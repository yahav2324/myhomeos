import {
  apiCreateList,
  apiDeleteItem,
  apiDeleteList,
  apiListLists,
  apiAddItem,
  apiRenameList,
  apiUpdateItem,
  apiImportGuest,
} from '../remote/shopping.remote';

import { outboxDefer, outboxMarkDone, outboxMarkFailedFinal, outboxPeekPending } from './outbox';
import {
  localAttachServerItemId,
  localAttachServerListId,
  localListLists,
  localListItems,
  localMarkItemClean,
  localMarkListClean,
  unitToApi,
} from './shopping.local';

import { useConnectivityStore } from '../../../shared/connectivity/connectivity.store';
import { sqlGet } from '../../../shared/db/sqlite';

function isTransientNetError(e: any) {
  const msg = String(e?.message ?? '');
  return (
    msg.includes('Network') ||
    msg.includes('Failed to fetch') ||
    msg.includes('Timeout') ||
    msg.includes('ECONN') ||
    msg.includes('abort')
  );
}

function getHttpStatus(e: any): number | null {
  const s = e?.status ?? e?.response?.status ?? e?.cause?.status;
  const n = Number(s);
  if (Number.isFinite(n)) return n;

  const msg = String(e?.message ?? '');
  const m = msg.match(/\b(400|401|403|404|409|410|422|500|502|503|504)\b/);
  return m ? Number(m[1]) : null;
}

async function ensureListServerId(p: any) {
  if (p?.listServerId) return String(p.listServerId);
  if (!p?.listLocalId) return null;

  const row = await sqlGet<any>(`SELECT server_id FROM shopping_lists WHERE local_id=? LIMIT 1;`, [
    String(p.listLocalId),
  ]);
  return row?.server_id ? String(row.server_id) : null;
}

// Push outbox operations
export async function syncOutboxOnce() {
  const { net, server } = useConnectivityStore.getState();
  if (net === 'offline') return;
  if (server === 'down') return;

  const pending = await outboxPeekPending(50);

  for (const row of pending) {
    try {
      const p = row.payload ?? {};

      if (row.op === 'LIST_CREATE') {
        const res = await apiCreateList(p.name);
        await localAttachServerListId(p.listLocalId, res.id);
        await localMarkListClean(p.listLocalId);
        await outboxMarkDone(row.id);
        continue;
      }

      if (row.op === 'LIST_RENAME') {
        const listServerId = await ensureListServerId(p);
        if (!listServerId) throw new Error('Missing listServerId');
        await apiRenameList(listServerId, p.name);
        await localMarkListClean(p.listLocalId);
        await outboxMarkDone(row.id);
        continue;
      }

      if (row.op === 'LIST_DELETE') {
        const listServerId = await ensureListServerId(p);
        if (!listServerId) {
          await outboxMarkDone(row.id);
          continue;
        }
        try {
          await apiDeleteList(listServerId);
        } catch (e: any) {
          const st = getHttpStatus(e);
          if (st === 404) {
            // כבר לא קיים בשרת -> מבחינת sync זה DONE
            await outboxMarkDone(row.id);
            continue;
          }
          throw e;
        }
        await outboxMarkDone(row.id);
        continue;
      }

      if (row.op === 'ITEM_ADD') {
        const listServerId = await ensureListServerId(p);
        if (!listServerId) throw new Error('Missing listServerId');

        const created = await apiAddItem(listServerId, {
          text: p.text,
          termId: p.termId ?? undefined,
          qty: p.qty ?? 1,
          unit: unitToApi(p.unit),
          category: p.category ?? undefined,
          extra: p.extra ?? undefined,
        });

        await localAttachServerItemId(p.itemLocalId, created.id);
        await localMarkItemClean(p.itemLocalId);
        await outboxMarkDone(row.id);
        continue;
      }

      if (row.op === 'ITEM_UPDATE') {
        const listServerId = await ensureListServerId(p);
        if (!p.itemServerId || !listServerId) throw new Error('Missing ids');

        try {
          await apiUpdateItem(listServerId, p.itemServerId, p.patch);
        } catch (e: any) {
          const st = getHttpStatus(e);
          if (st === 404) {
            // ניסינו לעדכן משהו שלא קיים -> mismatch אמיתי
            await outboxMarkFailedFinal(row.id, 'Server item not found (404)');
            continue;
          }
          throw e;
        }

        await localMarkItemClean(p.itemLocalId);
        await outboxMarkDone(row.id);
        continue;
      }

      if (row.op === 'ITEM_DELETE') {
        const listServerId = await ensureListServerId(p);

        if (!p.itemServerId || !listServerId) {
          await outboxMarkDone(row.id);
          continue;
        }

        try {
          await apiDeleteItem(listServerId, p.itemServerId);
        } catch (e: any) {
          const st = getHttpStatus(e);
          if (st === 404) {
            // כבר נמחק בשרת
            await outboxMarkDone(row.id);
            continue;
          }
          throw e;
        }

        await outboxMarkDone(row.id);
        continue;
      }

      await outboxMarkFailedFinal(row.id, 'Unknown op');
    } catch (e: any) {
      const err = String(e?.message ?? e);
      if (isTransientNetError(e)) {
        await outboxDefer(row.id, err, row.tries ?? 0);
        break; // במקום return
      }
      await outboxMarkFailedFinal(row.id, err);
    }
  }
}

// Pull
export async function pullServerToLocal() {
  await apiListLists();
}

// Guest import
export async function importGuestToServer() {
  const lists = await localListLists();

  const payloadLists: any[] = [];
  for (const l of lists) {
    const items = await localListItems(l.localId);
    payloadLists.push({
      listLocalId: l.localId,
      name: l.name,
      items: items.map((it) => ({
        itemLocalId: it.localId,
        text: it.text,
        termId: it.termId ?? null,
        qty: it.qty,
        unit: unitToApi(it.unit),
        checked: it.checked,
        category: it.category,
        extra: it.extra,
      })),
    });
  }

  const res = await apiImportGuest({ lists: payloadLists });

  const listIdMap = res.listIdMap ?? {};
  const itemIdMap = res.itemIdMap ?? {};

  for (const [listLocalId, serverId] of Object.entries(listIdMap)) {
    await localAttachServerListId(listLocalId, String(serverId));
    await localMarkListClean(listLocalId);
  }
  for (const [itemLocalId, serverId] of Object.entries(itemIdMap)) {
    await localAttachServerItemId(itemLocalId, String(serverId));
    await localMarkItemClean(itemLocalId);
  }
}
