// "Rullo finto": sostituisce navigator.bluetooth con un rullo FTMS e uno Zwift Click simulati.
// Si inietta con page.addInitScript({ path }) prima che l'app parta. Dal test si pilota con window.__fakeBle.
(() => {
  const BASE = '-0000-1000-8000-00805f9b34fb';
  const full = (n) => `0000${n.toString(16).padStart(4, '0')}${BASE}`;
  const norm = (u) => (typeof u === 'number' ? full(u) : String(u).toLowerCase());

  const FTMS = full(0x1826);
  const ZWIFT = '00000001-19ca-4651-86e5-fa29dcdd09d1';
  const Z_ASYNC = '00000002-19ca-4651-86e5-fa29dcdd09d1';
  const Z_RX = '00000003-19ca-4651-86e5-fa29dcdd09d1';
  const Z_TX = '00000004-19ca-4651-86e5-fa29dcdd09d1';

  const dv = (bytes) => new DataView(new Uint8Array(bytes).buffer);
  const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];
  const varint = (n) => { const o = []; while (n > 0x7f) { o.push((n & 0x7f) | 0x80); n = Math.floor(n / 128); } o.push(n); return o; };

  class Char extends EventTarget {
    constructor(uuid, props, onWrite, onRead) {
      super();
      this.uuid = norm(uuid);
      this.properties = { read: !!onRead, write: !!onWrite, writeWithoutResponse: false, notify: !!props.notify, indicate: false };
      this.value = null; this.onWrite = onWrite; this.onRead = onRead; this.notifying = false;
    }
    async startNotifications() { this.notifying = true; return this; }
    async stopNotifications() { this.notifying = false; return this; }
    async readValue() { if (!this.onRead) throw new DOMException('Lettura non permessa', 'NotSupportedError'); this.value = this.onRead(); return this.value; }
    async writeValueWithResponse(data) { this.onWrite?.(new Uint8Array(data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data)); }
    async writeValueWithoutResponse(data) { return this.writeValueWithResponse(data); }
    push(bytes) { // notifica al listener, se attivata
      if (!this.notifying) return;
      this.value = dv(bytes);
      this.dispatchEvent(new Event('characteristicvaluechanged'));
    }
  }
  class Service {
    constructor(uuid, chars) { this.uuid = norm(uuid); this.chars = chars; }
    async getCharacteristic(u) {
      const c = this.chars.find((x) => x.uuid === norm(u));
      if (!c) throw new DOMException('Caratteristica non trovata', 'NotFoundError');
      return c;
    }
    async getCharacteristics() { return this.chars; }
  }
  class Device extends EventTarget {
    constructor(id, name, services) {
      super();
      this.id = id; this.name = name; this.services = services;
      const dev = this;
      this.gatt = {
        connected: false, device: dev,
        async connect() { this.connected = true; return this; },
        disconnect() { if (!this.connected) return; this.connected = false; dev.dispatchEvent(new Event('gattserverdisconnected')); },
        async getPrimaryService(u) {
          const s = dev.services.find((x) => x.uuid === norm(u));
          if (!s) throw new DOMException('Servizio non trovato', 'NotFoundError');
          return s;
        },
        async getPrimaryServices() { return dev.services; },
      };
    }
  }

  const state = { power: 150, cadence: 80, speed: 28, controlLog: [], trainer: null, click: null, timer: null };

  // ---- Rullo FTMS ----
  const ibd = new Char(0x2ad2, { notify: true });
  const cp = new Char(0x2ad9, { notify: true }, (bytes) => {
    state.controlLog.push(Array.from(bytes));
    setTimeout(() => cp.push([0x80, bytes[0], 0x01]), 5); // risposta "OK"
  });
  const feature = new Char(0x2acc, {}, null, () => {
    // fitness machine features (u32) + target setting features (u32): resistenza (bit 2), potenza (bit 3), simulazione (bit 13)
    const t = (1 << 2) | (1 << 3) | (1 << 13);
    return dv([0, 0, 0, 0, t & 0xff, (t >> 8) & 0xff, (t >> 16) & 0xff, (t >>> 24) & 0xff]);
  });
  const powerRange = new Char(0x2ad8, {}, null, () => dv([...u16(0), ...u16(600), ...u16(1)]));
  const status = new Char(0x2ada, { notify: true });
  const ftms = new Service(FTMS, [feature, powerRange, ibd, cp, status]);

  function sendBikeData() {
    // flags 0x0044: velocità presente (bit 0 = 0), cadenza (bit 2), potenza (bit 6)
    ibd.push([...u16(0x0044), ...u16(Math.round(state.speed * 100)), ...u16(Math.round(state.cadence * 2)), ...u16(Math.round(state.power))]);
  }

  // ---- Zwift Click ----
  const zAsync = new Char(Z_ASYNC, { notify: true });
  const zTx = new Char(Z_TX, { notify: true });
  const zRx = new Char(Z_RX, {}, (bytes) => {
    if (String.fromCharCode(...bytes.slice(0, 6)) === 'RideOn') setTimeout(() => zTx.push(Array.from(bytes)), 5);
  });
  const zwift = new Service(ZWIFT, [zAsync, zTx, zRx]);

  const RELEASED = 0x3ffff; // tutti i pulsanti a riposo (bit a 1)
  const rideMsg = (mask) => [0x23, 0x08, ...varint(mask)];

  window.__fakeBle = {
    state,
    setPower(w) { state.power = w; sendBikeData(); },
    setCadence(c) { state.cadence = c; },
    /** Preme e rilascia il pulsante "+" (bit 12) o "−" (bit 8) del Click v2. */
    async press(dir) {
      const bit = dir > 0 ? 12 : 8;
      zAsync.push(rideMsg(RELEASED));
      zAsync.push(rideMsg(RELEASED & ~(1 << bit)));
      zAsync.push(rideMsg(RELEASED));
    },
    disconnectTrainer() { state.trainer?.gatt.disconnect(); },
  };

  navigator.bluetooth = {
    async getAvailability() { return true; },
    async requestDevice(opts = {}) {
      const wantsZwift = (opts.filters || []).some((f) => (f.namePrefix || '').startsWith('Zwift'));
      if (wantsZwift) { state.click = new Device('fake-click', 'Zwift Click', [zwift]); return state.click; }
      state.trainer = new Device('fake-trainer', 'Van Rysel D100 (finto)', [ftms]);
      if (!state.timer) state.timer = setInterval(() => { if (state.trainer?.gatt.connected) { state.power += 0; sendBikeData(); } }, 250);
      return state.trainer;
    },
  };
})();
