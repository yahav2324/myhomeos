import { ensureBlePermissions, HubClient, HubEvt } from '../../../shared';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';

type FoundBox = { addr: string; name: string; rssi: number; lastSeenAt: number };

export function HubScreen() {
  const hub = useMemo(() => new HubClient(), []);
  const hubRef = useRef(hub);

  const [logs, setLogs] = useState<string[]>([]);
  const [hubConnected, setHubConnected] = useState(false);

  const [status, setStatus] = useState<Extract<HubEvt, { type: 'status' }> | null>(null);
  const [boxes, setBoxes] = useState<Record<string, FoundBox>>({});
  const [scanRunning, setScanRunning] = useState(false);

  useEffect(() => {
    const offLog = hub.onLog((m) => setLogs((prev) => [m, ...prev].slice(0, 50)));

    const offEvt = hub.onEvent((evt) => {
      setLogs((prev) => [`EVT <- ${JSON.stringify(evt)}`, ...prev].slice(0, 50));

      if (evt.type === 'status') {
        setStatus(evt as Extract<HubEvt, { type: 'status' }>);
        // אם HUB מחובר לקופסה, נוודא שה־UI מציג את ה־box גם אם אין scan results
        if (evt.boxConnected && evt.boxAddr) {
          setBoxes((prev) => ({
            ...prev,
            [evt.boxAddr]: {
              addr: evt.boxAddr,
              name: evt.boxId ? `CONNECTED (${evt.boxId})` : 'CONNECTED',
              rssi: prev[evt.boxAddr]?.rssi ?? 0,
              lastSeenAt: Date.now(),
            },
          }));
        }
      }

      if (evt.type === 'scan_started') setScanRunning(true);
      if (evt.type === 'scan_done') setScanRunning(false);

      if (evt.type === 'box_found') {
        setBoxes((prev) => ({
          ...prev,
          [evt.addr]: {
            addr: evt.addr,
            name: evt.name || 'BOX',
            rssi: evt.rssi,
            lastSeenAt: Date.now(),
          },
        }));
      }

      if (evt.type === 'box_connected') {
        setBoxes((prev) => ({
          ...prev,
          [evt.addr]: {
            addr: evt.addr,
            name: `CONNECTED (${evt.boxId})`,
            rssi: prev[evt.addr]?.rssi ?? 0,
            lastSeenAt: Date.now(),
          },
        }));
        // גם נמשוך status כדי לסנכרן UI
        hubRef.current.status().catch(() => {
          /* empty */
        });
      }

      if (evt.type === 'box_disconnected') {
        // אל מוחקים את הרשומה, רק מסמנים ב-status
        hubRef.current.status().catch(() => {
          /* empty */
        });
      }
    });

    return () => {
      offLog();
      offEvt();
      hub.destroy().catch(() => {
        /* empty */
      });
    };
  }, [hub]);

  async function connectFlow() {
    const perm = await ensureBlePermissions();
    if (!perm.ok) {
      Alert.alert('צריך הרשאות BLE', 'תן הרשאות Bluetooth/Location כדי שזה יעבוד.');
      return;
    }

    try {
      const hubs = await hub.scanForHub(8000);
      if (hubs.length === 0) {
        Alert.alert('לא מצאתי HUB', 'בדוק שה-HUB דלוק ומפרסם BLE (Advertising).');
        return;
      }

      // מתחברים לראשון
      await hub.connectToHub(hubs[0].id);
      setHubConnected(true);
      await hub.status();
    } catch (e: any) {
      Alert.alert('שגיאה בהתחברות ל-HUB', e?.message ?? String(e));
    }
  }

  async function disconnectFlow() {
    try {
      await hub.disconnectHub();
      setHubConnected(false);
      setStatus(null);
    } catch (e: any) {
      Alert.alert('שגיאה בניתוק', e?.message ?? String(e));
    }
  }

  const boxList = Object.values(boxes).sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  const connectedBoxAddr = status?.boxConnected ? status.boxAddr : '';
  const connectedBoxId = status?.boxConnected ? status.boxId : '';

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>SmartKitchen – HUB</Text>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {!hubConnected ? (
          <Btn title="Connect HUB" onPress={connectFlow} />
        ) : (
          <>
            <Btn title="Disconnect HUB" onPress={disconnectFlow} />
            <Btn title="STATUS" onPress={() => hub.status()} />
            <Btn
              title={scanRunning ? 'Scanning…' : 'SCAN'}
              onPress={() => hub.scanBoxes()}
              disabled={scanRunning}
            />
            <Btn title="DEBUGSCAN" onPress={() => hub.debugScanAll()} />
            <Btn title="DISCONNECT BOX" onPress={() => hub.disconnectBox()} />
          </>
        )}
      </View>

      <View style={{ padding: 12, borderWidth: 1, borderRadius: 12 }}>
        <Text style={{ fontWeight: '700' }}>Status</Text>
        <Text>HUB connected: {hubConnected ? 'YES' : 'NO'}</Text>
        <Text>WiFi: {status?.wifi ?? '-'}</Text>
        <Text>IP: {status?.ip ?? '-'}</Text>
        <Text>PhoneConnected (server): {status?.phoneConnected ? 'YES' : 'NO'}</Text>

        <Text style={{ marginTop: 8, fontWeight: '700' }}>Connected Box</Text>
        <Text>boxConnected: {status?.boxConnected ? 'YES' : 'NO'}</Text>
        <Text>boxAddr: {connectedBoxAddr || '-'}</Text>
        <Text>boxId: {connectedBoxId || '-'}</Text>

        {status?.scanMayMissBecauseBoxConnected ? (
          <Text style={{ marginTop: 8 }}>
            ⚠️ Scan עלול לא למצוא את הקופסה כי ה-HUB כבר מחובר אליה (הקופסה יכולה להפסיק לפרסם).
          </Text>
        ) : null}
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ fontWeight: '700' }}>Boxes</Text>

        <FlatList
          data={boxList}
          keyExtractor={(i) => i.addr}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const isConnected = status?.boxConnected && item.addr === status.boxAddr;
            return (
              <View style={{ padding: 12, borderWidth: 1, borderRadius: 12 }}>
                <Text style={{ fontWeight: '700' }}>
                  {item.name} {isConnected ? '✅ (CONNECTED)' : ''}
                </Text>
                <Text>addr: {item.addr}</Text>
                <Text>rssi: {item.rssi}</Text>
                <Text>lastSeen: {new Date(item.lastSeenAt).toLocaleTimeString()}</Text>

                {hubConnected ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <Btn
                      title="CONNECT"
                      onPress={() => hub.connectBox(item.addr)}
                      disabled={!!status?.boxConnected && item.addr === status.boxAddr}
                    />
                    <Btn title="STATUS" onPress={() => hub.status()} />
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      </View>

      <View style={{ maxHeight: 170, borderWidth: 1, borderRadius: 12, padding: 10 }}>
        <Text style={{ fontWeight: '700' }}>Logs</Text>
        <FlatList
          data={logs}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <Text style={{ fontSize: 12 }}>{item}</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

function Btn(props: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.disabled ? undefined : props.onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 10,
        opacity: props.disabled ? 0.5 : 1,
      }}
    >
      <Text>{props.title}</Text>
    </Pressable>
  );
}
