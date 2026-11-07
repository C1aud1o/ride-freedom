// Mock di navigator.bluetooth per i test (iniettato con page.addInitScript prima che parta l'app).
// Emula un rullo scelto con window.__MOCK_PROFILE:
//   'fec'       Tacx con solo FE-C over BLE (es. Flux / Vortex con firmware vecchio)
//   'tacx-both' Tacx con FE-C e FTMS insieme (firmware recenti)
//   'wahoo'     Wahoo Kickr legacy (Cycling Power + caratteristica a026e005)
//   'ftms'      rullo FTMS semplice (per controllare che il percorso FTMS non sia cambiato)
// Tutto ciò che l'app scrive finisce in window.__ble.writes come { uuid, hex }.
// Come il vero Web Bluetooth, getPrimaryService() rifiuta i servizi non dichiarati in filters/optionalServices.
(() => {
  const profile = window.__MOCK_PROFILE || 'fec';
  const full = (u) => (typeof u === 'number' ? `0000${u.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb` : String(u).toLowerCase());
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join(' ');
  const ble = window.__ble = { profile, writes: [], requestOptions: null, log: [] };

  const FEC_S = '6e40fec1-b5a3-f393-e0a9-e50e24dcca9e';
  const FEC_RX = '6e40fec2-b5a3-f393-e0a9-e50e24dcca9e';
  const FEC_TX = '6e40fec3-b5a3-f393-e0a9-e50e24dcca9e';
  const WAHOO = 'a026e005-0a7d-4ab3-97fa-f1500f9feb8b';

  // valori "letti" dal rullo finto
  const LIVE = { fec: { power: 215, cadence: 88, speedKmh: 30 }, wahoo: { power: 180, cadence: 90 }, ftms: { power: 160, cadence: 85, speedKmh: 28 } };

  class Char extends EventTarget {
    constructor(service, uuid, props, opts = {}) {
      super();
      this.service = service; this.uuid = full(uuid); this.value = null; this.notifying = false;
      this.properties = { read: false, write: false, writeWithoutResponse: false, notify: false, indicate: false, ...props };
      this.onWrite = opts.onWrite; this.readData = opts.read;
    }
    async readValue() {
      if (!this.readData) throw new DOMException('Lettura non supportata', 'NotSupportedError');
      this.value = new DataView(Uint8Array.from(this.readData).buffer); return this.value;
    }
    async startNotifications() { this.notifying = true; return this; }
    async stopNotifications() { this.notifying = false; return this; }
    notify(bytes) {
      if (!this.notifying) return;
      this.value = new DataView(Uint8Array.from(bytes).buffer);
      this.dispatchEvent(new Event('characteristicvaluechanged'));
    }
    async write(v, withResponse) {
      const u8 = v instanceof DataView ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : new Uint8Array(v.buffer ? v.buffer.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength) : v);
      const copy = Uint8Array.from(u8);
      ble.writes.push({ uuid: this.uuid, hex: hex(copy), withResponse });
      if (withResponse && !this.properties.write) throw new DOMException('Write non permessa', 'NotSupportedError');
      if (!withResponse && !this.properties.writeWithoutResponse) throw new DOMException('WriteWithoutResponse non permessa', 'NotSupportedError');
      if (this.onWrite) setTimeout(() => this.onWrite(copy, this), 20);
    }
    writeValueWithResponse(v) { return this.write(v, true); }
    writeValueWithoutResponse(v) { return this.write(v, false); }
    writeValue(v) { return this.write(v, true); }
  }

  class Service {
    constructor(uuid) { this.uuid = full(uuid); this.chars = []; }
    add(uuid, props, opts) { const c = new Char(this, uuid, props, opts); this.chars.push(c); return c; }
    async getCharacteristic(u) { const c = this.chars.find((x) => x.uuid === full(u)); if (!c) throw new DOMException('Caratteristica non trovata', 'NotFoundError'); return c; }
    async getCharacteristics() { return this.chars; }
  }

  // ---------- costruzione dei profili ----------
  const services = [];
  const timers = [];
  const xor = (a) => a.reduce((x, b) => x ^ b, 0);
  const antMsg = (page, type = 0x4e) => { const m = [0xa4, 0x09, type, 0x05, ...page]; return [...m, xor(m)]; };

  function addFec() {
    const s = new Service(FEC_S);
    const rx = s.add(FEC_RX, { notify: true });
    s.add(FEC_TX, { write: true, writeWithoutResponse: true }, {
      onWrite(bytes) {
        // messaggio ANT valido? (sync, lunghezza, checksum XOR)
        const ok = bytes[0] === 0xa4 && bytes[1] === 0x09 && bytes.length === 13 && xor(Array.from(bytes.slice(0, 12))) === bytes[12];
        if (!ok) { ble.log.push(`FE-C: messaggio non valido ${hex(bytes)}`); return; }
        const page = bytes.slice(4, 12);
        // richiesta pagina 0x36 (capacità): rispondiamo con max 1000 N e basic+ERG+sim
        if (page[0] === 0x46 && page[6] === 0x36) rx.notify(antMsg([0x36, 0xff, 0xff, 0xff, 0xff, 0xe8, 0x03, 0x07]));
      },
    });
    services.push(s);
    let n = 0; let accPower = 0;
    timers.push(() => {
      const { power, cadence, speedKmh } = LIVE.fec;
      const sp = Math.round((speedKmh / 3.6) * 1000);
      if (n++ % 2 === 0) rx.notify(antMsg([0x10, 0x19, n & 0xff, n & 0xff, sp & 0xff, sp >> 8, 0xff, 0x34]));
      else { accPower = (accPower + power) & 0xffff; rx.notify(antMsg([0x19, n & 0xff, cadence, accPower & 0xff, accPower >> 8, power & 0xff, (power >> 8) & 0x0f, 0x30])); }
    });
  }

  function addWahoo() {
    const s = new Service(0x1818);
    const m = s.add(0x2a63, { notify: true });
    s.add(0x2a65, { read: true }, { read: [0x08, 0x00, 0x00, 0x00] });
    s.add(WAHOO, { write: true, indicate: true }, { onWrite(bytes, c) { c.notify([0x01, bytes[0], 0x01, 0x00]); } });
    services.push(s);
    let revs = 0; let t = 0; let last = 0;
    timers.push((now) => {
      // a 90 rpm un giro ogni 667 ms: una notifica per giro, tempo evento in 1/1024 s
      if (now - last < 667) return;
      last = now; revs = (revs + 1) & 0xffff; t = (t + 683) & 0xffff;
      const p = LIVE.wahoo.power;
      m.notify([0x20, 0x00, p & 0xff, p >> 8, revs & 0xff, revs >> 8, t & 0xff, t >> 8]);
    });
  }

  function addFtms() {
    const s = new Service(0x1826);
    // Feature: target settings con bit 2 (resistenza), 3 (potenza), 13 (simulazione)
    s.add(0x2acc, { read: true }, { read: [0x02, 0x40, 0x00, 0x00, 0x0c, 0x20, 0x00, 0x00] });
    s.add(0x2ad8, { read: true }, { read: [0x00, 0x00, 0xd0, 0x07, 0x01, 0x00] }); // 0–2000 W
    const ibd = s.add(0x2ad2, { notify: true });
    s.add(0x2ad9, { write: true, indicate: true }, { onWrite(bytes, c) { c.notify([0x80, bytes[0], 0x01]); } });
    services.push(s);
    timers.push(() => {
      const { power, cadence, speedKmh } = LIVE.ftms;
      const sp = Math.round(speedKmh * 100); const cad = cadence * 2;
      ibd.notify([0x44, 0x00, sp & 0xff, sp >> 8, cad & 0xff, cad >> 8, power & 0xff, power >> 8]);
    });
  }

  const NAMES = { fec: 'Tacx Flux 12345', 'tacx-both': 'Tacx Neo 2T 54321', wahoo: 'KICKR CORE 1A2B', ftms: 'Rullo FTMS' };
  if (profile === 'fec') addFec();
  if (profile === 'tacx-both') { addFtms(); addFec(); }
  if (profile === 'wahoo') addWahoo();
  if (profile === 'ftms') addFtms();

  // ---------- dispositivo ----------
  const device = new EventTarget();
  device.id = `mock-${profile}`; device.name = NAMES[profile];
  let allowed = new Set();
  let ticker = null;
  device.gatt = {
    device, connected: false,
    async connect() {
      this.connected = true;
      if (!ticker) ticker = setInterval(() => { const now = performance.now(); timers.forEach((f) => f(now)); }, 250);
      return this;
    },
    disconnect() {
      this.connected = false; clearInterval(ticker); ticker = null;
      device.dispatchEvent(new Event('gattserverdisconnected'));
    },
    async getPrimaryService(u) {
      const id = full(u);
      if (!allowed.has(id)) throw new DOMException(`Servizio ${id} non in optionalServices`, 'SecurityError');
      const s = services.find((x) => x.uuid === id);
      if (!s) throw new DOMException('Servizio non trovato', 'NotFoundError');
      return s;
    },
    async getPrimaryServices() { return services.filter((s) => allowed.has(s.uuid)); },
  };

  const bluetooth = {
    async getAvailability() { return true; },
    async requestDevice(opts = {}) {
      ble.requestOptions = JSON.parse(JSON.stringify(opts));
      const svc = (opts.filters || []).flatMap((f) => f.services || []);
      allowed = new Set([...svc, ...(opts.optionalServices || [])].map(full));
      // il dispositivo deve corrispondere ad almeno un filtro, come nel selettore di Chrome
      const match = (opts.filters || []).some((f) => (f.services && f.services.some((u) => services.some((s) => s.uuid === full(u))))
        || (f.namePrefix && device.name.startsWith(f.namePrefix)));
      if (!match) throw new DOMException('Nessun dispositivo trovato (filtri)', 'NotFoundError');
      return device;
    },
  };
  Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true });
  window.__setLive = (k, v) => Object.assign(LIVE[k], v);
})();
