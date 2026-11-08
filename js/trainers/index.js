// Rullo con scelta automatica del protocollo. Espone la stessa interfaccia di Trainer (js/ftms.js), quindi
// l'app lo usa senza sapere quale driver c'è sotto.
//
// Ordine di scelta (il primo disponibile vince):
//   1. FTMS (0x1826)       → js/ftms.js, comportamento invariato
//   2. Tacx FE-C over BLE  → js/trainers/fec.js
//   3. Wahoo legacy        → js/trainers/wahoo.js (caratteristica a026e005 dentro Cycling Power)
//   4. Cycling Power / CSC → js/ftms.js in sola lettura (fallback già esistente)
//
// Perché FTMS prima di FE-C anche sui Tacx: i Tacx con firmware recente espongono sia FTMS sia FE-C e non ci sono
// difetti pubblicamente documentati e riproducibili del loro FTMS che giustifichino una lista di eccezioni;
// FTMS è il percorso più provato dell'app e lo stesso ordine lo usano incyclist (priorità FTMS 100, Tacx 10,
// Wahoo 5) e GoldenCheetah (Wahoo solo se non c'è un altro servizio controllabile). Se un modello si comporta
// male in FTMS si può forzare il protocollo da console / debug:
//   localStorage.setItem('trainerProtocol', 'fec')   // oppure 'ftms', 'wahoo'; rimuovere per tornare ad 'auto'
// e, se serve, aggiungere il modello a PREFER_FEC qui sotto.

import { Trainer as FtmsTrainer } from '../ftms.js';
import { FecTrainer, FEC_SERVICE } from './fec.js';
import { WahooLegacyTrainer, WAHOO_CONTROL } from './wahoo.js';
import { SensorDebug } from '../debug.js';
import { t } from '../i18n.js';

const FTMS = 0x1826;
const CPS = 0x1818;
const CSC = 0x1816;
const HRS = 0x180d;

// nomi (prefisso) di rulli per cui preferire FE-C anche se hanno FTMS. Vuoto finché un utente non segnala problemi.
export const PREFER_FEC = [];

const full = (u) => (typeof u === 'number' ? `0000${u.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb` : String(u).toLowerCase());

// pura, testabile: { ftms, fec, wahoo } → 'ftms' | 'fec' | 'wahoo' | 'basic'
export function chooseProtocol({ ftms, fec, wahoo }, { name = '', force = 'auto' } = {}) {
  const avail = { ftms, fec, wahoo };
  if (force && force !== 'auto' && avail[force]) return force;
  if (fec && PREFER_FEC.some((p) => name.startsWith(p))) return 'fec';
  if (ftms) return 'ftms';
  if (fec) return 'fec';
  if (wahoo) return 'wahoo';
  return 'basic';
}

// nomi leggibili dei servizi BLE per la segnalazione del rullo (B4); gli altri restano come UUID corto
const SERVICE_NAMES = {
  '1800': 'Generic Access', '1801': 'Generic Attribute', '180a': 'Device Information', '180f': 'Battery',
  '180d': 'Heart Rate', '1816': 'Cycling Speed and Cadence', '1818': 'Cycling Power', '1826': 'Fitness Machine (FTMS)',
  '1814': 'Running Speed and Cadence', '181c': 'User Data',
};
export function serviceName(uuid) {
  const u = String(uuid).toLowerCase();
  if (u === FEC_SERVICE.toLowerCase()) return 'Tacx FE-C over BLE';
  const m = u.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
  if (m) return SERVICE_NAMES[m[1]] || `0x${m[1]}`;
  return u;
}

const LABEL = { ftms: 'FTMS', fec: 'FE-C', wahoo: 'Wahoo', basic: 'CP/CSC' };

function forcedProtocol() {
  try { return localStorage.getItem('trainerProtocol') || 'auto'; } catch { return 'auto'; }
}

export class Trainer extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.driver = null;
    this.protocol = null;
    this.dbg = new SensorDebug('trainer', 'Trainer');
    this.drivers = {};
    this.services = []; // nomi leggibili dei servizi BLE visti
  }

  get connected() { return !!this.device?.gatt?.connected; }
  get controllable() { return !!this.driver?.controllable; }
  get features() { return this.driver?.features || { power: false, resistance: false, simulation: false }; }
  get ranges() { return this.driver?.ranges || { power: [0, 600, 1], resistance: [0, 25.5, 0.1] }; }
  get hasCadence() { return !!this.driver?.hasCadence; }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS] }, { services: [CPS] }, { services: [FEC_SERVICE] },
        { namePrefix: 'Tacx' }, { namePrefix: 'D100' }, { namePrefix: 'VAN RYSEL' }, { namePrefix: 'Van Rysel' }],
      optionalServices: [FTMS, CPS, CSC, HRS, FEC_SERVICE],
    });
    this.device.addEventListener('gattserverdisconnected', () => { this.dbg.setStatus('Disconnected'); this.emit('disconnected'); });
    await this.setup();
    return this.device.name || t('home.trainer');
  }

  async reconnect() {
    if (!this.device) throw new Error('No device');
    await this.setup();
  }

  async probe(server) {
    let uuids = [];
    try { uuids = (await server.getPrimaryServices()).map((s) => String(s.uuid).toLowerCase()); } catch { /* alcuni stack non elencano */ }
    const has = async (u) => {
      if (uuids.length) return uuids.includes(full(u));
      try { await server.getPrimaryService(u); return true; } catch { return false; }
    };
    this.services = uuids.map(serviceName);
    const found = { ftms: await has(FTMS), fec: await has(FEC_SERVICE), wahoo: false };
    if (await has(CPS)) {
      try { await (await server.getPrimaryService(CPS)).getCharacteristic(WAHOO_CONTROL); found.wahoo = true; } catch { /* non è un Wahoo legacy */ }
    }
    return found;
  }

  makeDriver(kind) {
    if (this.drivers[kind]) return this.drivers[kind];
    let d;
    if (kind === 'fec') d = new FecTrainer({ dbg: this.dbg });
    else if (kind === 'wahoo') d = new WahooLegacyTrainer({ dbg: this.dbg });
    else { d = new FtmsTrainer(); d.dbg = this.dbg; } // FTMS e fallback CP/CSC: driver originale
    for (const type of ['data', 'log']) d.addEventListener(type, (e) => this.emit(type, e.detail));
    d.addEventListener('connected', (e) => this.emit('connected', { ...e.detail, protocol: LABEL[this.protocol] }));
    this.drivers[kind] = d;
    return d;
  }

  async setup() {
    this.dbg.setStatus('Connecting…');
    const server = await this.device.gatt.connect();
    const found = await this.probe(server);
    this.protocol = chooseProtocol(found, { name: this.device.name || '', force: forcedProtocol() });
    this.dbg.log(`Protocols found: ${Object.entries(found).filter(([, v]) => v).map(([k]) => LABEL[k]).join(', ') || 'none with control'} → using ${LABEL[this.protocol]}`);
    this.driver = this.makeDriver(this.protocol);
    this.driver.device = this.device;
    await this.driver.setup(server);
  }

  disconnect() { if (this.device?.gatt?.connected) this.device.gatt.disconnect(); }

  setTargetPower(w) { return this.driver ? this.driver.setTargetPower(w) : Promise.reject(new Error('Trainer not connected')); }
  setResistancePercent(p) { return this.driver ? this.driver.setResistancePercent(p) : Promise.reject(new Error('Trainer not connected')); }
  setSimulation(o) { return this.driver ? this.driver.setSimulation(o) : Promise.reject(new Error('Trainer not connected')); }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}
