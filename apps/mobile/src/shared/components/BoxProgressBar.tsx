import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../ui/AppText';
import { theme } from '../theme/theme';

export type BoxState = 'OK' | 'LOW' | 'EMPTY';

export function BoxProgressBar({
  percent,
  state,
  showLabel = true,
}: {
  percent: number;
  state: BoxState;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const barColor =
    state === 'OK' ? theme.colors.ok : state === 'LOW' ? theme.colors.low : theme.colors.empty;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: clamped, min: 0, max: 100 }}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: barColor }]} />
      </View>
      {showLabel ? (
        <AppText tone="muted" style={styles.label}>
          {clamped}%
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, minWidth: 140 },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fill: { height: '100%', borderRadius: 999 },
  label: { fontSize: 12 },
});
