import { SensorDebug } from './debug.js';
import { t } from './i18n.js';

// Fascia cardio o orologio Garmin con "Trasmetti frequenza cardiaca" attivo (Bluetooth HRS).
export class HeartRate extends EventTarget {
  constructor() { super(); this.device = null; this.dbg = new SensorDebug('hr', 'Heart rate'); }
  get connected() { return !!this.device?.gatt?.connected; }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    this.device.addEventListener('gattserverdisconnected', () => { this.dbg.setStatus('Disconnected'); this.dispatchEvent(new Event('disconnected')); });
    this.dbg.setStatus('Connecting…');
    const server = await this.device.gatt.connect();
    await this.dbg.describe(this.device, server);
    const c = await (await server.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    c.addEventListener('characteristicvaluechanged', (e) => {
      const v = e.target.value;
      this.dbg.raw('rx', 0x2a37, v);
      const hr = v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1);
      this.dbg.setValues({ hr });
      this.dispatchEvent(new CustomEvent('hr', { detail: hr }));
    });
    await c.startNotifications();
    this.dbg.setStatus('Connected');
    return this.device.name || t('home.hr');
  }

  disconnect() { if (this.connected) this.device.gatt.disconnect(); }
}
