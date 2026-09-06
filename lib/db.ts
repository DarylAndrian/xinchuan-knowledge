import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { seedIfNeeded } from "./seed";
import { htmlToText } from "./content";

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

CREATE TABLE IF NOT EXISTS page_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  content_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft','published')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_page_revisions_page_created
  ON page_revisions(page_id, created_at DESC, id DESC);
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
  initializeSearch(database);
  initializeRevisions(database);
  return database;
}

function initializeSearch(database: DatabaseSync) {
  database.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS page_search USING fts5(
    page_id UNINDEXED,
    title,
    content,
    tokenize = 'unicode61 remove_diacritics 2'
  );`);
  // Build workers can open the same database concurrently. Serialize the
  // backfill so two workers can never insert the published corpus twice.
  database.exec("BEGIN IMMEDIATE");
  try {
    const count = database.prepare(
      "SELECT COUNT(*) AS n, COUNT(DISTINCT page_id) AS unique_n FROM page_search"
    ).get() as unknown as { n: number; unique_n: number };
    const version = database.prepare("SELECT value FROM settings WHERE key = 'fts_schema_version'").get() as
      | { value: string }
      | undefined;
    if (version?.value !== "2" || count.n === 0 || count.n !== count.unique_n) {
      rebuildSearchIndex(database);
      database.prepare(`INSERT INTO settings (key, value) VALUES ('fts_schema_version', '2')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run();
    }
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* no active transaction */ }
    throw error;
  }
}

function initializeRevisions(database: DatabaseSync) {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      INSERT INTO page_revisions (page_id, title, icon, content_json, content_html, status, created_at, created_by)
      SELECT p.id, p.title, p.icon, p.content_json, p.content_html, p.status, p.updated_at, p.updated_by
      FROM pages p
      WHERE NOT EXISTS (SELECT 1 FROM page_revisions r WHERE r.page_id = p.id)
    `);
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* no active transaction */ }
    throw error;
  }
}

function rebuildSearchIndex(database: DatabaseSync) {
  database.exec("DELETE FROM page_search;");
  const rows = database
    .prepare("SELECT id, title, content_html FROM pages WHERE status = 'published'")
    .all() as unknown as Array<{ id: number; title: string; content_html: string }>;
  const insert = database.prepare("INSERT INTO page_search (page_id, title, content) VALUES (?, ?, ?)");
  for (const row of rows) insert.run(row.id, row.title, htmlToText(row.content_html));
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
    initializeSearch(db);
    initializeRevisions(db);
    globalForDb.xkSeeded = true;
  } catch (err) {
    // another worker may be seeding right now; retry once shortly
    if (String(err).includes("locked") || String(err).includes("UNIQUE")) {
      try {
        seedIfNeeded(db);
        initializeSearch(db);
        initializeRevisions(db);
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

export interface PageRevisionRow {
  id: number;
  page_id: number;
  title: string;
  icon: string;
  content_json: string;
  content_html: string;
  status: "draft" | "published";
  created_at: string;
  created_by: number | null;
  editor_name?: string;
}

export function syncPageSearch(pageId: number): void {
  db.prepare("DELETE FROM page_search WHERE page_id = ?").run(pageId);
  const page = db.prepare("SELECT id, title, content_html, status FROM pages WHERE id = ?").get(pageId) as unknown as
    | { id: number; title: string; content_html: string; status: string }
    | undefined;
  if (page?.status === "published") {
    db.prepare("INSERT INTO page_search (page_id, title, content) VALUES (?, ?, ?)")
      .run(page.id, page.title, htmlToText(page.content_html));
  }
}

export function recordPageRevision(pageId: number, userId: number | null, force = false): void {
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as unknown as PageRow | undefined;
  if (!page) return;

  const latest = db
    .prepare("SELECT * FROM page_revisions WHERE page_id = ? ORDER BY id DESC LIMIT 1")
    .get(pageId) as unknown as PageRevisionRow | undefined;
  const unchanged = latest && latest.title === page.title && latest.icon === page.icon &&
    latest.content_json === page.content_json && latest.content_html === page.content_html &&
    latest.status === page.status;
  if (unchanged) return;

  const hasEarlierRevision = latest
    ? Boolean(db.prepare("SELECT 1 FROM page_revisions WHERE page_id = ? AND id != ? LIMIT 1").get(pageId, latest.id))
    : false;
  const canCoalesce = !force && latest && hasEarlierRevision && latest.created_by === userId && latest.status === page.status &&
    Date.now() - new Date(latest.created_at.replace(" ", "T") + "Z").getTime() < 5 * 60 * 1000;
  if (canCoalesce) {
    db.prepare(`UPDATE page_revisions SET title = ?, icon = ?, content_json = ?, content_html = ?,
      status = ?, created_at = datetime('now') WHERE id = ?`)
      .run(page.title, page.icon, page.content_json, page.content_html, page.status, latest.id);
    return;
  }
  db.prepare(`INSERT INTO page_revisions
    (page_id, title, icon, content_json, content_html, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(page.id, page.title, page.icon, page.content_json, page.content_html, page.status, userId);
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
