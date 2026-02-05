import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

type ServerStatus = 'ok' | 'down' | 'unknown';

type ConnectivityState = {
  // Device network
  isOnline: boolean;
  lastNetworkChangeAt: number;

  // Server health
  serverStatus: ServerStatus;
  lastServerOkAt: number | null;
  lastServerCheckAt: number | null;
  lastServerError: string | null;

  // internals
  init: () => () => void;
  setOnline: (on: boolean) => void;
  setServerOk: () => void;
  setServerDown: (reason?: string) => void;
  setServerUnknown: () => void;
};

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  isOnline: true,
  lastNetworkChangeAt: Date.now(),

  serverStatus: 'unknown',
  lastServerOkAt: null,
  lastServerCheckAt: null,
  lastServerError: null,

  setOnline: (on) =>
    set({
      isOnline: on,
      lastNetworkChangeAt: Date.now(),
      // אם אין אינטרנט -> ברור שהשרת לא נגיש (אבל נשמור סיבה)
      ...(on ? null : { serverStatus: 'down', lastServerError: 'Device offline' }),
    } as any),

  setServerOk: () =>
    set({
      serverStatus: 'ok',
      lastServerOkAt: Date.now(),
      lastServerCheckAt: Date.now(),
      lastServerError: null,
    }),

  setServerDown: (reason) =>
    set({
      serverStatus: 'down',
      lastServerCheckAt: Date.now(),
      lastServerError: reason ?? 'Server unreachable',
    }),

  setServerUnknown: () =>
    set({
      serverStatus: 'unknown',
      lastServerCheckAt: Date.now(),
      lastServerError: null,
    }),

  init: () => {
    if (Platform.OS === 'web') {
      const apply = () => get().setOnline(navigator.onLine);
      apply();
      window.addEventListener('online', apply);
      window.addEventListener('offline', apply);
      return () => {
        window.removeEventListener('online', apply);
        window.removeEventListener('offline', apply);
      };
    }

    const unsub = NetInfo.addEventListener((state) => {
      const on = Boolean(state.isInternetReachable ?? state.isConnected ?? true);
      get().setOnline(on);
    });

    NetInfo.fetch()
      .then((state) => {
        const on = Boolean(state.isInternetReachable ?? state.isConnected ?? true);
        get().setOnline(on);
      })
      .catch(() => {
        /* empty */
      });

    return () => unsub();
  },
}));
