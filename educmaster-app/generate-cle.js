// generate-cle.js
//
// Script d'administration pour générer une clé d'accès (enseignant ou directeur).
// À lancer depuis ta machine, jamais exposé côté client.
//
// Installation : npm install @supabase/supabase-js
// Variables d'env nécessaires : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Exemples d'utilisation :
//   node generate-cle.js --role=directeur --ecole="EPP Sainte Rita"
//   node generate-cle.js --role=enseignant --ecole="EPP Sainte Rita" --classes="CM2 A,CM1 A"

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Alphabet sans caractères ambigus (pas de 0/O, 1/I/l)
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
  const { role, ecole, classes } = parseArgs();

  if (!role || !["enseignant", "directeur"].includes(role)) {
    console.error("❌ --role doit être 'enseignant' ou 'directeur'");
    process.exit(1);
  }
  if (!ecole) {
    console.error("❌ --ecole est requis (nom exact de l'école)");
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

  // 3. Insérer la clé
  const { data: cleRow, error: cleErr } = await supabase
    .from("cles_acces")
    .insert({
      cle_hash: cleHash,
      cle_visible: cle,
      role,
      ecole_id: ecoleRow.id,
      actif: true,
    })
    .select("id")
    .single();

  if (cleErr) {
    console.error("❌ Erreur lors de la création de la clé :", cleErr.message);
    process.exit(1);
  }

  // 4. Si enseignant, assigner les classes fournies
  if (role === "enseignant" && classes) {
    const nomsClasses = classes.split(",").map((c) => c.trim());

    const { data: classesRows, error: classesErr } = await supabase
      .from("classes")
      .select("id, nom")
      .eq("ecole_id", ecoleRow.id)
      .in("nom", nomsClasses);

    if (classesErr || !classesRows?.length) {
      console.warn("⚠️  Aucune classe trouvée pour les noms fournis — clé créée sans classe assignée.");
    } else {
      const liaisons = classesRows.map((c) => ({
        cle_acces_id: cleRow.id,
        classe_id: c.id,
      }));
      const { error: liaisonErr } = await supabase.from("enseignants_classes").insert(liaisons);
      if (liaisonErr) {
        console.warn("⚠️  Erreur lors de l'assignation des classes :", liaisonErr.message);
      } else {
        console.log(`✅ Classes assignées : ${classesRows.map((c) => c.nom).join(", ")}`);
      }
    }
  }

  console.log("\n=================================");
  console.log(`École        : ${ecoleRow.nom}`);
  console.log(`Rôle         : ${role}`);
  console.log(`Clé d'accès  : ${cle}`);
  console.log("=================================");
  console.log("⚠️  Cette clé ne sera plus jamais affichée en clair. Note-la maintenant.\n");
}

main();
