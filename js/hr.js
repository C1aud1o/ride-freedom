// Fascia cardio o orologio Garmin con "Trasmetti frequenza cardiaca" attivo (Bluetooth HRS).
export class HeartRate extends EventTarget {
  constructor() { super(); this.device = null; }
  get connected() { return !!this.device?.gatt?.connected; }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    this.device.addEventListener('gattserverdisconnected', () => this.dispatchEvent(new Event('disconnected')));
    const server = await this.device.gatt.connect();
    const c = await (await server.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    c.addEventListener('characteristicvaluechanged', (e) => {
      const v = e.target.value;
      const hr = v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1);
      this.dispatchEvent(new CustomEvent('hr', { detail: hr }));
    });
    await c.startNotifications();
    return this.device.name || 'Cardio';
  }

  disconnect() { if (this.connected) this.device.gatt.disconnect(); }
}
