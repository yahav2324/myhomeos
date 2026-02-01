import { I18nManager, Platform, DevSettings, BackHandler, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from './i18n';

let Updates: any = null;
try {
  Updates = require('expo-updates');
} catch {
  /* empty */
}

const RTL_PENDING_KEY = 'rtl:pendingRestart';

export function shouldUseRtl(lang: Lang) {
  return lang === 'he';
}

/**
 * Apply RTL/LTR settings.
 * IMPORTANT: do NOT force reload/exit automatically during startup,
 * or you can create an infinite crash/restart loop in preview builds.
 */
export async function applyRtlIfNeeded(lang: Lang, opts?: { interactive?: boolean }) {
  const wantRtl = shouldUseRtl(lang);
  const isRtlNow = I18nManager.isRTL;

  if (wantRtl === isRtlNow) {
    // Clear pending restart if we’re already in the desired direction
    await AsyncStorage.removeItem(RTL_PENDING_KEY).catch(() => {
      /* empty */
    });
    return;
  }

  // Apply desired direction (takes effect on next app start)
  I18nManager.allowRTL(wantRtl);
  I18nManager.forceRTL(wantRtl);

  // Mark that we need a restart
  await AsyncStorage.setItem(RTL_PENDING_KEY, '1').catch(() => {
    /* empty */
  });

  // If not interactive (e.g., during startup), DO NOT restart automatically.
  if (!opts?.interactive) return;

  // Interactive restart (user explicitly changed language)
  await restartApp();
}

/**
 * Call this once on app startup AFTER loading lang,
 * to optionally show a friendly prompt instead of looping.
 */
export async function maybePromptRtlRestartIfPending() {
  const pending = await AsyncStorage.getItem(RTL_PENDING_KEY).catch(() => null);
  if (!pending) return;

  Alert.alert('נדרש אתחול', 'כדי להחיל שינוי כיוון (RTL/LTR), צריך להפעיל מחדש את האפליקציה.', [
    { text: 'לא עכשיו', style: 'cancel' },
    { text: 'הפעל מחדש', onPress: () => void restartApp() },
  ]);
}

async function restartApp() {
  // 1) expo-updates (best for production-like builds)
  try {
    if (Updates?.isEnabled && Updates?.reloadAsync) {
      await Updates.reloadAsync();
      return;
    }
  } catch {
    /* empty */
  }

  // 2) DevSettings (works in dev sometimes)
  try {
    DevSettings.reload();
    return;
  } catch {
    /* empty */
  }

  // 3) Android fallback
  if (Platform.OS === 'android') {
    BackHandler.exitApp();
  }
}
