// Gestione Bluetooth del rullo: FTMS (Fitness Machine Service) con fallback
// su Cycling Power / Cycling Speed & Cadence. Il Van Rysel D100 espone FTMS.

const FTMS = 0x1826;
const CPS = 0x1818;
const CSC = 0x1816;
const HRS = 0x180d;

const CH = {
  feature: 0x2acc,
  indoorBikeData: 0x2ad2,
  resistanceRange: 0x2ad6,
  powerRange: 0x2ad8,
  controlPoint: 0x2ad9,
  status: 0x2ada,
  cpMeasurement: 0x2a63,
  cscMeasurement: 0x2a5b,
  hrMeasurement: 0x2a37,
};

const OP = {
  requestControl: 0x00,
  reset: 0x01,
  setTargetResistance: 0x04,
  setTargetPower: 0x05,
  startResume: 0x07,
  stopPause: 0x08,
  setSimulation: 0x11,
  response: 0x80,
};

const RESULT = { 1: 'ok', 2: 'non supportato', 3: 'parametro non valido', 4: 'fallito', 5: 'controllo non concesso' };

export class Trainer extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.cp = null; // control point characteristic
    this.queue = Promise.resolve();
    this.pending = null;
    this.features = { power: false, resistance: false, simulation: false };
    this.ranges = { power: [0, 600, 1], resistance: [0, 25.5, 0.1] };
    this.crank = null; // stato per calcolo cadenza da CPS/CSC
    this.wheel = null;
  }

  get connected() { return !!this.device?.gatt?.connected; }
  get controllable() { return !!this.cp; }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS] }, { services: [CPS] }, { namePrefix: 'D100' }, { namePrefix: 'VAN RYSEL' }, { namePrefix: 'Van Rysel' }],
      optionalServices: [FTMS, CPS, CSC, HRS],
    });
    this.device.addEventListener('gattserverdisconnected', () => this.emit('disconnected'));
    await this.setup();
    return this.device.name || 'Rullo';
  }

  async reconnect() {
    if (!this.device) throw new Error('Nessun dispositivo');
    await this.setup();
  }

  async setup() {
    const server = await this.device.gatt.connect();
    this.cp = null;
    let ftms = null;
    try { ftms = await server.getPrimaryService(FTMS); } catch { /* niente FTMS */ }

    if (ftms) {
      await this.readFeatures(ftms);
      const ibd = await ftms.getCharacteristic(CH.indoorBikeData);
      ibd.addEventListener('characteristicvaluechanged', (e) => this.onIndoorBikeData(e.target.value));
      await ibd.startNotifications();

      try {
        this.cp = await ftms.getCharacteristic(CH.controlPoint);
        this.cp.addEventListener('characteristicvaluechanged', (e) => this.onControlPointResponse(e.target.value));
        await this.cp.startNotifications();
        await this.command([OP.requestControl]);
        await this.command([OP.startResume]).catch(() => {});
      } catch (err) {
        this.cp = null;
        this.emit('log', `Controllo resistenza non disponibile: ${err.message}`);
      }
    } else {
      await this.setupFallback(server);
    }
    this.emit('connected', { name: this.device.name, ftms: !!ftms, features: this.features });
  }

  async readFeatures(ftms) {
    try {
      const v = await (await ftms.getCharacteristic(CH.feature)).readValue();
      const target = v.getUint32(4, true);
      this.features = {
        resistance: !!(target & (1 << 2)),
        power: !!(target & (1 << 3)),
        simulation: !!(target & (1 << 13)),
      };
    } catch {
      this.features = { power: true, resistance: true, simulation: true };
    }
    try {
      const v = await (await ftms.getCharacteristic(CH.powerRange)).readValue();
      this.ranges.power = [v.getInt16(0, true), v.getInt16(2, true), v.getUint16(4, true) || 1];
    } catch { /* opzionale */ }
    try {
      const v = await (await ftms.getCharacteristic(CH.resistanceRange)).readValue();
      this.ranges.resistance = [v.getInt16(0, true) / 10, v.getInt16(2, true) / 10, (v.getUint16(4, true) || 10) / 10];
    } catch { /* opzionale */ }
  }

  async setupFallback(server) {
    try {
      const cps = await server.getPrimaryService(CPS);
      const c = await cps.getCharacteristic(CH.cpMeasurement);
      c.addEventListener('characteristicvaluechanged', (e) => this.onCyclingPower(e.target.value));
      await c.startNotifications();
    } catch { /* assente */ }
    try {
      const csc = await server.getPrimaryService(CSC);
      const c = await csc.getCharacteristic(CH.cscMeasurement);
      c.addEventListener('characteristicvaluechanged', (e) => this.onCsc(e.target.value));
      await c.startNotifications();
    } catch { /* assente */ }
    try {
      const hrs = await server.getPrimaryService(HRS);
      const c = await hrs.getCharacteristic(CH.hrMeasurement);
      c.addEventListener('characteristicvaluechanged', (e) => {
        const v = e.target.value;
        const hr = v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1);
        this.emit('data', { hr });
      });
      await c.startNotifications();
    } catch { /* assente */ }
  }

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }

  // ---------- Parsing dati ----------

  onIndoorBikeData(v) {
    const flags = v.getUint16(0, true);
    let o = 2;
    const d = {};
    if (!(flags & 0x0001)) { d.speed = v.getUint16(o, true) / 100; o += 2; }
    if (flags & 0x0002) o += 2; // velocità media
    if (flags & 0x0004) { d.cadence = v.getUint16(o, true) / 2; o += 2; }
    if (flags & 0x0008) o += 2; // cadenza media
    if (flags & 0x0010) { d.distance = v.getUint16(o, true) | (v.getUint8(o + 2) << 16); o += 3; }
    if (flags & 0x0020) { d.resistance = v.getInt16(o, true); o += 2; }
    if (flags & 0x0040) { d.power = v.getInt16(o, true); o += 2; }
    if (flags & 0x0080) o += 2; // potenza media
    if (flags & 0x0100) o += 5; // energia
    if (flags & 0x0200) { d.hr = v.getUint8(o); o += 1; }
    this.emit('data', d);
  }

  onCyclingPower(v) {
    const flags = v.getUint16(0, true);
    const d = { power: v.getInt16(2, true) };
    let o = 4;
    if (flags & 0x01) o += 1;
    if (flags & 0x04) o += 2;
    if (flags & 0x10) {
      const revs = v.getUint32(o, true); const t = v.getUint16(o + 4, true); o += 6;
      const s = this.calcRate('wheel', revs, t, 2048);
      if (s != null) d.speed = s * 2.105 * 3.6;
    }
    if (flags & 0x20) {
      const revs = v.getUint16(o, true); const t = v.getUint16(o + 2, true); o += 4;
      const c = this.calcRate('crank', revs, t, 1024, 0xffff);
      if (c != null) d.cadence = c * 60;
    }
    this.emit('data', d);
  }

  onCsc(v) {
    const flags = v.getUint8(0);
    let o = 1;
    const d = {};
    if (flags & 1) {
      const revs = v.getUint32(o, true); const t = v.getUint16(o + 4, true); o += 6;
      const s = this.calcRate('wheel', revs, t, 1024);
      if (s != null) d.speed = s * 2.105 * 3.6;
    }
    if (flags & 2) {
      const revs = v.getUint16(o, true); const t = v.getUint16(o + 2, true);
      const c = this.calcRate('crank', revs, t, 1024, 0xffff);
      if (c != null) d.cadence = c * 60;
    }
    this.emit('data', d);
  }

  // giri al secondo partendo da contatori cumulativi
  calcRate(key, revs, time, res, revMask = 0xffffffff) {
    const prev = this[key];
    this[key] = { revs, time, at: performance.now() };
    if (!prev) return null;
    const dRevs = (revs - prev.revs) & revMask;
    const dt = ((time - prev.time) & 0xffff) / res;
    if (dt === 0) return performance.now() - prev.at > 2500 ? 0 : null;
    return dRevs / dt;
  }

  // ---------- Comandi (Control Point) ----------

  onControlPointResponse(v) {
    if (v.getUint8(0) !== OP.response || !this.pending) return;
    const op = v.getUint8(1);
    const result = v.getUint8(2);
    const p = this.pending;
    if (op !== p.op) return;
    this.pending = null;
    clearTimeout(p.timer);
    if (result === 1) p.resolve();
    else p.reject(new Error(`Comando 0x${op.toString(16)}: ${RESULT[result] || result}`));
  }

  // Le scritture GATT vanno serializzate: una alla volta, attendendo la risposta.
  command(bytes) {
    const run = () => new Promise((resolve, reject) => {
      if (!this.cp) return reject(new Error('Rullo non controllabile'));
      const op = bytes[0];
      const timer = setTimeout(() => { this.pending = null; resolve(); }, 1500); // alcuni rulli non rispondono sempre
      this.pending = { op, resolve, reject, timer };
      this.cp.writeValueWithResponse(new Uint8Array(bytes)).catch((err) => {
        clearTimeout(timer); this.pending = null; reject(err);
      });
    });
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  setTargetPower(watts) {
    const [min, max] = this.ranges.power;
    const w = Math.round(Math.min(Math.max(watts, Math.max(min, 0)), max || 600));
    return this.command([OP.setTargetPower, w & 0xff, (w >> 8) & 0xff]);
  }

  // percentuale 0-100 mappata sul range del rullo.
  // FTMS codifica il livello come uint8 con risoluzione 0.1 (quindi 0-25.5).
  setResistancePercent(pct) {
    const [min, max] = this.ranges.resistance;
    const lo = Math.max(0, Math.round(min * 10));
    const hi = Math.min(255, Math.round(max * 10));
    const raw = Math.round(lo + (Math.min(Math.max(pct, 0), 100) / 100) * (hi - lo));
    return this.command([OP.setTargetResistance, raw]);
  }

  setSimulation({ grade = 0, wind = 0, crr = 0.004, cw = 0.51 } = {}) {
    const g = Math.round(grade * 100);
    const w = Math.round(wind * 1000);
    return this.command([
      OP.setSimulation,
      w & 0xff, (w >> 8) & 0xff,
      g & 0xff, (g >> 8) & 0xff,
      Math.round(crr * 10000) & 0xff,
      Math.round(cw * 100) & 0xff,
    ]);
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}
