/**
 * Interface minimale d'accès SQL.
 * - En production : capacitorDriver.ts (@capacitor-community/sqlite, natif Android ou jeep-sqlite en web).
 * - En test : un driver sql.js (même moteur SQLite, exécuté sous Node).
 * Le dépôt (feedbackRepository.ts) n'utilise que cette interface.
 */

export type SqlValue = string | number | null;

export interface SqlExecutor {
  /** Exécute un ou plusieurs ordres SQL sans paramètres. */
  execute(sql: string): Promise<void>;
  /** Exécute un ordre paramétré (INSERT/UPDATE/DELETE). */
  run(sql: string, params?: SqlValue[]): Promise<void>;
  /** Exécute une requête SELECT et retourne les lignes. */
  query<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

export interface SqlDriver extends SqlExecutor {
  /**
   * Exécute `fn` dans une transaction : COMMIT si elle réussit,
   * ROLLBACK (aucune écriture conservée) si elle lève une erreur.
   */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
