import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { useConnectivityStore } from '../network/connectivity.store';

export function ConnectivityBadge() {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const serverStatus = useConnectivityStore((s) => s.serverStatus);

  let label = '…';
  let mode: 'ok' | 'warn' | 'bad' = 'warn';

  if (!isOnline) {
    label = 'אופליין';
    mode = 'bad';
  } else if (serverStatus === 'down') {
    label = 'שרת לא זמין';
    mode = 'bad';
  } else if (serverStatus === 'ok') {
    label = 'מחובר';
    mode = 'ok';
  } else {
    label = 'בודק…';
    mode = 'warn';
  }

  return (
    <View
      style={[styles.pill, mode === 'ok' ? styles.ok : mode === 'bad' ? styles.bad : styles.warn]}
    >
      <View
        style={[
          styles.dot,
          mode === 'ok' ? styles.dotOk : mode === 'bad' ? styles.dotBad : styles.dotWarn,
        ]}
      />
      <AppText style={styles.text}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  ok: { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.12)' },
  warn: { borderColor: 'rgba(245,158,11,0.35)', backgroundColor: 'rgba(245,158,11,0.12)' },
  bad: { borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.12)' },

  dot: { width: 8, height: 8, borderRadius: 999 },
  dotOk: { backgroundColor: 'rgba(34,197,94,0.95)' },
  dotWarn: { backgroundColor: 'rgba(245,158,11,0.95)' },
  dotBad: { backgroundColor: 'rgba(239,68,68,0.95)' },

  text: { fontWeight: '900', opacity: 0.95 },
});
