// supabase/functions/admin-generate-cle/index.ts
//
// Génère une clé d'accès depuis la page admin de l'app (pas de terminal requis).
// Protégée par un secret admin — jamais exposée publiquement.
//
// Déploiement : coller ce code dans une nouvelle fonction Edge nommée
// "admin-generate-cle" sur le dashboard Supabase.
//
// Secret nécessaire (Edge Functions > Secrets) :
//   ADMIN_SECRET  → un mot de passe que TOI seul connais

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET")!;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // pas de 0/O, 1/I/l

function generateCle(): string {
  const part = () =>
    Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `${part()}-${part()}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toUpperCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ error: "Corps de requête invalide" }), { status: 400 });
  }

  const { adminSecret, role, ecole, limite } = body;

  if (adminSecret !== ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Mot de passe admin incorrect" }), { status: 401 });
  }

  if (!role || !["enseignant", "directeur"].includes(role)) {
    return new Response(JSON.stringify({ error: "role doit être 'enseignant' ou 'directeur'" }), { status: 400 });
  }
  if (!ecole || typeof ecole !== "string") {
    return new Response(JSON.stringify({ error: "Nom d'école requis" }), { status: 400 });
  }

  const limiteClasses = limite ? parseInt(String(limite), 10) : role === "enseignant" ? 1 : 6;
  if (Number.isNaN(limiteClasses) || limiteClasses < 1) {
    return new Response(JSON.stringify({ error: "limite doit être un nombre positif" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Trouve l'école, ou la crée si elle n'existe pas encore.
  let { data: ecoleRow } = await supabase.from("ecoles").select("id, nom").eq("nom", ecole).maybeSingle();

  if (!ecoleRow) {
    const { data: nouvelleEcole, error: creationErr } = await supabase
      .from("ecoles")
      .insert({ nom: ecole })
      .select("id, nom")
      .single();

    if (creationErr) {
      return new Response(JSON.stringify({ error: "Impossible de créer l'école : " + creationErr.message }), {
        status: 500,
      });
    }
    ecoleRow = nouvelleEcole;
  }

  const cle = generateCle();
  const cleHash = await sha256Hex(cle);

  const { error: cleErr } = await supabase.from("cles_acces").insert({
    cle_hash: cleHash,
    cle_visible: cle,
    role,
    ecole_id: ecoleRow.id,
    actif: true,
    limite_classes: limiteClasses,
  });

  if (cleErr) {
    return new Response(JSON.stringify({ error: "Erreur lors de la création : " + cleErr.message }), {
      status: 500,
    });
  }

  return new Response(
    JSON.stringify({
      cle,
      role,
      ecole: ecoleRow.nom,
      ecole_nouvelle: !ecoleRow,
      limite_classes: limiteClasses,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
