// supabase/functions/verify-cle/index.ts
//
// Vérifie une clé d'accès (enseignant/directeur) et retourne un JWT
// contenant le claim `cle_acces_id`, utilisé ensuite par les policies RLS.
//
// Déploiement : supabase functions deploy verify-cle
// Variables d'env nécessaires (Supabase secrets) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create as createJwt, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET")!;

// Durée de validité longue car l'app doit rester utilisable hors-ligne
// pendant des semaines sans repasser par cette fonction.
const TOKEN_VALIDITY_DAYS = 90;

// Limite de tentatives simples par IP pour freiner le brute-force
// (en prod, préférer une vraie solution de rate-limiting, ex: Upstash).
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), { status: 405 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Trop de tentatives, réessayez dans quelques minutes." }),
      { status: 429 }
    );
  }

  const { cle } = await req.json().catch(() => ({ cle: null }));
  if (!cle || typeof cle !== "string") {
    return new Response(JSON.stringify({ error: "Clé manquante" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const cleHash = await sha256Hex(cle.trim().toUpperCase());

  const { data: cleAcces, error } = await supabase
    .from("cles_acces")
    .select("id, role, ecole_id, actif")
    .eq("cle_hash", cleHash)
    .maybeSingle();

  if (error || !cleAcces || !cleAcces.actif) {
    return new Response(JSON.stringify({ error: "Clé invalide ou désactivée" }), { status: 401 });
  }

  // Classes assignées (pertinent surtout pour un enseignant)
  const { data: classes } = await supabase
    .from("enseignants_classes")
    .select("classe_id, classes(nom, niveau_id)")
    .eq("cle_acces_id", cleAcces.id);

  const key = new TextEncoder().encode(JWT_SECRET);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await createJwt(
    { alg: "HS256", typ: "JWT" },
    {
      role: "authenticated",
      cle_acces_id: cleAcces.id,
      cle_role: cleAcces.role,
      ecole_id: cleAcces.ecole_id,
      exp: getNumericDate(TOKEN_VALIDITY_DAYS * 24 * 60 * 60),
    },
    cryptoKey
  );

  return new Response(
    JSON.stringify({
      token: jwt,
      cle_acces_id: cleAcces.id,
      role: cleAcces.role,
      ecole_id: cleAcces.ecole_id,
      classes: classes ?? [],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
