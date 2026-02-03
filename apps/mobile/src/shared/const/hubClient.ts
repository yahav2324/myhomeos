import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import { HUB_SERVICE_UUID, HUB_CMD_CHAR_UUID, HUB_EVT_CHAR_UUID, HUB_NAME_PREFIX } from './hub';

// הרחבת הממשק של Navigator כדי ש-TS יזהה את Bluetooth
declare global {
  interface Navigator {
    bluetooth: {
      requestDevice(options?: any): Promise<any>;
    };
  }
}
// ייבוא מותנה: BleManager ייטען רק ב-Native כדי לא לשבור את ה-Web
let BleManager: any;
if (Platform.OS !== 'web') {
  BleManager = require('react-native-ble-plx').BleManager;
}

type Listener<T> = (val: T) => void;

export type HubEvt =
  | { type: 'hub_connected' }
  | { type: 'scan_started' }
  | { type: 'scan_done'; count: number; error?: string }
  | { type: 'box_found'; addr: string; rssi: number; name: string }
  | { type: 'box_connected'; addr: string; boxId: string }
  | { type: 'box_disconnected' }
  | { type: 'status'; [key: string]: any }
  | { type: string; [k: string]: any };

function decodeBase64(b64: string) {
  return Buffer.from(b64, 'base64').toString('utf8');
}
function encodeBase64(text: string) {
  return Buffer.from(text, 'utf8').toString('base64');
}

export class HubClient {
  // Native properties
  private manager = Platform.OS !== 'web' ? new BleManager() : null;
  private device: any = null;
  private cmdChar: any = null;
  private evtChar: any = null;

  // Web properties (מיועד לדפדפן)
  private webGattServer: any = null;
  private webCmdChar: any = null;

  private evtListeners = new Set<Listener<HubEvt>>();
  private logListeners = new Set<Listener<string>>();

  onEvent(cb: Listener<HubEvt>) {
    this.evtListeners.add(cb);
    return () => this.evtListeners.delete(cb);
  }

  onLog(cb: Listener<string>) {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  private log(msg: string) {
    this.logListeners.forEach((l) => l(msg));
  }

  async destroy() {
    try {
      if (Platform.OS !== 'web' && this.device) {
        await this.device.cancelConnection();
        this.manager.destroy();
      } else if (this.webGattServer) {
        this.webGattServer.disconnect();
      }
    } catch {
      /* ignore */
    }
    this.device = null;
  }

  // --- סריקה ---
  async scanForHub(timeoutMs = 8000): Promise<any[]> {
    this.log(`Scanning for HUB (${Platform.OS})...`);

    if (Platform.OS === 'web') {
      return this.scanWeb();
    }
    return this.scanNative(timeoutMs);
  }

  private async scanWeb(): Promise<any[]> {
    if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: HUB_NAME_PREFIX }, { name: 'SmartKitchenHub' }],
        optionalServices: [HUB_SERVICE_UUID.toLowerCase()],
      });
      return [{ id: device.id, name: device.name, rawDevice: device }];
    } catch (e) {
      this.log(`Web Scan Cancelled: ${e}`);
      return [];
    }
  }

  private async scanNative(timeoutMs: number): Promise<any[]> {
    const found: any[] = [];
    const seen = new Set<string>();

    return new Promise((resolve) => {
      const sub = this.manager.onStateChange((state: string) => {
        if (state !== 'PoweredOn') return;

        const timer = setTimeout(() => {
          this.manager.stopDeviceScan();
          sub.remove();
          resolve(found);
        }, timeoutMs);

        this.manager.startDeviceScan([HUB_SERVICE_UUID], null, (error: any, dev: any) => {
          if (error) return;
          if (dev && !seen.has(dev.id)) {
            seen.add(dev.id);
            found.push(dev);
            this.log(`Found: ${dev.name} (${dev.id})`);
          }
        });
      }, true);
    });
  }

  // --- התחברות ---
  async connectToHub(deviceId: any) {
    if (Platform.OS === 'web') {
      return this.connectWeb(deviceId.rawDevice);
    }
    return this.connectNative(deviceId);
  }

  private async connectWeb(device: any) {
    this.log('Web: Connecting...');
    this.webGattServer = await device.gatt.connect();
    const service = await this.webGattServer.getPrimaryService(HUB_SERVICE_UUID.toLowerCase());

    this.webCmdChar = await service.getCharacteristic(HUB_CMD_CHAR_UUID.toLowerCase());
    const notifyChar = await service.getCharacteristic(HUB_EVT_CHAR_UUID.toLowerCase());

    await notifyChar.startNotifications();
    notifyChar.addEventListener('characteristicvaluechanged', (event: any) => {
      const value = event.target.value;
      const text = new TextDecoder().decode(value);
      this.handleIncomingJson(text);
    });

    this.log('Web: Connected');
    await this.status();
  }

  private async connectNative(deviceId: string) {
    this.log('Native: Connecting...');
    const dev = await this.manager.connectToDevice(deviceId);
    this.device = dev;
    await dev.discoverAllServicesAndCharacteristics();

    const chars = await dev.characteristicsForService(HUB_SERVICE_UUID);
    this.cmdChar = chars.find((c: any) => c.uuid.toLowerCase() === HUB_CMD_CHAR_UUID.toLowerCase());
    this.evtChar = chars.find((c: any) => c.uuid.toLowerCase() === HUB_EVT_CHAR_UUID.toLowerCase());

    await this.evtChar.monitor((err: any, ch: any) => {
      if (ch?.value) {
        this.handleIncomingJson(decodeBase64(ch.value));
      }
    });

    this.log('Native: Connected');
    await this.status();
  }

  private handleIncomingJson(text: string) {
    try {
      const evt = JSON.parse(text);
      this.evtListeners.forEach((l) => l(evt));
    } catch {
      this.evtListeners.forEach((l) => l({ type: 'raw', text } as any));
    }
  }

  // --- פקודות ---
  async sendCmd(cmd: string) {
    this.log(`CMD -> ${cmd}`);
    if (Platform.OS === 'web') {
      if (!this.webCmdChar) throw new Error('Web CMD char not ready');
      await this.webCmdChar.writeValue(new TextEncoder().encode(cmd));
    } else {
      if (!this.cmdChar) throw new Error('Native CMD char not ready');
      await this.cmdChar.writeWithResponse(encodeBase64(cmd));
    }
  }

  async disconnectHub() {
    if (Platform.OS === 'web') {
      this.webGattServer?.disconnect();
    } else {
      await this.device?.cancelConnection();
    }
    this.device = null;
    this.log('Disconnected');
  }

  // Convenience
  status() {
    return this.sendCmd('status');
  }
  scanBoxes() {
    return this.sendCmd('scan');
  }
  debugScanAll() {
    return this.sendCmd('debugscan');
  }
  disconnectBox() {
    return this.sendCmd('disconnect');
  }
  connectBox(addr: string) {
    return this.sendCmd(`connect:${addr}`);
  }
}
