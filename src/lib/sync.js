import { getSupabase } from "./supabaseClient";
import { db, getSession } from "./db";

// ---------- Descendant : référentiels fixes (rarement modifiés) ----------
export async function pullReferenceData() {
  const supabase = getSupabase();

  const { data: matieres } = await supabase.from("matieres").select("*");
  if (matieres) await db.matieres.bulkPut(matieres);

  const { data: typesEval } = await supabase.from("types_evaluation").select("*");
  if (typesEval) await db.types_evaluation.bulkPut(typesEval);

  const { data: niveauxEval } = await supabase.from("niveaux_evaluations").select("*");
  if (niveauxEval) await db.niveaux_evaluations.bulkPut(niveauxEval);
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

// À appeler une fois au démarrage de l'app pour retenter la sync
// automatiquement dès que le réseau revient.
export function ecouterRetourReseau() {
  window.addEventListener("online", () => {
    pousserNotesEnAttente().catch(() => {});
  });
}
