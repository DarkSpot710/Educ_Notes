import React, { useState } from "react";
import { Key, ChevronRight } from "lucide-react";
import { COLORS } from "../theme";
import { connecterAvecCle } from "../lib/auth";

export default function ScreenAcces({ onConnected }) {
  const [cle, setCle] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function handleSubmit() {
    if (!cle.trim()) return;
    setChargement(true);
    setErreur(null);
    try {
      const data = await connecterAvecCle(cle);
      onConnected(data);
    } catch (e) {
      setErreur(
        navigator.onLine
          ? e.message || "Clé invalide"
          : "Connexion internet requise pour la première connexion."
      );
    } finally {
      setChargement(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8"
      style={{ background: COLORS.chalk }}
    >
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0"
        style={{ width: 72, height: 72, border: `2px dashed ${COLORS.paper}99` }}
      >
        <span style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 24, color: COLORS.paper }}>
          EM
        </span>
      </div>

      <h1 className="mt-6 text-3xl text-center" style={{ fontFamily: "Fraunces, serif", fontWeight: 600, color: COLORS.paper }}>
        EducMaster
      </h1>
      <p className="mt-1 text-sm text-center opacity-70" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
        Carnet de notes numérique
      </p>

      <div className="w-full max-w-xs mt-10">
        <label className="text-xs uppercase tracking-wide opacity-70" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
          Clé d'accès
        </label>
        <div className="mt-2 flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: "#16291C", border: `1px solid ${COLORS.paper}33` }}>
          <Key size={16} color={COLORS.paper} opacity={0.6} />
          <input
            value={cle}
            onChange={(e) => setCle(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="XXXX-XXXX"
            className="bg-transparent outline-none w-full"
            style={{ fontFamily: "IBM Plex Mono, monospace", color: COLORS.paper, letterSpacing: "0.15em", fontSize: 15 }}
          />
        </div>
      </div>

      {erreur && (
        <p className="mt-3 text-xs text-center max-w-xs" style={{ fontFamily: "Inter, sans-serif", color: "#E5A48A" }}>
          {erreur}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={chargement}
        className="w-full max-w-xs mt-6 py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: COLORS.stamp, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.paper }}
      >
        {chargement ? "Vérification…" : "Entrer"} {!chargement && <ChevronRight size={16} />}
      </button>

      <p className="mt-6 text-xs text-center opacity-50 leading-relaxed max-w-xs" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
        Enseignant ou directeur — la clé détermine automatiquement votre niveau d'accès.
      </p>
    </div>
  );
}
