import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import { apiPing } from '../../features/shopping/remote/shopping.remote';

type NetState = 'online' | 'offline';
type ServerState = 'ok' | 'down' | 'unknown';

type ConnectivityState = {
  net: NetState;
  server: ServerState;
  lastServerOkAt: number | null;
  lastServerError: string | null;

  start: () => () => void;
  pingNow: () => Promise<void>;
};

function now() {
  return Date.now();
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  net: 'online',
  server: 'unknown',
  lastServerOkAt: null,
  lastServerError: null,

  start: () => {
    const unsub = NetInfo.addEventListener((s) => {
      const isOnline = Boolean(s.isConnected) && Boolean(s.isInternetReachable ?? true);
      set({ net: isOnline ? 'online' : 'offline' });

      // אם נהיית offline – אל תציג "server down" (זה לא נכון), תחזיר ל-unknown
      if (!isOnline) {
        set({ server: 'unknown' });
      }
    });

    // ping מחזורי (רק אם יש אינטרנט)
    const t = setInterval(() => {
      const st = get();
      if (st.net === 'online')
        st.pingNow().catch(() => {
          /* empty */
        });
    }, 12_000);

    // ping ראשון
    get()
      .pingNow()
      .catch(() => {
        /* empty */
      });

    return () => {
      unsub();
      clearInterval(t);
    };
  },

  pingNow: async () => {
    const st = get();
    if (st.net !== 'online') {
      set({ server: 'unknown' });
      return;
    }

    try {
      const ok = await apiPing();
      if (ok) {
        set({
          server: 'ok',
          lastServerOkAt: now(),
          lastServerError: null,
        });
      } else {
        set({
          server: 'down',
          lastServerError: 'Health returned not ok',
        });
      }
    } catch (e: any) {
      set({
        server: 'down',
        lastServerError: String(e?.message ?? e),
      });
    }
  },
}));
