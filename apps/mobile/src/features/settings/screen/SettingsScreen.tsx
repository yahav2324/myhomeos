import * as React from 'react';
import { View, Pressable, StyleSheet, I18nManager } from 'react-native';

import { t } from '../../../shared/i18n/i18n';
import { useLangStore } from '../../../shared/i18n/lang.store';
import { rtl } from '../../../shared/theme/rtlStyles';
import { theme } from '../../../shared/theme/theme';
import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';

export function SettingsScreen() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);

  return (
    <View style={styles.container}>
      <Card>
        <AppText style={[styles.title, lang === 'he' ? styles.textRTL : styles.textLTR]}>
          {t('settings')}
        </AppText>

        <View style={{ marginTop: theme.space.lg }}>
          <AppText
            style={[
              styles.section,
              rtl.text,
              styles.title,
              lang === 'he' ? styles.textRTL : styles.textLTR,
            ]}
          >
            {t('language')}
          </AppText>

          <View style={[styles.row, lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
            <LangPill label={t('english')} active={lang === 'en'} onPress={() => setLang('en')} />
            <LangPill label={t('hebrew')} active={lang === 'he'} onPress={() => setLang('he')} />
          </View>

          <AppText
            tone="muted"
            style={[styles.note, rtl.text, lang === 'he' ? styles.textRTL : styles.textLTR]}
          >
            {t('languageRestartNote')}
          </AppText>
        </View>
      </Card>
    </View>
  );
}

function LangPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, active && styles.pillOn, pressed && { opacity: 0.85 }]}
    >
      <AppText style={[styles.pillText, rtl.text]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.xl },
  title: { fontSize: 22, fontWeight: '900' },
  section: { fontSize: 14, fontWeight: '900' },
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
  pillText: { fontSize: 13, fontWeight: '900' },
  content: {
    alignItems: 'flex-start',
  },
  contentRTL: {
    alignItems: 'flex-end',
  },

  row: { flexDirection: 'row', gap: 10, marginTop: theme.space.md },

  note: { marginTop: 10, fontSize: 12 },
  // אם תציג אנגלית כשRTL פעיל, תכריח LTR כדי לא לקבל נקודה/סדר מוזר
  noteRTL: { writingDirection: 'ltr', textAlign: 'right' },
  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
  textLTR: { writingDirection: 'ltr', textAlign: 'left' },
  rowRTL: { flexDirection: 'row-reverse' },
  rowLTR: { flexDirection: 'row' },
});
