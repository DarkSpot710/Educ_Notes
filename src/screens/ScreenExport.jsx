import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { db } from "../lib/db";
import { COLORS, initials } from "../theme";
import { genererClasseurClasse } from "../lib/export";
import { pousserNotesEnAttente } from "../lib/sync";

export default function ScreenExport({ classe, onRetour }) {
  const [stamped, setStamped] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const eleves = useLiveQuery(() => db.eleves.where("classe_id").equals(classe.id).sortBy("nom"), [classe.id]) ?? [];
  const toutesLesNotes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const enAttente = toutesLesNotes.filter((n) => n.synced === 0).length;

  async function handleExport() {
    setEnCours(true);
    try {
      if (navigator.onLine) {
        await pousserNotesEnAttente().catch(() => {});
      }
      await genererClasseurClasse(classe.id);
      setStamped(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-4" style={{ background: COLORS.chalk }}>
        <div className="flex items-center gap-2 mb-1">
          <button onClick={onRetour}>
            <ArrowLeft size={18} color={COLORS.paper} />
          </button>
          <span className="text-xs opacity-60" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
            {classe.nom} · {classe.annee_scolaire}
          </span>
        </div>
        <h2 className="text-lg mt-1 pl-7" style={{ fontFamily: "Fraunces, serif", fontWeight: 600, color: COLORS.paper }}>
          Aperçu du fichier
        </h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto relative">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet size={14} color={COLORS.muted} />
          <p className="text-xs" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
            Une feuille par évaluation, au format ministère
          </p>
        </div>

        {enAttente > 0 && (
          <p className="text-xs mt-2" style={{ fontFamily: "Inter, sans-serif", color: COLORS.stamp }}>
            {enAttente} note(s) pas encore synchronisée(s) — sera(ont) inclue(s) dans l'export local quand même.
          </p>
        )}

        <div className="flex flex-col gap-2.5 mt-3">
          {eleves.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: "#FFFEFA", border: `1px solid ${COLORS.line}` }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EAF0E9", color: "#3D6B4C", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 12 }}>
                {initials(`${s.prenoms} ${s.nom}`)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 14, color: COLORS.text }}>
                  {s.nom} {s.prenoms}
                </p>
                <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: COLORS.muted }}>
                  N° {s.matricule}
                </p>
              </div>
            </div>
          ))}
        </div>

        {stamped && (
          <div
            className="absolute top-20 right-8 flex items-center justify-center rounded-full pointer-events-none"
            style={{ width: 110, height: 110, border: `3px solid ${COLORS.stamp}`, color: COLORS.stamp, transform: "rotate(-14deg)" }}
          >
            <span className="text-center text-[11px] leading-tight uppercase" style={{ fontFamily: "IBM Plex Mono, monospace", fontWeight: 700 }}>
              Fichier
              <br />✓ généré
            </span>
          </div>
        )}
      </div>

      <div className="px-5 py-4" style={{ background: "#FFFEFA", borderTop: `1px solid ${COLORS.line}` }}>
        <button
          onClick={handleExport}
          disabled={enCours}
          className="w-full py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: COLORS.stamp, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.paper }}
        >
          <Download size={16} />
          {enCours ? "Génération…" : "Télécharger le fichier Excel"}
        </button>
      </div>
    </div>
  );
}
