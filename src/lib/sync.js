import { getSupabase } from "./supabaseClient";
import { db, getSession } from "./db";

// ---------- Descendant : référentiels fixes (rarement modifiés) ----------
export async function pullReferenceData() {
  const supabase = getSupabase();
  const erreurs = [];

  const { data: niveaux, error: niveauxErr } = await supabase.from("niveaux").select("*");
  if (niveauxErr) erreurs.push(`niveaux: ${niveauxErr.message}`);
  if (niveaux) await db.niveaux.bulkPut(niveaux);

  const { data: matieres, error: matieresErr } = await supabase.from("matieres").select("*");
  if (matieresErr) erreurs.push(`matieres: ${matieresErr.message}`);
  if (matieres) await db.matieres.bulkPut(matieres);

  const { data: typesEval, error: typesEvalErr } = await supabase.from("types_evaluation").select("*");
  if (typesEvalErr) erreurs.push(`types_evaluation: ${typesEvalErr.message}`);
  if (typesEval) await db.types_evaluation.bulkPut(typesEval);

  const { data: niveauxEval, error: niveauxEvalErr } = await supabase.from("niveaux_evaluations").select("*");
  if (niveauxEvalErr) erreurs.push(`niveaux_evaluations: ${niveauxEvalErr.message}`);
  if (niveauxEval) await db.niveaux_evaluations.bulkPut(niveauxEval);

  const resume = {
    niveaux: niveaux?.length ?? 0,
    matieres: matieres?.length ?? 0,
    types_evaluation: typesEval?.length ?? 0,
    niveaux_evaluations: niveauxEval?.length ?? 0,
    erreurs,
  };

  if (erreurs.length) console.error("pullReferenceData erreurs:", erreurs);
  return resume;
}

// ---------- Descendant : classes + élèves assignés à la clé active ----------
export async function pullClassesEtEleves() {
  const supabase = getSupabase();

  const { data: classes, error: classesErr } = await supabase
    .from("classes")
    .select("id, ecole_id, niveau_id, nom, annee_scolaire");

  if (classesErr) throw classesErr;
  if (classes?.length) await db.classes.bulkPut(classes);

  if (classes?.length) {
    const classeIds = classes.map((c) => c.id);
    const { data: eleves, error: elevesErr } = await supabase
      .from("eleves")
      .select("id, classe_id, matricule, nom, prenoms")
      .in("classe_id", classeIds);

    if (elevesErr) throw elevesErr;
    if (eleves?.length) await db.eleves.bulkPut(eleves);
  }

  return classes ?? [];
}
// Récupère depuis Supabase les notes déjà saisies pour les élèves d'une
// classe (peu importe l'appareil qui les a saisies), et les fusionne dans
// le cache local — sans jamais écraser une saisie locale pas encore
// envoyée (pending), pour ne pas perdre de travail en cours.
export async function pullNotesClasse(classeId) {
  const supabase = getSupabase();

  const eleves = await db.eleves.where("classe_id").equals(classeId).toArray();
  const eleveIds = eleves.map((e) => e.id);
  if (!eleveIds.length) return;

  const { data: notesServeur, error } = await supabase
    .from("notes")
    .select("*")
    .in("eleve_id", eleveIds);

  if (error) throw error;
  if (!notesServeur) return;

  for (const n of notesServeur) {
    const localId = `${n.eleve_id}_${n.type_evaluation_id}_${n.matiere_id}`;
    const local = await db.notes.get(localId);

    // Ne jamais écraser une modification locale pas encore synchronisée.
    if (local && local.synced === 0) continue;

    await db.notes.put({
      localId,
      eleve_id: n.eleve_id,
      type_evaluation_id: n.type_evaluation_id,
      matiere_id: n.matiere_id,
      note_obtenue: n.note_obtenue,
      synced: 1,
      updated_at: n.updated_at,
    });
  }
}

// ---------- Écriture locale (toujours en premier, online ou offline) ----------
export async function enregistrerNoteLocale({ eleve_id, type_evaluation_id, matiere_id, note_obtenue }) {
  const localId = `${eleve_id}_${type_evaluation_id}_${matiere_id}`;
  await db.notes.put({
    localId,
    eleve_id,
    type_evaluation_id,
    matiere_id,
    note_obtenue,
    synced: 0,
    updated_at: new Date().toISOString(),
  });

  // Tentative de sync immédiate si on est en ligne — sans bloquer l'UI.
  if (navigator.onLine) {
    pousserNotesEnAttente().catch(() => {
      // échec silencieux : la note reste marquée 'en attente' et sera
      // retentée au prochain déclenchement (retour réseau, etc.)
    });
  }
}

// ---------- Montant : pousse les notes en attente vers Supabase ----------
export async function pousserNotesEnAttente() {
  const enAttente = await db.notes.where("synced").equals(0).toArray();
  if (!enAttente.length) return { pushed: 0, failed: 0 };

  const supabase = getSupabase();
  const session = await getSession();

  let pushed = 0;
  let failed = 0;

  for (const note of enAttente) {
    const { error } = await supabase.from("notes").upsert(
      {
        eleve_id: note.eleve_id,
        type_evaluation_id: note.type_evaluation_id,
        matiere_id: note.matiere_id,
        note_obtenue: note.note_obtenue,
        cle_acces_id: session.cle_acces_id,
        updated_at: note.updated_at,
      },
      { onConflict: "eleve_id,type_evaluation_id,matiere_id" }
    );

    if (error) {
      failed += 1;
      continue;
    }
    await db.notes.update(note.localId, { synced: 1 });
    pushed += 1;
  }

  return { pushed, failed };
}

// ---------- Création d'une classe (nécessite d'être en ligne) ----------
// Le quota (limite_classes) est vérifié côté serveur par un trigger Postgres,
// donc même si le client a un bug, impossible de le contourner.
export async function creerClasse({ ecole_id, niveau_id, nom, annee_scolaire, cle_acces_id }) {
  const supabase = getSupabase();

  const { data: classe, error: classeErr } = await supabase
    .from("classes")
    .insert({ ecole_id, niveau_id, nom, annee_scolaire })
    .select()
    .single();

  if (classeErr) throw classeErr;

  const { error: liaisonErr } = await supabase
    .from("enseignants_classes")
    .insert({ cle_acces_id, classe_id: classe.id });

  if (liaisonErr) {
    // La classe a été créée mais pas liée (ex: quota dépassé) — on la supprime
    // pour ne pas laisser une classe orpheline inaccessible.
    await supabase.from("classes").delete().eq("id", classe.id);
    throw liaisonErr;
  }

  await db.classes.put(classe);
  return classe;
}

// Combien de classes cette clé a-t-elle déjà créées (pour afficher le quota
// restant avant même d'essayer, en plus de la vérification serveur).
export async function compterClassesDeLaCle(cle_acces_id) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("enseignants_classes")
    .select("*", { count: "exact", head: true })
    .eq("cle_acces_id", cle_acces_id);
  if (error) throw error;
  return count ?? 0;
}

// ---------- Ajout d'élèves à une classe (nécessite d'être en ligne) ----------
export async function ajouterEleves(classeId, listeEleves) {
  // listeEleves = [{ matricule, nom, prenoms }, ...]
  const supabase = getSupabase();

  const rows = listeEleves.map((e) => ({
    classe_id: classeId,
    matricule: e.matricule.trim(),
    nom: e.nom.trim(),
    prenoms: e.prenoms.trim(),
  }));

  const { data, error } = await supabase.from("eleves").insert(rows).select();
  if (error) throw error;

  await db.eleves.bulkPut(data);
  return data;
}

// ---------- Suppression (nécessite d'être en ligne) ----------
export async function supprimerClasse(classeId) {
  const supabase = getSupabase();
  const { error } = await supabase.from("classes").delete().eq("id", classeId);
  if (error) throw error;
  await db.classes.delete(classeId);
  await db.eleves.where("classe_id").equals(classeId).delete();
}

export async function supprimerEleve(eleveId, classeId) {
  const supabase = getSupabase();
  const { error } = await supabase.from("eleves").delete().eq("id", eleveId);
  if (error) throw error;
  await db.eleves.delete(eleveId);
}

// À appeler une fois au démarrage de l'app pour retenter la sync
// automatiquement dès que le réseau revient.
export function ecouterRetourReseau() {
  window.addEventListener("online", () => {
    pousserNotesEnAttente().catch(() => {});
  });

  // Retente aussi toutes les 20 secondes pendant que l'app est ouverte —
  // utile si le réseau est instable (le navigateur croit être en ligne
  // mais les requêtes échouent quand même).
  setInterval(() => {
    if (navigator.onLine) {
      pousserNotesEnAttente().catch(() => {});
    }
  }, 20000);
}

// Nombre de notes en attente de synchronisation, pour affichage global.
export async function compterNotesEnAttente() {
  return db.notes.where("synced").equals(0).count();
}
