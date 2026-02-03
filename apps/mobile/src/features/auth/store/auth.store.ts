import { create } from 'zustand';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getTokens, saveTokens, clearTokens } from '../auth.tokens';

type AuthState = {
  isBootstrapped: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userName: string | null; // שדה חדש לשם המשתמש
  needsOnboarding: boolean;
  bootstrap: () => Promise<void>;
  // עדכון החתימה של הפונקציה לקבלת שם
  setSession: (
    access: string,
    refresh: string,
    name: string,
    needsOnboarding: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  isBootstrapped: false,
  accessToken: null,
  refreshToken: null,
  userName: null,
  needsOnboarding: false,

  bootstrap: async () => {
    const t = await getTokens();
    // כאן כדאי שגם getTokens יחזיר את השם אם שמרת אותו ב-Storage
    set({
      isBootstrapped: true,
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      userName: null, // או טעינה מ-Storage
    });
  },

  setSession: async (access, refresh, name, needsOnboarding) => {
    await saveTokens(access, refresh); // אם תרצה לשמור גם שם ב-Storage, תעדכן את saveTokens
    set({ accessToken: access, refreshToken: refresh, userName: name, needsOnboarding });
  },
  logout: async () => {
    try {
      if (Platform.OS !== 'web') {
        // התיקון כאן: משתמשים ב-hasPreviousSignIn
        const hasSignIn = await GoogleSignin.hasPreviousSignIn();
        if (hasSignIn) {
          await GoogleSignin.signOut();
        }
      }
      await clearTokens();
      set({ accessToken: null, refreshToken: null, userName: null, needsOnboarding: false });
    } catch (error) {
      console.error('[LOGOUT ERROR]', error);
      await clearTokens();
      set({ accessToken: null, refreshToken: null, userName: null, needsOnboarding: false });
    }
  },
}));
