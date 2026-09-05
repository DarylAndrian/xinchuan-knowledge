import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { seedIfNeeded } from "./seed";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin','admin','commentator')),
  suspended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  content_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER REFERENCES users(id),
  UNIQUE (collection_id, parent_id, slug)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  quote TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const DATA_DIR = path.join(process.cwd(), "data");

function createDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const database = new DatabaseSync(path.join(DATA_DIR, "xinchuan.db"));
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 10000;");
  database.exec(SCHEMA);
  migrateEmailToUsername(database);
  return database;
}

/**
 * One-time migration: users.email -> users.username (2026-09-05).
 * Existing databases have the old column; CREATE TABLE IF NOT EXISTS is a
 * no-op there, so rename in place. Idempotent: only runs while the old
 * column still exists.
 */
function migrateEmailToUsername(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(users)").all() as unknown as { name: string }[];
  const hasEmail = cols.some((c) => c.name === "email");
  const hasUsername = cols.some((c) => c.name === "username");
  if (hasEmail && !hasUsername) {
    database.exec("ALTER TABLE users RENAME COLUMN email TO username;");
  }
}

const globalForDb = globalThis as unknown as { xkDb?: DatabaseSync; xkSeeded?: boolean };

export const db: DatabaseSync = globalForDb.xkDb ?? createDb();
if (!globalForDb.xkDb) {
  globalForDb.xkDb = db;
}

/** Seed lazily so parallel workers don’t race on first write. */
export function ensureSeeded(): void {
  if (globalForDb.xkSeeded) return;
  try {
    seedIfNeeded(db);
    globalForDb.xkSeeded = true;
  } catch (err) {
    // another worker may be seeding right now; retry once shortly
    if (String(err).includes("locked") || String(err).includes("UNIQUE")) {
      try {
        seedIfNeeded(db);
        globalForDb.xkSeeded = true;
      } catch {
        /* ignore */
      }
    }
  }
}

/* ---------- row types ---------- */

export type Role = "superadmin" | "admin" | "commentator";

export interface UserRow {
  id: number;
  username: string;
  name: string;
  password_hash: string;
  role: Role;
  suspended: number;
  created_at: string;
}

export interface CollectionRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  position: number;
}

export interface PageRow {
  id: number;
  collection_id: number;
  parent_id: number | null;
  title: string;
  slug: string;
  icon: string;
  content_json: string;
  content_html: string;
  status: "draft" | "published";
  position: number;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
}

export interface CommentRow {
  id: number;
  page_id: number;
  author_id: number;
  author_name?: string;
  parent_id: number | null;
  quote: string;
  body: string;
  deleted_at: string | null;
  created_at: string;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}

export function getSetting(key: string, fallback: string): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as unknown as
    | { value: string }
    | undefined;
  return row ? row.value : fallback;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
