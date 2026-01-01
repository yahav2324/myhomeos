import * as React from 'react';
import { View, ViewProps, StyleSheet, I18nManager } from 'react-native';
import { theme } from '../theme/theme';

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, I18nManager.isRTL && styles.cardRTL, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: theme.space.lg,
    ...theme.shadow.card,
  },
  cardRTL: {
    // לא חובה, אבל עוזר למסכים שלא מגדירים alignItems לבד
    alignItems: 'stretch',
  },
});
