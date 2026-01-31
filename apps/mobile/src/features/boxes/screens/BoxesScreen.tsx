import * as React from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Pressable, I18nManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../navigation/types';
import { theme } from '../../../shared/theme/theme';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import { Card } from '../../../shared/ui/Card';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { BoxProgressBar } from '../../../shared/components/BoxProgressBar';
import type { BoxItem } from '../model/types';
import { SkeletonBoxCard } from '../../../shared';
import { useBoxesStore } from '../store/boxes.store';
import { t } from '../../../shared/i18n/i18n';
import { useLangStore } from '../../../shared/i18n/lang.store';
import { Ionicons } from '@expo/vector-icons';
import { useBoxesSocket } from '../ws/useBoxesSocket';

type BoxState = 'OK' | 'LOW' | 'EMPTY';
type Nav = NativeStackNavigationProp<RootStackParamList>;

function badgeBg(state: BoxState) {
  if (state === 'OK') return 'rgba(34,197,94,0.14)';
  if (state === 'LOW') return 'rgba(245,158,11,0.14)';
  return 'rgba(239,68,68,0.14)';
}

function badgeFg(state: BoxState) {
  if (state === 'OK') return theme.colors.ok;
  if (state === 'LOW') return theme.colors.low;
  return theme.colors.empty;
}

function badgeIcon(state: BoxState) {
  if (state === 'OK') return '✓';
  if (state === 'LOW') return '!';
  return '✕';
}

function badgeLabel(state: BoxState) {
  if (state === 'OK') return 'OK';
  if (state === 'LOW') return 'LOW';
  return 'EMPTY';
}

function timeAgo(iso?: string) {
  if (!iso) return null;
  const t0 = new Date(iso);
  const ms = Date.now() - t0.getTime();
  if (Number.isNaN(ms)) return null;

  const s = Math.floor(ms / 1000);
  if (s < 10) return { key: 'justNow' as const, value: '' };
  if (s < 60) return { key: 'secondsAgo' as const, value: String(s) };

  const m = Math.floor(s / 60);
  if (m < 60) return { key: 'minutesAgo' as const, value: String(m) };

  const h = Math.floor(m / 60);
  if (h < 24) return { key: 'hoursAgo' as const, value: String(h) };

  const d = Math.floor(h / 24);
  return { key: 'daysAgo' as const, value: String(d) };
}

export function BoxesScreen() {
  const navigation = useNavigation<Nav>();
  const lang = useLangStore((s) => s.lang);

  const items = useBoxesStore((s) => s.items);
  const initialLoading = useBoxesStore((s) => s.initialLoading);
  const refreshing = useBoxesStore((s) => s.refreshing);
  const err = useBoxesStore((s) => s.err);
  const load = useBoxesStore((s) => s.load);
  const refresh = useBoxesStore((s) => s.refresh);
  const upsertFromWs = useBoxesStore((s) => s.upsertFromWs);
  const remove = useBoxesStore((s) => s.remove);

  useBoxesSocket({
    onUpsert: (b) => {
      console.log('[BoxesScreen] boxUpserted -> upsertFromWs', b.id, b.quantity, b.percent);
      upsertFromWs(b);
    },
    onDelete: (id) => {
      remove(id);
    },
  });

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.headerRow, lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
        <View style={[styles.contentLTR, lang === 'he' ? styles.contentRTL : styles.contentLTR]}>
          <AppText style={[styles.title, lang === 'he' ? styles.textRTL : styles.textLTR]}>
            {t('boxes')}
          </AppText>
          <AppText tone="muted" style={lang === 'he' ? styles.rowRTL : styles.rowLTR}>
            {t('boxesSubtitle')}
          </AppText>
        </View>

        <AppButton
          title={t('create')}
          onPress={() =>
            navigation.navigate('ConnectBox', {
              onDone: refresh,
            })
          }
        />
      </View>

      {/* Error */}
      {err ? (
        <Card style={{ marginTop: theme.space.md }}>
          <AppText tone="danger" style={{ fontWeight: '800' }}>
            {err}
          </AppText>
          <AppButton
            title={t('retry')}
            variant="ghost"
            onPress={refresh}
            style={{ marginTop: theme.space.md }}
          />
        </Card>
      ) : null}

      {/* Loading / Empty / List */}
      {initialLoading ? (
        <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
          <SkeletonBoxCard />
          <SkeletonBoxCard />
          <SkeletonBoxCard />
        </View>
      ) : items.length === 0 ? (
        <View style={{ marginTop: theme.space.xl }}>
          <EmptyState
            title={t('noBoxesTitle')}
            subtitle={t('noBoxesSubtitle')}
            actionTitle={t('createBox')}
            onAction={() =>
              navigation.navigate('ConnectBox', {
                onDone: refresh,
              })
            }
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          renderItem={({ item }) => (
            <BoxCard item={item} navigation={navigation} isRTL={lang === 'he'} />
          )}
        />
      )}
    </View>
  );
}

function BoxCard({ item, navigation, isRTL }: { item: BoxItem; navigation: Nav; isRTL: boolean }) {
  const agoObj = timeAgo(item.updatedAt);
  const clock = item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString() : null;
  const [, force] = React.useState(0);
  const lang = useLangStore((s) => s.lang);

  React.useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const updatedText = agoObj
    ? t('updatedAgo', { when: t(agoObj.key, { n: agoObj.value }) })
    : clock
      ? t('updatedAt', { when: clock })
      : t('noUpdatesYet');

  return (
    <Pressable
      onPress={() => navigation.navigate('BoxDetails', { boxId: item.id })}
      style={({ pressed }) => [pressed && { opacity: 0.92 }]}
    >
      <Card>
        <View style={[styles.cardTop, lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
          <View style={[styles.contentLTR, isRTL && styles.contentRTL]}>
            <AppText style={[styles.cardTitle, lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
              {item.name}
            </AppText>
            <AppText tone="muted" style={[lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
              {item.code}
            </AppText>
          </View>

          <View style={[styles.cardActions, lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
            <Pressable
              onPress={() =>
                navigation.navigate('BoxDetails', {
                  boxId: item.id,
                })
              }
              hitSlop={10}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75 }]}
            >
              <AppText style={styles.iconBtnText}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.muted} />
              </AppText>
            </Pressable>

            <View
              style={[
                styles.badgeBase,
                lang === 'he' ? styles.rowRTL : styles.rowLTR,
                { backgroundColor: badgeBg(item.state) },
              ]}
            >
              <AppText style={[styles.badgeIcon, { color: badgeFg(item.state) }]}>
                {badgeIcon(item.state)}
              </AppText>
              <AppText style={[styles.badgeText, { color: badgeFg(item.state) }]}>
                {badgeLabel(item.state)}
              </AppText>
            </View>
          </View>
        </View>

        {/* Progress */}
        <View style={{ marginTop: theme.space.md }}>
          <BoxProgressBar percent={item.percent} state={item.state} />

          <View style={[styles.progressMetaRow, lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
            <AppText tone="muted">
              <AppText style={styles.progressNumber}>{item.quantity}</AppText>
              <AppText tone="muted">
                {' '}
                / {item.fullQuantity ?? '—'}
                {item.unit}
              </AppText>

              <AppText tone="muted">{isRTL ? ' · ' : '  ·  '}</AppText>

              <AppText style={styles.progressNumber}>{Math.round(item.percent)}%</AppText>
            </AppText>
          </View>
        </View>
        <View style={[styles.progressMetaRow, lang === 'he' ? styles.rowRTL : styles.rowLTR]}>
          <AppText
            tone="muted"
            style={[{ marginTop: theme.space.sm }, lang === 'he' ? styles.rowRTL : styles.rowLTR]}
          >
            {updatedText}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.xl },

  /* Text */
  title: { fontSize: 28, fontWeight: '900', letterSpacing: 0.2 },
  cardTitle: { fontSize: 18, fontWeight: '900' },
  badgeIcon: { fontSize: 12, fontWeight: '900' },
  badgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  iconBtnText: { fontSize: 16 },
  progressNumber: { fontWeight: '900' },

  /* Direction helpers */
  contentLTR: { alignItems: 'flex-start' },
  contentRTL: { alignItems: 'flex-end' },

  textRTL: { writingDirection: 'rtl', textAlign: 'right' },
  textLTR: { writingDirection: 'ltr', textAlign: 'left' },

  row: { flexDirection: 'row' },
  rowRTL: { flexDirection: 'row-reverse' },
  rowLTR: { flexDirection: 'row' },

  /* Layout */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },

  listContent: {
    paddingTop: theme.space.lg,
    gap: theme.space.md,
    paddingBottom: theme.space.xl,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  badgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  progressMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
