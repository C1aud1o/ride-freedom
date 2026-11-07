// Supporto SPERIMENTALE per i telecomandi Zwift (Click v1, Click v2 / Ride, Play).
// Protocollo ricostruito da progetti open source: handshake "RideOn", poi messaggi
// [tipo][protobuf]. I pulsanti sono "attivi bassi": 0 = premuto.
//  0x37 Click v1     campo 1 = +, campo 2 = −
//  0x23 Ride/Click v2 campo 1 = maschera di bit (bit a 0 = premuto)
//  0x07 Play          campi 1..7 = singoli pulsanti
//  0x19 batteria, 0x15 keep-alive

import { SensorDebug, hex } from './debug.js';

const SERVICES = ['00000001-19ca-4651-86e5-fa29dcdd09d1', 0xfc82];
const ASYNC = '00000002-19ca-4651-86e5-fa29dcdd09d1';
const SYNC_RX = '00000003-19ca-4651-86e5-fa29dcdd09d1';
const SYNC_TX = '00000004-19ca-4651-86e5-fa29dcdd09d1';
export const RIDE_ON = [0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e];

const MSG = { CLICK: 0x37, RIDE: 0x23, PLAY: 0x07, BATTERY: 0x19, KEEPALIVE: 0x15, INFO: 0x2a, SYSTEM: 0xff };
// bit dei pulsanti noti: a riposo valgono 1, quindi un bit noto a 0 = premuto fin dal primo pacchetto
const KNOWN_RIDE_BITS = 0x37fff;

// Nomi noti dei bit del protocollo "Ride"
export const RIDE_BITS = {
  0: 'Sinistra', 1: 'Su', 2: 'Destra', 3: 'Giù', 4: 'A', 5: 'B', 6: 'Y', 7: 'X', 8: 'Click v2 − (Z)',
  9: 'Cambio su (sx)', 10: 'Cambio giù (sx)', 11: 'Power-up (sx)', 12: 'Click v2 + (On/Off sx)',
  13: 'Cambio su (dx)', 14: 'Cambio giù (dx)', 16: 'Power-up (dx)', 17: 'On/Off (dx)',
};
const PLAY_FIELDS = { 1: 'Pad destro', 2: 'Y/Su', 3: 'Z/Sinistra', 4: 'A/Destra', 5: 'B/Giù', 6: 'Leva cambio', 7: 'Power' };

// Assegnazione predefinita dei pulsanti alle cambiate (modificabile dalla pagina di debug)
// Click v2 (verificato su un Click del D100 Zwift Ready): + = bit 12, − = bit 8.
const DEFAULT_MAP = {
  'v1:1': +1, 'v1:2': -1,
  'ride:12': +1, 'ride:8': -1,
  'ride:1': +1, 'ride:3': -1, 'ride:9': +1, 'ride:10': -1, 'ride:13': +1, 'ride:14': -1,
  'play:2': +1, 'play:5': -1,
};

export function buttonLabel(id) {
  const [proto, n] = id.split(':');
  if (proto === 'v1') return n === '1' ? 'Click +' : n === '2' ? 'Click −' : `Click campo ${n}`;
  if (proto === 'ride') return `${RIDE_BITS[n] || 'Bit'} (bit ${n})`;
  if (proto === 'play') return `${PLAY_FIELDS[n] || 'Campo'} (campo ${n})`;
  return id;
}

export class ZwiftClick extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.rx = null;
    this.pressed = new Set();
    this.seenHigh = KNOWN_RIDE_BITS; // bit visti almeno una volta a 1 (rilasciati) nel protocollo Ride
    this.dbg = new SensorDebug('click', 'Zwift Click');
    this.dbg.extra = { pressed: [], lastPressed: null, battery: null, protocol: null };
    try { this.map = { ...DEFAULT_MAP, ...JSON.parse(localStorage.getItem('clickMap') || '{}') }; } catch { this.map = { ...DEFAULT_MAP }; }
  }

  get connected() { return !!this.device?.gatt?.connected; }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Zwift' }],
      optionalServices: [...SERVICES, 'battery_service', 'device_information'],
    });
    this.dbg.setStatus('Connessione…');
    this.device.addEventListener('gattserverdisconnected', () => {
      this.dbg.setStatus('Disconnesso');
      this.emit('disconnected');
    });
    const server = await this.device.gatt.connect();
    await this.dbg.describe(this.device, server);

    let service = null;
    for (const uuid of SERVICES) {
      try { service = await server.getPrimaryService(uuid); this.dbg.log(`Servizio Zwift trovato: ${service.uuid}`); break; } catch { /* prova il prossimo */ }
    }
    if (!service) throw new Error('Servizio Zwift non trovato sul dispositivo');

    for (const uuid of [ASYNC, SYNC_TX]) {
      try {
        const c = await service.getCharacteristic(uuid);
        c.addEventListener('characteristicvaluechanged', (e) => this.onMessage(uuid, e.target.value));
        await c.startNotifications();
        this.dbg.log(`Notifiche attive su ${uuid.slice(0, 8)}`);
      } catch (err) {
        this.dbg.log(`Notifiche NON attive su ${uuid.slice(0, 8)}: ${err.message}`);
      }
    }
    this.rx = await service.getCharacteristic(SYNC_RX);
    await this.write(RIDE_ON);
    this.dbg.setStatus('Connesso, handshake inviato');
    return this.device.name || 'Zwift Click';
  }

  async write(bytes) {
    if (!this.rx) throw new Error('Click non connesso');
    const data = new Uint8Array(bytes);
    this.dbg.raw('tx', SYNC_RX, data);
    await this.rx.writeValueWithResponse(data);
  }

  disconnect() { if (this.connected) this.device.gatt.disconnect(); }

  onMessage(uuid, value) {
    this.dbg.raw('rx', uuid, value);
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 6)) === 'RideOn') {
      this.dbg.log(`Risposta handshake "RideOn" (${bytes.length} byte${bytes.length > 6 ? ': richiede probabilmente cifratura → ' + hex(bytes.subarray(6)) : ''})`);
      this.dbg.extra.handshake = bytes.length > 6 ? 'RideOn + dati' : 'RideOn';
      return;
    }
    const type = bytes[0];
    const fields = parseFields(bytes.subarray(1));
    let pressed = null;

    if (type === MSG.CLICK) {
      this.dbg.extra.protocol = 'Click v1 (0x37)';
      pressed = new Set();
      for (const [f, v] of Object.entries(fields)) if (v === 0) pressed.add(`v1:${f}`);
    } else if (type === MSG.RIDE) {
      this.dbg.extra.protocol = 'Ride / Click v2 (0x23)';
      const mask = fields[1];
      if (typeof mask === 'number') {
        this.seenHigh |= mask;
        pressed = new Set();
        for (let bit = 0; bit < 32; bit++) {
          if ((this.seenHigh >>> bit) & 1 && !((mask >>> bit) & 1)) pressed.add(`ride:${bit}`);
        }
        this.dbg.extra.mask = `0x${(mask >>> 0).toString(16)} (${(mask >>> 0).toString(2).padStart(18, '0')})`;
      }
    } else if (type === MSG.PLAY) {
      this.dbg.extra.protocol = 'Play (0x07)';
      pressed = new Set();
      for (const [f, v] of Object.entries(fields)) if (Number(f) <= 7 && v === 0) pressed.add(`play:${f}`);
    } else if (type === MSG.BATTERY) {
      this.dbg.extra.battery = `${fields[2] ?? fields[1]} %`;
    } else if (type === MSG.KEEPALIVE) {
      // nulla da fare
    } else if (type === MSG.INFO || type === MSG.SYSTEM) {
      this.dbg.log(`Messaggio informativo 0x${type.toString(16)} (ignorato)`);
      this.dbg.changed();
      return;
    } else {
      this.dbg.log(`Tipo messaggio sconosciuto 0x${type.toString(16)} campi ${JSON.stringify(fields)}`);
    }
    if (Object.keys(fields).length) this.dbg.extra.fields = fields;

    if (pressed) {
      for (const id of pressed) {
        if (!this.pressed.has(id)) {
          this.dbg.extra.lastPressed = id;
          const dir = this.map[id];
          this.dbg.log(`Premuto ${buttonLabel(id)}${dir ? ` → cambiata ${dir > 0 ? '+' : '−'}` : ' (non assegnato)'}`);
          if (dir) this.emit('shift', dir);
        }
      }
      this.pressed = pressed;
      this.dbg.extra.pressed = [...pressed];
      // direzione tenuta premuta (per sterzare in continuo nei giochi)
      let held = 0; for (const id of pressed) held += this.map[id] || 0;
      held = Math.sign(held);
      if (held !== this.held) { this.held = held; this.emit('hold', held); }
    }
    this.dbg.changed();
  }

  assign(id, dir) {
    for (const k of Object.keys(this.map)) if (this.map[k] === dir && k.split(':')[0] === id.split(':')[0]) delete this.map[k];
    if (dir) this.map[id] = dir; else delete this.map[id];
    localStorage.setItem('clickMap', JSON.stringify(this.map));
    this.dbg.log(`${buttonLabel(id)} assegnato a ${dir > 0 ? '+' : dir < 0 ? '−' : 'nessuna azione'}`);
  }

  resetMap() {
    this.map = { ...DEFAULT_MAP };
    localStorage.removeItem('clickMap');
    this.dbg.log('Assegnazioni pulsanti ripristinate');
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

// Decodifica protobuf minimale: varint (wire 0) come numeri, length-delimited (wire 2) come hex.
export function parseFields(buf) {
  const out = {};
  let i = 0;
  const readVarint = () => {
    let val = 0; let mul = 1;
    while (i < buf.length) {
      const b = buf[i++];
      val += (b & 0x7f) * mul;
      if (!(b & 0x80)) break;
      mul *= 128;
    }
    return val;
  };
  while (i < buf.length) {
    const key = readVarint();
    const field = Math.floor(key / 8); const wire = key & 7;
    if (wire === 0) out[field] = readVarint();
    else if (wire === 2) { const len = readVarint(); out[field] = hex(buf.subarray(i, i + len)); i += len; }
    else if (wire === 5) { i += 4; } else if (wire === 1) { i += 8; } else break;
  }
  return out;
}
