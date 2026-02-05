import { create } from 'zustand';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetState = {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  lastChangeAt: number;
  hydrate: () => () => void; // returns unsubscribe
  setStateFromNetInfo: (s: NetInfoState) => void;
};

export const useNetStore = create<NetState>((set, get) => ({
  isOnline: true,
  isInternetReachable: null,
  lastChangeAt: Date.now(),

  setStateFromNetInfo: (s) => {
    const isOnline = Boolean(s.isConnected);
    const isInternetReachable = s.isInternetReachable ?? null;

    set({
      isOnline,
      isInternetReachable,
      lastChangeAt: Date.now(),
    });
  },

  hydrate: () => {
    const unsub = NetInfo.addEventListener((s) => get().setStateFromNetInfo(s));
    // trigger initial fetch
    NetInfo.fetch()
      .then((s) => get().setStateFromNetInfo(s))
      .catch(() => {
        /* empty */
      });
    return unsub;
  },
}));
