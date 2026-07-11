import React, { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Plus, Trash2, Check, Upload, ArrowRight } from "lucide-react";
import { db } from "../lib/db";
import { COLORS, initials } from "../theme";
import { ajouterEleves, supprimerEleve } from "../lib/sync";
import { parserFichierEleves } from "../lib/export";

export default function ScreenAjoutEleves({ classe, onRetour, onAllerSaisie }) {
  const elevesExistants = useLiveQuery(() => db.eleves.where("classe_id").equals(classe.id).sortBy("nom"), [classe.id]) ?? [];

  const [brouillon, setBrouillon] = useState([{ matricule: "", nom: "", prenoms: "" }]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(null);
  const fileInputRef = useRef(null);

  function updateLigne(i, champ, valeur) {
    const copie = [...brouillon];
    copie[i][champ] = valeur;
    setBrouillon(copie);
  }

  function ajouterLigne() {
    setBrouillon([...brouillon, { matricule: "", nom: "", prenoms: "" }]);
  }

  function retirerLigne(i) {
    setBrouillon(brouillon.filter((_, idx) => idx !== i));
  }

  async function handleImportFichier(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErreur(null);
    try {
      const importes = await parserFichierEleves(file);
      if (!importes.length) {
        setErreur("Aucun élève reconnu dans ce fichier. Vérifie qu'il a des colonnes Matricule/Nom/Prénoms.");
        return;
      }
      // Remplace le brouillon vide par les lignes importées, prêtes à vérifier avant enregistrement.
      setBrouillon(importes);
      setSucces(`${importes.length} élève(s) importé(s) du fichier — vérifie puis enregistre.`);
    } catch (err) {
      setErreur("Impossible de lire ce fichier. Formats acceptés : .xlsx, .xls, .csv");
    } finally {
      e.target.value = "";
    }
  }

  async function handleEnregistrer() {
    const valides = brouillon.filter((e) => e.matricule.trim() && e.nom.trim() && e.prenoms.trim());
    if (!valides.length) {
      setErreur("Remplis au moins une ligne complète (matricule, nom, prénoms).");
      return;
    }
    setEnCours(true);
    setErreur(null);
    setSucces(null);
    try {
      await ajouterEleves(classe.id, valides);
      setSucces(`${valides.length} élève(s) ajouté(s).`);
      setBrouillon([{ matricule: "", nom: "", prenoms: "" }]);
    } catch (e) {
      setErreur(
        navigator.onLine
          ? e.message?.includes("duplicate") || e.message?.includes("unique")
            ? "Un matricule est déjà utilisé dans cette classe."
            : e.message
          : "Connexion internet requise pour ajouter des élèves."
      );
    } finally {
      setEnCours(false);
    }
  }

  async function handleSupprimer(eleveId) {
    if (!window.confirm("Supprimer cet élève et toutes ses notes ? Cette action est irréversible.")) return;
    setSuppressionEnCours(eleveId);
    try {
      await supprimerEleve(eleveId, classe.id);
    } catch (e) {
      setErreur(navigator.onLine ? e.message : "Connexion internet requise pour supprimer un élève.");
    } finally {
      setSuppressionEnCours(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-4 flex items-center gap-2" style={{ background: COLORS.chalk }}>
        <button onClick={onRetour}>
          <ArrowLeft size={18} color={COLORS.paper} />
        </button>
        <div className="flex-1">
          <span className="text-lg block" style={{ fontFamily: "Fraunces, serif", fontWeight: 600, color: COLORS.paper }}>
            Ajouter des élèves
          </span>
          <span className="text-xs opacity-60" style={{ fontFamily: "Inter, sans-serif", color: COLORS.paper }}>
            {classe.nom} · {elevesExistants.length} déjà inscrit(s)
          </span>
        </div>
        {onAllerSaisie && elevesExistants.length > 0 && (
          <button
            onClick={onAllerSaisie}
            className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg"
            style={{ background: COLORS.stamp, color: COLORS.paper, fontFamily: "Inter, sans-serif", fontWeight: 600 }}
          >
            Saisir les notes <ArrowRight size={13} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleImportFichier}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-lg"
          style={{ background: "#F1EFE6", border: `1.5px dashed ${COLORS.line}`, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.ink, fontSize: 13 }}
        >
          <Upload size={15} /> Importer depuis un fichier (.xlsx, .csv)
        </button>

        <div className="flex flex-col gap-3">
          {brouillon.map((ligne, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-3 rounded-xl" style={{ background: "#FFFEFA", border: `1px solid ${COLORS.line}` }}>
              <input
                value={ligne.matricule}
                onChange={(e) => updateLigne(i, "matricule", e.target.value)}
                placeholder="Matricule"
                className="outline-none px-2 py-1.5 rounded"
                style={{ width: 90, fontFamily: "IBM Plex Mono, monospace", fontSize: 12, background: "#F6F4EC", border: `1px solid ${COLORS.line}` }}
              />
              <input
                value={ligne.nom}
                onChange={(e) => updateLigne(i, "nom", e.target.value)}
                placeholder="Nom"
                className="outline-none px-2 py-1.5 rounded flex-1 min-w-0"
                style={{ fontFamily: "Inter, sans-serif", fontSize: 14, background: "#F6F4EC", border: `1px solid ${COLORS.line}` }}
              />
              <input
                value={ligne.prenoms}
                onChange={(e) => updateLigne(i, "prenoms", e.target.value)}
                placeholder="Prénoms"
                className="outline-none px-2 py-1.5 rounded flex-1 min-w-0"
                style={{ fontFamily: "Inter, sans-serif", fontSize: 14, background: "#F6F4EC", border: `1px solid ${COLORS.line}` }}
              />
              <button onClick={() => retirerLigne(i)} disabled={brouillon.length === 1}>
                <Trash2 size={16} color={COLORS.muted} opacity={brouillon.length === 1 ? 0.3 : 1} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={ajouterLigne}
          className="flex items-center gap-1.5 mt-3 text-xs"
          style={{ fontFamily: "Inter, sans-serif", color: COLORS.ink, fontWeight: 600 }}
        >
          <Plus size={14} /> Ajouter une ligne
        </button>

        {elevesExistants.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide mb-2" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
              Déjà dans la classe
            </p>
            <div className="flex flex-col gap-2">
              {elevesExistants.map((el) => (
                <div key={el.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#F1EFE6" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#EAF0E9", color: "#3D6B4C", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 10 }}>
                    {initials(`${el.prenoms} ${el.nom}`)}
                  </div>
                  <span className="text-xs" style={{ fontFamily: "Inter, sans-serif", color: COLORS.text }}>
                    {el.nom} {el.prenoms}
                  </span>
                  <span className="text-xs ml-auto mr-2" style={{ fontFamily: "IBM Plex Mono, monospace", color: COLORS.muted }}>
                    {el.matricule}
                  </span>
                  <button onClick={() => handleSupprimer(el.id)} disabled={suppressionEnCours === el.id}>
                    <Trash2 size={14} color={COLORS.stamp} opacity={suppressionEnCours === el.id ? 0.4 : 1} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4" style={{ background: "#FFFEFA", borderTop: `1px solid ${COLORS.line}` }}>
        {erreur && (
          <p className="text-xs mb-2" style={{ fontFamily: "Inter, sans-serif", color: COLORS.stamp }}>
            {erreur}
          </p>
        )}
        {succes && (
          <p className="text-xs mb-2 flex items-center gap-1" style={{ fontFamily: "Inter, sans-serif", color: "#3D6B4C" }}>
            <Check size={12} /> {succes}
          </p>
        )}
        <button
          onClick={handleEnregistrer}
          disabled={enCours}
          className="w-full py-3 rounded-lg disabled:opacity-60"
          style={{ background: COLORS.stamp, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.paper }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer les élèves"}
        </button>
      </div>
    </div>
  );
}
