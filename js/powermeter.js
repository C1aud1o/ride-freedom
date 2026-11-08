// Misuratore di potenza esterno (Bluetooth Cycling Power): pedali Garmin Rally/Vector, Favero,
// guarniture, ecc. Se attivato, i suoi watt (e la cadenza, se la trasmette) sostituiscono quelli del rullo.
import { SensorDebug } from './debug.js';
import { t } from './i18n.js';

export class PowerMeter extends EventTarget {
  constructor() { super(); this.device = null; this.dbg = new SensorDebug('pm', 'Power meter'); this.prev = null; }
  get connected() { return !!this.device?.gatt?.connected; }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: [0x1818] }, { services: [0x1816] }], optionalServices: [0x1818, 0x1816, 0x180f] });
    this.device.addEventListener('gattserverdisconnected', () => { this.dbg.setStatus('Disconnected'); this.dispatchEvent(new Event('disconnected')); });
    this.dbg.setStatus('Connecting…');
    const server = await this.device.gatt.connect();
    await this.dbg.describe(this.device, server);
    let svc = null;
    try { svc = await server.getPrimaryService(0x1818); } catch { /* sensore di sola cadenza */ }
    if (svc) {
      const c = await svc.getCharacteristic(0x2a63);
      c.addEventListener('characteristicvaluechanged', (e) => this.onData(e.target.value));
      await c.startNotifications();
    } else {
      // Cycling Speed and Cadence (es. sensore di cadenza Garmin): solo la cadenza
      const csc = await server.getPrimaryService(0x1816);
      const c = await csc.getCharacteristic(0x2a5b);
      c.addEventListener('characteristicvaluechanged', (e) => this.onCsc(e.target.value));
      await c.startNotifications();
    }
    this.dbg.setStatus('Connected');
    return this.device.name || t('pm.title');
  }

  disconnect() { if (this.connected) this.device.gatt.disconnect(); }

  // CSC: flag bit0 = dati ruota (6 byte), bit1 = dati pedivella (giri uint16, tempo uint16 in 1/1024 s)
  onCsc(v) {
    this.dbg.raw('rx', 0x2a5b, v);
    const flags = v.getUint8(0);
    let o = 1;
    if (flags & 0x01) o += 6;
    if (!(flags & 0x02)) return;
    const revs = v.getUint16(o, true); const t = v.getUint16(o + 2, true);
    const d = {};
    if (this.prev) {
      const dr = (revs - this.prev.revs) & 0xffff; const dt = ((t - this.prev.t) & 0xffff) / 1024;
      if (dt > 0) d.cadence = (dr / dt) * 60;
      else if (performance.now() - this.prev.at > 2500) d.cadence = 0;
    }
    if (!this.prev || this.prev.revs !== revs) this.prev = { revs, t, at: performance.now() };
    if (d.cadence == null) return;
    this.dbg.setValues(d);
    this.dispatchEvent(new CustomEvent('data', { detail: d }));
  }

  onData(v) {
    this.dbg.raw('rx', 0x2a63, v);
    const flags = v.getUint16(0, true);
    const d = { power: v.getInt16(2, true) };
    let o = 4;
    if (flags & 0x01) o += 1;   // bilanciamento
    if (flags & 0x04) o += 2;   // coppia accumulata
    if (flags & 0x10) o += 6;   // giri ruota
    if (flags & 0x20) {         // giri pedivella -> cadenza
      const revs = v.getUint16(o, true); const t = v.getUint16(o + 2, true);
      if (this.prev) {
        const dr = (revs - this.prev.revs) & 0xffff; const dt = ((t - this.prev.t) & 0xffff) / 1024;
        if (dt > 0) d.cadence = (dr / dt) * 60;
        else if (performance.now() - this.prev.at > 2500) d.cadence = 0;
      }
      if (!this.prev || this.prev.revs !== revs) this.prev = { revs, t, at: performance.now() };
    }
    this.dbg.setValues(d);
    this.dispatchEvent(new CustomEvent('data', { detail: d }));
  }
}
