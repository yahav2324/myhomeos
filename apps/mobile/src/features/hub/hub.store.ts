// apps/mobile/src/features/hub/hub.store.ts
import { create } from 'zustand';

export type HubPhase =
  | 'idle'
  | 'scanningHub'
  | 'connectingHub'
  | 'hubConnected'
  | 'scanningBoxes'
  | 'connectingBox';

export type BoxFound = {
  addr: string;
  name: string;
  rssi: number;
};

export type LastTelemetry = {
  unit: 'g' | 'ml';
  quantity: number;
};

export type ConnectedBox = {
  addr: string;
  boxId: string;
};

export type HubEntity = {
  hubId: string;
  name: string;
  connected: boolean;
  phase: HubPhase;
  boxesFound: BoxFound[];
  selectedAddr?: string | null;
  connectedBoxes: ConnectedBox[];
  lastError?: string;
  lastTelemetryByAddr?: Record<string, LastTelemetry>;
  navToken?: number;
};

type HubState = {
  hubs: Record<string, HubEntity>;

  // helpers
  getHub: (hubId: string) => HubEntity | undefined;
  bumpNavToken: (hubId: string) => void;

  // lifecycle
  upsertHub: (hub: { hubId: string; name?: string }) => void;
  setHubConnected: (hubId: string, connected: boolean) => void;
  setHubPhase: (hubId: string, phase: HubPhase) => void;
  setHubError: (hubId: string, msg?: string) => void;
  removeHub: (hubId: string) => void;

  // boxes found
  resetHubBoxesFound: (hubId: string) => void;
  upsertHubBoxFound: (hubId: string, box: BoxFound) => void;
  setHubSelectedAddr: (hubId: string, addr: string | null) => void;

  // connected boxes
  upsertConnectedBox: (hubId: string, box: ConnectedBox) => void;
  removeConnectedBoxByAddr: (hubId: string, addr: string) => void;
  clearConnectedBoxes: (hubId: string) => void;

  setStatusSingleOrMany: (
    hubId: string,
    status:
      | { connected: false }
      | { connected: true; addr?: string; boxId?: string }
      | { connected: true; boxes?: Array<{ addr: string; boxId: string }> },
  ) => void;
  setLastTelemetry: (hubId: string, addr: string, t: LastTelemetry) => void;
};

function sortByRssiDesc(arr: BoxFound[]) {
  return [...arr].sort((a, b) => b.rssi - a.rssi);
}

export const selectTelemetryForBox = (hubId: string, boxId: string) => (state: HubState) => {
  const hub = state.hubs[hubId];
  if (!hub) return undefined;

  const mapping = hub.connectedBoxes.find((b) => b.boxId === boxId);
  if (!mapping) return undefined;

  return hub.lastTelemetryByAddr?.[mapping.addr];
};

export const useHubStore = create<HubState>((set, get) => ({
  hubs: {},

  getHub: (hubId) => get().hubs[hubId],

  setLastTelemetry: (hubId, addr, t) =>
    set((state) => {
      const hub = state.hubs[hubId];
      if (!hub) return state;

      return {
        hubs: {
          ...state.hubs,
          [hubId]: {
            ...hub,
            lastTelemetryByAddr: {
              ...(hub.lastTelemetryByAddr ?? {}),
              [addr]: t,
            },
          },
        },
      };
    }),
  bumpNavToken: (hubId) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;
      return {
        hubs: {
          ...s.hubs,
          [hubId]: { ...h, navToken: (h.navToken ?? 0) + 1 },
        },
      };
    }),

  upsertHub: ({ hubId, name }) =>
    set((s) => {
      const prev = s.hubs[hubId];
      return {
        hubs: {
          ...s.hubs,
          [hubId]: {
            hubId,
            name: name ?? prev?.name ?? 'HUB',
            connected: prev?.connected ?? false,
            phase: prev?.phase ?? 'idle',
            boxesFound: prev?.boxesFound ?? [],
            selectedAddr: prev?.selectedAddr ?? null,
            connectedBoxes: prev?.connectedBoxes ?? [],
            lastError: prev?.lastError,
            lastTelemetryByAddr: prev?.lastTelemetryByAddr ?? {}, // ✅ חשוב
            navToken: prev?.navToken ?? 0, // ✅ חשוב
          },
        },
      };
    }),

  setHubConnected: (hubId, connected) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;
      return { hubs: { ...s.hubs, [hubId]: { ...h, connected } } };
    }),

  setHubPhase: (hubId, phase) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;
      return { hubs: { ...s.hubs, [hubId]: { ...h, phase } } };
    }),

  setHubError: (hubId, msg) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;
      return { hubs: { ...s.hubs, [hubId]: { ...h, lastError: msg } } };
    }),

  removeHub: (hubId) =>
    set((s) => {
      const next = { ...s.hubs };
      delete next[hubId];
      return { hubs: next };
    }),

  resetHubBoxesFound: (hubId) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;
      return {
        hubs: { ...s.hubs, [hubId]: { ...h, boxesFound: [], selectedAddr: null } },
      };
    }),

  upsertHubBoxFound: (hubId, box) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;

      const exists = h.boxesFound.find((b) => b.addr === box.addr);
      const next = exists
        ? h.boxesFound.map((b) => (b.addr === box.addr ? box : b))
        : [...h.boxesFound, box];

      return {
        hubs: {
          ...s.hubs,
          [hubId]: { ...h, boxesFound: sortByRssiDesc(next) },
        },
      };
    }),

  setHubSelectedAddr: (hubId, addr) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;
      return { hubs: { ...s.hubs, [hubId]: { ...h, selectedAddr: addr } } };
    }),

  upsertConnectedBox: (hubId, box) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;

      const nextConnected = h.connectedBoxes.some((b) => b.addr === box.addr)
        ? h.connectedBoxes.map((b) => (b.addr === box.addr ? box : b))
        : [...h.connectedBoxes, box];

      return {
        hubs: {
          ...s.hubs,
          [hubId]: {
            ...h,
            connectedBoxes: nextConnected,
            boxesFound: h.boxesFound.filter((b) => b.addr !== box.addr),
          },
        },
      };
    }),

  removeConnectedBoxByAddr: (hubId, addr) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;
      return {
        hubs: {
          ...s.hubs,
          [hubId]: {
            ...h,
            connectedBoxes: h.connectedBoxes.filter((b) => b.addr !== addr),
          },
        },
      };
    }),

  clearConnectedBoxes: (hubId) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;
      return { hubs: { ...s.hubs, [hubId]: { ...h, connectedBoxes: [] } } };
    }),

  setStatusSingleOrMany: (hubId, status) =>
    set((s) => {
      const h = s.hubs[hubId];
      if (!h) return s;

      if (!status.connected) {
        return { hubs: { ...s.hubs, [hubId]: { ...h, connectedBoxes: [] } } };
      }

      const boxes =
        'boxes' in status && status.boxes
          ? status.boxes
          : 'addr' in status && status.addr && status.boxId
            ? [{ addr: status.addr, boxId: status.boxId }]
            : [];

      return { hubs: { ...s.hubs, [hubId]: { ...h, connectedBoxes: boxes } } };
    }),
}));
