// E3/E4: account facoltativo e sincronizzazione.
//  - senza FIREBASE_CONFIG non compare nulla e non parte nessuna richiesta verso Google (fork e build foss);
//  - con la configurazione ma senza login, l'SDK non si scarica finché non si tocca "Accedi";
//  - merge (parte pura) e, con l'emulatore Firebase (SPINDRO_EMULATOR=1, vedi .github/workflows/rules.yml), login/consensi/sync/eliminazione veri.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import * as core from '../js/account/sync-core.js';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));
const CONFIG = fileURLToPath(new URL('../js/config.js', import.meta.url));
// i Google Fonts (fonts.googleapis.com / fonts.gstatic.com) sono nell'app da prima dell'account: qui contano solo gli host di Firebase e dell'SDK
const FIREBASE_HOSTS = /^(?!fonts\.).*(googleapis\.com|gstatic\.com|firebase|google\.com|recaptcha|cloudfunctions\.net)/i;
const TEST_CFG = "{ apiKey: 'fake-key', authDomain: 'demo-spindro.firebaseapp.com', projectId: 'demo-spindro', appId: '1:1:web:1', messagingSenderId: '1' }";

async function setup(page, { config = false, emulator = false, storage = {} } = {}) {
  page.errors = []; page.reqs = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('request', (r) => page.reqs.push(r.url()));
  if (config) {
    await page.route('**/js/config.js', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: readFileSync(CONFIG, 'utf8').replace('export const FIREBASE_CONFIG = null', `export const FIREBASE_CONFIG = ${TEST_CFG}`).replace('export const FIREBASE_EMULATOR = false', `export const FIREBASE_EMULATOR = ${emulator}`),
    }));
  }
  await page.addInitScript((s) => {
    try { if (!localStorage.getItem('__init')) { localStorage.setItem('__init', '1'); localStorage.setItem('lang', 'it'); localStorage.setItem('analytics', '0'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } } catch { /* */ }
  }, storage);
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
}

test('senza FIREBASE_CONFIG: nessun account in pagina e nessuna richiesta verso Google', async ({ page }) => {
  await setup(page);
  await page.click('#openSettings');
  await expect(page.locator('#settingsSheet')).toBeVisible();
  await page.waitForTimeout(800);
  expect(await page.locator('#accountGroup').count()).toBe(0);
  expect(await page.locator('#settingsSheet').innerText()).not.toMatch(/account|Accedi con Google/i);
  expect(page.reqs.filter((u) => FIREBASE_HOSTS.test(new URL(u).hostname))).toEqual([]);
  expect(page.reqs.filter((u) => /\/js\/account\/(ui|sync)\.js/.test(u))).toEqual([]); // nemmeno i moduli di login
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /^(sync:|account:)/.test(k)))).toEqual([]);
  expect(page.errors).toEqual([]);
});

test('con la configurazione ma senza login: la sezione c\'è, l\'SDK non si scarica finché non si tocca "Accedi"', async ({ page }) => {
  await setup(page, { config: true });
  await page.route('https://www.gstatic.com/**', (route) => route.abort());
  await page.click('#openSettings');
  await expect(page.locator('#accountGroup')).toBeVisible();
  await expect(page.locator('#accountGroup')).toContainText('Account');
  await page.waitForTimeout(600);
  expect(page.reqs.filter((u) => FIREBASE_HOSTS.test(new URL(u).hostname))).toEqual([]);
  // un tocco su "Accedi con Google" prova a scaricare l'SDK (qui bloccato): errore gentile, niente crash
  await page.click('#accountGroup [data-act=google]');
  await expect(page.locator('#accountGroup .acc-err')).toBeVisible();
  expect(page.reqs.some((u) => u.includes('gstatic.com/firebasejs/12.19.0/'))).toBe(true);
  expect(page.errors).toEqual([]);
});

test('i testi dell\'account sono tradotti nelle 5 lingue', async ({ page }) => {
  await setup(page, { config: true });
  await page.click('#openSettings');
  for (const [l, word] of [['en', 'Continue with Google'], ['fr', 'Continuer avec Google'], ['es', 'Continuar con Google'], ['de', 'Weiter mit Google'], ['it', 'Continua con Google']]) {
    await page.selectOption('#langSelect', l);
    await expect(page.locator('#accountGroup')).toContainText(word);
  }
});

// ---------- parte pura ----------
test.describe('merge della sincronizzazione', () => {
  const ride = (t, extra = {}) => ({ t, dur: 600, km: 5, avgW: 150, kj: 90, ...extra });
  test('serie: codifica e decodifica', () => {
    const s = [0, 1, 300, 65535, 123];
    expect(core.decodeSeries(core.encodeSeries(s))).toEqual(s);
    expect(core.encodeSeries(new Array(720).fill(1000)).length).toBeLessThanOrEqual(1920);
  });
  test('uscita → documento: il battito esce senza consenso, e le uscite non plausibili si scartano', () => {
    const r = ride(1700000000000, { avgHr: 140, maxHr: 170, series: [100, 200] });
    expect(core.rideToDoc(r, { hrOk: false }).hr).toBeUndefined();
    expect(core.rideToDoc(r, { hrOk: false })).not.toHaveProperty('avgHr');
    expect(core.rideToDoc(r, { hrOk: true }).hr).toEqual({ avgHr: 140, maxHr: 170 });
    expect(core.rideToDoc(ride(1700000000000, { km: 500 }))).toBeNull(); // 500 km in 10 minuti
    expect(core.rideToDoc(ride(1700000000000, { dur: 30 }))).toBeNull();
  });
  test('uscite: unione per id, vince la più completa, lapide toglie, le locali non si perdono', () => {
    const local = [ride(1), ride(2, { avgHr: 130 }), ride(3)].map((r) => ({ ...r, t: r.t + 1.7e12 }));
    const remote = [
      { id: String(1.7e12 + 1), ...core.rideToDoc(ride(1.7e12 + 1, { series: [5, 6] })) }, // remota con serie
      { id: String(1.7e12 + 4), ...core.rideToDoc(ride(1.7e12 + 4)) }, // nuova
      { id: String(1.7e12 + 3), t: 1.7e12 + 3, deleted: true }, // lapide
    ];
    const { list, changed } = core.mergeRides(local, remote);
    expect(changed).toBe(true);
    expect(list.map((r) => r.t - 1.7e12)).toEqual([1, 2, 4]);
    expect(list[0].series).toEqual([5, 6]);
    expect(list[1].avgHr).toBe(130); // il battito locale non si tocca
  });
  test('uscite: tiene le 200 più recenti', () => {
    const local = Array.from({ length: 250 }, (_, i) => ride(1.7e12 + i));
    expect(core.mergeRides(local, []).list).toHaveLength(200);
  });
  test('impostazioni: vince il timbro più recente; giochi: vince il migliore', () => {
    const m = core.mergePrefs({ ftp: '200', mass: '80' }, { ftp: 100, mass: 500 }, { values: { ftp: '250', mass: '70' }, stamps: { ftp: 200, mass: 100 } }, core.PREF_KEYS);
    expect(m.apply).toEqual({ ftp: '250' });
    expect(m.values.mass).toBe('80');
    expect(m.upload).toBe(true);
    const g = core.mergeGames({ hordeBest: '300', racer3dBest0: '95.5', racer3dStage: '2' }, { hordeBest: '500', racer3dBest0: '90.1', racer3dStage: '1', mattoniBest: '40' });
    expect(g.apply).toEqual({ hordeBest: '500', racer3dBest0: '90.1', mattoniBest: '40' }); // tempo: il minore; stage: il maggiore
    expect(g.values.racer3dStage).toBe('2');
    expect(core.betterGame('ghost:A:100', '[0,5,10,20]', '[0,5,20]')).toBe('[0,5,20]');
    expect(JSON.parse(core.betterGame('rfProgress', '{"xp":10,"achievements":{"a":1}}', '{"xp":50,"achievements":{"b":1}}'))).toMatchObject({ xp: 50, achievements: { a: 1, b: 1 } });
  });
  test('allenamenti: gli id in attesa vincono sul remoto, la lapide toglie', () => {
    const local = [{ id: 'my-1', name: 'A', tag: '', desc: '', steps: [], custom: true }, { id: 'my-2', name: 'B', tag: '', desc: '', steps: [], custom: true }];
    const remote = [{ id: 'my-1', name: 'A2', steps: [] }, { id: 'my-2', deleted: true, steps: [] }, { id: 'my-3', name: 'C', steps: [] }];
    const { list } = core.mergeWorkouts(local, remote, new Set(['my-1']));
    expect(list.map((w) => `${w.id}:${w.name}`).sort()).toEqual(['my-1:A', 'my-3:C']);
  });
});

// ---------- con l'emulatore Firebase (Auth 9099, Firestore 8080) ----------
const EMU = process.env.SPINDRO_EMULATOR === '1';
const PROJECT = 'demo-spindro';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;
const ADMIN = { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } };
const fsGet = async (path) => { const r = await fetch(`${FS}/${path}`, ADMIN); return r.ok ? r.json() : null; };
const fsList = async (path) => ((await (await fetch(`${FS}/${path}`, ADMIN)).json()).documents || []);

test.describe('con l\'emulatore Firebase', () => {
  test.skip(!EMU, 'serve l\'emulatore: SPINDRO_EMULATOR=1 (CI: job "account" in .github/workflows/rules.yml)');
  test.describe.configure({ mode: 'serial' });

  const email = `rider${Date.now()}@example.com`;
  let uid = null;
  const oneRide = { t: 1700000000000, dur: 1800, km: 15, avgW: 180, kj: 324, np: 190, maxW: 600, best: { 5: 600, 60: 400 }, series: [150, 180, 200], avgHr: 140, maxHr: 170 };

  test('crea l\'account, verifica l\'email, profilo e consensi (battito spento), poi la sincronizzazione senza battito', async ({ page }) => {
    await setup(page, { config: true, emulator: true, storage: { rideHistory: JSON.stringify([oneRide]), customWorkouts: JSON.stringify([{ id: 'my-1', name: 'Soglia', tag: 't', desc: 'd', steps: [{ d: 60, p: 0.9 }], custom: true }]), ftp: '230', hordeBest: '777' } });
    await page.click('#openSettings');
    await page.fill('#accEmail', email); await page.fill('#accPass', 'password-di-prova-1');
    await page.click('[data-act=signup]');
    await expect(page.locator('#accountGroup')).toContainText(email);
    // l'email si verifica aprendo il link che l'emulatore ha registrato
    let link;
    await expect.poll(async () => {
      const codes = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
      link = codes.oobCodes.filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL').pop()?.oobLink;
      return !!link;
    }).toBe(true);
    expect((await fetch(link)).ok).toBe(true);
    await page.click('[data-act=verified]');
    // profilo: senza spuntare i consensi non si crea
    await expect(page.locator('#accName')).toBeVisible();
    await page.fill('#accName', 'Ciclista Test'); await page.selectOption('#accCountry', 'IT');
    await page.click('[data-act=create]');
    await expect(page.locator('#accountGroup .acc-err')).toBeVisible();
    await page.check('#accAge'); await page.check('#accTerms'); await page.check('#accPrivacy');
    // il consenso al battito è separato e spento di default
    expect(await page.locator('#accHr').isChecked()).toBe(false);
    await page.click('[data-act=create]');
    await expect(page.locator('#accSync')).toHaveText('Sincronizzato', { timeout: 15_000 });
    uid = await page.evaluate(() => localStorage.getItem('sync:uid'));
    expect(uid).toBeTruthy();
    // profilo con data e versione dei consensi, battito non consentito
    const prof = (await fsGet(`users/${uid}`)).fields;
    expect(prof.consents.mapValue.fields.terms.mapValue.fields.v.stringValue).toBe('2026-11');
    expect(prof.consents.mapValue.fields.terms.mapValue.fields.at.timestampValue).toBeTruthy();
    expect(prof.consents.mapValue.fields.hrCloud).toBeUndefined();
    expect(prof.displayName.stringValue).toBe('Ciclista Test');
    // uscita e allenamento nel cloud, ma SENZA battito; impostazioni e record
    const ride = (await fsGet(`users/${uid}/rides/${oneRide.t}`)).fields;
    expect(ride.avgW.integerValue).toBe('180');
    expect(ride.hr).toBeUndefined(); expect(ride.avgHr).toBeUndefined();
    expect((await fsGet(`users/${uid}/workouts/my-1`)).fields.name.stringValue).toBe('Soglia');
    expect((await fsGet(`users/${uid}/settings/prefs`)).fields.values.mapValue.fields.ftp.stringValue).toBe('230');
    expect((await fsGet(`users/${uid}/settings/games`)).fields.values.mapValue.fields.hordeBest.stringValue).toBe('777');
    expect(page.reqs.filter((u) => /gstatic\.com\/firebasejs\/12\.19\.0\//.test(u)).length).toBeGreaterThan(0);
    expect(page.errors).toEqual([]);

    // consenso al battito: ora sì, il battito locale sale nel cloud; revocandolo il profilo lo registra
    await page.check('#accHr');
    await expect.poll(async () => (await fsGet(`users/${uid}/rides/${oneRide.t}`)).fields.hr?.mapValue.fields.avgHr.integerValue, { timeout: 15_000 }).toBe('140');
    const prof2 = (await fsGet(`users/${uid}`)).fields.consents.mapValue.fields.hrCloud.mapValue.fields;
    expect(prof2.granted.booleanValue).toBe(true);
    await page.uncheck('#accHr');
    await expect.poll(async () => (await fsGet(`users/${uid}`)).fields.consents.mapValue.fields.hrCloud.mapValue.fields.granted.booleanValue).toBe(false);
  });

  test('un secondo dispositivo scarica e unisce senza perdere i dati locali; il lavoro offline resta in coda e parte al ritorno della rete', async ({ page, context }) => {
    const mine = { t: 1700500000000, dur: 900, km: 7, avgW: 150, kj: 135 };
    await setup(page, { config: true, emulator: true, storage: { rideHistory: JSON.stringify([mine]), 'account:session': '0' } });
    await page.click('#openSettings');
    await page.fill('#accEmail', email); await page.fill('#accPass', 'password-di-prova-1');
    await page.click('[data-act=signin]');
    await expect(page.locator('#accSync')).toHaveText('Sincronizzato', { timeout: 15_000 });
    const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('rideHistory')));
    expect(hist.map((h) => h.t)).toEqual([1700000000000, 1700500000000]); // remota scaricata + locale conservata
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('customWorkouts')))[0].id).toBe('my-1');
    expect(await page.evaluate(() => localStorage.getItem('ftp'))).toBe('230');
    expect(await page.evaluate(() => localStorage.getItem('hordeBest'))).toBe('777');
    expect((await fsGet(`users/${uid}/rides/${mine.t}`)).fields.dur.integerValue).toBe('900'); // la locale è salita

    // offline: una nuova uscita resta "in attesa"
    await context.setOffline(true);
    await page.evaluate((r) => {
      const h = JSON.parse(localStorage.getItem('rideHistory')); h.push(r); localStorage.setItem('rideHistory', JSON.stringify(h));
    }, { t: 1700900000000, dur: 600, km: 4, avgW: 120, kj: 72 });
    await page.evaluate(async () => { (await import('/js/account/index.js')).dataChanged('rides', '1700900000000'); });
    await expect(page.locator('#accSync')).toContainText('in attesa');
    await context.setOffline(false);
    await page.click('[data-act=syncNow]');
    await expect(page.locator('#accSync')).toHaveText('Sincronizzato', { timeout: 15_000 });
    expect((await fsGet(`users/${uid}/rides/1700900000000`))).not.toBeNull();
  });

  test('elimina account: conferma esplicita, nuovo accesso, chiamata a deleteAccount, tornati allo stato di partenza', async ({ page }) => {
    await setup(page, { config: true, emulator: true });
    await page.route('**/deleteAccount', (route) => route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"result":{"ok":true}}' }));
    await page.click('#openSettings');
    await page.fill('#accEmail', email); await page.fill('#accPass', 'password-di-prova-1');
    await page.click('[data-act=signin]');
    await expect(page.locator('[data-act=askDelete]')).toBeVisible({ timeout: 15_000 });
    await page.click('[data-act=askDelete]');
    const dialogs = [];
    // 1ª domanda (eliminare l'account): sì. 2ª (cancellare anche i dati locali): no, i dati sul dispositivo restano
    page.on('dialog', (d) => { dialogs.push(d.message()); (/dispositivo/.test(d.message()) ? d.dismiss() : d.accept()).catch(() => {}); });
    await page.fill('#accDelPass', 'password-di-prova-1');
    const call = page.waitForRequest('**/deleteAccount');
    await page.click('[data-act=doDelete]');
    await call;
    await expect(page.locator('[data-act=google]')).toBeVisible({ timeout: 10_000 });
    expect(dialogs).toHaveLength(2);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sync:')))).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('ftp'))).toBe('230'); // i dati locali non si toccano
  });
});
