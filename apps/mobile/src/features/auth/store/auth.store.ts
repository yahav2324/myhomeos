import { create } from 'zustand';
import { getTokens, saveTokens, clearTokens } from '../auth.tokens';

type AuthState = {
  isBootstrapped: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  needsOnboarding: boolean;
  bootstrap: () => Promise<void>;
  setSession: (access: string, refresh: string, needsOnboarding: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  isBootstrapped: false,
  accessToken: null,
  refreshToken: null,
  needsOnboarding: false,

  bootstrap: async () => {
    const t = await getTokens();
    set({
      isBootstrapped: true,
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      needsOnboarding: false,
    });
  },

  setSession: async (access, refresh, needsOnboarding) => {
    await saveTokens(access, refresh);
    set({ accessToken: access, refreshToken: refresh, needsOnboarding });
  },

  logout: async () => {
    await clearTokens();
    set({ accessToken: null, refreshToken: null, needsOnboarding: false });
  },
}));
