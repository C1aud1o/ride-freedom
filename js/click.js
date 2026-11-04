// Supporto SPERIMENTALE per il telecomando Zwift Click (cambiate +/-).
// Protocollo ricostruito da progetti open source: handshake "RideOn" e
// notifiche protobuf con lo stato dei pulsanti (0 = premuto).
// Se il firmware del Click richiede la cifratura, i tasti potrebbero non arrivare:
// in quel caso usa i pulsanti a schermo o la tastiera.

const SERVICES = ['00000001-19ca-4651-86e5-fa29dcdd09d1', 0xfc82];
const ASYNC = '00000002-19ca-4651-86e5-fa29dcdd09d1';
const SYNC_RX = '00000003-19ca-4651-86e5-fa29dcdd09d1';
const SYNC_TX = '00000004-19ca-4651-86e5-fa29dcdd09d1';
const RIDE_ON = [0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e];
const CLICK_MSG = 0x37;

export class ZwiftClick extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.state = { plus: false, minus: false };
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Zwift' }],
      optionalServices: SERVICES,
    });
    this.device.addEventListener('gattserverdisconnected', () => this.emit('disconnected'));
    const server = await this.device.gatt.connect();

    let service = null;
    for (const uuid of SERVICES) {
      try { service = await server.getPrimaryService(uuid); break; } catch { /* prova il prossimo */ }
    }
    if (!service) throw new Error('Servizio Zwift non trovato sul dispositivo');

    const onValue = (e) => this.onMessage(new Uint8Array(e.target.value.buffer));
    for (const uuid of [ASYNC, SYNC_TX]) {
      try {
        const c = await service.getCharacteristic(uuid);
        c.addEventListener('characteristicvaluechanged', onValue);
        await c.startNotifications();
      } catch { /* opzionale */ }
    }
    const rx = await service.getCharacteristic(SYNC_RX);
    await rx.writeValueWithResponse(new Uint8Array(RIDE_ON));
    return this.device.name || 'Zwift Click';
  }

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }

  onMessage(bytes) {
    if (bytes.length < 2 || bytes[0] !== CLICK_MSG) return;
    const fields = parseVarintFields(bytes.subarray(1));
    const plus = fields[1] === 0;
    const minus = fields[2] === 0;
    if (plus && !this.state.plus) this.emit('shift', +1);
    if (minus && !this.state.minus) this.emit('shift', -1);
    this.state = { plus, minus };
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

// Decodifica minimale protobuf: solo campi varint (wire type 0).
function parseVarintFields(buf) {
  const out = {};
  let i = 0;
  const readVarint = () => {
    let shift = 0; let val = 0;
    while (i < buf.length) {
      const b = buf[i++];
      val |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    return val;
  };
  while (i < buf.length) {
    const key = readVarint();
    const field = key >> 3; const wire = key & 7;
    if (wire === 0) out[field] = readVarint();
    else if (wire === 2) { const len = readVarint(); i += len; }
    else break;
  }
  return out;
}
