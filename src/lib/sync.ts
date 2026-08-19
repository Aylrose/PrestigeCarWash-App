import { offlineDB } from "./offline-db";
import { supabase } from "./supabase";

let syncing = false;

export async function syncPendingFeedback(): Promise<void> {
  if (syncing || !navigator.onLine) return;

  syncing = true;

  try {
    const pending = await offlineDB.feedback
      .where("status")
      .equals("pending")
      .toArray();

    for (const item of pending) {
      if (!item.localId) continue;

      try {
        await offlineDB.feedback.update(item.localId, {
          status: "syncing",
        });

        const { localId, createdAt, status, ...payload } = item;

        const { error } = await supabase
          .from("prestige_feedback")
          .upsert(
            {
              ...payload,
              timestamp: createdAt,
            },
            {
              onConflict: "sync_id",
              ignoreDuplicates: true,
            }
          );

        if (error) {
          throw error;
        }

        await offlineDB.feedback.update(item.localId, {
          status: "synced",
        });
      } catch (error) {
        console.error(
          "Erreur de synchronisation du questionnaire :",
          error
        );

        await offlineDB.feedback.update(item.localId, {
          status: "pending",
        });
      }
    }
  } finally {
    syncing = false;
  }
}

export function startSyncListener(): () => void {
  const handleOnline = () => {
    console.log("Connexion Internet rétablie. Synchronisation...");
    void syncPendingFeedback();
  };

  window.addEventListener("online", handleOnline);

  void syncPendingFeedback();

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}