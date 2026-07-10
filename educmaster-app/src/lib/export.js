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
