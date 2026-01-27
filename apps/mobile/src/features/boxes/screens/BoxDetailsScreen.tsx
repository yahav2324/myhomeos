import * as React from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../navigation/types';
import { theme } from '../../../shared/theme/theme';
import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import { BoxProgressBar } from '../../../shared/components/BoxProgressBar';
import { useBoxesStore } from '../store/boxes.store';
import { useTelemetryHistory } from '../hooks/useTelemetryHistory';
import { API_URL } from '../api';
import { BoxActionsSheet } from '../../../shared/components/bottomActionsSheet';
import { useLangStore } from '../../../shared/i18n/lang.store';
import { authedFetch } from '../../auth/api/auth.api';

type Props = NativeStackScreenProps<RootStackParamList, 'BoxDetails'>;

export function BoxDetailsScreen({ navigation, route }: Props) {
  const [hours, setHours] = React.useState<24 | 168>(24);
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const lang = useLangStore((s) => s.lang);
  const { boxId } = route.params;
  const listRef = React.useRef<FlatList>(null);
  const isAtBottomRef = React.useRef(true);

  const box = useBoxesStore((s) => s.items.find((b) => b.id === boxId));
  const {
    items: history,
    loading: histLoading,
    err: histErr,
    reload,
  } = useTelemetryHistory(boxId, hours);

  React.useEffect(() => {
    if (box?.name) navigation.setOptions({ title: box.name });
  }, [box?.name, navigation]);

  React.useEffect(() => {
    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
  }, [history.length]);

  if (!box) {
    return (
      <View style={styles.container}>
        <Card>
          <AppText style={styles.title}>Box not found</AppText>
          <AppText tone="muted" style={{ marginTop: 6 }}>
            It may have been removed or not loaded yet.
          </AppText>

          <AppButton
            title="Back"
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={{ marginTop: theme.space.lg }}
          />
        </Card>
      </View>
    );
  }

  const percent = Math.round(box.percent);
  const full = box.fullQuantity ?? 0;

  const unit = box.unit;
  return (
    <View style={styles.container}>
      <Card style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <AppText style={styles.title}>{box.name}</AppText>
            <AppText tone="muted">{box.id}</AppText>
            <AppText tone="muted" style={{ marginTop: 4 }}>
              Device: <AppText>{box.deviceId}</AppText>
            </AppText>
          </View>

          <AppButton title="⋯" variant="ghost" onPress={() => setActionsOpen(true)} />
        </View>

        <View style={{ marginTop: theme.space.lg }}>
          <BoxProgressBar percent={box.percent} state={box.state} />
        </View>

        {/* ✅ 742 / 5000g · 15% */}
        <AppText tone="muted" style={{ marginTop: theme.space.md }}>
          <AppText style={styles.num}>{box.quantity}</AppText>
          <AppText tone="muted">
            {' '}
            / {full ? full : '—'}
            {box.unit}
          </AppText>
          <AppText tone="muted">{'  ·  '}</AppText>
          <AppText style={styles.num}>{percent}%</AppText>
        </AppText>

        <View style={{ marginTop: theme.space.lg, flex: 1, minHeight: 0 }}>
          <View style={styles.sectionHeader}>
            <AppText style={styles.sectionTitle}>History</AppText>

            <View style={styles.pillsRow}>
              <Pressable
                onPress={() => setHours(24)}
                style={({ pressed }) => [
                  styles.pill,
                  hours === 24 && styles.pillOn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppText style={[styles.pillText, hours === 24 && styles.pillTextOn]}>24h</AppText>
              </Pressable>

              <Pressable
                onPress={() => setHours(168)}
                style={({ pressed }) => [
                  styles.pill,
                  hours === 168 && styles.pillOn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppText style={[styles.pillText, hours === 168 && styles.pillTextOn]}>7d</AppText>
              </Pressable>

              <Pressable
                onPress={reload}
                style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
              >
                <AppText style={styles.pillText}>↻</AppText>
              </Pressable>
            </View>
          </View>

          {histErr ? (
            <Card style={{ marginTop: theme.space.md, flex: 1, minHeight: 0 }}>
              <AppText tone="danger" style={{ fontWeight: '900' }}>
                {histErr}
              </AppText>
              <AppButton
                title="Retry"
                variant="ghost"
                onPress={reload}
                style={{ marginTop: theme.space.md }}
              />
            </Card>
          ) : histLoading ? (
            <Card style={{ marginTop: theme.space.md }}>
              <AppText tone="muted">Loading history…</AppText>
            </Card>
          ) : history.length === 0 ? (
            <Card style={{ marginTop: theme.space.md }}>
              <AppText tone="muted">No history yet. Send some telemetry to see trends.</AppText>
            </Card>
          ) : (
            <Card style={{ marginTop: theme.space.md, flex: 1, minHeight: 0 }}>
              <FlatList
                style={{ flex: 1 }}
                ref={listRef}
                showsVerticalScrollIndicator={false} // במובייל, ובחלק מה-web
                decelerationRate="fast" // iOS feel
                data={history.slice(0, 100)}
                keyExtractor={(x, idx) => `${x.timestamp}-${idx}`}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                onScroll={(e) => {
                  const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                  const paddingToBottom = 20;

                  isAtBottomRef.current =
                    layoutMeasurement.height + contentOffset.y >=
                    contentSize.height - paddingToBottom;
                }}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <View style={styles.historyRow}>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontWeight: '900' }}>
                        {item.quantity}
                        {unit}{' '}
                        <AppText tone="muted">
                          / {box.fullQuantity ?? '—'}
                          {unit}
                        </AppText>
                      </AppText>

                      <AppText tone="muted" style={{ marginTop: 2, fontSize: 12 }}>
                        {formatTime(item.timestamp)}
                      </AppText>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <AppText style={{ fontWeight: '900' }}>{Math.round(item.percent)}%</AppText>
                      <AppText tone="muted" style={{ marginTop: 2, fontSize: 12 }}>
                        {item.state}
                      </AppText>
                    </View>
                  </View>
                )}
              />
            </Card>
          )}
        </View>
        <BoxActionsSheet
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          boxName={box.name}
          onRecalibrate={() => {
            setActionsOpen(false);
            navigation.navigate('SetFullLevel', {
              boxId: box.id,
              boxName: box.name,
              unit: box.unit,
              mode: 'recalibrate',
              currentFullQuantity: box.fullQuantity ?? 0,
            });
          }}
          onDelete={async () => {
            const res = await authedFetch(`/boxes/${box.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok || !json?.ok) throw new Error(json?.errors?.formErrors?.[0] ?? 'Failed');

            // אחרי WS המחיקה יגיע ותוסר מהרשימה,
            // אבל למסך פרטים כדאי לחזור אחורה מיד:
            navigation.goBack();
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.md,
    marginTop: theme.space.lg,
  },
  title: { fontSize: 22, fontWeight: '900' },
  num: { fontWeight: '900' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900' },

  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillOn: {
    borderColor: 'rgba(34,197,94,0.6)',
    backgroundColor: 'rgba(34,197,94,0.14)',
  },
  pillText: { fontSize: 12, fontWeight: '900' },
  pillTextOn: {},

  sep: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
    marginVertical: 10,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
});

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
