// Supporto SPERIMENTALE per i telecomandi Zwift: Click (v1 e v2), Play (sinistro + destro) e Ride.
// Protocollo "Zwift Connect" ricostruito da progetti open source (da confrontare con i sorgenti):
//  - ajchellew/zwiftplay (https://github.com/ajchellew/zwiftplay): UUID, handshake, messaggi Play
//  - SwiftControl (https://github.com/jonasbark/swiftcontrol): Click v2 / Ride / Play, tabella dei tasti
//  - qdomyos-zwift (https://github.com/cagnulein/qdomyos-zwift): zwiftclickremote / zwiftplayremote
// Handshake "RideOn", poi messaggi [tipo][protobuf]. I pulsanti sono "attivi bassi": 0 = premuto.
//  0x37 Click v1      campo 1 = +, campo 2 = −
//  0x23 Click v2/Ride campo 1 = maschera di bit (bit a 0 = premuto)
//  0x07 Play          campo 1 = lato (non è un tasto), 2..5 = Y/Su, Z/Sinistra, A/Destra, B/Giù,
//                     6 = tasto Zwift (On), 7 = leva cambio (Shift)  [ordine come in ajchellew/zwiftplay]
//  0x19 batteria, 0x15 keep-alive
// NON implementato (serve un dispositivo vero per verificarlo): lo scambio di chiavi cifrato che alcuni
// firmware di Play/Ride richiedono. Vedi docs/zwift-controller.md.

import { SensorDebug, hex } from './debug.js';

const SERVICES = ['00000001-19ca-4651-86e5-fa29dcdd09d1', 0xfc82];
const ASYNC = '00000002-19ca-4651-86e5-fa29dcdd09d1';
const SYNC_RX = '00000003-19ca-4651-86e5-fa29dcdd09d1';
const SYNC_TX = '00000004-19ca-4651-86e5-fa29dcdd09d1';
export const RIDE_ON = [0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e];

// Modelli riconosciuti. Il nome BLE è "Zwift Click", "Zwift Play …", "Zwift Ride …".
export const MODELS = { click: 'Zwift Click', play: 'Zwift Play', ride: 'Zwift Ride' };
export function detectModel(name = '') {
  if (/ride/i.test(name)) return 'ride';
  if (/play/i.test(name)) return 'play';
  return 'click'; // anche nome mancante/sconosciuto: comportamento di sempre
}

const MSG = { CLICK: 0x37, RIDE: 0x23, PLAY: 0x07, BATTERY: 0x19, KEEPALIVE: 0x15, INFO: 0x2a, SYSTEM: 0xff };
// bit dei pulsanti noti: a riposo valgono 1, quindi un bit noto a 0 = premuto fin dal primo pacchetto
const KNOWN_RIDE_BITS = 0x37fff;

// Nomi noti dei bit del protocollo "Ride"
export const RIDE_BITS = {
  0: 'Sinistra', 1: 'Su', 2: 'Destra', 3: 'Giù', 4: 'A', 5: 'B', 6: 'Y', 7: 'X', 8: 'Click v2 − (Z)',
  9: 'Cambio su (sx)', 10: 'Cambio giù (sx)', 11: 'Power-up (sx)', 12: 'Click v2 + (On/Off sx)',
  13: 'Cambio su (dx)', 14: 'Cambio giù (dx)', 16: 'Power-up (dx)', 17: 'On/Off (dx)',
};
const PLAY_FIELDS = { 2: 'Y/Su', 3: 'Z/Sinistra', 4: 'A/Destra', 5: 'B/Giù', 6: 'Tasto Zwift', 7: 'Leva cambio' };

// Assegnazione predefinita dei pulsanti alle cambiate (modificabile dalla pagina di debug)
// Click v2 (verificato su un Click del D100 Zwift Ready): + = bit 12, − = bit 8.
const DEFAULT_MAP = {
  'v1:1': +1, 'v1:2': -1,
  'ride:12': +1, 'ride:8': -1,
  'ride:1': +1, 'ride:3': -1, 'ride:9': +1, 'ride:10': -1, 'ride:13': +1, 'ride:14': -1,
  // Play (sx e dx mandano gli stessi campi): Y/Su e A/Destra = +, Z/Sinistra e B/Giù = −
  'play:2': +1, 'play:5': -1, 'play:4': +1, 'play:3': -1,
  // Ride (id "zr", stessa maschera di bit del Click v2): cambio sui tasti shift, croce e A/B/Y/Z per navigare
  'zr:9': +1, 'zr:10': -1, 'zr:13': +1, 'zr:14': -1,
  'zr:1': +1, 'zr:3': -1, 'zr:2': +1, 'zr:0': -1, 'zr:4': +1, 'zr:5': -1, 'zr:6': +1, 'zr:7': -1,
};
// Tasti "Zwift"/menu: aprono il menu Click (evento 'combo'), come premere + e − insieme.
const DEFAULT_MENU = new Set(['play:6', 'zr:12', 'zr:17']);

export function buttonLabel(id) {
  const [proto, n] = id.split(':');
  if (proto === 'v1') return n === '1' ? 'Click +' : n === '2' ? 'Click −' : `Click campo ${n}`;
  if (proto === 'ride' || proto === 'zr') return `${RIDE_BITS[n] || 'Bit'} (bit ${n})`;
  if (proto === 'play') return `${PLAY_FIELDS[n] || 'Campo'} (campo ${n})`;
  return id;
}

export class ZwiftClick extends EventTarget {
  constructor() {
    super();
    this.links = []; // un elemento per dispositivo collegato (Click: 1, Play: fino a 2, Ride: 1)
    this.pressed = new Set(); // unione dei tasti premuti su tutti i dispositivi
    this.dbg = new SensorDebug('click', 'Zwift Click');
    this.dbg.extra = { pressed: [], lastPressed: null, battery: null, protocol: null };
    try { this.map = { ...DEFAULT_MAP, ...JSON.parse(localStorage.getItem('clickMap') || '{}') }; } catch { this.map = { ...DEFAULT_MAP }; }
  }

  get device() { return this.links[0]?.device || null; }
  get connected() { return this.links.some((l) => l.device?.gatt?.connected); }
  /** Modelli collegati, es. ['play', 'play'] */
  get models() { return this.links.filter((l) => l.device?.gatt?.connected).map((l) => l.model); }
  /** Testo per la UI: "Zwift Click", "Zwift Play", "Zwift Play ×2", "Zwift Ride" */
  get label() {
    const m = this.models; if (!m.length) return '';
    const counts = {}; for (const k of m) counts[k] = (counts[k] || 0) + 1;
    return Object.entries(counts).map(([k, n]) => MODELS[k] + (n > 1 ? ` ×${n}` : '')).join(' + ');
  }
  /** I Play sono due controller (sinistro e destro): dopo il primo se ne può aggiungere un secondo. */
  get canAddSecond() { return this.models.length === 1 && this.models[0] === 'play'; }

  async connect() {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Zwift' }, { services: [0xfc82] }],
      optionalServices: [...SERVICES, 'battery_service', 'device_information'],
    });
    if (this.links.some((l) => l.device.id === device.id && l.device.gatt?.connected)) throw new Error('Dispositivo già collegato');
    const link = { device, rx: null, model: detectModel(device.name), pressed: new Set(), seenHigh: KNOWN_RIDE_BITS, unknown: 0 };
    this.dbg.setStatus(`Connessione ${device.name || ''}…`);
    this.dbg.log(`Modello riconosciuto dal nome "${device.name || ''}": ${MODELS[link.model]}`);
    device.addEventListener('gattserverdisconnected', () => {
      this.dbg.setStatus(`Disconnesso ${MODELS[link.model]}`);
      this.links = this.links.filter((l) => l !== link);
      this.recompute(); // rilascia i tasti di questo dispositivo
      this.emit('disconnected');
    });
    this.links.push(link);
    try {
      const server = await device.gatt.connect();
      await this.dbg.describe(device, server);

      let service = null;
      for (const uuid of SERVICES) {
        try { service = await server.getPrimaryService(uuid); this.dbg.log(`Servizio Zwift trovato: ${service.uuid}`); break; } catch { /* prova il prossimo */ }
      }
      if (!service) throw new Error('Servizio Zwift non trovato sul dispositivo');

      for (const uuid of [ASYNC, SYNC_TX]) {
        try {
          const c = await service.getCharacteristic(uuid);
          c.addEventListener('characteristicvaluechanged', (e) => this.onMessage(uuid, e.target.value, link));
          await c.startNotifications();
          this.dbg.log(`Notifiche attive su ${uuid.slice(0, 8)}`);
        } catch (err) {
          this.dbg.log(`Notifiche NON attive su ${uuid.slice(0, 8)}: ${err.message}`);
        }
      }
      link.rx = await service.getCharacteristic(SYNC_RX);
      await this.writeLink(link, RIDE_ON);
    } catch (err) {
      this.links = this.links.filter((l) => l !== link);
      try { device.gatt.disconnect(); } catch { /* già scollegato */ }
      throw err;
    }
    this.dbg.setStatus(`Connesso ${MODELS[link.model]}, handshake inviato`);
    this.dbg.extra.devices = this.links.map((l) => `${MODELS[l.model]} (${l.device.name || '?'})`);
    return this.label || device.name || 'Zwift Click';
  }

  async writeLink(link, bytes) {
    if (!link.rx) throw new Error('Click non connesso');
    const data = new Uint8Array(bytes);
    this.dbg.raw('tx', SYNC_RX, data);
    await link.rx.writeValueWithResponse(data);
  }

  /** Scrive su tutti i dispositivi collegati (usato dalla pagina di debug). */
  async write(bytes) {
    const ls = this.links.filter((l) => l.rx);
    if (!ls.length) throw new Error('Click non connesso');
    for (const l of ls) await this.writeLink(l, bytes);
  }

  disconnect() { for (const l of [...this.links]) if (l.device?.gatt?.connected) l.device.gatt.disconnect(); }

  onMessage(uuid, value, link = this.links[0]) {
    this.dbg.raw('rx', uuid, value);
    if (!link) return;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 6)) === 'RideOn') {
      this.dbg.log(`Risposta handshake "RideOn" (${bytes.length} byte${bytes.length > 6 ? ': richiede probabilmente cifratura → ' + hex(bytes.subarray(6)) : ''})`);
      this.dbg.extra.handshake = bytes.length > 6 ? 'RideOn + dati' : 'RideOn';
      return;
    }
    const type = bytes[0];
    const fields = parseFields(bytes.subarray(1));
    let pressed = null;
    const label = MODELS[link.model];

    if (type === MSG.CLICK) {
      this.dbg.extra.protocol = 'Click v1 (0x37)';
      pressed = new Set();
      for (const [f, v] of Object.entries(fields)) if (v === 0) pressed.add(`v1:${f}`);
    } else if (type === MSG.RIDE) {
      this.dbg.extra.protocol = `${label} (0x23)`;
      const proto = link.model === 'ride' ? 'zr' : 'ride'; // Click v2 mantiene gli id di sempre
      const mask = fields[1];
      if (typeof mask === 'number') {
        link.seenHigh |= mask;
        pressed = new Set();
        for (let bit = 0; bit < 32; bit++) {
          if ((link.seenHigh >>> bit) & 1 && !((mask >>> bit) & 1)) pressed.add(`${proto}:${bit}`);
        }
        this.dbg.extra.mask = `0x${(mask >>> 0).toString(16)} (${(mask >>> 0).toString(2).padStart(18, '0')})`;
      }
    } else if (type === MSG.PLAY) {
      if (link.model !== 'play') { this.dbg.log(`Messaggio Play (0x07) da "${link.device.name}": modello corretto in Zwift Play`); link.model = 'play'; }
      this.dbg.extra.protocol = 'Play (0x07)';
      pressed = new Set();
      // campo 1 = lato del controller (non è un tasto); 8-9 = leve analogiche, ignorate
      for (const [f, v] of Object.entries(fields)) if (Number(f) >= 2 && Number(f) <= 7 && v === 0) pressed.add(`play:${f}`);
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
      if (link.model !== 'click' && ++link.unknown === 3) this.dbg.log(`${label}: molti messaggi non riconosciuti, forse il firmware richiede lo scambio di chiavi cifrato (non ancora supportato, vedi docs/zwift-controller.md)`);
    }
    if (Object.keys(fields).length) this.dbg.extra.fields = fields;

    if (pressed) {
      for (const id of pressed) {
        if (!link.pressed.has(id)) {
          this.dbg.extra.lastPressed = id;
          const dir = this.map[id];
          if (DEFAULT_MENU.has(id) && !dir) {
            this.dbg.log(`Premuto ${buttonLabel(id)} → menu Click`);
            this.emit('combo');
          } else {
            this.dbg.log(`Premuto ${buttonLabel(id)}${dir ? ` → cambiata ${dir > 0 ? '+' : '−'}` : ' (non assegnato)'}`);
            if (dir) this.emit('shift', dir);
          }
        }
      }
      link.pressed = pressed;
      this.recompute();
    }
    this.dbg.changed();
  }

  // Unisce i tasti di tutti i dispositivi e aggiorna 'hold' (direzione tenuta) e 'combo' (+ e − insieme)
  recompute() {
    const all = new Set();
    for (const l of this.links) for (const id of l.pressed) all.add(id);
    this.pressed = all;
    this.dbg.extra.pressed = [...all];
    // direzione tenuta premuta (per sterzare in continuo nei giochi)
    let held = 0; for (const id of all) held += this.map[id] || 0;
    held = Math.sign(held);
    if (held !== this.held) { this.held = held; this.emit('hold', held); }
    // + e − insieme: apre il menu di navigazione
    const dirs = new Set([...all].map((id) => this.map[id]).filter(Boolean));
    const both = dirs.has(1) && dirs.has(-1);
    if (both && !this.comboOn) this.emit('combo');
    this.comboOn = both;
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
