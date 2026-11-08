// Traduzioni: con la lingua inglese non deve restare testo italiano visibile; il cambio lingua funziona al volo.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));

// parole italiane comuni che non esistono (o non servono) in inglese
const ITALIAN = [
  'Impostazioni', 'Avvia', 'Pausa', 'marcia', 'Marcia', 'Allenament', 'Giochi', 'Cadenza', 'Velocità', 'Battito', 'Potenza media',
  'Termina', 'Collega', 'Rullo', 'Storico', 'Pendenza', 'Salva', 'Chiudi', 'Mancano', 'Obiettivo', 'Schermo intero', 'Lingua',
  'Misuratore', 'Musica', 'Diagnostica', 'Esporta', 'Importa', 'Segnala', 'non collegato', 'spento', 'Scegli', 'Esci',
];

async function open(page, lang) {
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((l) => { try { if (!localStorage.getItem('lang')) localStorage.setItem('lang', l); } catch { /* */ } }, lang);
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
  await expect(page.locator('#startStop')).not.toBeEmpty();
}
// testo visibile di un contenitore (niente nodi nascosti, niente blocchi dev-only)
const visibleText = (page, sel) => page.locator(sel).evaluate((root) => {
  const out = [];
  const walk = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.hidden || el.classList.contains('dev-only')) return;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) out.push(t); } else if (n.nodeType === 1) walk(n);
    }
    for (const a of ['aria-label', 'placeholder']) { const v = el.getAttribute?.(a); if (v) out.push(v); }
  };
  walk(root);
  return out.join('\n');
});
function expectNoItalian(text, where) {
  const found = ITALIAN.filter((w) => text.includes(w));
  expect(found, `parole italiane visibili in ${where}`).toEqual([]);
}

test.afterEach(async ({ page }) => { expect(page.errors ?? [], 'errori JavaScript').toEqual([]); });

test('in inglese la home non mostra testo italiano', async ({ page }) => {
  await open(page, 'en');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  await expect(page.locator('#startStop')).toHaveText('Start');
  await expect(page.locator('#openSettings')).toHaveAttribute('aria-label', 'Settings');
  expectNoItalian(await visibleText(page, 'body'), 'la home');
});

test('in inglese le impostazioni, i giochi e gli allenamenti non mostrano testo italiano', async ({ page }) => {
  await open(page, 'en');
  await page.click('#openSettings');
  await expect(page.locator('#settingsTitle')).toHaveText('Settings');
  expectNoItalian(await visibleText(page, '#settingsSheet'), 'le impostazioni');
  await page.click('[data-close="settingsSheet"]');

  await page.click('#openGame');
  await expect(page.locator('#gameMenu')).toBeVisible();
  expectNoItalian(await visibleText(page, '#gameMenu'), 'il menu dei giochi');
  await page.click('#closeGame');

  await page.click('#openWorkouts');
  await expect(page.locator('#workoutList [data-wk]').first()).toBeVisible();
  expectNoItalian(await visibleText(page, '#workoutSheet'), 'gli allenamenti');
});

test('in inglese anche fine allenamento e benvenuto sono tradotti', async ({ page }) => {
  await open(page, 'en');
  await expect(page.locator('#welcome')).toContainText('Ready to ride?');
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
  await page.click('#startStop');
  await expect(page.locator('#startStop')).toHaveText('Pause');
  await expect(page.locator('#finishRide')).toBeEnabled();
  await page.click('#finishRide');
  await expect(page.locator('#finishSheet')).toBeVisible();
  await expect(page.locator('#finishSummary')).toContainText('Avg W');
  expectNoItalian(await visibleText(page, '#finishSheet'), 'la schermata di fine allenamento');
});

test('il selettore lingua cambia testi e lingua al volo, e si ricorda', async ({ page }) => {
  await open(page, 'en');
  await page.click('#openSettings');
  const options = await page.$$eval('#langSelect option', (o) => o.map((x) => x.value));
  expect(options).toEqual(expect.arrayContaining(['it', 'en']));
  await page.selectOption('#langSelect', 'it');
  await expect(page.locator('#settingsTitle')).toHaveText('Impostazioni');
  await expect(page.locator('#startStop')).toHaveText('Avvia');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('it');
  expect(await page.evaluate(() => localStorage.getItem('lang'))).toBe('it');
  await page.selectOption('#langSelect', 'en');
  await expect(page.locator('#settingsTitle')).toHaveText('Settings');
  await page.reload();
  await expect(page.locator('#startStop')).toHaveText('Start');
});

test('senza scelta salvata la lingua segue quella del browser', async ({ browser }) => {
  for (const [locale, start] of [['it-IT', 'Avvia'], ['en-GB', 'Start'], ['de-DE', 'Start']]) {
    const ctx = await browser.newContext({ locale, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.goto('/index.html');
    await expect(page.locator('#startStop')).toHaveText(start);
    await ctx.close();
  }
});

test('numeri e date seguono la lingua', async ({ page }) => {
  await open(page, 'en');
  const r = await page.evaluate(async () => {
    const m = await import('/js/i18n.js');
    return { dec: m.fmtDec(1.5, 1), date: m.fmtDate(new Date(2026, 0, 15)), ord: [1, 2, 3, 4, 11, 22].map(m.ordinal), plural: [1, 2].map((n) => m.t('time.daysAgo', { count: n })) };
  });
  expect(r.dec).toBe('1.5');
  expect(r.date).toContain('January');
  expect(r.ord).toEqual(['1st', '2nd', '3rd', '4th', '11th', '22nd']);
  expect(r.plural).toEqual(['1 day ago', '2 days ago']);
  await page.evaluate(() => import('/js/i18n.js').then((m) => m.setLang('it')));
  const it = await page.evaluate(async () => { const m = await import('/js/i18n.js'); return { dec: m.fmtDec(1.5, 1), ord: m.ordinal(3), plural: [1, 2].map((n) => m.t('time.daysAgo', { count: n })) }; });
  expect(it.dec).toBe('1,5');
  expect(it.ord).toBe('3°');
  expect(it.plural).toEqual(['1 giorno fa', '2 giorni fa']);
});

test('il coach parla nella lingua scelta', async ({ page }) => {
  await page.addInitScript(() => {
    window.__spoken = [];
    const ss = window.speechSynthesis;
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], cancel() {}, speak: (u) => window.__spoken.push({ text: u.text, lang: u.lang }) }, configurable: true });
    void ss;
  });
  await open(page, 'en');
  await page.click('#openSettings');
  await page.locator('#coachOn').evaluate((el) => el.click());
  await expect.poll(() => page.evaluate(() => window.__spoken.at(-1))).toEqual({ text: expect.stringContaining('coach'), lang: 'en-US' });
  await page.selectOption('#langSelect', 'it');
  await page.locator('#coachOn').evaluate((el) => { el.click(); el.click(); });
  await expect.poll(() => page.evaluate(() => window.__spoken.at(-1))).toEqual({ text: expect.stringContaining('coach'), lang: 'it-IT' });
});
