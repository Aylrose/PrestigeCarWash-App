import initSqlJs, { type Database } from "sql.js";
import type { SqlDriver, SqlExecutor, SqlValue } from "@/lib/db/driver";

/**
 * Driver de test : moteur SQLite (sql.js) exécuté sous Node, avec la même interface
 * que le driver Capacitor. `exportBytes()` permet de simuler fermeture / réouverture
 * du fichier de base.
 */
export type TestDriver = SqlDriver & {
  exportBytes(): Uint8Array;
  /** Fait échouer le n-ième prochain ordre SQL (1 par défaut) contenant ce motif (pour tester le ROLLBACK). */
  failNextMatching(pattern: RegExp, nth?: number): void;
};

export async function createSqlJsDriver(bytes?: Uint8Array): Promise<TestDriver> {
  const SQL = await initSqlJs();
  const db: Database = new SQL.Database(bytes);
  let failPattern: RegExp | null = null;
  let failCountdown = 0;
  let closed = false;

  const check = (sql: string) => {
    if (closed) throw new Error("base fermée");
    if (failPattern && failPattern.test(sql) && --failCountdown === 0) {
      failPattern = null;
      throw new Error("Échec simulé d'écriture SQLite");
    }
  };

  const exec: SqlExecutor = {
    async execute(sql) {
      check(sql);
      db.exec(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      check(sql);
      db.run(sql, params);
    },
    async query<T>(sql: string, params: SqlValue[] = []) {
      check(sql);
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        const out: T[] = [];
        while (stmt.step()) out.push(stmt.getAsObject() as T);
        return out;
      } finally {
        stmt.free();
      }
    },
  };

  return {
    ...exec,
    async transaction(fn) {
      db.exec("BEGIN");
      try {
        const r = await fn(exec);
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async close() {
      db.close();
      closed = true;
    },
    exportBytes: () => db.export(),
    failNextMatching(pattern, nth = 1) {
      failPattern = pattern;
      failCountdown = nth;
    },
  };
}
