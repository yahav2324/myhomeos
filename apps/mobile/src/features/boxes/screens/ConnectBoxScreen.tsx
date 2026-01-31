// apps/mobile/src/features/hub/ConnectBoxScreen.tsx
import * as React from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../../../shared/ui/AppText';
import { Card } from '../../../shared/ui/Card';
import { AppButton } from '../../../shared/ui/AppButton';
import { theme } from '../../../shared/theme/theme';
import { useShallow } from 'zustand/react/shallow';

import { useHubStore } from '../../hub/hub.store';
import {
  hubRequestAndConnect,
  hubDisconnect,
  hubScan,
  hubConnectBox,
  hubDisconnectBox,
  hubDisconnectAllBoxes,
} from '../../hub/hub.ble.web';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

function Row(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={props.onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <AppText style={styles.rowTitle}>{props.title}</AppText>
        {props.subtitle ? <AppText style={styles.rowSub}>{props.subtitle}</AppText> : null}
      </View>
      {props.right}
    </Pressable>
  );
}

export function ConnectBoxScreen() {
  const hubs = useHubStore(useShallow((s) => Object.values(s.hubs)));
  const setHubPhase = useHubStore((s) => s.setHubPhase);
  const setHubError = useHubStore((s) => s.setHubError);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [activeHubId, setActiveHubId] = React.useState<string | null>(null);

  const activeHub = useHubStore(
    React.useCallback((s) => (activeHubId ? s.hubs[activeHubId] : undefined), [activeHubId]),
  );
  React.useEffect(() => {
    if (activeHubId) return;
    const first = hubs[0]?.hubId;
    if (first) setActiveHubId(first);
  }, [activeHubId, hubs]);

  const handledNavTokenRef = React.useRef<number>(-1);

  React.useEffect(() => {
    if (!activeHub) return;

    const token = activeHub.navToken ?? 0;
    if (token === handledNavTokenRef.current) return; // ✅ כבר טיפלנו
    if (token === 0) return; // לפני התחברויות

    // נסה לקחת את הקופסה האחרונה שהתחברה:
    // הכי פשוט: אם יש selectedAddr — השתמש בו
    const addr = activeHub.selectedAddr ?? activeHub.connectedBoxes.at(-1)?.addr;
    if (!addr) return;

    const connected = activeHub.connectedBoxes.find((b) => b.addr === addr);
    if (!connected) return;

    handledNavTokenRef.current = token;

    const t = activeHub.lastTelemetryByAddr?.[addr];

    navigation.navigate('CreateBox', {
      deviceId: connected.boxId,
      currentQuantity: t?.quantity ?? 0,
      unit: t?.unit ?? 'g',
      onCreated: () => {
        /* empty */
      },
    });

    // ✅ אופציונלי: עכשיו אפשר לנקות selectedAddr כדי לא לבלבל
    useHubStore.getState().setHubSelectedAddr(activeHub.hubId, null);
  }, [
    activeHub?.navToken,
    activeHub?.connectedBoxes,
    activeHub?.selectedAddr,
    activeHub?.lastTelemetryByAddr,
  ]);

  const onAddHub = async () => {
    try {
      const hubId = await hubRequestAndConnect();
      setActiveHubId(hubId);
    } catch (e: any) {
      // אין לנו hubId עדיין -> פשוט נציג כללי
      console.error(e);
      alert(e?.message ?? 'Failed to add hub');
    }
  };

  const onDisconnectHub = async (hubId: string) => {
    try {
      await hubDisconnect(hubId);
      if (activeHubId === hubId) setActiveHubId(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Disconnect failed');
    }
  };

  const onScan = async () => {
    if (!activeHub) return;
    try {
      setHubError(activeHub.hubId, undefined);
      await hubScan(activeHub.hubId);
    } catch (e: any) {
      console.error(e);
      setHubPhase(activeHub.hubId, 'hubConnected');
      setHubError(activeHub.hubId, e?.message ?? 'scan failed');
    }
  };

  const onConnectBox = async (addr: string) => {
    if (!activeHub) return;
    try {
      await hubConnectBox(activeHub.hubId, addr);
    } catch (e: any) {
      console.error(e);
      setHubPhase(activeHub.hubId, 'hubConnected');
      setHubError(activeHub.hubId, e?.message ?? 'connect failed');
    }
  };

  const onDisconnectBox = async (addr: string) => {
    if (!activeHub) return;
    try {
      await hubDisconnectBox(activeHub.hubId, addr);
    } catch (e: any) {
      console.error(e);
      setHubError(activeHub.hubId, e?.message ?? 'disconnect failed');
    }
  };

  const onDisconnectAll = async () => {
    if (!activeHub) return;
    try {
      await hubDisconnectAllBoxes(activeHub.hubId);
    } catch (e: any) {
      console.error(e);
      setHubError(activeHub.hubId, e?.message ?? 'disconnectAll failed');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <AppText style={styles.h1}>חיבור קופסה</AppText>
        <AppText style={styles.p}>
          HUB פעיל כדי לסרוק/לחבר קופסאות. הסריקה מציגה רק קופסאות חדשות (שאינן מחוברות).
        </AppText>

        <AppButton title="הוסף HUB (בקשת הרשאה והתחברות)" onPress={onAddHub} />

        <View style={{ height: 16 }} />

        <AppText style={styles.h2}>HUB-ים</AppText>

        {hubs.length === 0 ? (
          <AppText style={styles.muted}>אין HUB-ים.</AppText>
        ) : (
          hubs.map((h) => {
            const isActive = h.hubId === activeHubId;
            return (
              <Card key={h.hubId} style={[styles.hubCard, isActive && styles.activeHubCard]}>
                <Row
                  title={h.name}
                  subtitle={`מצב: ${h.connected ? 'מחובר' : 'מנותק'} · phase: ${h.phase}`}
                  onPress={() => setActiveHubId(h.hubId)}
                  right={
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {h.connected ? (
                        <AppButton
                          title="נתק"
                          variant="ghost"
                          onPress={() => onDisconnectHub(h.hubId)}
                        />
                      ) : (
                        <AppText style={styles.muted}>הוסף שוב דרך "הוסף HUB"</AppText>
                      )}
                    </View>
                  }
                />

                {isActive ? (
                  <View style={{ marginTop: 12 }}>
                    {h.lastError ? <AppText style={styles.err}>{h.lastError}</AppText> : null}

                    <View style={styles.actionsRow}>
                      <AppButton
                        title={h.phase === 'scanningBoxes' ? 'סורק…' : 'סריקה נקייה'}
                        onPress={onScan}
                        disabled={!h.connected || h.phase === 'scanningBoxes'}
                      />
                      <AppButton
                        title="נתק את כל הקופסאות"
                        variant="ghost"
                        onPress={onDisconnectAll}
                        disabled={!h.connected}
                      />
                    </View>

                    <View style={{ height: 12 }} />

                    <AppText style={styles.h3}>קופסאות מחוברות (דרך HUB)</AppText>
                    {h.connectedBoxes.length === 0 ? (
                      <AppText style={styles.muted}>אין קופסאות מחוברות.</AppText>
                    ) : (
                      h.connectedBoxes.map((b) => (
                        <Row
                          key={b.addr}
                          title={b.boxId}
                          subtitle={`addr: ${b.addr}`}
                          right={
                            <AppButton
                              title="נתק"
                              variant="ghost"
                              onPress={() => onDisconnectBox(b.addr)}
                            />
                          }
                        />
                      ))
                    )}

                    <View style={{ height: 12 }} />

                    <AppText style={styles.h3}>קופסאות שנמצאו (חדשות בלבד)</AppText>
                    {h.boxesFound.length === 0 ? (
                      <AppText style={styles.muted}>אין תוצאות סריקה.</AppText>
                    ) : (
                      h.boxesFound.map((b) => {
                        const loading = h.phase === 'connectingBox' && h.selectedAddr === b.addr;
                        return (
                          <Row
                            key={b.addr}
                            title={b.name || b.addr}
                            subtitle={`${b.addr} · RSSI ${b.rssi}`}
                            right={
                              <AppButton
                                title={loading ? 'מחבר…' : 'חבר'}
                                onPress={() => onConnectBox(b.addr)}
                                disabled={!h.connected || loading}
                              />
                            }
                          />
                        );
                      })
                    )}
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </Card>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  card: {
    padding: 16,
  },
  hubCard: {
    padding: 12,
    marginTop: 12,
  },
  activeHubCard: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  h2: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  h3: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  p: {
    opacity: 0.85,
    marginBottom: 12,
  },
  muted: {
    opacity: 0.65,
  },
  err: {
    color: '#ff6b6b',
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  row: {
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  rowTitle: {
    fontWeight: '700',
  },
  rowSub: {
    opacity: 0.75,
    marginTop: 2,
  },
});
