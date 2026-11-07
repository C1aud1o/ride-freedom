// Prova con un Web Bluetooth finto: emula Zwift Click (v1 e v2), Zwift Play (2 controller) e Zwift Ride
// e verifica che gli eventi arrivino all'app (cambio marcia, apertura del menu Click, stato in UI).
// Uso: node tests/controllers/zwift-controllers.test.cjs   (serve Playwright con Chromium installato)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Web Bluetooth finto, installato prima del codice dell'app
const MOCK = () => {
  const ASYNC = '00000002-19ca-4651-86e5-fa29dcdd09d1';
  const SVC_V1 = '00000001-19ca-4651-86e5-fa29dcdd09d1';
  const SVC_FC82 = '0000fc82-0000-1000-8000-00805f9b34fb';
  const norm = (u) => (typeof u === 'number' ? `0000${u.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb` : String(u).toLowerCase());
  window.__bt = { queue: [], devices: {}, writes: [] };
  class Char extends EventTarget {
    constructor(uuid, dev) { super(); this.uuid = uuid; this.dev = dev; this.properties = { notify: true, write: true }; }
    async startNotifications() { return this; }
    async writeValueWithResponse(v) { window.__bt.writes.push({ id: this.dev.id, bytes: Array.from(new Uint8Array(v)) }); }
  }
  class Dev extends EventTarget {
    constructor(spec) {
      super(); this.id = spec.id; this.name = spec.name; this.spec = spec; this.chars = {};
      const dev = this;
      const service = { uuid: norm(spec.service), async getCharacteristic(u) { const k = norm(u); return (dev.chars[k] ||= new Char(k, dev)); }, async getCharacteristics() { return Object.values(dev.chars); } };
      this.gatt = {
        connected: false,
        async connect() { this.connected = true; return this; },
        disconnect() { this.connected = false; dev.dispatchEvent(new Event('gattserverdisconnected')); },
        async getPrimaryService(u) { if (norm(u) !== service.uuid) throw new DOMException('no', 'NotFoundError'); return service; },
        async getPrimaryServices() { return [service]; },
      };
    }
  }
  navigator.bluetooth = {
    async getAvailability() { return true; },
    async requestDevice(opts) {
      const spec = window.__bt.queue.shift();
      if (!spec) throw new DOMException('Nessun dispositivo', 'NotFoundError');
      window.__bt.lastOpts = JSON.stringify(opts);
      const d = new Dev(spec); window.__bt.devices[spec.id] = d; return d;
    },
  };
  // invia un pacchetto di notifica come se arrivasse dal dispositivo
  window.__notify = (id, bytes) => {
    const d = window.__bt.devices[id]; const c = d.chars[norm(ASYNC)];
    const dv = new DataView(new Uint8Array(bytes).buffer);
    c.value = dv; Object.defineProperty(c, 'value', { value: dv, configurable: true });
    c.dispatchEvent(new Event('characteristicvaluechanged'));
  };
  window.__SVC = { SVC_V1, SVC_FC82 };
};

const varint = (n) => { const o = []; n >>>= 0; while (n > 127) { o.push((n & 127) | 128); n = Math.floor(n / 128); } o.push(n); return o; };
const pb = (...pairs) => pairs.flatMap(([f, v]) => [(f << 3) | 0, ...varint(v)]);
// messaggi
const click1 = (plus, minus) => [0x37, ...pb([1, plus ? 0 : 1], [2, minus ? 0 : 1])];
const MASK_IDLE = 0x37fff;
const mask = (...bits) => [0x23, ...pb([1, bits.reduce((m, b) => m & ~(1 << b), MASK_IDLE)])];
const play = (...down) => [0x07, ...pb([1, 0], ...[2, 3, 4, 5, 6, 7].map((f) => [f, down.includes(f) ? 0 : 1]))];

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failed++; };

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(MOCK);
  await page.goto(base);

  const gear = async () => +(await page.textContent('#gearNum'));
  const menuOpen = () => page.evaluate(() => !document.getElementById('clickMenu').hidden);
  const status = () => page.textContent('#clickStatus');
  const send = (id, b) => page.evaluate(([i, x]) => window.__notify(i, x), [id, b]);
  const connect = async (spec) => { await page.evaluate((s) => window.__bt.queue.push(s), spec); await page.click('#connectClick'); await page.waitForFunction((id) => window.__bt.devices[id]?.chars && Object.keys(window.__bt.devices[id].chars).length > 1, spec.id); };
  const tap = async (id, down, idle) => { await send(id, down); await send(id, idle); };

  // ---- Zwift Click v1 (servizio proprietario, nome "Zwift Click")
  console.log('Zwift Click v1');
  await connect({ id: 'c1', name: 'Zwift Click', service: '00000001-19ca-4651-86e5-fa29dcdd09d1' });
  ok((await status()) === 'Collegato: Zwift Click', `stato UI: "${await status()}"`);
  ok((await page.evaluate(() => window.__bt.writes.some((w) => w.id === 'c1' && w.bytes.join() === '82,105,100,101,79,110'))), 'handshake RideOn inviato');
  let g = await gear();
  await tap('c1', click1(true, false), click1(false, false));
  ok((await gear()) === g + 1, 'Click v1 "+" → marcia +1');
  await tap('c1', click1(false, true), click1(false, false));
  ok((await gear()) === g, 'Click v1 "−" → marcia −1');
  await send('c1', click1(true, true));
  ok(await menuOpen(), 'Click v1 + e − insieme → menu Click aperto');
  await send('c1', click1(false, false));
  await send('c1', click1(true, true)); await send('c1', click1(false, false));
  ok(!(await menuOpen()), 'ancora + e − → menu chiuso');
  await page.click('#connectClick'); // scollega
  ok((await status()) === 'Non connesso', 'scollegato');

  // ---- Zwift Click v2 (maschera di bit): bit 12 = +, bit 8 = − (comportamento invariato)
  console.log('Zwift Click v2');
  await connect({ id: 'c2', name: 'Zwift Click', service: 0xfc82 });
  g = await gear();
  await tap('c2', mask(12), mask());
  ok((await gear()) === g + 1, 'Click v2 bit 12 → marcia +1');
  await tap('c2', mask(8), mask());
  ok((await gear()) === g, 'Click v2 bit 8 → marcia −1');
  await send('c2', mask(12, 8)); ok(await menuOpen(), 'Click v2 + e − insieme → menu aperto');
  await send('c2', mask()); await send('c2', mask(12, 8)); await send('c2', mask());
  ok(!(await menuOpen()), 'menu chiuso');
  await page.click('#connectClick');

  // ---- Zwift Play: due controller
  console.log('Zwift Play (sinistro + destro)');
  await connect({ id: 'pl', name: 'Zwift Play L', service: 0xfc82 });
  ok((await status()) === 'Collegato: Zwift Play', `un controller: "${await status()}"`);
  await connect({ id: 'pr', name: 'Zwift Play R', service: 0xfc82 }); // il click su "Click" propone il secondo (dialog accettato)
  ok((await status()) === 'Collegato: Zwift Play ×2', `due controller: "${await status()}"`);
  g = await gear();
  await tap('pl', play(2), play()); ok((await gear()) === g + 1, 'Play sinistro Su → marcia +1');
  await tap('pr', play(5), play()); ok((await gear()) === g, 'Play destro B/Giù → marcia −1');
  await tap('pr', play(4), play()); ok((await gear()) === g + 1, 'Play destro A/Destra → marcia +1');
  await tap('pl', play(3), play()); ok((await gear()) === g, 'Play sinistro Sinistra → marcia −1');
  await send('pl', play(6)); ok(await menuOpen(), 'tasto Zwift → menu Click aperto');
  await send('pl', play());
  g = await gear();
  await tap('pr', play(2), play()); ok((await gear()) === g, 'a menu aperto i tasti non cambiano marcia (navigano)');
  await send('pr', play(6)); await send('pr', play());
  ok(!(await menuOpen()), 'tasto Zwift sull\'altro controller → menu chiuso');
  // + del sinistro e − del destro tenuti insieme = combo
  await send('pl', play(2)); await send('pr', play(5)); ok(await menuOpen(), 'Su (sx) + Giù (dx) insieme → menu (combo tra due controller)');
  await send('pl', play()); await send('pr', play());
  await send('pl', play(6)); await send('pl', play());
  await page.evaluate(() => window.__bt.devices.pr.gatt.disconnect());
  ok((await status()) === 'Collegato: Zwift Play', `un controller scollegato: "${await status()}"`);
  await page.evaluate(() => window.__bt.devices.pl.gatt.disconnect());
  ok((await status()) === 'Non connesso', 'entrambi scollegati');

  // ---- Zwift Ride
  console.log('Zwift Ride');
  await connect({ id: 'rd', name: 'Zwift Ride', service: 0xfc82 });
  ok((await status()) === 'Collegato: Zwift Ride', `stato UI: "${await status()}"`);
  g = await gear();
  await tap('rd', mask(9), mask()); ok((await gear()) === g + 1, 'Ride cambio su (bit 9) → +1');
  await tap('rd', mask(10), mask()); ok((await gear()) === g, 'Ride cambio giù (bit 10) → −1');
  await tap('rd', mask(13), mask()); ok((await gear()) === g + 1, 'Ride cambio su dx (bit 13) → +1');
  await tap('rd', mask(14), mask()); ok((await gear()) === g, 'Ride cambio giù dx (bit 14) → −1');
  await tap('rd', mask(1), mask()); ok((await gear()) === g + 1, 'Ride croce Su → +1');
  await tap('rd', mask(6), mask()); ok((await gear()) === g + 2, 'Ride tasto Y → +1');
  await tap('rd', mask(3), mask()); await tap('rd', mask(5), mask()); ok((await gear()) === g, 'Ride Giù e B → −1 −1');
  await send('rd', mask(12)); ok(await menuOpen(), 'Ride tasto Zwift/menu (bit 12) → menu aperto');
  await send('rd', mask());
  await send('rd', mask(17)); await send('rd', mask());
  ok(!(await menuOpen()), 'Ride tasto menu destro → menu chiuso');
  ok((await gear()) === g, 'il tasto menu non cambia marcia');

  ok(errors.length === 0, `nessun errore JS nella pagina${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failed ? `\n${failed} controlli FALLITI` : '\nTutti i controlli superati');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
