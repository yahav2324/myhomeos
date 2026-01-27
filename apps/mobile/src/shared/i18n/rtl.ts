import { I18nManager, Platform, DevSettings, BackHandler } from 'react-native';
import * as Updates from 'expo-updates';
import type { Lang } from './i18n';

export function shouldUseRtl(lang: Lang) {
  return lang === 'he';
}

export async function applyRtlIfNeeded(lang: Lang) {
  const wantRtl = shouldUseRtl(lang);
  const isRtlNow = I18nManager.isRTL;

  if (wantRtl === isRtlNow) return;

  I18nManager.allowRTL(wantRtl);
  I18nManager.forceRTL(wantRtl);

  // 1) אם updates פעיל (בבילד אמיתי) – זה הכי טוב
  try {
    if (Updates.isEnabled) {
      await Updates.reloadAsync();
      return;
    }
  } catch {
    // לא קריטי אם זה לא עבד
  }

  // 2) ב-dev לפעמים עובד
  try {
    DevSettings.reload();
    return;
  } catch {
    // לא קריטי אם זה לא עבד
  }

  // 3) הכי אמין באנדרואיד: לסגור, והמשתמש יפתח שוב
  if (Platform.OS === 'android') {
    BackHandler.exitApp();
    return;
  }

  // 4) iOS: אין דרך חוקית “להרוג אפליקציה” מתוך קוד
  // כאן הפתרון הוא להציג הודעה למשתמש: "סגור ופתח מחדש"
}
