import Dexie from "dexie";

export const db = new Dexie("educmaster");

// v1 : session (token, rôle...), référentiels (matières, évaluations),
// classes/élèves assignés à la clé active, et les notes saisies localement.
db.version(1).stores({
  session: "key",
  matieres: "id",
  types_evaluation: "id, ordre",
  niveaux_evaluations: "[niveau_id+type_evaluation_id]",
  classes: "id, ecole_id",
  eleves: "id, classe_id",
  // clé locale = combinaison unique élève/évaluation/matière.
  // 'synced' = 0 (en attente) ou 1 (confirmé côté serveur).
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
