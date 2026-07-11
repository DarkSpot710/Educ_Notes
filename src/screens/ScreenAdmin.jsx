import React, { useState } from "react";
import { KeySquare, Copy, Check } from "lucide-react";
import { COLORS } from "../theme";

const ADMIN_URL = import.meta.env.VITE_ADMIN_GENERATE_CLE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function ScreenAdmin() {
  const [adminSecret, setAdminSecret] = useState("");
  const [role, setRole] = useState("enseignant");
  const [ecole, setEcole] = useState("");
  const [limite, setLimite] = useState("");
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [copie, setCopie] = useState(false);

  async function handleGenerer() {
    if (!adminSecret || !ecole.trim()) {
      setErreur("Mot de passe admin et nom de l'école requis.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      const res = await fetch(ADMIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          adminSecret,
          role,
          ecole: ecole.trim(),
          limite: limite || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur inconnue");
      setResultat(data);
      setCopie(false);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  function copierCle() {
    navigator.clipboard.writeText(resultat.cle);
    setCopie(true);
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10" style={{ background: COLORS.chalk }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <KeySquare size={20} color={COLORS.paper} />
          <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 22, color: COLORS.paper }}>
            Administration
          </h1>
        </div>

        <label className="text-xs uppercase tracking-wide opacity-70" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
          Mot de passe admin
        </label>
        <input
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          className="w-full mt-2 mb-4 px-3 py-3 rounded-lg outline-none"
          style={{ fontFamily: "IBM Plex Mono, monospace", background: "#16291C", border: `1px solid ${COLORS.paper}33`, color: COLORS.paper }}
        />

        <label className="text-xs uppercase tracking-wide opacity-70" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
          Rôle de la clé
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full mt-2 mb-4 px-3 py-3 rounded-lg outline-none"
          style={{ fontFamily: "Inter, sans-serif", background: "#16291C", border: `1px solid ${COLORS.paper}33`, color: COLORS.paper }}
        >
          <option value="enseignant">Enseignant (1 classe)</option>
          <option value="directeur">Directeur (6 classes)</option>
        </select>

        <label className="text-xs uppercase tracking-wide opacity-70" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
          Nom de l'école (créée automatiquement si nouvelle)
        </label>
        <input
          value={ecole}
          onChange={(e) => setEcole(e.target.value)}
          placeholder="Ex: EPP Sainte Rita"
          className="w-full mt-2 mb-4 px-3 py-3 rounded-lg outline-none"
          style={{ fontFamily: "Inter, sans-serif", background: "#16291C", border: `1px solid ${COLORS.paper}33`, color: COLORS.paper }}
        />

        <label className="text-xs uppercase tracking-wide opacity-70" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
          Limite de classes (optionnel — sinon 1 ou 6 selon le rôle)
        </label>
        <input
          type="number"
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
          placeholder="Ex: 15 pour un groupe scolaire"
          className="w-full mt-2 mb-6 px-3 py-3 rounded-lg outline-none"
          style={{ fontFamily: "IBM Plex Mono, monospace", background: "#16291C", border: `1px solid ${COLORS.paper}33`, color: COLORS.paper }}
        />

        {erreur && (
          <p className="text-xs mb-4" style={{ fontFamily: "Inter, sans-serif", color: "#E5A48A" }}>
            {erreur}
          </p>
        )}

        <button
          onClick={handleGenerer}
          disabled={enCours}
          className="w-full py-3 rounded-lg disabled:opacity-60"
          style={{ background: COLORS.stamp, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.paper }}
        >
          {enCours ? "Génération…" : "Générer la clé"}
        </button>

        {resultat && (
          <div className="mt-6 rounded-xl p-4" style={{ background: "#FFFEFA", border: `2px dashed ${COLORS.stamp}` }}>
            <p className="text-xs" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
              {resultat.role} · {resultat.ecole} · {resultat.limite_classes} classe(s) max
            </p>
            <div className="flex items-center justify-between mt-2">
              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 22, fontWeight: 700, color: COLORS.ink, letterSpacing: "0.1em" }}>
                {resultat.cle}
              </span>
              <button onClick={copierCle}>
                {copie ? <Check size={18} color="#3D6B4C" /> : <Copy size={18} color={COLORS.muted} />}
              </button>
            </div>
            <p className="text-xs mt-2" style={{ fontFamily: "Inter, sans-serif", color: COLORS.stamp }}>
              Cette clé ne sera plus jamais affichée. Note-la maintenant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
