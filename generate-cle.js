// generate-cle.js
//
// Script d'administration pour générer une clé d'accès (enseignant ou directeur).
// À lancer depuis ta machine, jamais exposé côté client.
//
// Installation : npm install @supabase/supabase-js
// Variables d'env nécessaires : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Exemples d'utilisation :
//   node generate-cle.js --role=enseignant --ecole="EPP Sainte Rita"
//   node generate-cle.js --role=directeur --ecole="EPP Sainte Rita" --limite=6
//   node generate-cle.js --role=directeur --ecole="Groupe Scolaire ABC" --limite=15

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCle() {
  const part = () =>
    Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
  return `${part()}-${part()}`;
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input.trim().toUpperCase()).digest("hex");
}

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    args[key] = value;
  }
  return args;
}

async function main() {
  const { role, ecole, limite } = parseArgs();

  if (!role || !["enseignant", "directeur"].includes(role)) {
    console.error("❌ --role doit être 'enseignant' ou 'directeur'");
    process.exit(1);
  }
  if (!ecole) {
    console.error("❌ --ecole est requis (nom exact de l'école)");
    process.exit(1);
  }

  // Quota par défaut selon le rôle, sauf si --limite est précisé explicitement.
  const limiteParDefaut = role === "enseignant" ? 1 : 6;
  const limiteClasses = limite ? parseInt(limite, 10) : limiteParDefaut;

  if (Number.isNaN(limiteClasses) || limiteClasses < 1) {
    console.error("❌ --limite doit être un nombre entier positif");
    process.exit(1);
  }

  // 1. Trouver l'école
  const { data: ecoleRow, error: ecoleErr } = await supabase
    .from("ecoles")
    .select("id, nom")
    .eq("nom", ecole)
    .maybeSingle();

  if (ecoleErr || !ecoleRow) {
    console.error(`❌ École "${ecole}" introuvable. Crée-la d'abord dans la table 'ecoles'.`);
    process.exit(1);
  }

  // 2. Générer et hasher la clé
  const cle = generateCle();
  const cleHash = sha256Hex(cle);

  // 3. Insérer la clé, avec son quota de classes
  const { error: cleErr } = await supabase
    .from("cles_acces")
    .insert({
      cle_hash: cleHash,
      cle_visible: cle,
      role,
      ecole_id: ecoleRow.id,
      actif: true,
      limite_classes: limiteClasses,
    })
    .select("id")
    .single();

  if (cleErr) {
    console.error("❌ Erreur lors de la création de la clé :", cleErr.message);
    process.exit(1);
  }

  console.log("\n=================================");
  console.log(`École         : ${ecoleRow.nom}`);
  console.log(`Rôle          : ${role}`);
  console.log(`Classes max   : ${limiteClasses}`);
  console.log(`Clé d'accès   : ${cle}`);
  console.log("=================================");
  console.log("⚠️  Cette clé ne sera plus jamais affichée en clair. Note-la maintenant.\n");
  console.log("L'enseignant ou le directeur créera lui-même ses classes et ses élèves depuis l'app.\n");
}

main();
