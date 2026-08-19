import Dexie, { type Table } from "dexie";
import type { FeedbackPayload } from "./supabase";

export type PendingFeedback = FeedbackPayload & {
  localId?: number;
  createdAt: string;
  status: "pending" | "syncing" | "synced";
};

class PrestigeOfflineDB extends Dexie {
  feedback!: Table<PendingFeedback, number>;

  constructor() {
    super("PrestigeCarWashDB");

    this.version(1).stores({
      feedback: "++localId, sync_id, createdAt, status",
    });
  }
}

export const offlineDB = new PrestigeOfflineDB();