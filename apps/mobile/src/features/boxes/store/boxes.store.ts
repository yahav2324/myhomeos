import { create } from 'zustand';
import { fetchBoxes } from '../api/boxes.api';
import type { BoxItem } from '../model/types';

type State = {
  items: BoxItem[];
  initialLoading: boolean;
  refreshing: boolean;
  err: string | null;

  load: () => Promise<void>;
  refresh: () => Promise<void>;

  // WS
  upsertFromWs: (box: BoxItem) => void;
};

export const useBoxesStore = create<State>((set, get) => ({
  items: [],
  initialLoading: true,
  refreshing: false,
  err: null,

  load: async () => {
    try {
      set({ initialLoading: true, err: null });
      const res = await fetchBoxes();
      set({ items: res, initialLoading: false });
    } catch (e: any) {
      set({ err: e?.message ?? 'Failed to load', initialLoading: false });
    }
  },

  refresh: async () => {
    try {
      set({ refreshing: true, err: null });
      const res = await fetchBoxes();
      set({ items: res, refreshing: false });
    } catch (e: any) {
      set({ err: e?.message ?? 'Failed to refresh', refreshing: false });
    }
  },

  upsertFromWs: (box) => {
    // חשוב: ליצור מערך חדש + אובייקט חדש כדי לכפות רנדר
    const items = get().items;
    const idx = items.findIndex((x) => x.id === box.id);

    if (idx === -1) {
      set({ items: [box, ...items] });
      return;
    }

    const next = items.slice();
    next[idx] = { ...items[idx], ...box };
    set({ items: next });
  },
}));
