import * as XLSX from "xlsx";
import { db } from "./db";
// Génère le classeur Excel pour une classe : une feuille par évaluation
// autorisée pour son niveau, avec colonnes "Note obtenue" / "Note perfectionnement"
// par matière, dans le format attendu par le ministère.
export async function genererClasseurClasse(classeId) {
  const classe = await db.classes.get(classeId);
  if (!classe) throw new Error("Classe introuvable");

  const eleves = await db.eleves.where("classe_id").equals(classeId).sortBy("nom");
  const matieres = await db.matieres.toArray();
  const typesEval = await db.types_evaluation.orderBy("ordre").toArray();

  const niveauxEval = await db.niveaux_evaluations
    .where("niveau_id")
    .equals(classe.niveau_id)
    .toArray();
  const evalsAutorisees = new Set(
    niveauxEval.filter((n) => n.actif).map((n) => n.type_evaluation_id)
  );

  const workbook = XLSX.utils.book_new();

  for (const typeEval of typesEval) {
    if (!evalsAutorisees.has(typeEval.id)) continue; // ex: CI sans formatives

    const header = ["Matricule", "Nom", "Prénoms"];
    matieres.forEach((m) => header.push(`${m.nom} - Note obtenue`, `${m.nom} - Note perfectionnement`));

    const rows = [header];

    for (const eleve of eleves) {
      const row = [`'${eleve.matricule}`, eleve.nom, eleve.prenoms]; // apostrophe = forcé en texte

      for (const matiere of matieres) {
        const note = await db.notes
          .where("[eleve_id+type_evaluation_id+matiere_id]")
          .equals([eleve.id, typeEval.id, matiere.id])
          .first();

        row.push(note?.note_obtenue ?? "", matiere.bareme_max);
      }
      rows.push(row);
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    // Nom de feuille limité à 31 caractères par Excel
    const sheetName = typeEval.nom.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  const fileName = `notes_${classe.nom.replace(/\s+/g, "_")}_${classe.annee_scolaire}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

// Lit un fichier .xlsx/.csv envoyé par l'utilisateur et en extrait une liste
// d'élèves. Accepte des en-têtes variés (Matricule/N°, Nom, Prénoms/Prénom),
// insensible à la casse — pour pouvoir réutiliser directement le fichier
// du ministère ou une liste maison.
export async function parserFichierEleves(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const feuille = workbook.Sheets[workbook.SheetNames[0]];
  const lignes = XLSX.utils.sheet_to_json(feuille, { defval: "" });

  function trouverColonne(ligne, candidats) {
    const cles = Object.keys(ligne);
    for (const candidat of candidats) {
      const trouve = cles.find((k) => k.toLowerCase().trim().includes(candidat));
      if (trouve) return trouve;
    }
    return null;
  }

  const eleves = [];
  for (const ligne of lignes) {
    const colMatricule = trouverColonne(ligne, ["matricule", "n°", "numero"]);
    const colNom = trouverColonne(ligne, ["nom"]);
    const colPrenoms = trouverColonne(ligne, ["prénom", "prenom"]);

    const matricule = colMatricule ? String(ligne[colMatricule]).replace(/^'/, "").trim() : "";
    const nom = colNom ? String(ligne[colNom]).trim() : "";
    const prenoms = colPrenoms ? String(ligne[colPrenoms]).trim() : "";

    if (matricule && nom) {
      eleves.push({ matricule, nom, prenoms: prenoms || "-" });
    }
  }

  return eleves;
}
