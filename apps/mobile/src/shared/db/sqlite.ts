// apps/mobile/src/shared/db/sqlite.ts
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export type SqlRow = Record<string, any>;

let _db: SQLite.SQLiteDatabase | null = null;

function tryExec(db: SQLite.SQLiteDatabase, sql: string) {
  try {
    db.execSync(sql);
  } catch {
    // ignore (usually: column already exists)
  }
}

export function getDb(): SQLite.SQLiteDatabase | null {
  if (Platform.OS === 'web') return null;
  if (!_db) _db = SQLite.openDatabaseSync('myhomeos.db');
  return _db;
}

/**
 * Init schema + defaults
 */
export function initSqliteSync() {
  const db = getDb();
  if (!db) return false; // ✅ web: no sqlite

  // Ensure foreign keys
  db.execSync(`PRAGMA foreign_keys = ON;`);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS shopping_lists (
      local_id TEXT PRIMARY KEY NOT NULL,
      server_id TEXT,
      name TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      dirty INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS shopping_items (
      local_id TEXT PRIMARY KEY NOT NULL,
      server_id TEXT,
      list_local_id TEXT NOT NULL,
      list_server_id TEXT,
      term_id TEXT,
      text TEXT NOT NULL,
      normalized_text TEXT,
      dedupe_key TEXT,
      qty REAL NOT NULL,
      unit TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      extra_json TEXT,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      dirty INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(list_local_id) REFERENCES shopping_lists(local_id)
    );
  `);

  db.execSync(`CREATE INDEX IF NOT EXISTS idx_items_list_local ON shopping_items(list_local_id);`);
  db.execSync(
    `CREATE INDEX IF NOT EXISTS idx_items_list_server ON shopping_items(list_server_id);`,
  );

  db.execSync(`
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      op TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      last_error TEXT,
      tries INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER
    );
  `);

  // ---- outbox migrations (safe) ----
  tryExec(db, `ALTER TABLE outbox ADD COLUMN tries INTEGER NOT NULL DEFAULT 0;`);
  tryExec(db, `ALTER TABLE outbox ADD COLUMN next_attempt_at INTEGER;`);
  tryExec(
    db,
    `CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(status, next_attempt_at, id);`,
  );

  // default meta
  const mode = getMetaSync('auth.mode');
  if (!mode) setMetaSync('auth.mode', 'guest');

  return true;
}

/**
 * Async init (wrapper)
 */
export async function initSqlite() {
  return initSqliteSync();
}

// --- Meta (SYNC) ---
export function setMetaSync(key: string, value: string) {
  const db = getDb();
  if (!db) return; // ✅ web noop
  db.runSync(
    `INSERT INTO meta(key,value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value;`,
    [key, value],
  );
}

export function getMetaSync(key: string) {
  const db = getDb();
  if (!db) return null; // ✅ web
  const row = db.getFirstSync<{ value: string }>(`SELECT value FROM meta WHERE key=? LIMIT 1;`, [
    key,
  ]);
  return row?.value ?? null;
}

// --- Meta (ASYNC) ---
export async function setMeta(key: string, value: string) {
  const db = getDb();
  if (!db) return; // ✅ web noop
  await db.runAsync(
    `INSERT INTO meta(key,value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value;`,
    [key, value],
  );
}

export async function getMeta(key: string) {
  const db = getDb();
  if (!db) return null; // ✅ web
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key=? LIMIT 1;`,
    [key],
  );
  return row?.value ?? null;
}

// --- Helpers (ASYNC) ---
export async function sqlAll<T = any>(sql: string, params: any[] = []) {
  const db = getDb();
  if (!db) return [] as T[]; // ✅ web
  return (await db.getAllAsync<T>(sql, params)) ?? [];
}

export async function sqlGet<T = any>(sql: string, params: any[] = []) {
  const db = getDb();
  if (!db) return null; // ✅ web
  return (await db.getFirstAsync<T>(sql, params)) ?? null;
}

export async function sqlRun(sql: string, params: any[] = []) {
  const db = getDb();
  if (!db) return null; // ✅ web
  return db.runAsync(sql, params);
}

// --- Helpers (SYNC) ---
export function sqlAllSync<T = any>(sql: string, params: any[] = []) {
  const db = getDb();
  if (!db) return [] as T[]; // ✅ web
  return db.getAllSync<T>(sql, params) ?? [];
}

export function sqlGetSync<T = any>(sql: string, params: any[] = []) {
  const db = getDb();
  if (!db) return null; // ✅ web
  return db.getFirstSync<T>(sql, params) ?? null;
}

export function sqlRunSync(sql: string, params: any[] = []) {
  const db = getDb();
  if (!db) return null; // ✅ web
  return db.runSync(sql, params);
}
