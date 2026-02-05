import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../theme/theme';
import { useNetworkStore } from '../network/network.store';

export function OnlineBadge(props: { compact?: boolean }) {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const online = isOnline ? 'Online' : 'Offline';

  const toneStyle = isOnline ? styles.on : styles.off;

  return (
    <View style={[styles.pill, toneStyle, props.compact && styles.compact]}>
      <View style={[styles.dot, isOnline ? styles.dotOn : styles.dotOff]} />
      <AppText style={styles.text}>{online}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  compact: { paddingVertical: 4, paddingHorizontal: 8 },

  on: {
    borderColor: 'rgba(34,197,94,0.35)',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  off: {
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },

  dot: { width: 8, height: 8, borderRadius: 999 },
  dotOn: { backgroundColor: 'rgba(34,197,94,0.95)' },
  dotOff: { backgroundColor: 'rgba(239,68,68,0.95)' },

  text: { fontWeight: '900', color: theme.colors.text, opacity: 0.95 },
});
