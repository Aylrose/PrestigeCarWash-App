import type { FeedbackRow } from "@/lib/feedbackTypes";

/**
 * Sauvegarde complète des réponses au format JSON.
 * Contrairement aux exports PDF/Excel (consultation), ce fichier contient TOUTES les
 * colonnes (id, sync_id, date d'origine, source…) et permet une restauration sans doublon.
 */

export const BACKUP_FORMAT = "prestigecarwash-feedback-backup";
export const BACKUP_VERSION = 1;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  schemaVersion: number;
  count: number;
  feedback: FeedbackRow[];
};

export class BackupFormatError extends Error {}

export function buildBackup(rows: FeedbackRow[], schemaVersion: number, now = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    schemaVersion,
    count: rows.length,
    feedback: rows,
  };
}

/** Contrôle l'enveloppe du fichier ; chaque ligne est ensuite validée à l'import. */
export function parseBackup(text: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupFormatError("Le fichier n'est pas un JSON valide.");
  }
  if (!data || typeof data !== "object") throw new BackupFormatError("Contenu de sauvegarde invalide.");
  const b = data as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) {
    throw new BackupFormatError("Ce fichier n'est pas une sauvegarde Prestige Car Wash.");
  }
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) {
    throw new BackupFormatError(`Version de sauvegarde non prise en charge (${String(b.version)}).`);
  }
  if (!Array.isArray(b.feedback)) throw new BackupFormatError("La sauvegarde ne contient pas de réponses.");
  if (typeof b.count === "number" && b.count !== b.feedback.length) {
    throw new BackupFormatError(
      `Sauvegarde incomplète : ${b.feedback.length} réponse(s) trouvée(s) au lieu de ${b.count}.`
    );
  }
  return b.feedback;
}

export const backupFileName = (now = new Date()) =>
  `prestige-sauvegarde-${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
