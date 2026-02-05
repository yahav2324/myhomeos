import { create } from 'zustand';
import type { ShoppingCategory } from '@smart-kitchen/contracts';
import {
  localAddItem,
  localCreateList,
  localDeleteItem,
  localDeleteList,
  localListItems,
  localListLists,
  localRenameList,
  localUpdateItem,
  type LocalShoppingItem,
  type LocalShoppingList,
  type Unit,
} from '../offline/shopping.local';
import { outboxEnqueue } from '../offline/outbox';
import { syncOutboxOnce } from '../offline/shopping.sync';
import { Platform } from 'react-native';

import {
  apiListLists,
  apiCreateList,
  apiRenameList,
  apiDeleteList,
  apiListItems,
  apiAddItem,
  apiUpdateItem,
  apiDeleteItem,
} from '../remote/shopping.remote';

type State = {
  lists: LocalShoppingList[];
  itemsByListLocalId: Record<string, LocalShoppingItem[]>;
  loading: boolean;
  saving: boolean;
  lastError: string | null;

  refreshLists: () => Promise<void>;
  refreshItems: (listLocalId: string) => Promise<void>;

  createList: (name: string) => Promise<void>;
  renameList: (list: LocalShoppingList, name: string) => Promise<void>;
  deleteList: (list: LocalShoppingList) => Promise<void>;

  addItem: (
    list: LocalShoppingList,
    payload: {
      text: string;
      termId?: string | null;
      qty?: any;
      unit?: Unit;
      category?: ShoppingCategory | null;
      extra?: any | null;
    },
  ) => Promise<void>;

  updateItem: (list: LocalShoppingList, item: LocalShoppingItem, patch: any) => Promise<void>;
  deleteItem: (list: LocalShoppingList, item: LocalShoppingItem) => Promise<void>;

  trySync: () => Promise<void>;
};

// ✅ מיפוי API → Local (בשביל web)
function mapApiListToLocal(l: any): LocalShoppingList {
  return {
    localId: l.id, // ב-web: localId == serverId
    serverId: l.id,
    name: l.name,
    updatedAt: new Date(l.updatedAt).getTime(),
    createdAt: new Date(l.createdAt).getTime(),
    dirty: false,
    deleted: false,
  };
}

// אם ה-API שלך מחזיר שדות שונים—תתאים כאן פעם אחת והכל יסתדר
function mapApiItemToLocal(listId: string, i: any): LocalShoppingItem {
  return {
    localId: i.id, // ב-web: localId == serverId
    serverId: i.id,
    listLocalId: listId,
    listServerId: i.listServerId,
    text: i.text,
    termId: i.termId ?? null,
    qty: i.qty ?? null,
    unit: i.unit ?? null,
    category: i.category ?? null,
    extra: i.extra ?? null,
    checked: Boolean(i.checked),
    updatedAt: new Date(i.updatedAt ?? Date.now()).getTime(),
    createdAt: new Date(i.createdAt ?? Date.now()).getTime(),
    dirty: false,
    deleted: false,
  };
}

export const useShoppingStore = create<State>((set, get) => ({
  lists: [],
  itemsByListLocalId: {},
  loading: false,
  saving: false,
  lastError: null,

  refreshLists: async () => {
    set({ loading: true, lastError: null });
    try {
      if (Platform.OS === 'web') {
        const apiLists = await apiListLists();
        const mapped: LocalShoppingList[] = (apiLists ?? []).map(mapApiListToLocal);
        set({ lists: mapped });
        return;
      }

      const lists = await localListLists();
      set({ lists });
    } catch (e: any) {
      set({ lastError: String(e?.message ?? e) });
    } finally {
      set({ loading: false });
    }
  },

  refreshItems: async (listLocalId) => {
    set({ loading: true, lastError: null });
    try {
      if (Platform.OS === 'web') {
        const apiItems = await apiListItems(listLocalId);
        const mapped = (apiItems ?? []).map((i) => mapApiItemToLocal(listLocalId, i));
        set((s) => ({ itemsByListLocalId: { ...s.itemsByListLocalId, [listLocalId]: mapped } }));
        return;
      }

      const items = await localListItems(listLocalId);
      set((s) => ({ itemsByListLocalId: { ...s.itemsByListLocalId, [listLocalId]: items } }));
    } catch (e: any) {
      set({ lastError: String(e?.message ?? e) });
    } finally {
      set({ loading: false });
    }
  },

  createList: async (name) => {
    set({ saving: true, lastError: null });
    try {
      if (Platform.OS === 'web') {
        await apiCreateList(name);
        await get().refreshLists();
        return;
      }

      const list = await localCreateList(name);
      await outboxEnqueue('LIST_CREATE', { listLocalId: list.localId, name: list.name });
      await get().refreshLists();
      void get().trySync();
    } catch (e: any) {
      set({ lastError: String(e?.message ?? e) });
    } finally {
      set({ saving: false });
    }
  },

  renameList: async (list, name) => {
    set({ saving: true, lastError: null });
    try {
      if (Platform.OS === 'web') {
        const id = list.serverId ?? list.localId;
        await apiRenameList(id, name);
        await get().refreshLists();
        return;
      }

      await localRenameList(list.localId, name);
      await outboxEnqueue('LIST_RENAME', {
        listLocalId: list.localId,
        listServerId: list.serverId,
        name,
      });
      await get().refreshLists();
      void get().trySync();
    } catch (e: any) {
      set({ lastError: String(e?.message ?? e) });
    } finally {
      set({ saving: false });
    }
  },

  deleteList: async (list) => {
    set({ saving: true, lastError: null });
    try {
      if (Platform.OS === 'web') {
        const id = list.serverId ?? list.localId;
        await apiDeleteList(id);
        // ניקוי items מה-cache כדי שלא תראה “שאריות”
        set((s) => {
          const next = { ...s.itemsByListLocalId };
          delete next[list.localId];
          return { itemsByListLocalId: next };
        });
        await get().refreshLists();
        return;
      }

      await localDeleteList(list.localId);
      await outboxEnqueue('LIST_DELETE', {
        listLocalId: list.localId,
        listServerId: list.serverId,
      });
      await get().refreshLists();
      void get().trySync();
    } catch (e: any) {
      set({ lastError: String(e?.message ?? e) });
    } finally {
      set({ saving: false });
    }
  },

  addItem: async (list, payload) => {
    set({ saving: true, lastError: null });
    try {
      if (Platform.OS === 'web') {
        const listId = list.serverId ?? list.localId;
        await apiAddItem(listId, payload);
        await get().refreshItems(list.localId);
        await get().refreshLists();
        return;
      }

      const created = await localAddItem({
        listLocalId: list.localId,
        ...payload,
      });

      await outboxEnqueue('ITEM_ADD', {
        itemLocalId: created.localId,
        listLocalId: list.localId,
        listServerId: list.serverId,
        text: created.text,
        termId: created.termId,
        qty: created.qty,
        unit: created.unit,
        category: created.category,
        extra: created.extra,
      });

      await get().refreshItems(list.localId);
      await get().refreshLists();
      void get().trySync();
    } catch (e: any) {
      set({ lastError: String(e?.message ?? e) });
    } finally {
      set({ saving: false });
    }
  },

  updateItem: async (list, item, patch) => {
    set({ saving: true, lastError: null });
    try {
      if (Platform.OS === 'web') {
        const listId = list.serverId ?? list.localId;
        const itemId = item.serverId ?? item.localId;
        await apiUpdateItem(listId, itemId, patch);
        await get().refreshItems(list.localId);
        await get().refreshLists();
        return;
      }

      await localUpdateItem(item.localId, patch);

      await outboxEnqueue('ITEM_UPDATE', {
        itemLocalId: item.localId,
        itemServerId: item.serverId,
        listServerId: list.serverId,
        patch,
      });

      await get().refreshItems(list.localId);
      await get().refreshLists();
      void get().trySync();
    } catch (e: any) {
      set({ lastError: String(e?.message ?? e) });
    } finally {
      set({ saving: false });
    }
  },

  deleteItem: async (list, item) => {
    set({ saving: true, lastError: null });
    try {
      if (Platform.OS === 'web') {
        const listId = list.serverId ?? list.localId;
        const itemId = item.serverId ?? item.localId;
        await apiDeleteItem(listId, itemId);
        await get().refreshItems(list.localId);
        await get().refreshLists();
        return;
      }

      await localDeleteItem(item.localId);

      await outboxEnqueue('ITEM_DELETE', {
        itemServerId: item.serverId,
        listServerId: list.serverId,
      });

      await get().refreshItems(list.localId);
      await get().refreshLists();
      void get().trySync();
    } catch (e: any) {
      set({ lastError: String(e?.message ?? e) });
    } finally {
      set({ saving: false });
    }
  },

  trySync: async () => {
    if (Platform.OS === 'web') return;
    try {
      await syncOutboxOnce();
    } catch {
      // swallow (network down)
    }
  },
}));
