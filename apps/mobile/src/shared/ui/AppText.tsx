import * as React from 'react';
import { Text, TextProps, StyleSheet, I18nManager } from 'react-native';
import { theme } from '../theme/theme';

type Tone = 'default' | 'muted' | 'danger';

type Dir = 'auto' | 'rtl' | 'ltr';

export function AppText({
  style,
  tone = 'default',
  dir = 'auto',
  ...props
}: TextProps & { tone?: Tone; dir?: Dir }) {
  const rtlStyle = dir === 'auto' ? styles.rtlAuto : dir === 'rtl' ? styles.rtl : styles.ltr;

  return <Text {...props} style={[styles.base, rtlStyle, toneStyles[tone], style]} />;
}
const styles = StyleSheet.create({
  base: { color: theme.colors.text, fontSize: 14 },
  rtlAuto: {
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
});

const toneStyles = StyleSheet.create({
  default: {},
  muted: { color: theme.colors.muted },
  danger: { color: theme.colors.danger },
});
