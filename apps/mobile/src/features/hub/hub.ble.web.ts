// apps/mobile/src/features/hub/hub.ble.web.ts
import { useHubStore } from './hub.store';

const HUB_SERVICE_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const HUB_CMD_CHAR_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
const HUB_EVT_CHAR_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';

type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;
type BluetoothRemoteGATTServer = any;

type HubSession = {
  hubId: string;
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  cmdChar: BluetoothRemoteGATTCharacteristic;
  evtChar: BluetoothRemoteGATTCharacteristic;
  onEvt: (ev: Event) => void;
};

const sessions = new Map<string, HubSession>();

function decodeUtf8(v: DataView | ArrayBuffer): string {
  const buf = v instanceof DataView ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v;
  return new TextDecoder('utf-8').decode(buf);
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function applyEvtToStore(hubId: string, evt: any) {
  const st = useHubStore.getState();

  // ודא HUB קיים ב-store
  if (evt?.hubName) st.upsertHub({ hubId, name: evt.hubName });
  else st.upsertHub({ hubId });

  const type = evt?.type as string | undefined;

  if (type === 'hub_connected') {
    st.setHubConnected(hubId, true);
    st.setHubPhase(hubId, 'hubConnected');
    return;
  }

  if (type === 'scan_started') {
    st.setHubPhase(hubId, 'scanningBoxes');
    st.resetHubBoxesFound(hubId);
    return;
  }

  if (type === 'scan_done') {
    st.setHubPhase(hubId, 'hubConnected');
    return;
  }

  if (type === 'box_found') {
    st.upsertHubBoxFound(hubId, {
      addr: String(evt.addr),
      name: String(evt.name ?? 'BOX'),
      rssi: Number(evt.rssi ?? -999),
    });
    return;
  }

  if (type === 'box_connected') {
    st.upsertConnectedBox(hubId, { addr: String(evt.addr), boxId: String(evt.boxId ?? 'UNKNOWN') });
    st.bumpNavToken(hubId);

    // ✅ טריגר ניווט
    st.bumpNavToken(hubId);

    st.setHubPhase(hubId, 'hubConnected');

    // ❌ אל תאפס פה selectedAddr
    // st.setHubSelectedAddr(hubId, null);

    return;
  }

  if (type === 'box_disconnected') {
    if (evt.addr) st.removeConnectedBoxByAddr(hubId, String(evt.addr));
    st.setHubPhase(hubId, 'hubConnected');
    return;
  }

  if (type === 'box_disconnected_all') {
    st.clearConnectedBoxes(hubId);
    st.setHubPhase(hubId, 'hubConnected');
    return;
  }

  if (type === 'status') {
    st.setStatusSingleOrMany(hubId, {
      connected: true,
      boxes: Array.isArray(evt.boxes) ? evt.boxes : [],
    });
    return;
  }

  if (type === 'error') {
    st.setHubError(hubId, String(evt.msg ?? 'error'));
    st.setHubPhase(hubId, 'hubConnected');
    return;
  }

  if (type === 'telemetry') {
    const addr = String(evt.addr);
    const p = evt.payload ?? evt;

    const unit: 'g' | 'ml' = p.unit === 'ml' ? 'ml' : 'g';
    const quantity = Number(p.quantity ?? p.weight ?? p.value ?? p.net ?? 0);

    st.setLastTelemetry(hubId, addr, { unit, quantity });

    const boxId = String(p.boxId ?? '');
    if (boxId) {
      st.setLastTelemetry(hubId, boxId, { unit, quantity });
    }
    return;
  }

  // telemtry events לא חובה למסך, אבל נשאיר אפשרות
}

export async function hubRequestAndConnect() {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    throw new Error('Web Bluetooth not supported in this environment');
  }

  const device = await (navigator as any).bluetooth.requestDevice({
    filters: [{ services: [HUB_SERVICE_UUID] }],
    optionalServices: [HUB_SERVICE_UUID],
  });

  if (!device.gatt) throw new Error('No GATT on selected device');

  const hubId = device.id;
  const st = useHubStore.getState();

  st.upsertHub({ hubId, name: device.name ?? 'HUB' });
  st.setHubPhase(hubId, 'connectingHub');

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(HUB_SERVICE_UUID);
  const cmdChar = await service.getCharacteristic(HUB_CMD_CHAR_UUID);
  const evtChar = await service.getCharacteristic(HUB_EVT_CHAR_UUID);

  st.setHubConnected(hubId, true);
  st.setHubPhase(hubId, 'hubConnected');

  const onEvt = (ev: Event) => {
    const c = ev.target as BluetoothRemoteGATTCharacteristic;
    const raw = c.value ? decodeUtf8(c.value) : '';
    console.log('[HUB EVT RAW]', raw);
    const parsed = safeJsonParse(raw);
    console.log('[HUB EVT JSON]', parsed);
    if (parsed) applyEvtToStore(hubId, parsed);
  };

  await evtChar.startNotifications();
  evtChar.addEventListener('characteristicvaluechanged', onEvt);

  const session: HubSession = { hubId, device, server, cmdChar, evtChar, onEvt };
  sessions.set(hubId, session);

  device.addEventListener('gattserverdisconnected', () => {
    // ניתוק
    const s = useHubStore.getState();
    s.setHubConnected(hubId, false);
    s.setHubPhase(hubId, 'idle');
    s.clearConnectedBoxes(hubId);
    s.resetHubBoxesFound(hubId);
    sessions.delete(hubId);
  });

  // סנכרון מצב מיידי
  await hubSendCmd(hubId, 'status');

  return hubId;
}

export async function hubDisconnect(hubId: string) {
  const session = sessions.get(hubId);
  const st = useHubStore.getState();

  if (!session) {
    st.setHubConnected(hubId, false);
    st.setHubPhase(hubId, 'idle');
    return;
  }

  try {
    session.evtChar.removeEventListener('characteristicvaluechanged', session.onEvt);
  } catch {
    /* empty */
  }
  try {
    session.server.disconnect();
  } catch {
    /* empty */
  }

  sessions.delete(hubId);
  st.setHubConnected(hubId, false);
  st.setHubPhase(hubId, 'idle');
  st.clearConnectedBoxes(hubId);
  st.resetHubBoxesFound(hubId);
}

export async function hubSendCmd(hubId: string, cmd: string) {
  const session = sessions.get(hubId);
  if (!session) throw new Error(`No session for hubId=${hubId}`);
  const bytes = new TextEncoder().encode(cmd);
  await session.cmdChar.writeValue(bytes);
}

export async function hubScan(hubId: string) {
  const st = useHubStore.getState();
  st.setHubError(hubId, undefined);
  st.resetHubBoxesFound(hubId);
  st.setHubPhase(hubId, 'scanningBoxes');
  await hubSendCmd(hubId, 'scan');
}

export async function hubConnectBox(hubId: string, addr: string) {
  const st = useHubStore.getState();
  st.setHubSelectedAddr(hubId, addr);
  st.setHubPhase(hubId, 'connectingBox');
  await hubSendCmd(hubId, `connect:${addr}`);
}

export async function hubDisconnectBox(hubId: string, addr: string) {
  await hubSendCmd(hubId, `disconnect:${addr}`);
}

export async function hubDisconnectAllBoxes(hubId: string) {
  await hubSendCmd(hubId, 'disconnectAll');
}
