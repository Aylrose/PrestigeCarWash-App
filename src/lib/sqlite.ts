import { Capacitor } from "@capacitor/core";
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";

const sqlite = new SQLiteConnection(CapacitorSQLite);

const DB_NAME = "prestige_car_wash";

let db: SQLiteDBConnection | null = null;

export async function initDatabase() {
  // SQLite ne fonctionne que sur Android/iOS.
  if (!Capacitor.isNativePlatform()) {
    console.log("SQLite ignoré : application exécutée dans le navigateur.");
    return;
  }

  if (db) {
    return db;
  }

  db = await sqlite.createConnection(
    DB_NAME,
    false,
    "no-encryption",
    1,
    false
  );

  await db.open();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_id TEXT NOT NULL UNIQUE,
      timestamp TEXT NOT NULL,
      accueil INTEGER,
      lavage TEXT,
      lavage_detail TEXT,
      attente TEXT,
      lounge INTEGER,
      qualite_prix TEXT,
      nps TEXT,
      commentaire TEXT,
      synced INTEGER DEFAULT 0
    );
  `);

  console.log("SQLite initialisé avec succès.");

  return db;
}