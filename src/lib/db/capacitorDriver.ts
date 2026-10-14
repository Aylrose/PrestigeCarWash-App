import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import type { SqlDriver, SqlExecutor, SqlValue } from "./driver";

/**
 * Nom logique de la base. Le plugin crée sur Android le fichier
 * /data/data/com.prestigecarwash.app/databases/prestigecarwashSQLite.db
 * (en web : IndexedDB "jeepSqliteStore", via le composant jeep-sqlite).
 */
export const DB_NAME = "prestigecarwash";

const sqlite = new SQLiteConnection(CapacitorSQLite);

/** Retire les commentaires SQL "-- ..." : le découpage multi-ordres du plugin ne les gère pas toujours. */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** En navigateur, le plugin s'appuie sur le composant web jeep-sqlite (sql.js + IndexedDB). */
async function initWebStore() {
  const { defineCustomElements } = await import("jeep-sqlite/loader");
  await defineCustomElements(window);
  if (!document.querySelector("jeep-sqlite")) {
    document.body.appendChild(document.createElement("jeep-sqlite"));
  }
  await customElements.whenDefined("jeep-sqlite");
  await sqlite.initWebStore();
}

async function openConnection(): Promise<SQLiteDBConnection> {
  const consistency = await sqlite.checkConnectionsConsistency();
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  const db =
    consistency.result && exists
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  if (!(await db.isDBOpen()).result) {
    await db.open();
  }
  return db;
}

export async function createCapacitorDriver(): Promise<SqlDriver> {
  const isWeb = Capacitor.getPlatform() === "web";
  if (isWeb) await initWebStore();

  const db = await openConnection();

  // En web, la base vit en mémoire : il faut la recopier dans IndexedDB après chaque écriture.
  const persist = async () => {
    if (isWeb) await sqlite.saveToStore(DB_NAME);
  };

  const makeExecutor = (inTransaction: boolean): SqlExecutor => ({
    async execute(sql) {
      // Hors transaction explicite, le plugin encadre lui-même l'ordre dans une transaction.
      await db.execute(stripComments(sql), !inTransaction);
      if (!inTransaction) await persist();
    },
    async run(sql, params: SqlValue[] = []) {
      await db.run(sql, params, !inTransaction);
      if (!inTransaction) await persist();
    },
    async query<T>(sql: string, params: SqlValue[] = []) {
      const res = await db.query(sql, params);
      return (res.values ?? []) as T[];
    },
  });

  const base = makeExecutor(false);
  const tx = makeExecutor(true);

  return {
    ...base,
    async transaction(fn) {
      await db.beginTransaction();
      try {
        const result = await fn(tx);
        await db.commitTransaction();
        await persist();
        return result;
      } catch (error) {
        try {
          if ((await db.isTransactionActive()).result) await db.rollbackTransaction();
        } catch (rollbackError) {
          console.error("Échec du ROLLBACK SQLite :", rollbackError);
        }
        throw error;
      }
    },
    async close() {
      await persist();
      await sqlite.closeConnection(DB_NAME, false);
    },
  };
}
