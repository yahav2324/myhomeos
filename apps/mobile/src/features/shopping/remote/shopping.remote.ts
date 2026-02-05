import { authedFetch } from '../../auth/api/auth.api';

type ApiList = { id: string; name: string; createdAt: string; updatedAt: string };
type ApiItem = any;

const BASE = '';

async function parseJsonSafe(res: Response) {
  const txt = await res.text().catch(() => '');
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

function ensureOk(res: Response, json: any) {
  if (res.ok) return;
  const msg =
    (json && (json.message || json.error)) || `HTTP ${res.status} ${res.statusText || ''}`.trim();
  const err: any = new Error(msg);
  err.status = res.status;
  throw err;
}

export async function apiPing(): Promise<boolean> {
  const res = await authedFetch(`${BASE}/health`, { method: 'GET' });
  const json = await parseJsonSafe(res);
  if (!res.ok) return false;
  return Boolean(json?.ok);
}

export async function apiListLists(): Promise<ApiList[]> {
  const res = await authedFetch(`${BASE}/shopping/lists`, { method: 'GET' });
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
  return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
}

export async function apiCreateList(name: string): Promise<ApiList> {
  const res = await authedFetch(`${BASE}/shopping/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
  return json?.data ?? json;
}

export async function apiRenameList(listId: string, name: string): Promise<void> {
  const res = await authedFetch(`${BASE}/shopping/lists/${encodeURIComponent(listId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
}

export async function apiDeleteList(listId: string): Promise<void> {
  const res = await authedFetch(`${BASE}/shopping/lists/${encodeURIComponent(listId)}`, {
    method: 'DELETE',
  });
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
}

export async function apiListItems(listId: string): Promise<ApiItem[]> {
  const res = await authedFetch(`${BASE}/shopping/lists/${encodeURIComponent(listId)}/items`, {
    method: 'GET',
  });
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
  return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
}

export async function apiAddItem(listId: string, payload: any): Promise<{ id: string }> {
  const res = await authedFetch(`${BASE}/shopping/lists/${encodeURIComponent(listId)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
  return json?.data ?? json;
}

export async function apiUpdateItem(listId: string, itemId: string, patch: any): Promise<void> {
  const res = await authedFetch(
    `${BASE}/shopping/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
}

export async function apiDeleteItem(listId: string, itemId: string): Promise<void> {
  const res = await authedFetch(
    `${BASE}/shopping/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
}

export async function apiImportGuest(payload: any): Promise<any> {
  const res = await authedFetch(`${BASE}/shopping/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await parseJsonSafe(res);
  ensureOk(res, json);
  return json?.data ?? json;
}
