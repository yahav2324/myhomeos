import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { HUB_SERVICE_UUID, HUB_CMD_CHAR_UUID, HUB_EVT_CHAR_UUID, HUB_NAME_PREFIX } from './hub';
import { Buffer } from 'buffer';

type Listener<T> = (val: T) => void;

export type HubEvt =
  | { type: 'hub_connected' }
  | { type: 'scan_started' }
  | { type: 'scan_done'; count: number; error?: string }
  | { type: 'box_found'; addr: string; rssi: number; name: string }
  | { type: 'box_connected'; addr: string; boxId: string }
  | { type: 'box_disconnected' }
  | { type: 'box_connect_failed'; addr: string; error?: string }
  | {
      type: 'status';
      hubId: string;
      uptimeMs: number;
      wifi: 'connected' | 'disconnected';
      ip: string;
      phoneConnected: boolean;
      boxConnected: boolean;
      boxAddr: string;
      boxId: string;
      scanMayMissBecauseBoxConnected: boolean;
    }
  | { type: 'telemetry'; boxId: string; payload: any }
  // fallback:
  | { type: string; [k: string]: any };

function decodeBase64(b64: string) {
  return Buffer.from(b64, 'base64').toString('utf8');
}
function encodeBase64(text: string) {
  return Buffer.from(text, 'utf8').toString('base64');
}

export class HubClient {
  private manager = new BleManager();
  private device: Device | null = null;
  private cmdChar: Characteristic | null = null;
  private evtChar: Characteristic | null = null;

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
      if (this.device) {
        await this.device.cancelConnection();
      }
    } catch {
      // Intentionally ignore errors during destroy
    }
    this.device = null;
    this.cmdChar = null;
    this.evtChar = null;
    this.manager.destroy();
  }

  async scanForHub(timeoutMs = 8000): Promise<Device[]> {
    const found: Device[] = [];
    const seen = new Set<string>();

    this.log('Scanning for HUB...');

    return await new Promise((resolve) => {
      const sub = this.manager.onStateChange((state) => {
        if (state !== 'PoweredOn') return;

        const timer = setTimeout(() => {
          this.manager.stopDeviceScan();
          sub.remove();
          resolve(found);
        }, timeoutMs);

        this.manager.startDeviceScan(
          [HUB_SERVICE_UUID],
          { allowDuplicates: false },
          (error, dev) => {
            if (error) {
              this.log(`Scan error: ${error.message}`);
              return;
            }
            if (!dev) return;

            const name = dev.name ?? dev.localName ?? '';
            const isHub = name.includes(HUB_NAME_PREFIX) || name.includes('SmartKitchenHub');

            if (!isHub) return;

            if (!seen.has(dev.id)) {
              seen.add(dev.id);
              found.push(dev);
              this.log(`Found HUB: ${name} (${dev.id})`);
            }
          },
        );

        // just in case stop early
        setTimeout(() => {
          clearTimeout(timer);
        }, timeoutMs + 2000);
      }, true);
    });
  }

  async connectToHub(deviceId: string) {
    this.log(`Connecting to HUB deviceId=${deviceId}`);

    const dev = await this.manager.connectToDevice(deviceId, { timeout: 15000 });
    this.device = dev;

    await dev.discoverAllServicesAndCharacteristics();

    // Get chars
    const services = await dev.services();
    const hubSvc = services.find((s) => s.uuid.toLowerCase() === HUB_SERVICE_UUID);

    if (!hubSvc) {
      throw new Error('HUB service not found on device');
    }

    const chars = await hubSvc.characteristics();
    this.cmdChar = chars.find((c) => c.uuid.toLowerCase() === HUB_CMD_CHAR_UUID) ?? null;
    this.evtChar = chars.find((c) => c.uuid.toLowerCase() === HUB_EVT_CHAR_UUID) ?? null;

    if (!this.cmdChar) throw new Error('HUB CMD characteristic missing');
    if (!this.evtChar) throw new Error('HUB EVT characteristic missing');

    // Subscribe notifications
    await this.evtChar.monitor((error, ch) => {
      if (error) {
        this.log(`EVT monitor error: ${error.message}`);
        return;
      }
      const v = ch?.value;
      if (!v) return;

      const text = decodeBase64(v);

      // HUB שולח JSON (string). נטפל בזה.
      let evt: HubEvt | null = null;
      try {
        evt = JSON.parse(text);
      } catch {
        evt = { type: 'raw', text } as any;
      }

      this.evtListeners.forEach((l) => l(evt!));
    });

    // auto status (server כבר שולח status ב-onConnect, אבל נוודא גם מהצד שלנו)
    await this.sendCmd('status');

    this.log('Connected & subscribed to EVT');
  }

  async disconnectHub() {
    if (!this.device) return;
    this.log('Disconnecting HUB');
    await this.device.cancelConnection();
    this.device = null;
    this.cmdChar = null;
    this.evtChar = null;
  }

  async sendCmd(cmd: string) {
    if (!this.device || !this.cmdChar) throw new Error('Not connected to HUB');
    this.log(`CMD -> ${cmd}`);
    await this.cmdChar.writeWithResponse(encodeBase64(cmd));
  }

  // convenience
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
