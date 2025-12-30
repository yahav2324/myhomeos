import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { theme } from '../theme/theme';

export function EmptyState({
  title,
  subtitle,
  actionTitle,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <AppText style={styles.title}>{title}</AppText>
      {subtitle ? (
        <AppText tone="muted" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
      {actionTitle && onAction ? (
        <AppButton title={actionTitle} onPress={onAction} style={{ marginTop: theme.space.md }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: theme.space.xl,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    gap: theme.space.sm,
  },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { textAlign: 'center' },
});
