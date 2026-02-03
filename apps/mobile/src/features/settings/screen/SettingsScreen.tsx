// apps/mobile/src/features/settings/screens/SettingsScreen.tsx
import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { t } from '../../../shared/i18n/i18n';
import { useLangStore } from '../../../shared/i18n/lang.store';
import { theme } from '../../../shared/theme/theme';
import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';
import { useAuthStore } from '../../auth/store/auth.store';

type Lang = 'he' | 'en';

export function SettingsScreen({ navigation }: any) {
  const logout = useAuthStore((s) => s.logout);
  const lang = useLangStore((s) => s.lang as Lang);
  const setLang = useLangStore((s) => s.setLang);
  const userName = useAuthStore((s) => s.userName);
  const [busy, setBusy] = React.useState(false);

  const isRTL = lang === 'he';

  const handleLogout = async () => {
    try {
      setBusy(true);
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'AuthGoogle' }],
      });
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setBusy(false);
    }
  };

  const changeLang = React.useCallback(
    async (next: Lang) => {
      if (next === lang) return;
      try {
        setBusy(true);
        await setLang(next, { interactive: true });
      } finally {
        setBusy(false);
      }
    },
    [lang, setLang],
  );

  return (
    <View style={styles.container}>
      {/* הוספת style להעלמת הרקע והצל של הכרטיס */}
      <Card style={styles.transparentCard}>
        {/* --- אזור משתמש --- */}
        <View style={[styles.userRow, isRTL ? styles.rowRTL : styles.rowLTR]}>
          <AppText style={styles.userNameText}>
            {t('hello') || 'שלום'}, {userName || 'אורח'}
          </AppText>

          <Pressable
            disabled={busy}
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && { opacity: 0.7 },
              busy && { opacity: 0.5 },
            ]}
          >
            <AppText style={styles.logoutText}>{t('logout') || 'התנתק'}</AppText>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {/* --- כותרת הגדרות --- */}
        <AppText style={[styles.title, isRTL ? styles.textRTL : styles.textLTR]}>
          {t('settings')}
        </AppText>

        <View style={{ marginTop: theme.space.lg }}>
          <AppText style={[styles.section, isRTL ? styles.textRTL : styles.textLTR]}>
            {t('language')}
          </AppText>

          <View style={[styles.row, isRTL ? styles.rowRTL : styles.rowLTR]}>
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

          <AppText tone="muted" style={[styles.note, isRTL ? styles.textRTL : styles.textLTR]}>
            {t('languageRestartNote')}
          </AppText>

          {busy ? (
            <AppText
              tone="muted"
              style={[styles.note, { marginTop: 6 }, isRTL ? styles.textRTL : styles.textLTR]}
            >
              {isRTL ? 'מבצע שינויים...' : 'Applying changes...'}
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
      <AppText style={styles.pillText}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.space.xl,
  },
  transparentCard: {
    backgroundColor: theme.colors.bg, // אותו צבע כמו הרקע של המסך
    elevation: 0, // הסרת צל באנדרואיד
    shadowOpacity: 0, // הסרת צל ב-iOS
    borderWidth: 0, // הסרת מסגרת אם קיימת ב-Card ברירת המחדל
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.2, // קו עדין מאוד
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
  },
  section: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: theme.space.md,
  },
  rowRTL: { flexDirection: 'row-reverse' },
  rowLTR: { flexDirection: 'row' },
  pill: {
    paddingHorizontal: 16,
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
  pillText: {
    fontSize: 13,
    fontWeight: '900',
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.7,
  },
  textRTL: {
    textAlign: 'right',
  },
  textLTR: {
    textAlign: 'left',
  },
});
