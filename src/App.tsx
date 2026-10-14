import { useState, useEffect, useCallback } from "react";
import { createFeedback, initializeDatabase } from "@/lib/feedbackRepository";
import type { Answers } from "@/lib/constants";
import { Kiosk } from "@/components/Kiosk";
import { AdminLogin } from "@/components/AdminLogin";
import { Admin } from "@/components/Admin";

type Mode = "kiosk" | "login" | "admin";

export default function App() {
  const [mode, setMode] = useState<Mode>("kiosk");

  // Ouverture anticipée de la base locale (le kiosque reste utilisable pendant ce temps).
  useEffect(() => {
    initializeDatabase().catch((error) => {
      console.error("Erreur lors de l'initialisation de la base locale :", error);
    });
  }, []);

  // Enregistrement 100 % local : aucune requête réseau.
  const handleSubmit = useCallback(async (answers: Answers) => {
    await createFeedback({
      accueil: answers.accueil,
      lavage: answers.lavage,
      lavage_detail: answers.lavageDetail,
      attente: answers.attente,
      lounge: answers.lounge,
      qualite_prix: answers.qualitePrix,
      nps: answers.nps,
      commentaire: answers.commentaire,
    });
  }, []);

  if (mode === "login") return <AdminLogin onAuth={() => setMode("admin")} onClose={() => setMode("kiosk")} />;
  if (mode === "admin") return <Admin onClose={() => setMode("kiosk")} />;

  return <Kiosk onSubmit={handleSubmit} onOpenAdmin={() => setMode("login")} />;
}
