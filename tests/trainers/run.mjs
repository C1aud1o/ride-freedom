// Test dei driver dei rulli senza rulli veri: node tests/trainers/run.mjs
// Avvia un piccolo server statico, apre l'app in Chromium (Playwright) con il mock Web Bluetooth
// (mock-bluetooth.js) e controlla collegamento, potenza/cadenza mostrate e byte dei comandi ERG/pendenza.
// I byte attesi sono scritti a mano qui sotto (non calcolati con il codice dell'app), partendo dagli esempi e
// dalle formule delle fonti citate in js/trainers/fec.js e js/trainers/wahoo.js.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const MOCK = await readFile(join(here, 'mock-bluetooth.js'), 'utf8');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body); } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------- piccolo framework ----------
let failed = 0; let passed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); } };
const eq = (a, b, msg) => ok(a === b, `${msg}${a === b ? '' : `\n      atteso: ${b}\n      ottenuto: ${a}`}`);
const xor = (a) => a.reduce((x, b) => x ^ b, 0);
const h = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
const ant = (page) => { const m = [0xa4, 0x09, 0x4f, 0x05, ...page]; return h([...m, xor(m)]); };

const FEC_TX = '6e40fec3-b5a3-f393-e0a9-e50e24dcca9e';
const WAHOO = 'a026e005-0a7d-4ab3-97fa-f1500f9feb8b';
const FTMS_CP = '00002ad9-0000-1000-8000-00805f9b34fb';

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });

async function open(profile, { protocol } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`    [errore pagina] ${e.message}`));
  await page.addInitScript(({ profile, protocol }) => {
    window.__MOCK_PROFILE = profile;
    try { if (protocol) localStorage.setItem('trainerProtocol', protocol); else localStorage.removeItem('trainerProtocol'); } catch { /* */ }
  }, { profile, protocol });
  await page.addInitScript(MOCK);
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => document.getElementById('connectTrainer'));
  await page.waitForTimeout(300);
  return { ctx, page };
}

const writes = (page, uuid) => page.evaluate((u) => window.__ble.writes.filter((w) => w.uuid === u).map((w) => w.hex), uuid);
const clearWrites = (page) => page.evaluate(() => { window.__ble.writes.length = 0; });
async function waitWrites(page, uuid, pred, timeout = 4000) {
  const end = Date.now() + timeout;
  let w = [];
  while (Date.now() < end) { w = await writes(page, uuid); if (pred(w)) return w; await page.waitForTimeout(100); }
  return w;
}
async function setMode(page, mode) {
  await page.evaluate((m) => { const r = document.querySelector(`[name=mode][value=${m}]`); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }, mode);
}
async function setHidden(page, id, value) {
  await page.evaluate(([i, v]) => { const el = document.getElementById(i); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, String(value)]);
}
async function connect(page) {
  await page.evaluate(() => document.getElementById('connectTrainer').click());
  await page.waitForFunction(() => /·/.test(document.getElementById('trainerStatus').textContent), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1600); // qualche pacchetto di dati
}
const text = (page, id) => page.$eval(`#${id}`, (e) => e.textContent.trim());

// ---------- 1. funzioni di codifica (nel browser, moduli ES dell'app) ----------
console.log('\nCodifica FE-C / Wahoo / scelta protocollo');
{
  const { ctx, page } = await open('fec');
  const r = await page.evaluate(async () => {
    const f = await import('/js/trainers/fec.js');
    const w = await import('/js/trainers/wahoo.js');
    const i = await import('/js/trainers/index.js');
    const hx = (a) => Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(' ');
    // esempio del documento Tacx "FE-C over BLE": A4 09 4E 05 10 19 04 00 00 00 FF 24 | checksum 0x30
    const doc = [0xa4, 0x09, 0x4e, 0x05, 0x10, 0x19, 0x04, 0x00, 0x00, 0x00, 0xff, 0x24];
    const docMsgs = f.splitMessages(Uint8Array.from([...doc, 0x30]));
    return {
      docChecksum: f.checksum(doc),
      docParsed: docMsgs.length === 1 ? f.parsePage(docMsgs[0].slice(4, 12)) : null,
      badChecksumRejected: f.splitMessages(Uint8Array.from([...doc, 0x31])).length === 0,
      erg200: hx(f.antMessage(f.targetPowerPage(200))),
      track: hx(f.antMessage(f.trackResistancePage(-3.5, 0.004))),
      user: hx(f.userConfigPage(75, 9, 0.7)),
      wind: hx(f.windResistancePage(0.51, 0, 1)),
      basic: hx(f.basicResistancePage(50)),
      wErg: hx(w.ergCmd(250)), wSim: hx(w.simModeCmd(85, 0.004, 0.51)), wGrade: hx(w.gradeCmd(-2)),
      wGrade0: hx(w.gradeCmd(0)), wUnlock: hx(w.unlockCmd()),
      choose: [
        i.chooseProtocol({ ftms: true, fec: true, wahoo: false }),
        i.chooseProtocol({ ftms: false, fec: true, wahoo: false }),
        i.chooseProtocol({ ftms: false, fec: false, wahoo: true }),
        i.chooseProtocol({ ftms: true, fec: false, wahoo: true }),
        i.chooseProtocol({ ftms: false, fec: false, wahoo: false }),
        i.chooseProtocol({ ftms: true, fec: true, wahoo: false }, { force: 'fec' }),
        i.chooseProtocol({ ftms: true, fec: false, wahoo: false }, { force: 'fec' }),
      ].join(','),
    };
  });
  eq(r.docChecksum, 0x30, 'checksum XOR dell\'esempio del documento Tacx = 0x30');
  ok(r.docParsed && r.docParsed.speed === 0, `esempio del documento letto come pagina 0x10 (velocità 0) → ${JSON.stringify(r.docParsed)}`);
  ok(r.badChecksumRejected, 'messaggio con checksum sbagliato scartato');
  // 200 W → 800 (0x0320) in 0.25 W
  eq(r.erg200, ant([0x31, 0xff, 0xff, 0xff, 0xff, 0xff, 0x20, 0x03]), 'FE-C 0x31 Target Power 200 W');
  // -3.5 % → (196.5 × 100) = 19650 = 0x4CC2; Crr 0.004 / 5e-5 = 80 = 0x50
  eq(r.track, ant([0x33, 0xff, 0xff, 0xff, 0xff, 0xc2, 0x4c, 0x50]), 'FE-C 0x33 Track Resistance -3.5 %, Crr 0.004');
  // 75 kg → 7500 = 0x1D4C; bici 9 kg / 0.05 = 180 = 0x0B4 → nibble 4 in byte 4 alto, 0x0B in byte 5; ruota 0.70 m → 70
  eq(r.user, h([0x37, 0x4c, 0x1d, 0xff, 0x40, 0x0b, 0x46, 0x00]), 'FE-C 0x37 User Configuration 75 kg + 9 kg, ruota 700 mm');
  eq(r.wind, h([0x32, 0xff, 0xff, 0xff, 0xff, 51, 127, 100]), 'FE-C 0x32 Wind Resistance 0.51 kg/m, vento 0, drafting 1');
  eq(r.basic, h([0x30, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 100]), 'FE-C 0x30 Basic Resistance 50 %');
  eq(r.wUnlock, '20 ee fc', 'Wahoo sblocco 0x20 EE FC');
  eq(r.wErg, '42 fa 00', 'Wahoo ERG 0x42 250 W');
  // 85 kg → 8500 = 0x2134; Crr 0.004 × 10000 = 40; cw 0.51 × 1000 = 510 = 0x01FE
  eq(r.wSim, '43 34 21 28 00 fe 01', 'Wahoo 0x43 simulazione 85 kg, Crr 0.004, cw 0.51');
  // -2 % → (1 - 0.02) × 32767.5 = 32112.15 → 32112 = 0x7D70
  eq(r.wGrade, '46 70 7d', 'Wahoo 0x46 pendenza -2 %');
  eq(r.wGrade0, '46 00 80', 'Wahoo 0x46 pendenza 0 % (0x8000)');
  eq(r.choose, 'ftms,fec,wahoo,ftms,basic,fec,ftms', 'scelta del protocollo: FTMS > FE-C > Wahoo > CP/CSC, forzatura solo se disponibile');
  await ctx.close();
}

// ---------- 2. Tacx FE-C nell'app ----------
console.log('\nTacx con solo FE-C (es. Flux)');
{
  const { ctx, page } = await open('fec');
  await connect(page);
  const opts = await page.evaluate(() => window.__ble.requestOptions);
  ok(opts.optionalServices.includes('6e40fec1-b5a3-f393-e0a9-e50e24dcca9e'), 'servizio FE-C in optionalServices');
  ok(opts.filters.some((f) => f.services?.includes('6e40fec1-b5a3-f393-e0a9-e50e24dcca9e')), 'servizio FE-C nei filtri');
  ok((await text(page, 'trainerStatus')).includes('FE-C'), `stato: "${await text(page, 'trainerStatus')}"`);
  eq(await text(page, 'power'), '215', 'potenza mostrata dalla pagina 0x19');
  eq(await text(page, 'cadence'), '88', 'cadenza mostrata dalla pagina 0x19');
  const capsReq = await writes(page, FEC_TX);
  ok(capsReq.includes(ant([0x46, 0xff, 0xff, 0xff, 0xff, 0x01, 0x36, 0x01])), 'richiesta pagina capacità 0x36 all\'avvio');
  const via = await page.evaluate(() => window.__ble.writes.find((w) => w.uuid === '6e40fec3-b5a3-f393-e0a9-e50e24dcca9e')?.withResponse);
  eq(via, false, 'scrittura senza risposta (come GoldenCheetah / incyclist)');

  await setMode(page, 'erg');
  await page.waitForTimeout(1000);
  // fuori dalla modalità Cambio la velocità mostrata è quella del rullo
  ok(Math.abs(parseFloat(await text(page, 'speed')) - 30) < 0.2, `velocità dalla pagina 0x10: ${await text(page, 'speed')} km/h`);
  await clearWrites(page);
  await setHidden(page, 'erg', 175);
  // 175 W → 700 = 0x02BC in unità 0.25 W
  let w = await waitWrites(page, FEC_TX, (x) => x.length > 0);
  eq(w.at(-1), ant([0x31, 0xff, 0xff, 0xff, 0xff, 0xff, 0xbc, 0x02]), 'ERG 175 W → pagina 0x31');

  await setMode(page, 'sim');
  await page.waitForTimeout(1000);
  await clearWrites(page);
  await setHidden(page, 'grade', 5);
  w = await waitWrites(page, FEC_TX, (x) => x.length > 0);
  // la prima pendenza dopo il cambio modo ha già inviato 0x37/0x32; ora solo 0x33: 5 % → 20500 = 0x5014
  eq(w.at(-1), ant([0x33, 0xff, 0xff, 0xff, 0xff, 0x14, 0x50, 0x50]), 'Pendenza 5 % → pagina 0x33 (Crr 0.004)');
  ok(w.length === 1, `nessun reinvio di peso/vento se non cambiano (${w.length} messaggi)`);

  await setMode(page, 'gears'); await page.waitForTimeout(1000); // esce dalla simulazione
  await clearWrites(page);
  await setMode(page, 'sim');
  w = await waitWrites(page, FEC_TX, (x) => x.length >= 3);
  // peso app 80 kg con bici → ciclista 70 kg (7000 = 0x1B58), bici 10 kg (200 = 0xC8)
  eq(w[0], ant([0x37, 0x58, 0x1b, 0xff, 0x80, 0x0c, 0x46, 0x00]), 'entrando in pendenza: 0x37 User Configuration (70 + 10 kg)');
  eq(w[1], ant([0x32, 0xff, 0xff, 0xff, 0xff, 51, 127, 100]), 'poi 0x32 Wind Resistance');
  eq(w[2], ant([0x33, 0xff, 0xff, 0xff, 0xff, 0x14, 0x50, 0x50]), 'poi 0x33 Track Resistance 5 %');

  await page.waitForTimeout(1000);
  await setMode(page, 'resistance');
  await page.waitForTimeout(1000);
  await clearWrites(page);
  await setHidden(page, 'resistance', 40);
  w = await waitWrites(page, FEC_TX, (x) => x.length > 0);
  eq(w.at(-1), ant([0x30, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 80]), 'Resistenza 40 % → pagina 0x30 (80 × 0.5 %)');
  await ctx.close();
}

// ---------- 3. Wahoo legacy ----------
console.log('\nWahoo Kickr legacy (Cycling Power + a026e005)');
{
  const { ctx, page } = await open('wahoo');
  await connect(page);
  ok((await text(page, 'trainerStatus')).includes('Wahoo'), `stato: "${await text(page, 'trainerStatus')}"`);
  let w = await writes(page, WAHOO);
  eq(w[0], '20 ee fc', 'sblocco 0x20 EE FC appena collegato');
  eq(await text(page, 'power'), '180', 'potenza da 0x2a63');
  const cad = +(await text(page, 'cadence'));
  ok(Math.abs(cad - 90) <= 1, `cadenza dai giri pedivella di 0x2a63: ${cad}`);

  await setMode(page, 'erg');
  await page.waitForTimeout(1000);
  await clearWrites(page);
  await setHidden(page, 'erg', 175);
  w = await waitWrites(page, WAHOO, (x) => x.length > 0);
  eq(w.at(-1), '42 af 00', 'ERG 175 W → 0x42 AF 00');

  await page.waitForTimeout(1000); // l'app scarta i comandi mentre un altro è in corso
  await setMode(page, 'sim');
  w = await waitWrites(page, WAHOO, (x) => x.some((s) => s.startsWith('46')));
  eq(w.find((s) => s.startsWith('43')), '43 40 1f 28 00 fe 01', 'entrando in pendenza: 0x43 peso 80 kg, Crr 0.004, cw 0.51');
  await page.waitForTimeout(1000);
  await clearWrites(page);
  await setHidden(page, 'grade', 5);
  w = await waitWrites(page, WAHOO, (x) => x.some((c) => c.startsWith('46')));
  // 5 % → 1.05 × 32767.5 = 34405.9 → 34406 = 0x8666
  eq(w.at(-1), '46 66 86', 'Pendenza 5 % → 0x46 66 86');
  ok(w.length === 1, `0x43 non ripetuto se peso/Crr/cw non cambiano (${w.length} comandi)`);
  await ctx.close();
}

// ---------- 4. Tacx con FTMS e FE-C: FTMS (default) o FE-C forzato ----------
console.log('\nTacx con FTMS e FE-C');
{
  let { ctx, page } = await open('tacx-both');
  await connect(page);
  ok((await text(page, 'trainerStatus')).includes('FTMS'), `default FTMS: "${await text(page, 'trainerStatus')}"`);
  eq(await text(page, 'power'), '160', 'potenza da FTMS');
  await ctx.close();
  ({ ctx, page } = await open('tacx-both', { protocol: 'fec' }));
  await connect(page);
  ok((await text(page, 'trainerStatus')).includes('FE-C'), `forzato FE-C: "${await text(page, 'trainerStatus')}"`);
  eq(await text(page, 'power'), '215', 'potenza da FE-C');
  await ctx.close();
}

// ---------- 5. FTMS invariato ----------
console.log('\nRullo FTMS (regressione)');
{
  const { ctx, page } = await open('ftms');
  await connect(page);
  ok((await text(page, 'trainerStatus')).includes('FTMS'), `stato: "${await text(page, 'trainerStatus')}"`);
  let w = await writes(page, FTMS_CP);
  eq(w.slice(0, 2).join(' | '), '00 | 07', 'Request Control 0x00 e Start 0x07 come prima');
  eq(await text(page, 'power'), '160', 'potenza da Indoor Bike Data');
  eq(await text(page, 'cadence'), '85', 'cadenza da Indoor Bike Data');
  await setMode(page, 'erg');
  await page.waitForTimeout(1000);
  await clearWrites(page);
  await setHidden(page, 'erg', 175);
  w = await waitWrites(page, FTMS_CP, (x) => x.length > 0);
  eq(w.at(-1), '05 af 00', 'ERG 175 W → 0x05 AF 00');
  await setMode(page, 'sim');
  await page.waitForTimeout(1000);
  await clearWrites(page);
  await setHidden(page, 'grade', 5);
  w = await waitWrites(page, FTMS_CP, (x) => x.length > 0);
  eq(w.at(-1), '11 00 00 f4 01 28 33', 'Pendenza 5 % → 0x11 (vento 0, 500, Crr 40, cw 51)');
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${passed} superati, ${failed} falliti`);
process.exit(failed ? 1 : 0);
