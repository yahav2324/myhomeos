import * as React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

type Tone = 'default' | 'muted' | 'danger';

export function AppText({ style, tone = 'default', ...props }: TextProps & { tone?: Tone }) {
  return <Text {...props} style={[styles.base, toneStyles[tone], style]} />;
}

const styles = StyleSheet.create({
  base: {
    color: theme.colors.text,
    fontSize: 14,
  },
});

const toneStyles = StyleSheet.create({
  default: {},
  muted: { color: theme.colors.muted },
  danger: { color: theme.colors.danger },
});
