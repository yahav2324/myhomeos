import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

type NetworkState = {
  isOnline: boolean;
  lastChangeAt: number;
  init: () => () => void;
  setOnline: (on: boolean) => void;
};

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: true,
  lastChangeAt: Date.now(),

  setOnline: (on) => set({ isOnline: on, lastChangeAt: Date.now() }),

  init: () => {
    // ✅ Web fallback אם NetInfo לא מחזיר כלום
    if (Platform.OS === 'web') {
      const apply = () => set({ isOnline: navigator.onLine, lastChangeAt: Date.now() });
      apply();
      window.addEventListener('online', apply);
      window.addEventListener('offline', apply);
      return () => {
        window.removeEventListener('online', apply);
        window.removeEventListener('offline', apply);
      };
    }

    const unsub = NetInfo.addEventListener((state) => {
      // state.isInternetReachable לפעמים null בהתחלה — אז נשתמש ב-isConnected fallback
      const on = Boolean(state.isInternetReachable ?? state.isConnected ?? true);
      set({ isOnline: on, lastChangeAt: Date.now() });
    });

    // גם fetch ראשוני
    NetInfo.fetch()
      .then((state) => {
        const on = Boolean(state.isInternetReachable ?? state.isConnected ?? true);
        set({ isOnline: on, lastChangeAt: Date.now() });
      })
      .catch(() => {
        /* empty */
      });

    return () => unsub();
  },
}));
