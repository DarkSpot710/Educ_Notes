import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, School } from "lucide-react";
import { db, getSession } from "../lib/db";
import { COLORS } from "../theme";
import { creerClasse, compterClassesDeLaCle, pullClassesEtEleves } from "../lib/sync";

export default function ScreenCreerClasse({ onRetour, onClasseCreee }) {
  const niveaux = useLiveQuery(() => db.niveaux?.toArray?.() ?? [], []) ?? [];
  const [niveauId, setNiveauId] = useState("");
  const [nom, setNom] = useState("");
  const [anneeScolaire, setAnneeScolaire] = useState("2025-2026");
  const [quota, setQuota] = useState(null); // { utilisees, limite }
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      const utilisees = await compterClassesDeLaCle(session.cle_acces_id);
      setQuota({ utilisees, limite: session.limite_classes ?? null });
    })();
  }, []);

  async function handleSubmit() {
    if (!niveauId || !nom.trim()) {
      setErreur("Choisis un niveau et donne un nom à la classe.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const session = await getSession();
      const classe = await creerClasse({
        ecole_id: session.ecole_id,
        niveau_id: niveauId,
        nom: nom.trim(),
        annee_scolaire: anneeScolaire,
        cle_acces_id: session.cle_acces_id,
      });
      onClasseCreee(classe);
    } catch (e) {
      if (e.message?.includes("Quota")) {
        setErreur("Tu as atteint le nombre maximum de classes autorisées pour ta clé.");
      } else {
        setErreur(navigator.onLine ? e.message : "Connexion internet requise pour créer une classe.");
      }
    } finally {
      setEnCours(false);
    }
  }

  const quotaAtteint = quota && quota.limite !== null && quota.utilisees >= quota.limite;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-4 flex items-center gap-2" style={{ background: COLORS.chalk }}>
        <button onClick={onRetour}>
          <ArrowLeft size={18} color={COLORS.paper} />
        </button>
        <span className="text-lg" style={{ fontFamily: "Fraunces, serif", fontWeight: 600, color: COLORS.paper }}>
          Nouvelle classe
        </span>
      </div>

      <div className="flex-1 px-5 py-6">
        {quota && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg mb-5 text-xs"
            style={{ background: "#F1EFE6", fontFamily: "Inter, sans-serif", color: COLORS.muted }}
          >
            <School size={14} />
            {quota.limite ? `${quota.utilisees}/${quota.limite} classes créées` : `${quota.utilisees} classe(s) créée(s)`}
          </div>
        )}

        {quotaAtteint ? (
          <p className="text-sm" style={{ fontFamily: "Inter, sans-serif", color: COLORS.stamp }}>
            Tu as atteint le quota de classes autorisé pour ta clé. Contacte l'administrateur si tu as besoin d'un quota plus élevé.
          </p>
        ) : (
          <>
            <label className="text-xs uppercase tracking-wide" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
              Niveau
            </label>
            <select
              value={niveauId}
              onChange={(e) => setNiveauId(e.target.value)}
              className="w-full mt-2 mb-4 px-3 py-3 rounded-lg outline-none"
              style={{ fontFamily: "Inter, sans-serif", border: `1px solid ${COLORS.line}`, background: "#FFFEFA" }}
            >
              <option value="">— Choisir —</option>
              {niveaux.map((n) => (
                <option key={n.id} value={n.id}>{n.nom}</option>
              ))}
            </select>

            <label className="text-xs uppercase tracking-wide" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
              Nom de la classe
            </label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: CM2 A"
              className="w-full mt-2 mb-4 px-3 py-3 rounded-lg outline-none"
              style={{ fontFamily: "Inter, sans-serif", border: `1px solid ${COLORS.line}`, background: "#FFFEFA" }}
            />

            <label className="text-xs uppercase tracking-wide" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
              Année scolaire
            </label>
            <input
              value={anneeScolaire}
              onChange={(e) => setAnneeScolaire(e.target.value)}
              className="w-full mt-2 mb-6 px-3 py-3 rounded-lg outline-none"
              style={{ fontFamily: "IBM Plex Mono, monospace", border: `1px solid ${COLORS.line}`, background: "#FFFEFA" }}
            />

            {erreur && (
              <p className="text-xs mb-4" style={{ fontFamily: "Inter, sans-serif", color: COLORS.stamp }}>
                {erreur}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={enCours}
              className="w-full py-3 rounded-lg disabled:opacity-60"
              style={{ background: COLORS.stamp, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.paper }}
            >
              {enCours ? "Création…" : "Créer la classe"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
