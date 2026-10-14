import Dexie from "dexie";
import { META_LEGACY_IMPORT, type FeedbackRepository } from "@/lib/feedbackRepository";
import { emptyReport, type ImportReport } from "@/lib/feedbackTypes";

/**
 * Avant SQLite, les réponses étaient d'abord stockées dans IndexedDB (Dexie, base "PrestigeCarWashDB")
 * avec un statut pending/syncing/synced, puis envoyées à Supabase.
 * Les réponses encore "pending" n'existent QUE sur l'appareil : on les recopie dans SQLite.
 * Les réponses "synced" sont aussi recopiées ; l'anti-doublon sur sync_id évite tout doublon
 * avec les réponses historiques Supabase. L'ancienne base IndexedDB n'est jamais effacée (copie de sécurité).
 */

export const LEGACY_DB_NAME = "PrestigeCarWashDB";

type LegacyItem = {
  localId?: number;
  sync_id?: string;
  createdAt?: string;
  status?: string;
  accueil?: number | null;
  lavage?: string | null;
  lavage_detail?: string[] | null;
  attente?: string | null;
  lounge?: number | null;
  qualite_prix?: string | null;
  nps?: string | null;
  commentaire?: string | null;
};

/** Convertit un élément de l'ancienne file au format de la table (même mapping que l'ancien sync.ts). */
export function legacyItemToRow(item: LegacyItem) {
  const id = item.sync_id || `legacy-${item.localId}`;
  return {
    id,
    sync_id: item.sync_id ?? null,
    timestamp: item.createdAt,
    accueil: item.accueil ?? null,
    lavage: item.lavage ?? null,
    lavage_detail: item.lavage_detail ?? null,
    attente: item.attente ?? null,
    lounge: item.lounge ?? null,
    qualite_prix: item.qualite_prix ?? null,
    nps: item.nps ?? null,
    commentaire: item.commentaire ?? null,
  };
}

/** Lit l'ancienne file. Retourne [] si elle n'a jamais existé (sans la créer). */
export async function readLegacyOfflineQueue(): Promise<LegacyItem[]> {
  if (typeof indexedDB === "undefined") return [];
  if (!(await Dexie.exists(LEGACY_DB_NAME))) return [];
  const legacy = new Dexie(LEGACY_DB_NAME);
  legacy.version(1).stores({ feedback: "++localId, sync_id, createdAt, status" });
  try {
    return await legacy.table<LegacyItem>("feedback").toArray();
  } finally {
    legacy.close();
  }
}

export async function importLegacyOfflineFeedback(
  repo: FeedbackRepository,
  read: () => Promise<LegacyItem[]> = readLegacyOfflineQueue
): Promise<ImportReport> {
  const report: ImportReport = { ...emptyReport(), status: "running", startedAt: new Date().toISOString() };
  try {
    const items = await read();
    report.remoteCount = items.length;
    Object.assign(report, await repo.importRows(items.map(legacyItemToRow), "legacy_offline"));
    report.status = report.invalid || report.missingAfterImport ? "partial" : "success";
  } catch (error) {
    report.status = "error";
    report.errors.push(error instanceof Error ? error.message : String(error));
  }
  report.finishedAt = new Date().toISOString();
  await repo.saveImportReport(META_LEGACY_IMPORT, report);
  return report;
}
