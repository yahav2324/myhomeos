import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n, type Lang } from './i18n';
import { applyRtlIfNeeded } from './rtl';

const KEY = 'app.lang';

type LangState = {
  lang: Lang;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLang: (lang: Lang) => Promise<void>;
};

export const useLangStore = create<LangState>((set, get) => ({
  lang: 'en',
  hydrated: false,

  hydrate: async () => {
    const saved = (await AsyncStorage.getItem(KEY)) as Lang | null;
    const lang: Lang = saved === 'he' ? 'he' : 'en';
    i18n.locale = lang;
    set({ lang, hydrated: true });
  },

  setLang: async (lang) => {
    await AsyncStorage.setItem(KEY, lang);
    i18n.locale = lang;
    set({ lang });

    // אם צריך להפוך RTL/LTR – יקרה כאן reload
    await applyRtlIfNeeded(lang);
  },
}));
