// Wahoo "legacy": Kickr / Kickr Snap / Kickr Core con firmware precedenti all'FTMS (circa prima del 2020).
// Si controllano con una caratteristica proprietaria dentro il servizio Cycling Power (0x1818); la potenza
// e la cadenza arrivano dalla normale Cycling Power Measurement 0x2a63.
//
// Non c'è documentazione ufficiale pubblica: i formati sono presi (e confrontati) da codice open source:
// - GoldenCheetah src/Train/BT40Device.cpp (WAHOO_BRAKE_CONTROL_UUID, setLoadErg 0x42, setRiderCharacteristics
//   0x43, setGradient 0x46, setWindSpeed 0x47, setWheelCircumference 0x48, setLoadIntensity 0x40);
// - Kinetic SwiftySensorsTrainers WahooTrainerSerializer.swift (opcode, unlock 0x20 0xEE 0xFC, risposta
//   "0x01 0x42 0x01 0x00 watt" all'ERG);
// - qdomyos-zwift src/devices/wahookickrsnapbike (stessi opcode, sblocco all'avvio e poi setSimMode);
// - incyclist/devices src/ble/wahoo/sensor.ts (byte 0 della risposta = 1 → ok; alcuni firmware, es. Kickr Snap,
//   non rispondono a 0x43: timeout breve e si va avanti).
// Unico punto in cui le fonti non coincidono: il Crr in 0x43. GoldenCheetah e incyclist lo scrivono ×10000,
// SwiftySensors e qdomyos ×1000. Usiamo ×10000 (GoldenCheetah + incyclist, quest'ultimo con test su rulli veri):
// da verificare con un rullo vero (vedi tests/trainers/README.md).
// La pendenza 0x46 è (1 + pendenza/100) × 65535/2 (SwiftySensors, qdomyos, incyclist; GoldenCheetah usa ×32768).

import { SensorDebug } from '../debug.js';
import { t } from '../i18n.js';

export const CPS = 0x1818;
export const CP_MEASUREMENT = 0x2a63;
export const WAHOO_CONTROL = 'a026e005-0a7d-4ab3-97fa-f1500f9feb8b';

export const OP = {
  unlock: 0x20, resistance: 0x40, standard: 0x41, erg: 0x42, sim: 0x43, crr: 0x44, windResistance: 0x45,
  grade: 0x46, windSpeed: 0x47, wheel: 0x48,
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const u16 = (v) => { const n = Math.round(clamp(v, 0, 0xffff)); return [n & 0xff, (n >> 8) & 0xff]; };

// ---------- Codifica (funzioni pure, usate anche dai test) ----------
export const unlockCmd = () => [OP.unlock, 0xee, 0xfc];
export const ergCmd = (watts) => [OP.erg, ...u16(watts)];
// peso kg ×100, Crr ×10000, coeff. vento (kg/m) ×1000
export const simModeCmd = (massKg, crr = 0.004, cw = 0.51) => [OP.sim, ...u16(massKg * 100), ...u16(crr * 10000), ...u16(cw * 1000)];
export const gradeCmd = (gradePct) => [OP.grade, ...u16((clamp(gradePct / 100, -1, 1) + 1) * 65535 / 2)];
export const windSpeedCmd = (ms) => [OP.windSpeed, ...u16((clamp(ms, -32.767, 32.767) + 32.767) * 1000)];
// modalità "resistenza": 0 = massima, 16383 = minima (GoldenCheetah: (1 - intensità) × 16383)
export const resistanceCmd = (pct) => [OP.resistance, ...u16((1 - clamp(pct, 0, 100) / 100) * 16383)];

// ---------- Driver ----------
// Stessa interfaccia pubblica di Trainer in js/ftms.js.
export class WahooLegacyTrainer extends EventTarget {
  constructor({ dbg } = {}) {
    super();
    this.device = null;
    this.ctrl = null;
    this.queue = Promise.resolve();
    this.pending = null;
    this.features = { power: true, resistance: true, simulation: true };
    this.ranges = { power: [0, 2000, 1], resistance: [0, 100, 1] };
    this.hasCadence = false;
    this.crank = null;
    this.sim = null;
    this.dbg = dbg || new SensorDebug('trainer', 'Trainer');
  }

  get connected() { return !!this.device?.gatt?.connected; }
  get controllable() { return !!this.ctrl; }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: [CPS] }], optionalServices: [CPS] });
    this.device.addEventListener('gattserverdisconnected', () => { this.dbg.setStatus('Disconnected'); this.emit('disconnected'); });
    await this.setup();
    return this.device.name || t('home.trainer');
  }

  async reconnect() {
    if (!this.device) throw new Error('No device');
    await this.setup();
  }

  async setup(server) {
    this.dbg.setStatus('Connecting…');
    server ||= await this.device.gatt.connect();
    await this.dbg.describe(this.device, server);
    this.ctrl = null; this.sim = null; this.crank = null;
    const cps = await server.getPrimaryService(CPS);
    const m = await cps.getCharacteristic(CP_MEASUREMENT);
    m.addEventListener('characteristicvaluechanged', (e) => { this.dbg.raw('rx', CP_MEASUREMENT, e.target.value); this.onCyclingPower(e.target.value); });
    await m.startNotifications();
    try {
      const c = await cps.getCharacteristic(WAHOO_CONTROL);
      c.addEventListener('characteristicvaluechanged', (e) => { this.dbg.raw('rx', WAHOO_CONTROL, e.target.value); this.onResponse(e.target.value); });
      await c.startNotifications(); // il Kickr usa le "indication": Web Bluetooth le attiva con la stessa chiamata
      this.ctrl = c;
      await this.command(unlockCmd(), 3000);
    } catch (err) {
      this.ctrl = null;
      this.emit('log', `Wahoo control not available: ${err.message}`);
      this.dbg.log(`Wahoo control not available: ${err.message}`);
    }
    this.dbg.setStatus(`Connected (Wahoo legacy${this.ctrl ? ', controllable' : ', read-only'})`);
    this.dbg.extra = { protocollo: 'Wahoo legacy', features: this.features, ranges: this.ranges };
    this.emit('connected', { name: this.device.name, ftms: false, protocol: 'Wahoo', features: this.features });
  }

  disconnect() { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); }

  onCyclingPower(v) {
    const flags = v.getUint16(0, true);
    const d = { power: v.getInt16(2, true) };
    let o = 4;
    if (flags & 0x01) o += 1; // bilanciamento
    if (flags & 0x04) o += 2; // coppia accumulata
    if (flags & 0x10) {
      const revs = v.getUint32(o, true); const t = v.getUint16(o + 4, true); o += 6;
      const s = this.rate('wheel', revs, t, 2048, 0xffffffff);
      if (s != null) d.speed = s * 2.105 * 3.6;
    }
    if (flags & 0x20) {
      const revs = v.getUint16(o, true); const t = v.getUint16(o + 2, true); o += 4;
      const c = this.rate('crank', revs, t, 1024, 0xffff);
      if (c != null) { d.cadence = c * 60; this.hasCadence = true; }
    }
    this.dbg.setValues(d);
    this.emit('data', d);
  }

  rate(key, revs, time, res, mask) {
    const prev = this[key];
    if (prev && prev.revs === revs && prev.time === time) {
      return performance.now() - prev.at > 2500 ? 0 : null; // stesso evento ripetuto: fermo se dura troppo
    }
    this[key] = { revs, time, at: performance.now() };
    if (!prev) return null;
    const dt = ((time - prev.time) & 0xffff) / res;
    if (dt === 0) return null;
    return ((revs - prev.revs) & mask) / dt;
  }

  // risposta: [0x01, opcode, …] = ok; altri valori nel byte 0 = errore
  onResponse(v) {
    if (!this.pending || v.byteLength < 2) return;
    const p = this.pending;
    if (v.getUint8(1) !== p.op) return;
    this.pending = null;
    clearTimeout(p.timer);
    const ok = v.getUint8(0) === 0x01;
    this.dbg.log(`Wahoo response 0x${p.op.toString(16)}: ${ok ? 'ok' : `error ${v.getUint8(0)}`}`);
    if (ok) p.resolve(); else p.reject(new Error(`Wahoo command 0x${p.op.toString(16)} rejected`));
  }

  command(bytes, timeout = 800) {
    const run = () => new Promise((resolve, reject) => {
      if (!this.ctrl) return reject(new Error('Trainer is not controllable'));
      const op = bytes[0];
      const timer = setTimeout(() => { this.pending = null; resolve(); }, timeout); // alcuni firmware non rispondono
      this.pending = { op, resolve, reject, timer };
      const data = Uint8Array.from(bytes);
      this.dbg.raw('tx', WAHOO_CONTROL, data);
      const w = this.ctrl.writeValueWithResponse ? this.ctrl.writeValueWithResponse(data) : this.ctrl.writeValue(data);
      w.catch((err) => { clearTimeout(timer); this.pending = null; reject(err); });
    });
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  setTargetPower(watts) {
    const [min, max] = this.ranges.power;
    this.sim = null;
    return this.command(ergCmd(Math.min(Math.max(watts, Math.max(min, 0)), max || 2000)));
  }

  setResistancePercent(pct) {
    this.sim = null;
    return this.command(resistanceCmd(pct));
  }

  // 0x43 porta il rullo in simulazione (da ERG) e imposta peso/Crr/vento: lo mandiamo solo se cambia qualcosa
  async setSimulation({ grade = 0, wind = 0, crr = 0.004, cw = 0.51, mass = 80 } = {}) {
    const prev = this.sim;
    if (!prev || prev.mass !== mass || prev.crr !== crr || prev.cw !== cw) await this.command(simModeCmd(mass, crr, cw));
    if (prev ? prev.wind !== wind : wind !== 0) await this.command(windSpeedCmd(wind));
    this.sim = { mass, crr, cw, wind };
    return this.command(gradeCmd(grade));
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}
