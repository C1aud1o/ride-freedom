// Tacx FE-C over BLE: i rulli Tacx (Flux, Flux S/2, Vortex Smart, Bushido Smart, Genius Smart, Neo, Neo 2/2T,
// Flow Smart…) trasportano i messaggi ANT+ FE-C dentro un servizio BLE "seriale" (derivato dal Nordic UART).
//
// Fonti pubbliche usate (verificate):
// - Tacx, "FE-C over BLE – Simple how-to for engineers" v1.0.0 (2015), copia pubblica in
//   https://github.com/abellono/tacx-ios-bluetooth-example ("How-to FE-C over BLE v1_0_0.pdf"):
//   servizio 6E40FEC1-…, notifiche dal rullo su 6E40FEC2-…, scrittura verso il rullo su 6E40FEC3-…;
//   ogni pacchetto BLE è un messaggio ANT completo: A4 | length | type | channel(5) | 8 byte di pagina | checksum.
//   Esempio del documento: A4 09 4E 05 10 19 04 00 00 00 FF 24 30 (pagina 0x10, checksum 0x30).
//   Nota: il testo del PDF dice "somma dei byte", ma il suo stesso esempio torna solo con lo XOR di tutti i
//   byte compreso 0xA4 (come nel protocollo ANT standard): usiamo lo XOR (come GoldenCheetah, ANTMessage.cpp).
// - Specifica ANT+ "Fitness Equipment Device Profile" (FE-C), pagine 0x10, 0x19, 0x30, 0x31, 0x32, 0x33, 0x37, 0x47.
// - GoldenCheetah src/ANT/ANTMessage.cpp (fecSetTargetPower / fecSetTrackResistance / fecSetWindResistance)
//   e src/Train/BT40Device.cpp (canale 5, scrittura senza risposta su 6E40FEC3).
// - pycycling tacx_trainer_control.py e incyclist/devices src/ble/tacx + fe-c-pages.ts (formati delle pagine).
//
// Tipo di messaggio: i comandi (pagine 0x30–0x37) li mandiamo come "Acknowledged data" 0x4F, come fanno
// GoldenCheetah, pycycling e incyclist e come chiede il profilo FE-C per le pagine di controllo; il documento
// Tacx dice che il tipo "può variare" e che il canale è ignorato in scrittura. I dati dal rullo arrivano come
// broadcast 0x4E (accettiamo anche 0x4F/0x4D).

import { SensorDebug } from '../debug.js';

export const FEC_SERVICE = '6e40fec1-b5a3-f393-e0a9-e50e24dcca9e';
export const FEC_RX = '6e40fec2-b5a3-f393-e0a9-e50e24dcca9e'; // notifiche: rullo → app
export const FEC_TX = '6e40fec3-b5a3-f393-e0a9-e50e24dcca9e'; // scrittura: app → rullo

const SYNC = 0xa4;
const MSG_BROADCAST = 0x4e;
const MSG_ACK = 0x4f;
const CHANNEL = 5;
const BIKE_KG = 10; // la massa nell'app è "peso con la bici": la dividiamo in ciclista + bici

export const PAGE = {
  general: 0x10, trainer: 0x19, basicResistance: 0x30, targetPower: 0x31, wind: 0x32, track: 0x33,
  capabilities: 0x36, userConfig: 0x37, requestPage: 0x46, commandStatus: 0x47,
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- Codifica (funzioni pure, usate anche dai test) ----------

export function checksum(bytes) { return bytes.reduce((x, b) => x ^ b, 0); }

// messaggio ANT completo da una pagina FE-C di 8 byte
export function antMessage(page, type = MSG_ACK, channel = CHANNEL) {
  if (page.length !== 8) throw new Error('Una pagina FE-C è di 8 byte');
  const m = [SYNC, 0x09, type, channel, ...page];
  return Uint8Array.from([...m, checksum(m)]);
}

// 0x31 Target Power: unità 0.25 W
export function targetPowerPage(watts) {
  const raw = Math.round(clamp(watts, 0, 4000) * 4);
  return [PAGE.targetPower, 0xff, 0xff, 0xff, 0xff, 0xff, raw & 0xff, (raw >> 8) & 0xff];
}

// 0x33 Track Resistance: pendenza in 0.01 % con offset -200 %, Crr in unità 5e-5
export function trackResistancePage(gradePct, crr = 0.004) {
  const g = Math.round((clamp(gradePct, -200, 200) + 200) * 100);
  const c = Math.round(clamp(crr, 0, 0.0127) / 0.00005);
  return [PAGE.track, 0xff, 0xff, 0xff, 0xff, g & 0xff, (g >> 8) & 0xff, c];
}

// 0x32 Wind Resistance: coeff. in 0.01 kg/m, vento in km/h con offset +127, drafting in 0.01
export function windResistancePage(cw = 0.51, windKmh = 0, drafting = 1) {
  return [PAGE.wind, 0xff, 0xff, 0xff, 0xff,
    Math.round(clamp(cw, 0, 1.86) * 100), Math.round(clamp(windKmh, -127, 127) + 127), Math.round(clamp(drafting, 0, 1) * 100)];
}

// 0x30 Basic Resistance: percentuale della resistenza massima in unità 0.5 %
export function basicResistancePage(pct) {
  return [PAGE.basicResistance, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, Math.round(clamp(pct, 0, 100) * 2)];
}

// 0x37 User Configuration: peso ciclista 0.01 kg; peso bici 12 bit in 0.05 kg (nibble alto del byte 4 + byte 5);
// diametro ruota in 0.01 m (+ offset in mm nel nibble basso del byte 4); rapporto 0 = non valido.
export function userConfigPage(userKg, bikeKg = BIKE_KG, wheelM = 0.7) {
  const u = Math.round(clamp(userKg, 0, 655.34) * 100);
  const b = Math.round(clamp(bikeKg, 0, 50) * 20);
  const wheelMm = Math.round(wheelM * 1000);
  const d = Math.floor(wheelMm / 10); const off = wheelMm % 10;
  return [PAGE.userConfig, u & 0xff, (u >> 8) & 0xff, 0xff, (off & 0x0f) | ((b & 0x0f) << 4), (b >> 4) & 0xff, d & 0xff, 0x00];
}

// 0x46 Request Data Page (pagina comune ANT+ 70): chiede al rullo di mandare una pagina (es. 0x47 o 0x36)
export function requestPage(page) {
  return [PAGE.requestPage, 0xff, 0xff, 0xff, 0xff, 0x01, page, 0x01];
}

// ---------- Decodifica ----------

// separa uno o più messaggi ANT da un pacchetto BLE (di solito ce n'è uno solo)
export function splitMessages(bytes) {
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] !== SYNC) { i++; continue; }
    const len = bytes[i + 1];
    const end = i + 4 + len; // sync, len, type, [len byte: canale + dati], checksum
    if (len == null || end > bytes.length) break;
    const msg = bytes.slice(i, end);
    if (checksum(Array.from(msg.slice(0, -1))) === msg[msg.length - 1]) out.push(msg);
    i = end;
  }
  return out;
}

// pagina FE-C → valori nello stesso formato dell'evento 'data' di FTMS (velocità in km/h, potenza in W, cadenza in rpm)
export function parsePage(p) {
  switch (p[0]) {
    case PAGE.general: {
      const d = {};
      const speed = p[4] | (p[5] << 8);
      if (speed !== 0xffff) d.speed = (speed / 1000) * 3.6;
      if (p[6] !== 0xff && p[6] > 0) d.hr = p[6];
      return d;
    }
    case PAGE.trainer: {
      const d = {};
      if (p[2] !== 0xff) d.cadence = p[2];
      const power = p[5] | ((p[6] & 0x0f) << 8);
      if (power !== 0xfff) d.power = power;
      d.trainerStatus = p[6] >> 4; // bit0 calibrazione potenza, bit1 resistenza, bit2 configurazione utente richiesta
      d.targetLimit = p[7] & 0x03; // 0 ok, 1 velocità troppo bassa, 2 troppo alta, 3 limite raggiunto
      return d;
    }
    case PAGE.commandStatus:
      return { lastCommand: p[1], sequence: p[2], status: p[3] }; // status: 0 ok, 1 fallito, 2 non supportato, 3 rifiutato, 255 non inizializzato
    case PAGE.capabilities: {
      const maxN = p[5] | (p[6] << 8);
      return { maxResistanceN: maxN === 0xffff ? null : maxN, caps: p[7] }; // bit0 basic, bit1 power, bit2 simulation
    }
    default: return null;
  }
}

const STATUS = { 0: 'ok', 1: 'fallito', 2: 'non supportato', 3: 'rifiutato', 255: 'non inizializzato' };

// ---------- Driver ----------
// Stessa interfaccia pubblica di Trainer in js/ftms.js: eventi connected / disconnected / data / log,
// proprietà connected / controllable / features / ranges / hasCadence / dbg,
// metodi connect / reconnect / disconnect / setTargetPower / setResistancePercent / setSimulation.
export class FecTrainer extends EventTarget {
  constructor({ dbg } = {}) {
    super();
    this.device = null;
    this.tx = null;
    this.queue = Promise.resolve();
    this.features = { power: true, resistance: true, simulation: true };
    this.ranges = { power: [0, 2000, 1], resistance: [0, 100, 0.5] };
    this.hasCadence = false;
    this.sim = null; // ultimi parametri di simulazione inviati (per non ripetere 0x37/0x32)
    this.dbg = dbg || new SensorDebug('trainer', 'Rullo');
  }

  get connected() { return !!this.device?.gatt?.connected; }
  get controllable() { return !!this.tx; }

  // uso diretto (senza scelta automatica del protocollo)
  async connect() {
    this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: [FEC_SERVICE] }, { namePrefix: 'Tacx' }], optionalServices: [FEC_SERVICE] });
    this.device.addEventListener('gattserverdisconnected', () => { this.dbg.setStatus('Disconnesso'); this.emit('disconnected'); });
    await this.setup();
    return this.device.name || 'Rullo';
  }

  async reconnect() {
    if (!this.device) throw new Error('Nessun dispositivo');
    await this.setup();
  }

  // server: già connesso dalla scelta automatica del protocollo (evita una seconda gatt.connect)
  async setup(server) {
    this.dbg.setStatus('Connessione…');
    server ||= await this.device.gatt.connect();
    await this.dbg.describe(this.device, server);
    this.tx = null; this.sim = null;
    const svc = await server.getPrimaryService(FEC_SERVICE);
    const rx = await svc.getCharacteristic(FEC_RX);
    rx.addEventListener('characteristicvaluechanged', (e) => { this.dbg.raw('rx', FEC_RX, e.target.value); this.onPacket(e.target.value); });
    await rx.startNotifications();
    try {
      this.tx = await svc.getCharacteristic(FEC_TX);
    } catch (err) {
      this.emit('log', `Controllo resistenza non disponibile: ${err.message}`);
      this.dbg.log(`Caratteristica di scrittura FE-C non disponibile: ${err.message}`);
    }
    // chiediamo le capacità (resistenza massima, modalità supportate): la risposta arriva come pagina 0x36
    if (this.tx) this.send(requestPage(PAGE.capabilities)).catch(() => {});
    this.dbg.setStatus(`Connesso (Tacx FE-C${this.tx ? ', controllabile' : ', sola lettura'})`);
    this.dbg.extra = { protocollo: 'FE-C', features: this.features, ranges: this.ranges };
    this.emit('connected', { name: this.device.name, ftms: false, protocol: 'FE-C', features: this.features });
  }

  disconnect() { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); }

  onPacket(v) {
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    for (const msg of splitMessages(bytes)) {
      const page = msg.slice(4, 12);
      const d = parsePage(page);
      if (!d) continue;
      if (page[0] === PAGE.commandStatus) {
        this.dbg.log(`Stato comando 0x${d.lastCommand.toString(16)}: ${STATUS[d.status] ?? d.status}`);
        continue;
      }
      if (page[0] === PAGE.capabilities) {
        if (d.maxResistanceN) this.dbg.setValues({ resistenzaMaxN: d.maxResistanceN });
        this.features = { resistance: !!(d.caps & 1), power: !!(d.caps & 2), simulation: !!(d.caps & 4) };
        this.dbg.log(`Capacità: basic ${this.features.resistance ? 'sì' : 'no'}, ERG ${this.features.power ? 'sì' : 'no'}, simulazione ${this.features.simulation ? 'sì' : 'no'}`);
        continue;
      }
      if (page[0] === PAGE.trainer) {
        const { trainerStatus, targetLimit, ...rest } = d;
        this.dbg.setValues({ statoRullo: trainerStatus, limiteTarget: targetLimit });
        if (rest.cadence != null) this.hasCadence = true;
        this.dbg.setValues(rest);
        this.emit('data', rest);
        continue;
      }
      this.dbg.setValues(d);
      this.emit('data', d);
    }
  }

  // Le scritture vanno serializzate. FE-C non ha una risposta diretta come FTMS: l'esito si può chiedere con la
  // pagina 0x46→0x47 (lo facciamo solo nel debug). Scrittura senza risposta come GoldenCheetah e incyclist.
  send(page) {
    const run = async () => {
      if (!this.tx) throw new Error('Rullo non controllabile');
      const msg = antMessage(page);
      this.dbg.raw('tx', FEC_TX, msg);
      const p = this.tx.properties || {};
      if (p.writeWithoutResponse && this.tx.writeValueWithoutResponse) await this.tx.writeValueWithoutResponse(msg);
      else if (this.tx.writeValueWithResponse) await this.tx.writeValueWithResponse(msg);
      else await this.tx.writeValue(msg);
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  setTargetPower(watts) {
    const [min, max] = this.ranges.power;
    this.sim = null;
    return this.send(targetPowerPage(Math.min(Math.max(watts, Math.max(min, 0)), max || 2000)));
  }

  setResistancePercent(pct) {
    this.sim = null;
    return this.send(basicResistancePage(pct));
  }

  // mass: peso totale ciclista + bici (kg), come nell'app. Peso e vento si mandano solo quando cambiano.
  async setSimulation({ grade = 0, wind = 0, crr = 0.004, cw = 0.51, mass = 80 } = {}) {
    const prev = this.sim;
    if (!prev || prev.mass !== mass) await this.send(userConfigPage(Math.max(mass - BIKE_KG, 20), BIKE_KG));
    if (!prev || prev.wind !== wind || prev.cw !== cw) await this.send(windResistancePage(cw, wind * 3.6, 1));
    this.sim = { mass, wind, cw };
    return this.send(trackResistancePage(grade, crr));
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}
