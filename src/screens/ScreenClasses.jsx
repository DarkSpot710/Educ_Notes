import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Users, Wifi, WifiOff, LogOut, Plus } from "lucide-react";
import { db } from "../lib/db";
import { COLORS } from "../theme";

function useOnline() {
  const [online, setOnline] = React.useState(navigator.onLine);
  React.useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function ScreenClasses({ onOpenClasse, onCreerClasse, onDeconnecter }) {
  const online = useOnline();
  const classes = useLiveQuery(() => db.classes.toArray(), []) ?? [];
  const eleves = useLiveQuery(() => db.eleves.toArray(), []) ?? [];

  const effectifParClasse = (classeId) => eleves.filter((e) => e.classe_id === classeId).length;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-5 pt-6 pb-5" style={{ background: COLORS.chalk }}>
        <div className="flex items-center justify-between">
          <p className="text-lg" style={{ fontFamily: "Fraunces, serif", fontWeight: 600, color: COLORS.paper }}>
            Vos classes
          </p>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
              style={{ background: online ? "#2C4F3B" : "#5A3226", color: COLORS.paper, fontFamily: "Inter, sans-serif", fontWeight: 500 }}
            >
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? "Connecté" : "Hors ligne"}
            </div>
            <button onClick={onDeconnecter} title="Déconnexion">
              <LogOut size={16} color={COLORS.paper} opacity={0.7} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 flex-1">
        {classes.length === 0 && (
          <p className="text-sm mt-6" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
            Aucune classe assignée pour l'instant, ou pas encore synchronisée. Vérifie ta connexion et reconnecte-toi si besoin.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenClasse(c)}
              className="text-left rounded-lg p-4 flex items-center gap-3 relative overflow-hidden"
              style={{ background: "#FFFEFA", border: `1px solid ${COLORS.line}` }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: COLORS.stamp }} />
              <div className="pl-2 flex-1">
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 18, color: COLORS.text }}>
                    {c.nom}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
                    <Users size={12} /> {effectifParClasse(c.id)}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted }}>
                  {c.annee_scolaire}
                </p>
              </div>
              <ChevronRight size={18} color={COLORS.muted} />
            </button>
          ))}
        </div>

        <button
          onClick={onCreerClasse}
          className="w-full mt-4 py-3 rounded-lg flex items-center justify-center gap-2"
          style={{ background: "transparent", border: `1.5px dashed ${COLORS.line}`, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.ink }}
        >
          <Plus size={16} /> Nouvelle classe
        </button>
      </div>
    </div>
  );
}
