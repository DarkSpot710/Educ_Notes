import Dexie from "dexie";

export const db = new Dexie("educmaster");

// v1 : session (token, rôle...), référentiels (matières, évaluations),
// classes/élèves assignés à la clé active, et les notes saisies localement.
// v1 : structure initiale (sans niveaux, ajoutée plus tard)
db.version(1).stores({
  session: "key",
  matieres: "id",
  types_evaluation: "id, ordre",
  niveaux_evaluations: "[niveau_id+type_evaluation_id]",
  classes: "id, ecole_id",
  eleves: "id, classe_id",
  notes: "localId, [eleve_id+type_evaluation_id+matiere_id], synced, updated_at",
});

// v2 : ajout du référentiel des niveaux (CI, CP, CE1...), nécessaire pour
// l'écran de création de classe. Dexie crée automatiquement le nouveau
// store sur les appareils qui avaient déjà la v1 en local.
db.version(2).stores({
  session: "key",
  niveaux: "id, ordre",
  matieres: "id",
  types_evaluation: "id, ordre",
  niveaux_evaluations: "[niveau_id+type_evaluation_id]",
  classes: "id, ecole_id",
  eleves: "id, classe_id",
  notes: "localId, [eleve_id+type_evaluation_id+matiere_id], synced, updated_at",
});

export async function getSession() {
  const rows = await db.session.toArray();
  const obj = {};
  rows.forEach((r) => (obj[r.key] = r.value));
  return obj;
}

export async function setSessionValue(key, value) {
  await db.session.put({ key, value });
}

export async function clearSession() {
  await db.session.clear();
}
