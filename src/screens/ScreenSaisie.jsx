import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, FileSpreadsheet } from "lucide-react";
import { db } from "../lib/db";
import { COLORS, initials } from "../theme";
import { enregistrerNoteLocale } from "../lib/sync";

export default function ScreenSaisie({ classe, onRetour, onVoirExport, onGererEleves }) {
  const eleves = useLiveQuery(() => db.eleves.where("classe_id").equals(classe.id).sortBy("nom"), [classe.id]) ?? [];
  const matieres = useLiveQuery(() => db.matieres.toArray(), []) ?? [];
  const matieresBrutes = useLiveQuery(() => db.matieres.toArray(), []) ?? [];
const matieres = [...matieresBrutes].sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));
  const niveauxEval = useLiveQuery(
    () => db.niveaux_evaluations.where("niveau_id").equals(classe.niveau_id).toArray(),
    [classe.niveau_id]
  ) ?? [];

  const typesEvalAutorises = useMemo(() => {
    const actifs = new Set(niveauxEval.filter((n) => n.actif).map((n) => n.type_evaluation_id));
    return typesEvalTous.filter((t) => actifs.has(t.id));
  }, [typesEvalTous, niveauxEval]);

  const [typeEvalId, setTypeEvalId] = useState(null);
  const [matiereId, setMatiereId] = useState(null);
  const typeEval = typesEvalAutorises.find((t) => t.id === (typeEvalId ?? typesEvalAutorises[0]?.id));
  const matiere = matieres.find((m) => m.id === (matiereId ?? matieres[0]?.id));

  // Toutes les notes de la classe, filtrées côté client par évaluation/matière active.
  const toutesLesNotes = useLiveQuery(() => db.notes.toArray(), []) ?? [];
  const getNote = (eleveId) =>
    toutesLesNotes.find(
      (n) => n.eleve_id === eleveId && n.type_evaluation_id === typeEval?.id && n.matiere_id === matiere?.id
    );

  const [active, setActive] = useState(null);
  const filled = eleves.filter((e) => getNote(e.id)?.note_obtenue !== undefined && getNote(e.id)?.note_obtenue !== "").length;

  async function handleChange(eleveId, valeur) {
    const num = valeur === "" ? null : Number(valeur);
    if (valeur !== "" && Number.isNaN(num)) return;
    if (num !== null && (num < 0 || num > (matiere?.bareme_max ?? 20))) return;

    await enregistrerNoteLocale({
      eleve_id: eleveId,
      type_evaluation_id: typeEval.id,
      matiere_id: matiere.id,
      note_obtenue: num,
    });
  }

  if (!typeEval || !matiere) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
        Aucune donnée de référence chargée. Reconnecte-toi une fois en ligne.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-4" style={{ background: COLORS.chalk }}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onRetour}>
            <ArrowLeft size={18} color={COLORS.paper} />
          </button>
          <span className="text-xs opacity-60" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
            {classe.nom}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
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
          <select
            value={matiere.id}
            onChange={(e) => setMatiereId(e.target.value)}
            className="px-3 py-1.5 rounded-full text-xs outline-none"
            style={{ background: "#16291C", fontFamily: "Inter, sans-serif", color: COLORS.paper, border: "none" }}
          >
            {matieres.map((m) => (
              <option key={m.id} value={m.id} style={{ color: "#000" }}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-5 py-2.5 flex items-center justify-between text-xs sticky top-0 z-10" style={{ background: COLORS.paper, borderBottom: `1px solid ${COLORS.line}`, fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
        <span>{filled}/{eleves.length} saisies</span>
        <button onClick={onGererEleves} style={{ color: COLORS.ink, fontWeight: 600 }}>
          Gérer les élèves
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          {eleves.map((s) => {
            const note = getNote(s.id);
            const isActive = active === s.id;
            const hasValue = note?.note_obtenue !== null && note?.note_obtenue !== undefined;
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 px-3 py-3.5 rounded-xl"
                style={{
                  background: "#FFFEFA",
                  border: `1px solid ${isActive ? COLORS.ink : COLORS.line}`,
                  boxShadow: isActive ? `0 0 0 3px ${COLORS.ink}1A` : "none",
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: hasValue ? "#EAF0E9" : "#F1EFE6", color: hasValue ? "#3D6B4C" : COLORS.muted, fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 13 }}
                >
                  {initials(`${s.prenoms} ${s.nom}`)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 15, color: COLORS.text }}>
                    {s.nom} {s.prenoms}
                  </p>
                  <p style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: COLORS.muted }}>
                    N° {s.matricule}
                    {note && note.synced === 0 && <span style={{ color: COLORS.stamp }}> · en attente</span>}
                  </p>
                </div>

                <input
                  key={`${typeEval.id}-${matiere.id}-${s.id}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  defaultValue={note?.note_obtenue ?? ""}
                  onFocus={() => setActive(s.id)}
                  onBlur={(e) => {
                    setActive(null);
                    handleChange(s.id, e.target.value);
                  }}
                  className="text-center rounded-lg outline-none flex-shrink-0"
                  style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 18, fontWeight: 700, width: 56, height: 44, background: "#F6F4EC", border: `1.5px solid ${COLORS.line}`, color: COLORS.ink }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4 flex items-center justify-between" style={{ background: "#FFFEFA", borderTop: `1px solid ${COLORS.line}` }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: COLORS.muted }}>
          {filled}/{eleves.length} notes saisies
        </span>
        <button
          onClick={() => onVoirExport(typeEval)}
          className="px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5"
          style={{ background: COLORS.ink, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.paper }}
        >
          <FileSpreadsheet size={14} /> Voir l'export
        </button>
      </div>
    </div>
  );
}
