import { setAuthToken } from "./supabaseClient";
import { db, setSessionValue, clearSession, getSession } from "./db";
import { pullReferenceData, pullClassesEtEleves } from "./sync";

const VERIFY_CLE_URL = import.meta.env.VITE_VERIFY_CLE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Appelée quand l'utilisateur saisit sa clé sur l'écran d'accès.
// Nécessite d'être en ligne (une seule fois, à la connexion initiale).
export async function connecterAvecCle(cle) {
  const res = await fetch(VERIFY_CLE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ cle }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Clé invalide");
  }

  const data = await res.json();

  setAuthToken(data.token);
  await setSessionValue("token", data.token);
  await setSessionValue("cle_acces_id", data.cle_acces_id);
  await setSessionValue("role", data.role);
  await setSessionValue("ecole_id", data.ecole_id);
  await setSessionValue("limite_classes", data.limite_classes);
  await setSessionValue("connecte_le", new Date().toISOString());

  // Télécharge tout ce qu'il faut pour travailler hors-ligne ensuite.
  await pullReferenceData();
  await pullClassesEtEleves();

  return data;
}

// À appeler au démarrage de l'app : restaure la session locale si elle existe,
// sans nécessiter de réseau.
export async function restaurerSession() {
  const session = await getSession();
  if (session.token) {
    setAuthToken(session.token);
    return session;
  }
  return null;
}

export async function deconnecter() {
  setAuthToken(null);
  await clearSession();
  await db.classes.clear();
  await db.eleves.clear();
}
