import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";

const DB_DIR = process.env.DB_DIR || path.join(os.homedir(), ".clipai");
const DB_PATH = path.join(DB_DIR, "clipai.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,
      clip_path TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      hashtags TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('instagram', 'tiktok', 'both')),
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'publishing', 'done', 'error')),
      error TEXT,
      instagram_post_id TEXT,
      tiktok_post_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      episode_name TEXT,
      thumbnail_path TEXT
    );

    CREATE TABLE IF NOT EXISTS processed_episodes (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      episode_name TEXT NOT NULL,
      duration REAL,
      clips_generated INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'done', 'error')),
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
