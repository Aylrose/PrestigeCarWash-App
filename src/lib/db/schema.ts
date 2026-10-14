import type { SqlDriver } from "./driver";

/**
 * Migrations de schéma SQLite, appliquées dans l'ordre.
 * Pour faire évoluer le schéma : AJOUTER une entrée (version + 1) à la fin,
 * ne jamais modifier une migration déjà publiée.
 * La version courante est stockée dans app_meta.schema_version.
 */
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS feedback (
        id            TEXT PRIMARY KEY NOT NULL,   -- uuid (Supabase conservé ou généré localement)
        sync_id       TEXT UNIQUE,                 -- uuid nullable, unique si présent (comme Supabase)
        timestamp     TEXT NOT NULL,               -- date ISO d'origine, conservée à l'identique
        timestamp_ms  INTEGER NOT NULL,            -- même date en ms epoch, pour trier/filtrer
        accueil       INTEGER,
        lavage        TEXT,
        lavage_detail TEXT,                        -- tableau JSON, ou NULL
        attente       TEXT,
        lounge        INTEGER,
        qualite_prix  TEXT,
        nps           TEXT,
        commentaire   TEXT,
        source        TEXT NOT NULL DEFAULT 'local',
        created_at    TEXT NOT NULL                -- date d'écriture dans cette base
      );
      CREATE INDEX IF NOT EXISTS idx_feedback_timestamp_ms ON feedback(timestamp_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source);

      -- Réponses supprimées volontairement : empêche un nouvel import de les faire réapparaître.
      CREATE TABLE IF NOT EXISTS deleted_feedback (
        id         TEXT PRIMARY KEY NOT NULL,
        sync_id    TEXT,
        deleted_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_deleted_feedback_sync_id ON deleted_feedback(sync_id);
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function getSchemaVersion(db: SqlDriver): Promise<number> {
  const rows = await db.query<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'schema_version'"
  );
  return rows.length ? Number(rows[0].value) : 0;
}

/** Crée/met à jour le schéma. Chaque migration est atomique. */
export async function migrateSchema(db: SqlDriver): Promise<number> {
  await db.execute(
    "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);"
  );

  let current = await getSchemaVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.transaction(async (tx) => {
      await tx.execute(migration.sql);
      await tx.run(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?)",
        [String(migration.version)]
      );
    });
    current = migration.version;
  }

  return current;
}
