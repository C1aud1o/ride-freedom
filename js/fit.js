// Encoder minimale di file .FIT (formato Garmin) per un'attività di ciclismo indoor.
// Il file si importa in Garmin Connect, Strava, intervals.icu, TrainingPeaks...

const FIT_EPOCH = 631065600; // 1989-12-31T00:00:00Z in secondi Unix
const T = { enum: 0x00, uint8: 0x02, uint16: 0x84, sint32: 0x85, uint32: 0x86, uint32z: 0x8c };
const SIZE = { 0x00: 1, 0x02: 1, 0x84: 2, 0x85: 4, 0x86: 4, 0x8c: 4 };
const INVALID = { 0x00: 0xff, 0x02: 0xff, 0x84: 0xffff, 0x85: 0x7fffffff, 0x86: 0xffffffff, 0x8c: 0 };

const CRC_TABLE = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];

function crc16(bytes, crc = 0) {
  for (const b of bytes) {
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[b & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(b >> 4) & 0xf];
  }
  return crc;
}

// Definizioni dei messaggi: [numero globale, [[campo, tipo], ...]]
const MSG = {
  fileId: [0, [[0, T.enum], [1, T.uint16], [2, T.uint16], [3, T.uint32z], [4, T.uint32]]],
  event: [21, [[253, T.uint32], [0, T.enum], [1, T.enum]]],
  record: [20, [[253, T.uint32], [3, T.uint8], [4, T.uint8], [5, T.uint32], [6, T.uint16], [7, T.uint16]]],
  // con un percorso GPX: anche posizione (semicerchi) e quota (scala 5, offset 500)
  recordGps: [20, [[253, T.uint32], [3, T.uint8], [4, T.uint8], [5, T.uint32], [6, T.uint16], [7, T.uint16], [0, T.sint32], [1, T.sint32], [2, T.uint16]]],
  lap: [19, [[253, T.uint32], [2, T.uint32], [7, T.uint32], [8, T.uint32], [9, T.uint32], [0, T.enum], [1, T.enum],
    [25, T.enum], [39, T.enum], [19, T.uint16], [20, T.uint16], [15, T.uint8], [16, T.uint8], [17, T.uint8], [11, T.uint16]]],
  session: [18, [[253, T.uint32], [2, T.uint32], [7, T.uint32], [8, T.uint32], [9, T.uint32], [5, T.enum], [6, T.enum],
    [0, T.enum], [1, T.enum], [20, T.uint16], [21, T.uint16], [16, T.uint8], [17, T.uint8], [18, T.uint8], [11, T.uint16],
    [26, T.uint16], [25, T.uint16]]],
  activity: [34, [[253, T.uint32], [0, T.uint32], [1, T.uint16], [2, T.enum], [3, T.enum], [4, T.enum], [5, T.uint32]]],
};

class Writer {
  constructor() { this.bytes = []; this.locals = new Map(); }
  u8(v) { this.bytes.push(v & 0xff); }
  u16(v) { this.u8(v); this.u8(v >> 8); }
  u32(v) { this.u16(v & 0xffff); this.u16(Math.floor(v / 0x10000) & 0xffff); }

  define(name) {
    const local = this.locals.size;
    const [global, fields] = MSG[name];
    this.locals.set(name, local);
    this.u8(0x40 | local); this.u8(0); this.u8(0); this.u16(global); this.u8(fields.length);
    for (const [num, type] of fields) { this.u8(num); this.u8(SIZE[type]); this.u8(type); }
  }

  write(name, values) {
    if (!this.locals.has(name)) this.define(name);
    this.u8(this.locals.get(name));
    for (const [i, [, type]] of MSG[name][1].entries()) {
      let v = values[i];
      v = v == null || Number.isNaN(v) ? INVALID[type] : type === T.sint32 ? Math.round(v) : Math.max(0, Math.round(v));
      if (SIZE[type] === 1) this.u8(Math.min(v, 0xff));
      else if (SIZE[type] === 2) this.u16(Math.min(v, 0xffff));
      else this.u32(Math.min(v, 0xffffffff));
    }
  }
}

const fitTime = (ms) => Math.round(ms / 1000) - FIT_EPOCH;

/**
 * samples: [{ t: ms Unix, power, cadence, hr, speed (m/s), distance (m) }]
 * Restituisce un Uint8Array con il file .FIT.
 */
export function encodeFit(samples) {
  if (!samples.length) throw new Error('Nessun dato registrato');
  const w = new Writer();
  const start = samples[0].t; const end = samples[samples.length - 1].t;
  const startTs = fitTime(start); const endTs = fitTime(end);
  const timer = samples.length * 1000; // un campione al secondo, solo mentre il timer gira
  const elapsed = Math.max(timer, end - start + 1000);

  const pw = samples.map((s) => s.power || 0);
  const hrs = samples.map((s) => s.hr).filter(Boolean);
  const cads = samples.map((s) => s.cadence).filter((c) => c > 0);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const max = (a) => (a.length ? Math.max(...a) : null);
  const kj = pw.reduce((x, y) => x + y, 0) / 1000;
  const kcal = kj; // ~ efficienza umana 24% => kcal ≈ kJ
  const dist = samples[samples.length - 1].distance || 0;

  w.write('fileId', [4, 255, 1, 1, startTs]); // tipo activity, produttore "development"
  w.write('event', [startTs, 0, 0]); // timer start
  const gps = samples.some((s) => s.lat != null);
  const SEMI = 2 ** 31 / 180;
  for (const s of samples) {
    const base = [fitTime(s.t), s.hr, s.cadence, (s.distance || 0) * 100, (s.speed || 0) * 1000, s.power];
    if (gps) w.write('recordGps', [...base, s.lat != null ? s.lat * SEMI : null, s.lon != null ? s.lon * SEMI : null, s.ele != null ? (s.ele + 500) * 5 : null]);
    else w.write('record', base);
  }
  const sub = gps ? 58 : 6; // 58 = attività virtuale (percorso), 6 = ciclismo indoor
  w.write('event', [endTs, 0, 4]); // timer stop_all
  const summary = [avg(pw), max(pw), avg(hrs), max(hrs), avg(cads), kcal];
  w.write('lap', [endTs, startTs, elapsed, timer, dist * 100, 9, 1, 2, sub, ...summary]);
  w.write('session', [endTs, startTs, elapsed, timer, dist * 100, 2, sub, 8, 1, ...summary, 1, 0]);
  const tzOffset = -new Date(end).getTimezoneOffset() * 60;
  w.write('activity', [endTs, timer, 1, 0, 26, 1, endTs + tzOffset]);

  const data = w.bytes;
  const header = new DataView(new ArrayBuffer(14));
  header.setUint8(0, 14); header.setUint8(1, 0x20); header.setUint16(2, 2132, true);
  header.setUint32(4, data.length, true);
  [0x2e, 0x46, 0x49, 0x54].forEach((c, i) => header.setUint8(8 + i, c)); // ".FIT"
  const headerBytes = new Uint8Array(header.buffer);
  header.setUint16(12, crc16(headerBytes.subarray(0, 12)), true);

  const out = new Uint8Array(14 + data.length + 2);
  out.set(headerBytes, 0); out.set(data, 14);
  const crc = crc16(out.subarray(0, 14 + data.length));
  out[out.length - 2] = crc & 0xff; out[out.length - 1] = crc >> 8;
  return out;
}
