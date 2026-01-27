import * as React from 'react';
import { View, StyleSheet, FlatList, Alert, Platform, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Buffer } from 'buffer';

import { theme } from '../../../shared/theme/theme';
import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import type { RootStackParamList } from '../../../navigation/types';
import { t } from '../../../shared/i18n/i18n';

// ✅ NATIVE only import – כדי שלא יקרוס ב-web
let BleManager: any;
let State: any;
let DeviceType: any;
let SubscriptionType: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ble = require('react-native-ble-plx');
  BleManager = ble.BleManager;
  State = ble.State;
  DeviceType = ble.Device;
  SubscriptionType = ble.Subscription;
} catch {
  // web build - ignore
}

// ===== Hub UUIDs =====
const HUB_SERVICE_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const HUB_CMD_CHAR_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
const HUB_EVT_CHAR_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';

// ===== WEB BT helpers =====
type WebBtDevice = BluetoothDevice;
type WebGattServer = BluetoothRemoteGATTServer;
type WebGattChar = BluetoothRemoteGATTCharacteristic;

// ===== Types =====
type Props = NativeStackScreenProps<RootStackParamList, 'ConnectBox'>;

type BoxFound = {
  addr: string;
  name: string;
  rssi: number;
};

type ConnectedBox = {
  addr: string;
  boxId: string;
};

type HubEvt =
  | { type: 'hub_connected' }
  | { type: 'scan_started' }
  | { type: 'scan_done'; count: number; error?: string }
  | { type: 'box_found'; addr: string; name: string; rssi: number }
  | { type: 'box_connected'; addr: string; boxId: string }
  | { type: 'box_connect_failed'; addr: string; error?: string }
  | { type: 'box_disconnected'; addr?: string }
  | { type: 'status'; connected: boolean; addr?: string; boxId?: string }
  | { type: 'telemetry'; boxId: string; payload: any }
  | { type: 'error'; msg: string };

function b64ToUtf8(b64?: string | null) {
  if (!b64) return '';
  return Buffer.from(b64, 'base64').toString('utf8');
}
function utf8ToB64(s: string) {
  return Buffer.from(s, 'utf8').toString('base64');
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// ===== WEB: Feature detect =====
function isWebBluetoothSupported() {
  if (Platform.OS !== 'web') return false;
  // @ts-expect-error - navigator typing differs
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

// ===== UI small row =====
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <AppText tone="muted">{label}</AppText>
      <AppText style={{ fontWeight: '700' }}>{value}</AppText>
    </View>
  );
}

export function ConnectBoxScreen({ navigation, route }: Props) {
  const onDone = route.params?.onDone;

  const [phase, setPhase] = React.useState<
    'idle' | 'scanningHub' | 'connectingHub' | 'hubConnected' | 'scanningBoxes' | 'connectingBox'
  >('idle');

  const [boxes, setBoxes] = React.useState<BoxFound[]>([]);
  const [selectedAddr, setSelectedAddr] = React.useState<string | null>(null);
  const [connectedBox, setConnectedBox] = React.useState<ConnectedBox | null>(null);

  // ===== NATIVE refs =====
  const managerRef = React.useRef<any>(null);
  const hubDeviceRef = React.useRef<any>(null);
  const evtSubRef = React.useRef<any>(null);

  // ===== WEB refs =====
  const webDeviceRef = React.useRef<WebBtDevice | null>(null);
  const webServerRef = React.useRef<WebGattServer | null>(null);
  const webCmdCharRef = React.useRef<WebGattChar | null>(null);
  const webEvtCharRef = React.useRef<WebGattChar | null>(null);

  const resetBoxes = React.useCallback(() => {
    setBoxes([]);
    setSelectedAddr(null);
  }, []);

  const upsertBox = React.useCallback((b: BoxFound) => {
    setBoxes((prev) => {
      const i = prev.findIndex((x) => x.addr === b.addr);
      if (i === -1) return [...prev, b].sort((a, c) => c.rssi - a.rssi);
      const next = prev.slice();
      next[i] = b;
      next.sort((a, c) => c.rssi - a.rssi);
      return next;
    });
  }, []);

  // ============ HUB EVENT HANDLER (common) ============
  const handleHubEvent = React.useCallback(
    (evt: HubEvt) => {
      if (evt.type === 'scan_started') {
        setPhase('scanningBoxes');
        resetBoxes();
        return;
      }
      if (evt.type === 'scan_done') {
        setPhase('hubConnected');
        if (evt.error) Alert.alert('Scan error', String(evt.error));
        return;
      }
      if (evt.type === 'box_found') {
        upsertBox({ addr: evt.addr, name: evt.name, rssi: evt.rssi });
        return;
      }
      if (evt.type === 'box_connected') {
        setPhase('hubConnected');
        setConnectedBox({ addr: evt.addr, boxId: evt.boxId });

        // ממשיכים ל-CreateBox
        navigation.replace('CreateBox', {
          deviceId: evt.boxId,
          currentQuantity: 0,
          unit: 'g',
          onCreated: async () => {
            onDone?.();
          },
        });
        return;
      }
      if (evt.type === 'box_connect_failed') {
        setPhase('hubConnected');
        Alert.alert('חיבור לקופסה נכשל', `${evt.addr}${evt.error ? ` (${evt.error})` : ''}`);
        return;
      }
      if (evt.type === 'box_disconnected') {
        setPhase('hubConnected');
        setConnectedBox(null);
        return;
      }
      if (evt.type === 'status') {
        if (evt.connected && evt.addr && evt.boxId) {
          setConnectedBox({ addr: evt.addr, boxId: evt.boxId });
        } else {
          setConnectedBox(null);
        }
        return;
      }
      if (evt.type === 'error') {
        Alert.alert('HUB error', evt.msg);
        return;
      }
    },
    [navigation, onDone, resetBoxes, upsertBox],
  );

  // =========================
  // ===== NATIVE METHODS =====
  // =========================
  const ensureNativeManager = React.useCallback(() => {
    if (Platform.OS === 'web') return null;
    if (!managerRef.current) managerRef.current = new BleManager();
    return managerRef.current;
  }, []);

  const ensureBtOnNative = React.useCallback(async () => {
    const manager = ensureNativeManager();
    if (!manager) return;

    const state = await manager.state();
    if (state === State.PoweredOn) return;

    if (Platform.OS === 'android') {
      try {
        await manager.enable();
      } catch {
        // ignore
      }
    }

    const after = await manager.state();
    if (after !== State.PoweredOn) {
      Alert.alert(
        t('bluetoothOffTitle') ?? 'Bluetooth כבוי',
        t('bluetoothOffMsg') ?? 'תדליק Bluetooth ואז נסה שוב',
      );
      throw new Error('Bluetooth is not powered on');
    }
  }, [ensureNativeManager]);

  const nativeWriteHubCmd = React.useCallback(
    async (cmd: string) => {
      const manager = ensureNativeManager();
      const hubDevice = hubDeviceRef.current;
      if (!manager || !hubDevice) throw new Error('No hub connected');

      const d = await hubDevice.discoverAllServicesAndCharacteristics();
      await d.writeCharacteristicWithResponseForService(
        HUB_SERVICE_UUID,
        HUB_CMD_CHAR_UUID,
        utf8ToB64(cmd),
      );
    },
    [ensureNativeManager],
  );

  const nativeSubscribeHubEvents = React.useCallback(
    async (device: any) => {
      const dd = await device.discoverAllServicesAndCharacteristics();

      evtSubRef.current?.remove?.();
      evtSubRef.current = dd.monitorCharacteristicForService(
        HUB_SERVICE_UUID,
        HUB_EVT_CHAR_UUID,
        (err: any, char: any) => {
          if (err) return;
          const txt = b64ToUtf8(char?.value);
          if (!txt) return;

          const evt = safeJsonParse<HubEvt>(txt);
          if (!evt) return;

          handleHubEvent(evt);
        },
      );
    },
    [handleHubEvent],
  );

  const nativeDisconnectHub = React.useCallback(async () => {
    const manager = ensureNativeManager();
    const hubDevice = hubDeviceRef.current;

    try {
      evtSubRef.current?.remove?.();
      evtSubRef.current = null;

      if (hubDevice && manager) {
        await manager.cancelDeviceConnection(hubDevice.id);
      }
    } catch {
      // ignore
    } finally {
      hubDeviceRef.current = null;
      setConnectedBox(null);
      resetBoxes();
      setPhase('idle');
    }
  }, [ensureNativeManager, resetBoxes]);

  const nativeScanAndConnectHub = React.useCallback(async () => {
    const manager = ensureNativeManager();
    if (!manager) return;

    await ensureBtOnNative();

    setPhase('scanningHub');
    hubDeviceRef.current = null;
    setConnectedBox(null);
    resetBoxes();

    manager.stopDeviceScan();

    const foundRef = { done: false };
    const timeout = setTimeout(() => {
      if (foundRef.done) return;
      manager.stopDeviceScan();
      setPhase('idle');
      Alert.alert('לא נמצא HUB', 'ודא שה-HUB דולק ומפרסם BLE.');
    }, 12000);

    manager.startDeviceScan(
      [HUB_SERVICE_UUID],
      { allowDuplicates: false },
      async (error: any, device: any) => {
        if (error) {
          clearTimeout(timeout);
          setPhase('idle');
          Alert.alert('Scan error', String(error.message ?? error));
          return;
        }
        if (!device) return;

        foundRef.done = true;
        clearTimeout(timeout);
        manager.stopDeviceScan();
        setPhase('connectingHub');

        try {
          const connected = await manager.connectToDevice(device.id, { autoConnect: false });
          hubDeviceRef.current = connected;
          setPhase('hubConnected');

          await nativeSubscribeHubEvents(connected);

          // ✅ סנכרון מי מחובר כרגע
          await nativeWriteHubCmd('status');

          Alert.alert('HUB מחובר', 'עכשיו אפשר לסרוק קופסאות דרך ה-HUB');
        } catch (e: any) {
          setPhase('idle');
          Alert.alert('חיבור ל-HUB נכשל', String(e?.message ?? e));
        }
      },
    );
  }, [
    ensureBtOnNative,
    ensureNativeManager,
    nativeSubscribeHubEvents,
    nativeWriteHubCmd,
    resetBoxes,
  ]);

  // ======================
  // ===== WEB METHODS =====
  // ======================
  const webDisconnectHub = React.useCallback(async () => {
    try {
      const dev = webDeviceRef.current;
      if (dev?.gatt?.connected) dev.gatt.disconnect();
    } catch {
      // ignore
    } finally {
      webDeviceRef.current = null;
      webServerRef.current = null;
      webCmdCharRef.current = null;
      webEvtCharRef.current = null;
      setConnectedBox(null);
      resetBoxes();
      setPhase('idle');
    }
  }, [resetBoxes]);

  const webWriteHubCmd = React.useCallback(async (cmd: string) => {
    const ch = webCmdCharRef.current;
    if (!ch) throw new Error('No hub connected');

    const bytes = new TextEncoder().encode(cmd); // HUB צריך לקרוא bytes→string
    await ch.writeValue(bytes);
  }, []);

  const writeHubCmd = React.useCallback(
    async (cmd: string) => {
      if (Platform.OS === 'web') await webWriteHubCmd(cmd);
      else await nativeWriteHubCmd(cmd);
    },
    [nativeWriteHubCmd, webWriteHubCmd],
  );

  const webSubscribeHubEvents = React.useCallback(async () => {
    const evtChar = webEvtCharRef.current;
    if (!evtChar) throw new Error('No EVT characteristic');

    // ✅ notifications
    await evtChar.startNotifications();

    const onValue = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      const dv = target.value;
      if (!dv) return;

      // HUB שולח JSON כ-UTF8 bytes
      const txt = new TextDecoder().decode(dv.buffer);
      const evt = safeJsonParse<HubEvt>(txt);
      if (!evt) return;

      handleHubEvent(evt);
    };

    evtChar.addEventListener('characteristicvaluechanged', onValue);

    // cleanup function stored in ref by returning closure pattern
    return () => {
      try {
        evtChar.removeEventListener('characteristicvaluechanged', onValue);
      } catch {
        // ignore
      }
    };
  }, [handleHubEvent]);

  const webRequestDeviceAndConnectHub = React.useCallback(async () => {
    if (!isWebBluetoothSupported()) return;

    setPhase('connectingHub');
    setConnectedBox(null);
    resetBoxes();

    // @ts-expect-error - navigator typing differs
    const bt = navigator.bluetooth as Bluetooth;

    try {
      // מבקשים הרשאות + בחירת מכשיר
      const device = await bt.requestDevice({
        filters: [{ services: [HUB_SERVICE_UUID] }],
        optionalServices: [HUB_SERVICE_UUID],
      });

      webDeviceRef.current = device;

      device.addEventListener('gattserverdisconnected', () => {
        setPhase('idle');
        setConnectedBox(null);
      });

      setPhase('connectingHub');

      const server = await device.gatt!.connect();
      webServerRef.current = server;

      const service = await server.getPrimaryService(HUB_SERVICE_UUID);
      const cmdChar = await service.getCharacteristic(HUB_CMD_CHAR_UUID);
      const evtChar = await service.getCharacteristic(HUB_EVT_CHAR_UUID);

      webCmdCharRef.current = cmdChar;
      webEvtCharRef.current = evtChar;

      // subscribe events
      const cleanup = await webSubscribeHubEvents();

      setPhase('hubConnected');

      // ✅ סנכרון מי מחובר כרגע
      await webWriteHubCmd('status');

      Alert.alert('HUB מחובר (WEB)', 'עכשיו אפשר לסרוק קופסאות דרך ה-HUB');

      // cleanup on unmount
      return cleanup;
    } catch (e: any) {
      setPhase('idle');
      Alert.alert('WEB Bluetooth error', String(e?.message ?? e));
      return undefined;
    }
  }, [resetBoxes, webSubscribeHubEvents, webWriteHubCmd]);

  // ==========================
  // ===== Commands (common) ===
  // ==========================
  const requestScanBoxesClean = React.useCallback(async () => {
    try {
      setPhase('scanningBoxes');
      resetBoxes();

      // קודם ננסה forceScan (HUB חדש)
      try {
        await writeHubCmd('forceScan');
        return;
      } catch {
        // fallback ל-HUB ישן: disconnect ואז scan
      }

      await writeHubCmd('disconnect');
      // רגע קטן כדי לתת ל-ESP לעשות disconnect לפני scan
      await new Promise((r) => setTimeout(r, 150));
      await writeHubCmd('scan');
    } catch (e: any) {
      setPhase('hubConnected');
      Alert.alert('שגיאה', String(e?.message ?? e));
    }
  }, [resetBoxes, writeHubCmd]);

  const requestConnectBox = React.useCallback(
    async (addr: string) => {
      try {
        setSelectedAddr(addr);
        setPhase('connectingBox');

        if (Platform.OS === 'web') {
          await webWriteHubCmd(`connect:${addr}`);
        } else {
          await nativeWriteHubCmd(`connect:${addr}`);
        }
      } catch (e: any) {
        setPhase('hubConnected');
        Alert.alert('שגיאה', String(e?.message ?? e));
      }
    },
    [nativeWriteHubCmd, webWriteHubCmd],
  );

  const requestDisconnectBox = React.useCallback(async () => {
    try {
      if (!connectedBox) return;

      // ההאב מחזיק חיבור אחד בלבד → disconnect כללי
      await writeHubCmd('disconnect');
      await writeHubCmd('status');
    } catch (e: any) {
      Alert.alert('שגיאה', String(e?.message ?? e));
    }
  }, [connectedBox, writeHubCmd]);

  const requestStatus = React.useCallback(async () => {
    try {
      if (Platform.OS === 'web') await webWriteHubCmd('status');
      else await nativeWriteHubCmd('status');
    } catch {
      // ignore
    }
  }, [nativeWriteHubCmd, webWriteHubCmd]);

  // ===== effect cleanup =====
  React.useEffect(() => {
    const run = async () => {
      const isHubConnectedNow =
        Platform.OS === 'web'
          ? !!webServerRef.current && !!webDeviceRef.current?.gatt?.connected
          : !!hubDeviceRef.current;

      if (isHubConnectedNow) await requestStatus();
    };

    run();

    return () => {
      try {
        if (Platform.OS !== 'web') {
          const manager = managerRef.current;
          manager?.stopDeviceScan?.();
          evtSubRef.current?.remove?.();
          evtSubRef.current = null;
        }
      } catch {
        /* Empty */
      }
    };
  }, [requestStatus]);

  // ===== Derived UI =====
  const isHubConnected =
    Platform.OS === 'web'
      ? !!webServerRef.current && !!webDeviceRef.current?.gatt?.connected
      : !!hubDeviceRef.current;

  const hubName =
    Platform.OS === 'web'
      ? (webDeviceRef.current?.name ?? 'HUB')
      : (hubDeviceRef.current?.name ?? hubDeviceRef.current?.id ?? 'HUB');

  const hubStatusText =
    phase === 'scanningHub'
      ? 'מחפש HUB...'
      : phase === 'connectingHub'
        ? 'מתחבר ל-HUB...'
        : isHubConnected
          ? `HUB מחובר: ${hubName}`
          : 'לא מחובר ל-HUB';

  // ==========================
  // ============ WEB ==========
  // ==========================
  if (Platform.OS === 'web') {
    const supported = isWebBluetoothSupported();

    if (!supported) {
      return (
        <View style={styles.container}>
          <Card>
            <AppText style={styles.title}>חיבור קופסה</AppText>
            <AppText tone="muted" style={{ marginTop: 6 }}>
              הדפדפן הזה לא תומך ב-Web Bluetooth.
              {'\n'}
              כדי להתחבר ל-HUB ב-WEB צריך Chrome/Edge (בדרך כלל Android/Chrome עובד הכי טוב).
              {'\n'}
              אחרת – תריץ את האפליקציה על Android/iOS.
            </AppText>

            <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
              <AppButton
                title="להמשיך בלי BLE (WEB Preview)"
                variant="ghost"
                onPress={() => {
                  navigation.replace('Tabs');
                  onDone?.();
                }}
              />
            </View>
          </Card>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Card>
          <AppText style={styles.title}>{t('connectBoxTitle') ?? 'חיבור קופסה'}</AppText>
          <AppText tone="muted" style={{ marginTop: 4 }}>
            WEB Bluetooth עובד רק אחרי בקשת הרשאה. נתחבר ל-HUB ואז נבצע סריקה נקייה לקופסאות.
          </AppText>

          <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
            <AppText>{hubStatusText}</AppText>

            <View style={{ flexDirection: 'row', gap: theme.space.md }}>
              <AppButton
                title={isHubConnected ? 'התנתק HUB' : 'בקש הרשאה והתחבר ל-HUB'}
                variant={isHubConnected ? 'ghost' : 'primary'}
                onPress={isHubConnected ? webDisconnectHub : webRequestDeviceAndConnectHub}
                disabled={phase === 'connectingHub' || phase === 'scanningHub'}
                style={{ flex: 1 }}
              />

              <AppButton
                title="סריקה נקייה"
                onPress={requestScanBoxesClean}
                disabled={!isHubConnected || phase === 'scanningBoxes' || phase === 'connectingBox'}
                style={{ flex: 1 }}
              />
            </View>

            {connectedBox && (
              <Card>
                <AppText style={{ fontWeight: '900' }}>מחובר כרגע</AppText>
                <View style={{ marginTop: 10, gap: 6 }}>
                  <Row label="addr" value={connectedBox.addr} />
                  <Row label="boxId" value={connectedBox.boxId} />
                </View>

                <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
                  <AppButton
                    title="נתק BOX"
                    variant="ghost"
                    onPress={requestDisconnectBox}
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="רענן סטטוס"
                    variant="ghost"
                    onPress={requestStatus}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            )}

            {(phase === 'connectingHub' ||
              phase === 'scanningBoxes' ||
              phase === 'connectingBox') && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator />
                <AppText tone="muted">
                  {phase === 'connectingHub'
                    ? 'מתחבר ל-HUB...'
                    : phase === 'scanningBoxes'
                      ? 'מבצע סריקה נקייה דרך ה-HUB...'
                      : 'מתחבר לקופסה...'}
                </AppText>
              </View>
            )}

            <View style={{ marginTop: theme.space.md }}>
              <AppText style={{ fontWeight: '700' }}>קופסאות שנמצאו</AppText>
              <AppText tone="muted" style={{ marginTop: 2, fontSize: 12 }}>
                "סריקה נקייה = forceScan: נתק קופסה אם מחוברת ואז סרוק מחדש"
              </AppText>

              <FlatList
                data={boxes}
                keyExtractor={(b) => b.addr}
                style={{ marginTop: 10, maxHeight: 320 }}
                ListEmptyComponent={
                  <AppText tone="muted" style={{ marginTop: 10 }}>
                    עדיין לא נמצאו קופסאות.
                  </AppText>
                }
                renderItem={({ item }) => (
                  <View style={styles.boxRow}>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontWeight: '700' }}>{item.name || 'BOX'}</AppText>
                      <AppText tone="muted" style={{ fontSize: 12 }}>
                        {item.addr} · RSSI {item.rssi}
                      </AppText>
                    </View>

                    <AppButton
                      title={
                        selectedAddr === item.addr && phase === 'connectingBox' ? 'מתחבר...' : 'חבר'
                      }
                      onPress={() => requestConnectBox(item.addr)}
                      disabled={
                        !isHubConnected || phase === 'scanningBoxes' || phase === 'connectingBox'
                      }
                      variant="ghost"
                    />
                  </View>
                )}
              />
            </View>
          </View>
        </Card>
      </View>
    );
  }

  // ==========================
  // ========= NATIVE ==========
  // ==========================
  return (
    <View style={styles.container}>
      <Card>
        <AppText style={styles.title}>{t('connectBoxTitle') ?? 'חיבור קופסה'}</AppText>
        <AppText tone="muted" style={{ marginTop: 4 }}>
          קודם מתחברים ל-HUB, ואז עושים “סריקה נקייה” כדי לוודא שה-BOX לא נשאר מחובר.
        </AppText>

        <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
          <AppText>{hubStatusText}</AppText>

          <View style={{ flexDirection: 'row', gap: theme.space.md }}>
            <AppButton
              title={isHubConnected ? 'התנתק HUB' : 'סרוק HUB'}
              variant={isHubConnected ? 'ghost' : 'primary'}
              onPress={isHubConnected ? nativeDisconnectHub : nativeScanAndConnectHub}
              disabled={phase === 'scanningHub' || phase === 'connectingHub'}
              style={{ flex: 1 }}
            />
            <AppButton
              title="סריקה נקייה"
              onPress={requestScanBoxesClean}
              disabled={!isHubConnected || phase === 'scanningBoxes' || phase === 'connectingBox'}
              style={{ flex: 1 }}
            />
          </View>

          {connectedBox && (
            <Card>
              <AppText style={{ fontWeight: '900' }}>מחובר כרגע</AppText>
              <View style={{ marginTop: 10, gap: 6 }}>
                <Row label="addr" value={connectedBox.addr} />
                <Row label="boxId" value={connectedBox.boxId} />
              </View>

              <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
                <AppButton
                  title="נתק BOX"
                  variant="ghost"
                  onPress={requestDisconnectBox}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="רענן סטטוס"
                  variant="ghost"
                  onPress={requestStatus}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}

          {(phase === 'scanningHub' ||
            phase === 'connectingHub' ||
            phase === 'scanningBoxes' ||
            phase === 'connectingBox') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator />
              <AppText tone="muted">
                {phase === 'scanningHub'
                  ? 'מחפש HUB...'
                  : phase === 'connectingHub'
                    ? 'מתחבר ל-HUB...'
                    : phase === 'scanningBoxes'
                      ? 'מבצע סריקה נקייה דרך ה-HUB...'
                      : 'מתחבר לקופסה...'}
              </AppText>
            </View>
          )}

          <View style={{ marginTop: theme.space.md }}>
            <AppText style={{ fontWeight: '700' }}>קופסאות שנמצאו</AppText>
            <AppText tone="muted" style={{ marginTop: 2, fontSize: 12 }}>
              אם לא רואים קופסה אחרי חיבור/מחיקה — תלחץ “סריקה נקייה” (forceScan).
            </AppText>

            <FlatList
              data={boxes}
              keyExtractor={(b) => b.addr}
              style={{ marginTop: 10, maxHeight: 320 }}
              ListEmptyComponent={
                <AppText tone="muted" style={{ marginTop: 10 }}>
                  עדיין לא נמצאו קופסאות.
                </AppText>
              }
              renderItem={({ item }) => (
                <View style={styles.boxRow}>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: '700' }}>{item.name || 'BOX'}</AppText>
                    <AppText tone="muted" style={{ fontSize: 12 }}>
                      {item.addr} · RSSI {item.rssi}
                    </AppText>
                  </View>

                  <AppButton
                    title={
                      selectedAddr === item.addr && phase === 'connectingBox' ? 'מתחבר...' : 'חבר'
                    }
                    onPress={() => requestConnectBox(item.addr)}
                    disabled={
                      !isHubConnected || phase === 'scanningBoxes' || phase === 'connectingBox'
                    }
                    variant="ghost"
                  />
                </View>
              )}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.xl },
  title: { fontSize: 20, fontWeight: '900' },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
});
