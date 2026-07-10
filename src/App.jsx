import React, { useEffect, useState } from "react";
import { restaurerSession, deconnecter } from "./lib/auth";
import { ecouterRetourReseau, pousserNotesEnAttente } from "./lib/sync";
import ScreenAcces from "./screens/ScreenAcces";
import ScreenClasses from "./screens/ScreenClasses";
import ScreenSaisie from "./screens/ScreenSaisie";
import ScreenExport from "./screens/ScreenExport";
import ScreenCreerClasse from "./screens/ScreenCreerClasse";
import ScreenAjoutEleves from "./screens/ScreenAjoutEleves";
import ScreenAdmin from "./screens/ScreenAdmin";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = en cours de chargement
  const [ecran, setEcran] = useState("classes");
  const [classeActive, setClasseActive] = useState(null);
  const [evalActive, setEvalActive] = useState(null);

  // Page admin séparée, accessible via l'URL ?admin=1 — jamais mêlée
  // au flux enseignant/directeur normal.
  const estPageAdmin = new URLSearchParams(window.location.search).get("admin") === "1";

  useEffect(() => {
    if (estPageAdmin) return; // pas besoin de session pour la page admin
    restaurerSession().then((s) => setSession(s));
    ecouterRetourReseau();
    pousserNotesEnAttente().catch(() => {});
  }, [estPageAdmin]);

  if (estPageAdmin) {
    return <ScreenAdmin />;
  }

  if (session === undefined) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif" }}>Chargement…</div>;
  }

  if (!session) {
    return <ScreenAcces onConnected={(s) => setSession(s)} />;
  }

  return (
    <div className="min-h-screen">
      {ecran === "classes" && (
        <ScreenClasses
          onOpenClasse={(classe) => {
            setClasseActive(classe);
            setEcran("saisie");
          }}
          onCreerClasse={() => setEcran("creerClasse")}
          onDeconnecter={async () => {
            await deconnecter();
            setSession(null);
          }}
        />
      )}

      {ecran === "creerClasse" && (
        <ScreenCreerClasse
          onRetour={() => setEcran("classes")}
          onClasseCreee={(classe) => {
            setClasseActive(classe);
            setEcran("ajoutEleves");
          }}
        />
      )}

      {ecran === "ajoutEleves" && classeActive && (
        <ScreenAjoutEleves classe={classeActive} onRetour={() => setEcran("classes")} />
      )}

      {ecran === "saisie" && classeActive && (
        <ScreenSaisie
          classe={classeActive}
          onRetour={() => setEcran("classes")}
          onVoirExport={(typeEval) => {
            setEvalActive(typeEval);
            setEcran("export");
          }}
          onGererEleves={() => setEcran("ajoutEleves")}
        />
      )}

      {ecran === "export" && classeActive && (
        <ScreenExport classe={classeActive} onRetour={() => setEcran("saisie")} />
      )}
    </div>
  );
}
