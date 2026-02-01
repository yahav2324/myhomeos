import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n, type Lang } from './i18n';
import { applyRtlIfNeeded, maybePromptRtlRestartIfPending } from './rtl';

const KEY = 'app.lang';

type LangState = {
  lang: Lang;
  hydrated: boolean;
  version: number;

  hydrate: () => Promise<void>;

  /**
   * Set language.
   * interactive=true means user explicitly changed it (can restart).
   * interactive=false means silent update (startup/hydration) - MUST NOT restart.
   */
  setLang: (lang: Lang, opts?: { interactive?: boolean }) => Promise<void>;
};

export const useLangStore = create<LangState>((set, get) => ({
  lang: 'en',
  hydrated: false,
  version: 0,

  hydrate: async () => {
    const saved = (await AsyncStorage.getItem(KEY)) as Lang | null;
    const lang: Lang = saved === 'he' ? 'he' : 'en';

    // Apply to i18n
    i18n.locale = lang;

    // Set store state
    set({ lang, hydrated: true, version: get().version + 1 });

    // ✅ Apply RTL config but DO NOT restart automatically during startup
    // This only sets I18nManager flags and marks "pending restart" if needed.
    await applyRtlIfNeeded(lang, { interactive: false });

    // ✅ Optionally prompt user to restart if needed (safe; no auto-exit)
    // If you prefer to control this from app.tsx, you can remove this line.
    await maybePromptRtlRestartIfPending();
  },

  setLang: async (lang, opts) => {
    const next: Lang = lang === 'he' ? 'he' : 'en';
    const prev = get().lang;

    // No-op
    if (next === prev && get().hydrated) return;

    // Persist + i18n
    await AsyncStorage.setItem(KEY, next);
    i18n.locale = next;

    // Update store
    set((s) => ({ lang: next, version: s.version + 1 }));

    // ✅ Apply RTL config
    // If interactive (user pressed a button), allow restart via rtl.ts logic.
    await applyRtlIfNeeded(next, { interactive: !!opts?.interactive });

    // If not interactive, we don't restart; we can still prompt if needed.
    if (!opts?.interactive) {
      await maybePromptRtlRestartIfPending();
    }
  },
}));
