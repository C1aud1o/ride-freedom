// Integrazione con l'app Android (Capacitor). Nel browser non fa nulla.
// Nell'app: Web Bluetooth non esiste nella WebView, quindi qui si installa un "navigator.bluetooth"
// equivalente costruito sul plugin nativo @capacitor-community/bluetooth-le. Il resto dell'app
// (rullo, Zwift Click, cardio, misuratore di potenza) funziona senza modifiche.
const cx = window.capacitorExports;
export const isNative = !!cx?.Capacitor?.isNativePlatform?.();
export const BLE = isNative ? cx.registerPlugin('BluetoothLe') : null;
export const GarminBridge = isNative ? cx.registerPlugin('GarminBridge') : null;
// promemoria dei piani di allenamento (@capacitor/local-notifications): notifiche locali, nessun server
export const LocalNotifications = isNative ? cx.registerPlugin('LocalNotifications') : null;

const ALIASES = {
  heart_rate: 0x180d, battery_service: 0x180f, device_information: 0x180a, cycling_power: 0x1818,
  cycling_speed_and_cadence: 0x1816, fitness_machine: 0x1826, heart_rate_measurement: 0x2a37,
};
function uuid(u) {
  if (typeof u === 'number') return `0000${u.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
  if (ALIASES[u]) return uuid(ALIASES[u]);
  const s = String(u).toLowerCase();
  if (/^[0-9a-f]{4}$/.test(s)) return uuid(parseInt(s, 16));
  return s;
}
const hexToDV = (hex) => {
  const pairs = String(hex || '').replace(/[^0-9a-f]/gi, '').match(/../g) || [];
  return new DataView(new Uint8Array(pairs.map((h) => parseInt(h, 16))).buffer);
};
const toHex = (v) => {
  const u8 = v instanceof DataView ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
    : v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer || v);
  return Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join(' ');
};
// le operazioni GATT vanno fatte una alla volta
let queue = Promise.resolve();
const serial = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
let ready = null;
const init = () => (ready ||= BLE.initialize({ androidNeverForLocation: true }));

class NativeCharacteristic extends EventTarget {
  constructor(device, service, info) {
    super();
    this.service = service; this.uuid = info.uuid; this._dev = device; this.value = null;
    const p = info.properties || {};
    this.properties = { read: !!p.read, write: !!p.write, writeWithoutResponse: !!p.writeWithoutResponse, notify: !!p.notify, indicate: !!p.indicate };
  }
  get _ids() { return { deviceId: this._dev.id, service: this.service.uuid, characteristic: this.uuid }; }
  async readValue() { const r = await serial(() => BLE.read(this._ids)); this.value = hexToDV(r.value); return this.value; }
  writeValueWithResponse(v) { return serial(() => BLE.write({ ...this._ids, value: toHex(v) })); }
  writeValueWithoutResponse(v) { return serial(() => BLE.writeWithoutResponse({ ...this._ids, value: toHex(v) })); }
  writeValue(v) { return this.writeValueWithResponse(v); }
  async startNotifications() {
    const key = `notification|${this._dev.id}|${this.service.uuid}|${this.uuid}`;
    await this._listener?.remove();
    this._listener = await BLE.addListener(key, (ev) => {
      this.value = hexToDV(ev.value);
      this.dispatchEvent(new Event('characteristicvaluechanged'));
    });
    await serial(() => BLE.startNotifications(this._ids));
    return this;
  }
  async stopNotifications() { await this._listener?.remove(); await serial(() => BLE.stopNotifications(this._ids)); return this; }
}

class NativeService {
  constructor(device, info) { this.device = device; this.uuid = info.uuid; this.chars = (info.characteristics || []).map((c) => new NativeCharacteristic(device, this, c)); }
  async getCharacteristic(u) { const id = uuid(u); const c = this.chars.find((x) => x.uuid === id); if (!c) throw new DOMException('Characteristic not found', 'NotFoundError'); return c; }
  async getCharacteristics() { return this.chars; }
}

class NativeDevice extends EventTarget {
  constructor(id, name) {
    super();
    this.id = id; this.name = name; this.services = [];
    const dev = this;
    this.gatt = {
      connected: false, device: dev,
      async connect() {
        await init();
        await dev._disc?.remove();
        dev._disc = await BLE.addListener(`disconnected|${id}`, () => { dev.gatt.connected = false; dev.dispatchEvent(new Event('gattserverdisconnected')); });
        await serial(() => BLE.connect({ deviceId: id }));
        const res = await serial(() => BLE.getServices({ deviceId: id }));
        dev.services = (res.services || []).map((s) => new NativeService(dev, s));
        this.connected = true;
        return this;
      },
      disconnect() { BLE.disconnect({ deviceId: id }).catch(() => {}); },
      async getPrimaryService(u) { const want = uuid(u); const s = dev.services.find((x) => x.uuid === want); if (!s) throw new DOMException('Service not found', 'NotFoundError'); return s; },
      async getPrimaryServices() { return dev.services; },
    };
  }
}

if (isNative) {
  const bluetooth = {
    async getAvailability() { return true; },
    async requestDevice(opts = {}) {
      await init();
      const services = []; let namePrefix = null;
      for (const f of opts.filters || []) {
        if (f.services) services.push(...f.services.map(uuid));
        if (f.namePrefix && !namePrefix) namePrefix = f.namePrefix;
      }
      const req = services.length ? { services: [...new Set(services)] } : namePrefix ? { namePrefix } : {};
      req.optionalServices = (opts.optionalServices || []).map(uuid);
      const d = await BLE.requestDevice(req);
      return new NativeDevice(d.deviceId, d.name || 'Device');
    },
  };
  Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true });
  document.documentElement.classList.add('native-app');
}
