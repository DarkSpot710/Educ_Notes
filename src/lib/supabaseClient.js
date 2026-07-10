import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let currentToken = null;
let client = buildClient();

function buildClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: currentToken ? { headers: { Authorization: `Bearer ${currentToken}` } } : {},
    auth: { persistSession: false },
  });
}

// À appeler après verify-cle avec le JWT reçu, ou avec null pour déconnecter.
export function setAuthToken(token) {
  currentToken = token;
  client = buildClient();
}

// Toujours passer par cette fonction plutôt que d'importer un client figé,
// pour être sûr d'avoir le token à jour dans les requêtes.
export function getSupabase() {
  return client;
}
