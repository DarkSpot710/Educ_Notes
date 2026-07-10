import React, { useEffect, useState } from "react";
import { restaurerSession, deconnecter } from "./lib/auth";
import { ecouterRetourReseau, pousserNotesEnAttente } from "./lib/sync";
import ScreenAcces from "./screens/ScreenAcces";
import ScreenClasses from "./screens/ScreenClasses";
import ScreenSaisie from "./screens/ScreenSaisie";
import ScreenExport from "./screens/ScreenExport";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = en cours de chargement
  const [ecran, setEcran] = useState("classes");
  const [classeActive, setClasseActive] = useState(null);
  const [evalActive, setEvalActive] = useState(null);

  useEffect(() => {
    restaurerSession().then((s) => setSession(s));
    ecouterRetourReseau();
    pousserNotesEnAttente().catch(() => {});
  }, []);

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
          onDeconnecter={async () => {
            await deconnecter();
            setSession(null);
          }}
        />
      )}

      {ecran === "saisie" && classeActive && (
        <ScreenSaisie
          classe={classeActive}
          onRetour={() => setEcran("classes")}
          onVoirExport={(typeEval) => {
            setEvalActive(typeEval);
            setEcran("export");
          }}
        />
      )}

      {ecran === "export" && classeActive && (
        <ScreenExport classe={classeActive} onRetour={() => setEcran("saisie")} />
      )}
    </div>
  );
}
