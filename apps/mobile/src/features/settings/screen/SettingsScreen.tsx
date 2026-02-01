// apps/mobile/src/features/settings/screens/SettingsScreen.tsx
import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { t } from '../../../shared/i18n/i18n';
import { useLangStore } from '../../../shared/i18n/lang.store';
import { rtl } from '../../../shared/theme/rtlStyles';
import { theme } from '../../../shared/theme/theme';
import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';

type Lang = 'he' | 'en';

export function SettingsScreen() {
  const lang = useLangStore((s) => s.lang as Lang);
  const setLang = useLangStore((s) => s.setLang);

  const [busy, setBusy] = React.useState(false);

  const changeLang = React.useCallback(
    async (next: Lang) => {
      if (next === lang) return;

      try {
        setBusy(true);

        // ✅ הכל מתבצע בתוך ה-store:
        // - שמירה ל-AsyncStorage
        // - i18n.locale
        // - applyRtlIfNeeded(…, { interactive:true }) עם restart רק ביוזמת משתמש
        await setLang(next, { interactive: true });
      } finally {
        setBusy(false);
      }
    },
    [lang, setLang],
  );

  return (
    <View style={styles.container}>
      <Card>
        <AppText style={[styles.title, lang === 'he' ? styles.textRTL : styles.textLTR]}>
          {t('settings')}
        </AppText>

        <View style={{ marginTop: theme.space.lg }}>
          <AppText
            style={[styles.section, rtl.text, lang === 'he' ? styles.textRTL : styles.textLTR]}
          >
            {t('language')}
          </AppText>

          <View style={[styles.row, lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
            <LangPill
              label={t('english')}
              active={lang === 'en'}
              disabled={busy}
              onPress={() => changeLang('en')}
            />
            <LangPill
              label={t('hebrew')}
              active={lang === 'he'}
              disabled={busy}
              onPress={() => changeLang('he')}
            />
          </View>

          <AppText
            tone="muted"
            style={[styles.note, rtl.text, lang === 'he' ? styles.textRTL : styles.textLTR]}
          >
            {t('languageRestartNote')}
          </AppText>

          {busy ? (
            <AppText tone="muted" style={[styles.note, { marginTop: 6 }]}>
              מחיל שינוי...
            </AppText>
          ) : null}
        </View>
      </Card>
    </View>
  );
}

function LangPill(props: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { label, active, disabled, onPress } = props;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillOn,
        disabled && styles.pillDisabled,
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <AppText style={[styles.pillText, rtl.text]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.xl },

  title: { fontSize: 22, fontWeight: '900' },
  section: { fontSize: 14, fontWeight: '900' },

  row: { flexDirection: 'row', gap: 10, marginTop: theme.space.md },
  rowRTL: { flexDirection: 'row-reverse' },
  rowLTR: { flexDirection: 'row' },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillOn: {
    borderColor: 'rgba(59,130,246,0.7)',
    backgroundColor: 'rgba(59,130,246,0.14)',
  },
  pillDisabled: {
    opacity: 0.6,
  },
  pillText: { fontSize: 13, fontWeight: '900' },

  note: { marginTop: 10, fontSize: 12 },

  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
  textLTR: { writingDirection: 'ltr', textAlign: 'left' },
});
