import { useState, useEffect, useCallback } from "react";
import { supabase, type FeedbackRow, type FeedbackPayload } from "@/lib/supabase";
import { offlineDB } from "@/lib/offline-db";
import { startSyncListener, syncPendingFeedback } from "@/lib/sync";
import { COLORS, blankAnswers, type Answers } from "@/lib/constants";
import { Kiosk } from "@/components/Kiosk";
import { AdminLogin } from "@/components/AdminLogin";
import { Admin } from "@/components/Admin";

type Mode = "kiosk" | "login" | "admin";

export default function App() {
  const [mode, setMode] = useState<Mode>("kiosk");
  const [responses, setResponses] = useState<FeedbackRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
  const cleanup = startSyncListener();

  return cleanup;
}, []);

  const loadResponses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("prestige_feedback")
        .select("*")
        .order("timestamp", { ascending: false });
      if (error) throw error;
      setResponses((data as FeedbackRow[]) || []);
    } catch (error) {
  console.error("Erreur lors du chargement des réponses :", error);
  setResponses([]);
} finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadResponses(); }, [loadResponses]);

const handleSubmit = useCallback(async (answers: Answers) => {
  const syncId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const payload: FeedbackPayload = {
    sync_id: syncId,
    accueil: answers.accueil,
    lavage: answers.lavage,
    lavage_detail: answers.lavageDetail,
    attente: answers.attente,
    lounge: answers.lounge,
    qualite_prix: answers.qualitePrix,
    nps: answers.nps,
    commentaire: answers.commentaire,
  };

  try {
    await offlineDB.feedback.add({
      ...payload,
      createdAt,
      status: "pending",
    });

    if (navigator.onLine) {
      await syncPendingFeedback();
    }

    await loadResponses();
  } catch (error) {
    console.error(
      "Impossible d'enregistrer le questionnaire localement :",
      error
    );
  }
}, [loadResponses]);

  const handleReset = useCallback(async () => {
    if (!window.confirm("Effacer toutes les réponses stockées ?")) return;
    try {
      await supabase.from("prestige_feedback").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      setResponses([]);
    } catch {
      // ignore
    }
  }, []);

  if (!loaded) {
    return <div style={{ minHeight: "100vh", background: COLORS.bg }} />;
  }

  if (mode === "login") return <AdminLogin onAuth={() => setMode("admin")} onClose={() => setMode("kiosk")} />;
  if (mode === "admin") return <Admin responses={responses} onClose={() => setMode("kiosk")} onReset={handleReset} />;

  return <Kiosk onSubmit={handleSubmit} onOpenAdmin={() => setMode("login")} />;
}
