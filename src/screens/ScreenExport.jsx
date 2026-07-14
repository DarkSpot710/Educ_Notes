import React, { useState, useMemo } from "react";
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
  const matieresBrutes = useLiveQuery(() => db.matieres.toArray(), []) ?? [];
const matieres = [...matieresBrutes].sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));
  const typesEvalTous = useLiveQuery(() => db.types_evaluation.orderBy("ordre").toArray(), []) ?? [];
  const niveauxEval = useLiveQuery(
    () => db.niveaux_evaluations.where("niveau_id").equals(classe.niveau_id).toArray(),
    [classe.niveau_id]
  ) ?? [];
  const toutesLesNotes = useLiveQuery(() => db.notes.toArray(), []) ?? [];

  const typesEvalAutorises = useMemo(() => {
    const actifs = new Set(niveauxEval.filter((n) => n.actif).map((n) => n.type_evaluation_id));
    return typesEvalTous.filter((t) => actifs.has(t.id));
  }, [typesEvalTous, niveauxEval]);

  const [typeEvalId, setTypeEvalId] = useState(null);
  const typeEval = typesEvalAutorises.find((t) => t.id === (typeEvalId ?? typesEvalAutorises[0]?.id));

  const enAttente = toutesLesNotes.filter((n) => n.synced === 0).length;

  function getNote(eleveId, matiereId) {
    return toutesLesNotes.find(
      (n) => n.eleve_id === eleveId && n.type_evaluation_id === typeEval?.id && n.matiere_id === matiereId
    );
  }

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
        <h2 className="text-lg mt-1 pl-7 mb-3" style={{ fontFamily: "Fraunces, serif", fontWeight: 600, color: COLORS.paper }}>
          Aperçu du fichier
        </h2>

        {typeEval && (
          <div className="pl-7">
            <select
              value={typeEval.id}
              onChange={(e) => setTypeEvalId(e.target.value)}
              className="px-3 py-1.5 rounded-full text-xs outline-none"
              style={{ background: COLORS.stamp, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.paper, border: "none" }}
            >
              {typesEvalAutorises.map((t) => (
                <option key={t.id} value={t.id} style={{ color: "#000" }}>
                  {t.nom}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto relative">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet size={14} color={COLORS.muted} />
          <p className="text-xs" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
            {typesEvalAutorises.length} feuille(s) au total dans l'export — aperçu ci-dessous pour "{typeEval?.nom}"
          </p>
        </div>

        {enAttente > 0 && (
          <p className="text-xs mt-2" style={{ fontFamily: "Inter, sans-serif", color: COLORS.stamp }}>
            {enAttente} note(s) pas encore synchronisée(s) — incluse(s) quand même dans l'export local.
          </p>
        )}

        <div className="mt-3 rounded-lg overflow-x-auto" style={{ border: `1px solid ${COLORS.line}` }}>
          <table className="w-full" style={{ borderCollapse: "collapse", fontFamily: "Inter, sans-serif" }}>
            <thead>
              <tr style={{ background: "#EDE9DA" }}>
                <th className="text-left px-2 py-2 text-[10px] sticky left-0" style={{ background: "#EDE9DA", color: COLORS.muted, minWidth: 110 }}>
                  Élève
                </th>
                {matieres.map((m) => (
                  <th key={m.id} className="text-center px-2 py-2 text-[9px]" style={{ color: COLORS.muted, minWidth: 46 }}>
                    {m.nom}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eleves.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 ? "#FBFAF5" : "#FFFEFA", borderTop: `1px solid ${COLORS.line}` }}>
                  <td className="px-2 py-2 sticky left-0" style={{ background: i % 2 ? "#FBFAF5" : "#FFFEFA" }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EAF0E9", color: "#3D6B4C", fontWeight: 700, fontSize: 9 }}>
                        {initials(`${s.prenoms} ${s.nom}`)}
                      </div>
                      <span className="text-[11px] truncate" style={{ color: COLORS.text, maxWidth: 80 }}>
                        {s.nom}
                      </span>
                    </div>
                  </td>
                  {matieres.map((m) => {
                    const note = getNote(s.id, m.id);
                    const valeur = note?.note_obtenue;
                    return (
                      <td
                        key={m.id}
                        className="text-center text-[11px] px-2 py-2"
                        style={{
                          fontFamily: "IBM Plex Mono, monospace",
                          color: valeur !== null && valeur !== undefined ? COLORS.text : COLORS.line,
                          fontWeight: valeur !== null && valeur !== undefined ? 600 : 400,
                        }}
                      >
                        {valeur !== null && valeur !== undefined ? valeur : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs mt-4 opacity-70 leading-relaxed" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
          Une feuille par évaluation, regroupées dans un seul classeur — au format du ministère. Les cases "—" seront vides dans le fichier exporté.
        </p>

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
