/**
 * Types partagés pour les réponses au questionnaire.
 * La forme de FeedbackRow reprend exactement la table Supabase `prestige_feedback`
 * (voir supabase/migrations) pour que les données importées restent identiques.
 */

/** Origine d'une réponse stockée localement. */
export type FeedbackSource =
  | "local" // saisie sur cet appareil après la migration SQLite
  | "supabase" // réponse historique de l'ancienne table Supabase (livrée avec l'app)
  | "legacy_offline" // récupérée de l'ancienne file d'attente IndexedDB (Dexie)
  | "backup"; // restaurée depuis une sauvegarde JSON

export type FeedbackRow = {
  /** uuid — identifiant Supabase conservé tel quel, ou uuid généré localement. */
  id: string;
  /** uuid de synchronisation (nullable dans Supabase). */
  sync_id: string | null;
  /** Date ISO 8601 telle que fournie à l'origine (ex. "2026-08-03T13:20:00.123456+00:00"). */
  timestamp: string;
  accueil: number | null;
  lavage: string | null;
  lavage_detail: string[] | null;
  attente: string | null;
  lounge: number | null;
  qualite_prix: string | null;
  nps: string | null;
  commentaire: string | null;
  source: FeedbackSource;
};

/** Données saisies dans le questionnaire, prêtes à être enregistrées. */
export type NewFeedback = {
  accueil: number | null;
  lavage: string | null;
  lavage_detail: string[];
  attente: string | null;
  lounge: number | null;
  qualite_prix: string | null;
  nps: string | null;
  commentaire: string;
};

/** Valeurs autorisées, reprises des écrans du questionnaire (Kiosk.tsx). */
export const ALLOWED = {
  lavage: ["impeccable", "satisfait", "insatisfait"],
  lavage_detail: ["carrosserie", "interieur", "jantes"],
  attente: ["rapide", "peu_long", "trop_long"],
  qualite_prix: ["avantageux", "correct", "cher"],
  nps: ["oui", "non"],
} as const;

export const MAX_COMMENT_LENGTH = 2000;

export type ImportStatus = "never" | "running" | "success" | "partial" | "error" | "interrupted";

export type ImportReport = {
  status: ImportStatus;
  startedAt: string | null;
  finishedAt: string | null;
  /** Nombre de lignes annoncé par la source (null si inconnu). */
  remoteCount: number | null;
  /** Nombre de lignes effectivement récupérées. */
  fetched: number;
  /** Nouvelles lignes écrites dans SQLite. */
  inserted: number;
  /** Lignes déjà présentes localement (même id ou même sync_id). */
  alreadyPresent: number;
  /** Lignes ignorées car supprimées volontairement en local. */
  skippedDeleted: number;
  /** Lignes rejetées car invalides. */
  invalid: number;
  /** Lignes récupérées mais introuvables localement après import (doit valoir 0). */
  missingAfterImport: number;
  errors: string[];
};

export const emptyReport = (): ImportReport => ({
  status: "never",
  startedAt: null,
  finishedAt: null,
  remoteCount: null,
  fetched: 0,
  inserted: 0,
  alreadyPresent: 0,
  skippedDeleted: 0,
  invalid: 0,
  missingAfterImport: 0,
  errors: [],
});

export type MigrationStatus = {
  localCount: number;
  countsBySource: Record<FeedbackSource, number>;
  schemaVersion: number;
  /** Intégration des réponses historiques livrées avec l'application. */
  historicalImport: ImportReport;
  legacyOfflineImport: ImportReport;
};
