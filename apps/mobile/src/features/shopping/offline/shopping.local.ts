import { ShoppingUnit } from '@prisma/client';
import { sqlAll, sqlGet, sqlRun } from '../../../shared/db/sqlite';
import type { ShoppingCategory } from '@smart-kitchen/contracts';

export type Unit = 'pcs' | 'g' | 'ml' | 'kg' | 'l';
export type ApiUnit = 'PCS' | 'G' | 'KG' | 'ML' | 'L';

export type LocalShoppingList = {
  localId: string;
  serverId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
  dirty: boolean;
  deleted: boolean;
};

export type LocalShoppingItem = {
  localId: string;
  serverId: string | null;

  listLocalId: string;
  listServerId: string | null;

  termId: string | null;
  text: string;
  qty: number;
  unit: Unit;
  checked: boolean;
  category: ShoppingCategory | null;
  extra: any | null;

  createdAt: number;
  updatedAt: number;
  dirty: boolean;
  deleted: boolean;
};

export function uuid() {
  // good enough for local ids
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function unitToApi(u: Unit): ApiUnit {
  if (u === 'g') return 'G';
  if (u === 'ml') return 'ML';
  if (u === 'kg') return 'KG';
  if (u === 'l') return 'L';
  return 'PCS';
}

export function unitFromApi(u: any): ShoppingUnit | null {
  const s = String(u ?? '').toLowerCase();
  if (s === 'pcs') return ShoppingUnit.PCS;
  if (s === 'g') return ShoppingUnit.G;
  if (s === 'kg') return ShoppingUnit.KG;
  if (s === 'ml') return ShoppingUnit.ML;
  if (s === 'l') return ShoppingUnit.L;
  return null;
}

function norm(s: string) {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function makeDedupeKey(text: string, termId: string | null) {
  if (termId) return termId;
  return norm(text);
}

function safeQty(q: any) {
  const n = Number(String(q).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.round(n * 100) / 100;
}

/* ======================
   Lists
====================== */

export async function localListLists(): Promise<LocalShoppingList[]> {
  const rows = await sqlAll<any>(
    `SELECT local_id, server_id, name, created_at, updated_at, dirty, deleted
     FROM shopping_lists
     WHERE deleted=0
     ORDER BY updated_at DESC;`,
  );

  return rows.map((r) => ({
    localId: String(r.local_id),
    serverId: r.server_id ? String(r.server_id) : null,
    name: String(r.name),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    dirty: Number(r.dirty) === 1,
    deleted: Number(r.deleted) === 1,
  }));
}

export async function localCreateList(name: string): Promise<LocalShoppingList> {
  const now = Date.now();
  const localId = uuid();
  const n = String(name ?? '').trim();
  if (!n) throw new Error('name is required');

  await sqlRun(
    `INSERT INTO shopping_lists(local_id, server_id, name, created_at, updated_at, dirty, deleted)
     VALUES(?,?,?,?,?,1,0);`,
    [localId, null, n, now, now],
  );

  return {
    localId,
    serverId: null,
    name: n,
    createdAt: now,
    updatedAt: now,
    dirty: true,
    deleted: false,
  };
}

export async function localRenameList(localId: string, name: string) {
  const now = Date.now();
  const n = String(name ?? '').trim();
  if (!n) throw new Error('name is required');

  await sqlRun(
    `UPDATE shopping_lists
     SET name=?, updated_at=?, dirty=1
     WHERE local_id=?;`,
    [n, now, localId],
  );
}

export async function localDeleteList(localId: string) {
  const now = Date.now();
  // mark deleted; items too
  await sqlRun(`UPDATE shopping_lists SET deleted=1, updated_at=?, dirty=1 WHERE local_id=?;`, [
    now,
    localId,
  ]);
  await sqlRun(
    `UPDATE shopping_items SET deleted=1, updated_at=?, dirty=1 WHERE list_local_id=?;`,
    [now, localId],
  );
}

/* ======================
   Items
====================== */

export async function localListItems(listLocalId: string): Promise<LocalShoppingItem[]> {
  const rows = await sqlAll<any>(
    `SELECT *
     FROM shopping_items
     WHERE list_local_id=? AND deleted=0
     ORDER BY checked ASC, updated_at DESC;`,
    [listLocalId],
  );

  return rows.map(mapRowItem);
}

function mapRowItem(r: any): LocalShoppingItem {
  return {
    localId: String(r.local_id),
    serverId: r.server_id ? String(r.server_id) : null,
    listLocalId: String(r.list_local_id),
    listServerId: r.list_server_id ? String(r.list_server_id) : null,
    termId: r.term_id ? String(r.term_id) : null,
    text: String(r.text),
    qty: Number(r.qty ?? 1),
    unit: String(r.unit ?? 'pcs') as Unit,
    checked: Number(r.checked) === 1,
    category: r.category ? (String(r.category) as any) : null,
    extra: r.extra_json ? safeJsonParse(r.extra_json) : null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    dirty: Number(r.dirty) === 1,
    deleted: Number(r.deleted) === 1,
  };
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function localAddItem(input: {
  listLocalId: string;
  termId?: string | null;
  text: string;
  qty?: any;
  unit?: Unit;
  category?: ShoppingCategory | null;
  extra?: any | null;
}): Promise<LocalShoppingItem> {
  const now = Date.now();
  const localId = uuid();

  const text = String(input.text ?? '').trim();
  if (!text) throw new Error('text is required');

  const termId = input.termId ? String(input.termId) : null;

  const qty = safeQty(input.qty);
  const unit = (input.unit ?? 'pcs') as Unit;
  const checked = false;
  const category = input.category ?? null;
  const extra = input.extra ?? null;

  const normalizedText = norm(text);
  const dedupeKey = makeDedupeKey(text, termId);

  const list = await sqlGet<any>(`SELECT server_id FROM shopping_lists WHERE local_id=? LIMIT 1;`, [
    input.listLocalId,
  ]);

  const listServerId = list?.server_id ? String(list.server_id) : null;

  await sqlRun(
    `INSERT INTO shopping_items(
      local_id, server_id, list_local_id, list_server_id,
      term_id, text, normalized_text, dedupe_key,
      qty, unit, checked, category, extra_json,
      created_at, updated_at, dirty, deleted
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0);`,
    [
      localId,
      null,
      input.listLocalId,
      listServerId,
      termId,
      text,
      normalizedText,
      dedupeKey,
      qty,
      unit,
      0,
      category,
      extra ? JSON.stringify(extra) : null,
      now,
      now,
      1,
    ],
  );

  // bump list updated_at
  await sqlRun(`UPDATE shopping_lists SET updated_at=?, dirty=1 WHERE local_id=?;`, [
    now,
    input.listLocalId,
  ]);

  return {
    localId,
    serverId: null,
    listLocalId: input.listLocalId,
    listServerId,
    termId,
    text,
    qty,
    unit,
    checked,
    category,
    extra,
    createdAt: now,
    updatedAt: now,
    dirty: true,
    deleted: false,
  };
}

export async function localUpdateItem(
  localId: string,
  patch: Partial<{
    text: string;
    qty: any;
    unit: Unit;
    checked: boolean;
    category: ShoppingCategory | null;
    extra: any | null;
  }>,
) {
  const now = Date.now();
  const row = await sqlGet<any>(`SELECT * FROM shopping_items WHERE local_id=? LIMIT 1;`, [
    localId,
  ]);
  if (!row) throw new Error('item not found');

  const nextText = patch.text !== undefined ? String(patch.text).trim() : String(row.text);
  if (!nextText) throw new Error('text cannot be empty');

  const nextQty = patch.qty !== undefined ? safeQty(patch.qty) : Number(row.qty ?? 1);
  const nextUnit = patch.unit !== undefined ? patch.unit : (String(row.unit ?? 'pcs') as Unit);
  const nextChecked =
    patch.checked !== undefined ? Boolean(patch.checked) : Number(row.checked) === 1;
  const nextCategory =
    patch.category !== undefined
      ? patch.category
      : row.category
        ? (String(row.category) as any)
        : null;
  const nextExtra =
    patch.extra !== undefined ? patch.extra : row.extra_json ? safeJsonParse(row.extra_json) : null;

  const normalizedText = norm(nextText);
  const termId = row.term_id ? String(row.term_id) : null;
  const dedupeKey = makeDedupeKey(nextText, termId);

  await sqlRun(
    `UPDATE shopping_items
     SET text=?, normalized_text=?, dedupe_key=?,
         qty=?, unit=?, checked=?,
         category=?, extra_json=?,
         updated_at=?, dirty=1
     WHERE local_id=?;`,
    [
      nextText,
      normalizedText,
      dedupeKey,
      nextQty,
      nextUnit,
      nextChecked ? 1 : 0,
      nextCategory,
      nextExtra ? JSON.stringify(nextExtra) : null,
      now,
      localId,
    ],
  );

  await sqlRun(`UPDATE shopping_lists SET updated_at=?, dirty=1 WHERE local_id=?;`, [
    now,
    String(row.list_local_id),
  ]);
}

export async function localDeleteItem(localId: string) {
  const now = Date.now();
  const row = await sqlGet<any>(
    `SELECT list_local_id FROM shopping_items WHERE local_id=? LIMIT 1;`,
    [localId],
  );
  if (!row) return;

  await sqlRun(`UPDATE shopping_items SET deleted=1, updated_at=?, dirty=1 WHERE local_id=?;`, [
    now,
    localId,
  ]);

  await sqlRun(`UPDATE shopping_lists SET updated_at=?, dirty=1 WHERE local_id=?;`, [
    now,
    String(row.list_local_id),
  ]);
}

/* ======================
   Apply server ids (after sync/import)
====================== */

export async function localAttachServerListId(listLocalId: string, serverId: string) {
  await sqlRun(`UPDATE shopping_lists SET server_id=?, dirty=0 WHERE local_id=?;`, [
    serverId,
    listLocalId,
  ]);

  // propagate to items
  await sqlRun(`UPDATE shopping_items SET list_server_id=? WHERE list_local_id=?;`, [
    serverId,
    listLocalId,
  ]);
}

export async function localAttachServerItemId(itemLocalId: string, serverId: string) {
  await sqlRun(`UPDATE shopping_items SET server_id=?, dirty=0 WHERE local_id=?;`, [
    serverId,
    itemLocalId,
  ]);
}

export async function localMarkListClean(localId: string) {
  await sqlRun(`UPDATE shopping_lists SET dirty=0 WHERE local_id=?;`, [localId]);
}
export async function localMarkItemClean(localId: string) {
  await sqlRun(`UPDATE shopping_items SET dirty=0 WHERE local_id=?;`, [localId]);
}
