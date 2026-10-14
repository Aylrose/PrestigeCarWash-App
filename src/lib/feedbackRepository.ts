import type { SqlDriver, SqlExecutor, SqlValue } from "@/lib/db/driver";
import { migrateSchema, getSchemaVersion } from "@/lib/db/schema";
import {
  ALLOWED,
  MAX_COMMENT_LENGTH,
  emptyReport,
  type FeedbackRow,
  type FeedbackSource,
  type ImportReport,
  type MigrationStatus,
  type NewFeedback,
} from "@/lib/feedbackTypes";

/**
 * Point d'accès UNIQUE aux réponses du questionnaire.
 * La base SQLite locale est la source de vérité : le questionnaire, le tableau de bord,
 * les imports (données historiques Supabase livrées avec l'app, ancienne file IndexedDB,
 * sauvegardes) passent tous par ici. Aucun accès réseau.
 */

const SOURCES: FeedbackSource[] = ["local", "supabase", "legacy_offline", "backup"];

/** État de l'intégration des 23 réponses historiques (src/data/supabaseSeed.json). */
export const META_SEED_IMPORT = "supabase_seed_import";
export const META_LEGACY_IMPORT = "legacy_offline_import";

type DbRow = {
  id: string;
  sync_id: string | null;
  timestamp: string;
  timestamp_ms: number;
  accueil: number | null;
  lavage: string | null;
  lavage_detail: string | null;
  attente: string | null;
  lounge: number | null;
  qualite_prix: string | null;
  nps: string | null;
  commentaire: string | null;
  source: string;
};

const COLUMNS = [
  "id",
  "sync_id",
  "timestamp",
  "timestamp_ms",
  "accueil",
  "lavage",
  "lavage_detail",
  "attente",
  "lounge",
  "qualite_prix",
  "nps",
  "commentaire",
  "source",
  "created_at",
] as const;

/** 14 colonnes x 50 lignes = 700 paramètres, sous la limite SQLite de 999. */
const INSERT_CHUNK = 50;

export class FeedbackValidationError extends Error {}

function fromDb(r: DbRow): FeedbackRow {
  let detail: string[] | null = null;
  if (r.lavage_detail != null) {
    try {
      const parsed = JSON.parse(r.lavage_detail);
      detail = Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
      detail = null;
    }
  }
  return {
    id: r.id,
    sync_id: r.sync_id,
    timestamp: r.timestamp,
    accueil: r.accueil,
    lavage: r.lavage,
    lavage_detail: detail,
    attente: r.attente,
    lounge: r.lounge,
    qualite_prix: r.qualite_prix,
    nps: r.nps,
    commentaire: r.commentaire,
    source: (SOURCES as string[]).includes(r.source) ? (r.source as FeedbackSource) : "local",
  };
}

function toParams(row: FeedbackRow, createdAt: string): SqlValue[] {
  return [
    row.id,
    row.sync_id,
    row.timestamp,
    Date.parse(row.timestamp),
    row.accueil,
    row.lavage,
    row.lavage_detail == null ? null : JSON.stringify(row.lavage_detail),
    row.attente,
    row.lounge,
    row.qualite_prix,
    row.nps,
    row.commentaire,
    row.source,
    createdAt,
  ];
}

/** uuid v4 ; crypto.randomUUID est disponible dans la WebView Android (contexte sécurisé). */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Valide une réponse du questionnaire (mêmes règles que les écrans du kiosque). */
export function validateNewFeedback(input: NewFeedback): void {
  const errors: string[] = [];
  const star = (v: number | null, label: string) => {
    if (v == null || !Number.isInteger(v) || v < 1 || v > 5) errors.push(`${label} : note de 1 à 5 requise`);
  };
  const choice = (v: string | null, allowed: readonly string[], label: string) => {
    if (v == null || !allowed.includes(v)) errors.push(`${label} : réponse requise`);
  };
  star(input.accueil, "Accueil");
  choice(input.lavage, ALLOWED.lavage, "Lavage");
  if (!Array.isArray(input.lavage_detail) || input.lavage_detail.some((d) => !(ALLOWED.lavage_detail as readonly string[]).includes(d))) {
    errors.push("Détail du lavage invalide");
  }
  choice(input.attente, ALLOWED.attente, "Attente");
  star(input.lounge, "Coffee Lounge");
  choice(input.qualite_prix, ALLOWED.qualite_prix, "Qualité/prix");
  choice(input.nps, ALLOWED.nps, "Recommandation");
  if (typeof input.commentaire !== "string") errors.push("Commentaire invalide");
  else if (input.commentaire.length > MAX_COMMENT_LENGTH) errors.push(`Commentaire trop long (${MAX_COMMENT_LENGTH} caractères max.)`);
  if (errors.length) throw new FeedbackValidationError(errors.join(" ; "));
}

/**
 * Convertit une ligne venant de l'extérieur (données historiques, sauvegarde, ancienne file IndexedDB)
 * en FeedbackRow, SANS modifier les valeurs : seuls les types sont contrôlés.
 */
export function normalizeExternalRow(raw: unknown, defaultSource: FeedbackSource): FeedbackRow {
  if (!raw || typeof raw !== "object") throw new Error("ligne non objet");
  const r = raw as Record<string, unknown>;
  const str = (k: string): string | null => {
    const v = r[k];
    if (v == null) return null;
    if (typeof v !== "string") throw new Error(`${k} : texte attendu`);
    return v;
  };
  const int = (k: string): number | null => {
    const v = r[k];
    if (v == null) return null;
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${k} : nombre attendu`);
    return v;
  };

  const id = str("id");
  if (!id) throw new Error("id manquant");
  const timestamp = str("timestamp");
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) throw new Error(`date invalide (id ${id})`);

  let detail: string[] | null = null;
  if (r.lavage_detail != null) {
    if (!Array.isArray(r.lavage_detail) || r.lavage_detail.some((d) => typeof d !== "string")) {
      throw new Error(`lavage_detail invalide (id ${id})`);
    }
    detail = r.lavage_detail as string[];
  }

  const source = typeof r.source === "string" && (SOURCES as string[]).includes(r.source)
    ? (r.source as FeedbackSource)
    : defaultSource;

  return {
    id,
    sync_id: str("sync_id"),
    timestamp,
    accueil: int("accueil"),
    lavage: str("lavage"),
    lavage_detail: detail,
    attente: str("attente"),
    lounge: int("lounge"),
    qualite_prix: str("qualite_prix"),
    nps: str("nps"),
    commentaire: str("commentaire"),
    source,
  };
}

export type ImportRowsOptions = {
  /** Restauration de sauvegarde : réintègre aussi les réponses supprimées auparavant. */
  includeDeleted?: boolean;
};

export type ImportRowsResult = Pick<
  ImportReport,
  "fetched" | "inserted" | "alreadyPresent" | "skippedDeleted" | "invalid" | "missingAfterImport" | "errors"
>;

export function createFeedbackRepository(db: SqlDriver, deps: { now?: () => Date } = {}) {
  const now = () => (deps.now ? deps.now() : new Date());

  // Toutes les écritures sont sérialisées : une transaction d'import ne doit jamais
  // s'entremêler avec l'enregistrement d'une réponse sur la même connexion.
  let writeQueue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = writeQueue.then(fn, fn);
    writeQueue = next.catch(() => undefined);
    return next;
  };

  async function insertRows(tx: SqlExecutor, rows: FeedbackRow[], createdAt: string) {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK);
      const placeholders = chunk.map(() => `(${COLUMNS.map(() => "?").join(",")})`).join(",");
      await tx.run(
        `INSERT INTO feedback (${COLUMNS.join(",")}) VALUES ${placeholders}`,
        chunk.flatMap((r) => toParams(r, createdAt))
      );
    }
  }

  async function loadKeys(ex: SqlExecutor) {
    const ids = new Set<string>();
    const syncIds = new Set<string>();
    for (const r of await ex.query<{ id: string; sync_id: string | null }>("SELECT id, sync_id FROM feedback")) {
      ids.add(r.id);
      if (r.sync_id) syncIds.add(r.sync_id);
    }
    return { ids, syncIds };
  }

  async function loadTombstones(ex: SqlExecutor) {
    const ids = new Set<string>();
    const syncIds = new Set<string>();
    for (const r of await ex.query<{ id: string; sync_id: string | null }>("SELECT id, sync_id FROM deleted_feedback")) {
      ids.add(r.id);
      if (r.sync_id) syncIds.add(r.sync_id);
    }
    return { ids, syncIds };
  }

  async function getMeta<T>(key: string): Promise<T | null> {
    const rows = await db.query<{ value: string }>("SELECT value FROM app_meta WHERE key = ?", [key]);
    if (!rows.length) return null;
    try {
      return JSON.parse(rows[0].value) as T;
    } catch {
      return null;
    }
  }

  const repo = {
    db,

    /** Crée ou met à jour le schéma. Retourne la version de schéma. */
    async initialize(): Promise<number> {
      return exclusive(() => migrateSchema(db));
    },

    /** Toutes les réponses, de la plus récente à la plus ancienne. */
    async getAll(): Promise<FeedbackRow[]> {
      const rows = await db.query<DbRow>("SELECT * FROM feedback ORDER BY timestamp_ms DESC, id DESC");
      return rows.map(fromDb);
    },

    async getById(id: string): Promise<FeedbackRow | null> {
      const rows = await db.query<DbRow>("SELECT * FROM feedback WHERE id = ?", [id]);
      return rows.length ? fromDb(rows[0]) : null;
    },

    async count(): Promise<number> {
      const rows = await db.query<{ n: number }>("SELECT COUNT(*) AS n FROM feedback");
      return Number(rows[0]?.n ?? 0);
    },

    /** Enregistre une nouvelle réponse. Ne nécessite aucun accès réseau. */
    async create(input: NewFeedback): Promise<FeedbackRow> {
      validateNewFeedback(input);
      const id = generateId();
      const ts = now().toISOString();
      const row: FeedbackRow = {
        id,
        sync_id: id,
        timestamp: ts,
        accueil: input.accueil,
        lavage: input.lavage,
        lavage_detail: [...input.lavage_detail],
        attente: input.attente,
        lounge: input.lounge,
        qualite_prix: input.qualite_prix,
        nps: input.nps,
        commentaire: input.commentaire,
        source: "local",
      };
      await exclusive(() => db.transaction((tx) => insertRows(tx, [row], ts)));
      // Relecture : on ne confirme qu'une écriture effectivement présente en base.
      const saved = await repo.getById(id);
      if (!saved) throw new Error("La réponse n'a pas été retrouvée après écriture.");
      return saved;
    },

    /** Supprime une réponse et mémorise sa suppression (un nouvel import ne la recréera pas). */
    async delete(id: string): Promise<boolean> {
      return exclusive(() =>
        db.transaction(async (tx) => {
          const found = await tx.query<{ id: string; sync_id: string | null }>(
            "SELECT id, sync_id FROM feedback WHERE id = ?",
            [id]
          );
          if (!found.length) return false;
          await tx.run(
            "INSERT OR REPLACE INTO deleted_feedback (id, sync_id, deleted_at) VALUES (?, ?, ?)",
            [found[0].id, found[0].sync_id, now().toISOString()]
          );
          await tx.run("DELETE FROM feedback WHERE id = ?", [id]);
          return true;
        })
      );
    },

    /**
     * Importe des lignes externes dans UNE transaction (tout ou rien).
     * Anti-doublons : une ligne déjà présente (même id OU même sync_id) est ignorée,
     * donc l'import peut être relancé autant de fois que nécessaire.
     */
    async importRows(
      rawRows: unknown[],
      defaultSource: FeedbackSource,
      options: ImportRowsOptions = {}
    ): Promise<ImportRowsResult> {
      const result: ImportRowsResult = {
        fetched: rawRows.length,
        inserted: 0,
        alreadyPresent: 0,
        skippedDeleted: 0,
        invalid: 0,
        missingAfterImport: 0,
        errors: [],
      };

      const valid: FeedbackRow[] = [];
      rawRows.forEach((raw, i) => {
        try {
          valid.push(normalizeExternalRow(raw, defaultSource));
        } catch (e) {
          result.invalid++;
          if (result.errors.length < 20) result.errors.push(`Ligne ${i + 1} ignorée : ${(e as Error).message}`);
        }
      });

      const expected: FeedbackRow[] = [];

      await exclusive(() =>
        db.transaction(async (tx) => {
          const keys = await loadKeys(tx);
          const tomb = await loadTombstones(tx);
          const toInsert: FeedbackRow[] = [];

          for (const row of valid) {
            const deleted = tomb.ids.has(row.id) || (row.sync_id != null && tomb.syncIds.has(row.sync_id));
            if (deleted && !options.includeDeleted) {
              result.skippedDeleted++;
              continue;
            }
            expected.push(row);
            if (keys.ids.has(row.id) || (row.sync_id != null && keys.syncIds.has(row.sync_id))) {
              result.alreadyPresent++;
              continue;
            }
            keys.ids.add(row.id);
            if (row.sync_id) keys.syncIds.add(row.sync_id);
            toInsert.push(row);
          }

          await insertRows(tx, toInsert, now().toISOString());
          if (options.includeDeleted && expected.length) {
            for (const row of expected) {
              await tx.run("DELETE FROM deleted_feedback WHERE id = ? OR (sync_id IS NOT NULL AND sync_id = ?)", [row.id, row.sync_id]);
            }
          }
          result.inserted = toInsert.length;
        })
      );

      // Contrôle après COMMIT : chaque ligne attendue doit être retrouvée en base.
      const after = await loadKeys(db);
      result.missingAfterImport = expected.filter(
        (r) => !after.ids.has(r.id) && !(r.sync_id != null && after.syncIds.has(r.sync_id))
      ).length;

      return result;
    },

    async getImportReport(key: string): Promise<ImportReport> {
      return { ...emptyReport(), ...((await getMeta<ImportReport>(key)) ?? {}) };
    },

    async saveImportReport(key: string, report: ImportReport): Promise<void> {
      await exclusive(() =>
        db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [key, JSON.stringify(report)])
      );
    },

    async getMigrationStatus(): Promise<MigrationStatus> {
      const counts = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<FeedbackSource, number>;
      for (const r of await db.query<{ source: string; n: number }>(
        "SELECT source, COUNT(*) AS n FROM feedback GROUP BY source"
      )) {
        if ((SOURCES as string[]).includes(r.source)) counts[r.source as FeedbackSource] = Number(r.n);
      }
      return {
        localCount: Object.values(counts).reduce((a, b) => a + b, 0),
        countsBySource: counts,
        schemaVersion: await getSchemaVersion(db),
        historicalImport: await repo.getImportReport(META_SEED_IMPORT),
        legacyOfflineImport: await repo.getImportReport(META_LEGACY_IMPORT),
      };
    },
  };

  return repo;
}

export type FeedbackRepository = ReturnType<typeof createFeedbackRepository>;

/* ------------------------------------------------------------------ */
/* Instance unique de l'application                                    */
/* ------------------------------------------------------------------ */

let instance: Promise<FeedbackRepository> | null = null;

/** Délai maximal d'ouverture de la base : au-delà, une erreur est affichée au lieu d'un chargement sans fin. */
const OPEN_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Ouvre la base SQLite (native sur Android, jeep-sqlite en navigateur),
 * applique les migrations de schéma, puis intègre automatiquement (une seule fois, sans réseau) :
 * 1. les réponses historiques extraites de Supabase et livrées avec l'application ;
 * 2. l'ancienne file d'attente hors ligne (IndexedDB) de l'appareil.
 * L'ordre compte : en cas de doublon (même sync_id), l'identifiant Supabase d'origine est conservé.
 */
export function initializeDatabase(): Promise<FeedbackRepository> {
  if (!instance) {
    instance = (async () => {
      const { createCapacitorDriver } = await import("@/lib/db/capacitorDriver");
      const driver = await withTimeout(
        createCapacitorDriver(),
        OPEN_TIMEOUT_MS,
        "La base SQLite ne s'est pas ouverte (délai dépassé). Consultez la console pour le détail."
      );
      const repo = createFeedbackRepository(driver);
      await repo.initialize();

      const { importHistoricalSeed } = await import("@/lib/seedImport");
      if ((await repo.getImportReport(META_SEED_IMPORT)).status !== "success") {
        const report = await importHistoricalSeed(repo);
        if (report.status !== "success") console.error("Intégration des données historiques :", report);
      }

      const { importLegacyOfflineFeedback } = await import("@/lib/legacyOfflineImport");
      const legacy = await repo.getImportReport(META_LEGACY_IMPORT);
      if (legacy.status !== "success") {
        const report = await importLegacyOfflineFeedback(repo);
        if (report.status !== "success") console.error("Import de l'ancienne file hors ligne :", report);
      }
      return repo;
    })();
    instance.catch(() => {
      instance = null; // permet une nouvelle tentative
    });
  }
  return instance;
}

export async function getAllFeedback() {
  return (await initializeDatabase()).getAll();
}

export async function getFeedbackById(id: string) {
  return (await initializeDatabase()).getById(id);
}

export async function createFeedback(input: NewFeedback) {
  return (await initializeDatabase()).create(input);
}

export async function deleteFeedback(id: string) {
  return (await initializeDatabase()).delete(id);
}

export async function getMigrationStatus() {
  return (await initializeDatabase()).getMigrationStatus();
}

/** Sauvegarde complète (toutes colonnes) de la base locale. */
export async function exportBackup() {
  const repo = await initializeDatabase();
  const { buildBackup } = await import("@/lib/backup");
  return buildBackup(await repo.getAll(), await getSchemaVersion(repo.db));
}

/** Restaure une sauvegarde JSON ; les réponses déjà présentes ne sont pas dupliquées. */
export async function restoreBackup(text: string) {
  const repo = await initializeDatabase();
  const { parseBackup } = await import("@/lib/backup");
  return repo.importRows(parseBackup(text), "backup", { includeDeleted: true });
}
