// Raccolta di informazioni di debug per ogni sensore: stato, servizi, pacchetti grezzi, log.

const MAX_LINES = 500;
const NAMES = {
  0x1826: 'Fitness Machine (FTMS)', 0x1818: 'Cycling Power', 0x1816: 'Speed & Cadence', 0x180d: 'Heart Rate',
  0x180f: 'Battery', 0x180a: 'Device Info', 0xfc82: 'Zwift',
  0x2acc: 'FTMS Feature', 0x2ad2: 'Indoor Bike Data', 0x2ad6: 'Resistance Range', 0x2ad8: 'Power Range',
  0x2ad9: 'FTMS Control Point', 0x2ada: 'FTMS Status', 0x2a63: 'CP Measurement', 0x2a5b: 'CSC Measurement',
  0x2a37: 'HR Measurement', 0x2a19: 'Battery Level',
  '6e40fec1-b5a3-f393-e0a9-e50e24dcca9e': 'Tacx FE-C',
  '6e40fec2-b5a3-f393-e0a9-e50e24dcca9e': 'FE-C dal rullo (notify)',
  '6e40fec3-b5a3-f393-e0a9-e50e24dcca9e': 'FE-C verso il rullo (write)',
  'a026e005-0a7d-4ab3-97fa-f1500f9feb8b': 'Wahoo controllo (legacy)',
  '00000001-19ca-4651-86e5-fa29dcdd09d1': 'Zwift',
  '00000002-19ca-4651-86e5-fa29dcdd09d1': 'Zwift Async (notify)',
  '00000003-19ca-4651-86e5-fa29dcdd09d1': 'Zwift Sync RX (write)',
  '00000004-19ca-4651-86e5-fa29dcdd09d1': 'Zwift Sync TX (indicate)',
};

export function uuidName(uuid) {
  if (typeof uuid === 'number') return NAMES[uuid] || `0x${uuid.toString(16).padStart(4, '0')}`;
  const u = String(uuid).toLowerCase();
  const m = u.match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
  if (m) return NAMES[parseInt(m[1], 16)] || `0x${m[1]}`;
  return NAMES[u] || u;
}

export function hex(data) {
  const bytes = data instanceof DataView ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export class SensorDebug extends EventTarget {
  constructor(kind, title) {
    super();
    this.kind = kind;
    this.title = title;
    this.status = 'Non connesso';
    this.device = null;
    this.services = []; // [{ uuid, chars: [{ uuid, props }] }]
    this.values = {}; // ultimi valori interpretati
    this.lastRaw = {}; // per caratteristica: { hex, at }
    this.counts = {};
    this.lines = [];
    this.extra = {}; // dati specifici del sensore (es. pulsanti Click)
  }

  log(msg) {
    const t = new Date();
    const ts = `${t.toLocaleTimeString('it-IT')}.${String(t.getMilliseconds()).padStart(3, '0')}`;
    this.lines.push(`${ts}  ${msg}`);
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES);
    this.changed();
  }

  raw(dir, uuid, data) {
    const name = uuidName(uuid);
    const h = hex(data);
    if (dir === 'rx') {
      this.lastRaw[name] = { hex: h, at: Date.now() };
      this.counts[name] = (this.counts[name] || 0) + 1;
      // pacchetti identici al precedente dello stesso tipo: contati ma non ripetuti nel log
      const key = `${name}|${h.slice(0, 2)}`;
      this.prev ||= {};
      if (this.prev[key] === h) { this.repeats = (this.repeats || 0) + 1; this.changed(); return; }
      this.prev[key] = h;
    }
    this.log(`${dir === 'rx' ? '←' : '→'} ${name}: ${h}`);
  }

  setStatus(s) { this.status = s; this.log(`Stato: ${s}`); }
  setValues(v) { Object.assign(this.values, v); this.changed(); }

  async describe(device, server) {
    this.device = { name: device.name || '(senza nome)', id: device.id };
    this.services = [];
    try {
      for (const s of await server.getPrimaryServices()) {
        const entry = { uuid: s.uuid, chars: [] };
        try {
          for (const c of await s.getCharacteristics()) {
            const p = c.properties;
            const props = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => p[k]);
            entry.chars.push({ uuid: c.uuid, props });
          }
        } catch (err) { this.log(`Caratteristiche di ${uuidName(s.uuid)} non leggibili: ${err.message}`); }
        this.services.push(entry);
      }
      this.log(`Servizi accessibili: ${this.services.map((s) => uuidName(s.uuid)).join(', ') || 'nessuno'}`);
    } catch (err) {
      this.log(`Elenco servizi non disponibile: ${err.message}`);
    }
    this.changed();
  }

  report() {
    const out = [`=== ${this.title} ===`, `Stato: ${this.status}`];
    if (this.device) out.push(`Dispositivo: ${this.device.name} (id ${this.device.id})`);
    for (const s of this.services) {
      out.push(`Servizio ${uuidName(s.uuid)} [${s.uuid}]`);
      for (const c of s.chars) out.push(`  - ${uuidName(c.uuid)} [${c.uuid}] ${c.props.join(',')}`);
    }
    if (Object.keys(this.values).length) out.push(`Valori: ${JSON.stringify(this.values)}`);
    if (Object.keys(this.extra).length) out.push(`Extra: ${JSON.stringify(this.extra)}`);
    for (const [k, v] of Object.entries(this.lastRaw)) out.push(`Ultimo ${k} (${this.counts[k]} pacchetti): ${v.hex}`);
    out.push(`--- log (pacchetti ripetuti identici omessi: ${this.repeats || 0}) ---`, ...this.lines);
    return out.join('\n');
  }

  clear() { this.lines = []; this.counts = {}; this.lastRaw = {}; this.prev = {}; this.repeats = 0; this.changed(); }
  changed() { this.dispatchEvent(new Event('change')); }
}
