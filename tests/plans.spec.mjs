// R1: piani di allenamento. La logica (js/plans.js) si prova direttamente; la home e la scheda "Piani" con il browser.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import * as P from '../js/plans.js';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));
const D0 = P.dayNum(new Date(2026, 10, 9)); // lunedì 9 novembre 2026

test('i piani: 4 piani, durate e settimane come promesso', () => {
  const by = Object.fromEntries(P.PLANS.map((p) => [p.id, p]));
  expect(Object.keys(by).sort()).toEqual(['fondoinv', 'piuftp', 'primipassi', 'ritorno']);
  expect([by.primipassi, by.piuftp, by.fondoinv, by.ritorno].map((p) => p.weeks.length)).toEqual([3, 6, 8, 4]);
  expect(by.primipassi.weeks.every((w) => w.length === 3)).toBe(true);
  expect(by.piuftp.weeks.every((w) => w.length === 3 || w.length === 4)).toBe(true);
  // niente due uscite nello stesso giorno e giorni dentro la settimana
  for (const p of P.PLANS) for (const w of p.weeks) { const d = w.map((x) => x.d); expect(new Set(d).size).toBe(d.length); expect(Math.max(...d)).toBeLessThan(7); }
});

test('piano: scelta e giorno di partenza → oggi c\'è l\'allenamento giusto', () => {
  const st = P.startPlan('primipassi', D0);
  expect(P.due(st, D0 - 1)).toEqual([]);                       // prima della partenza
  expect(P.due(st, D0).map((s) => s.wk)).toEqual(['facile']);   // 1° giorno
  expect(P.due(st, D0 + 1)).toEqual([P.due(st, D0 + 1)[0]].filter((s) => s.status === 'late')); // ieri non fatta: da recuperare
  expect(P.due(st, D0 + 2).map((s) => s.wk)).toEqual(['ramp', 'facile']); // oggi prima, poi il recupero
  expect(P.nextSession(st, D0).wk).toBe('ramp');
  expect(P.progress(st, D0)).toMatchObject({ total: 9, done: 0, week: 1, weeks: 3, weekTotal: 3 });
});

test('piano: completare segna la giornata solo se era in programma', () => {
  const st = P.startPlan('primipassi', D0);
  expect(P.complete(st, 'costante', D0)).toBeNull();            // non è l'allenamento di oggi
  const r = P.complete(st, 'facile', D0);
  expect(r.session.key).toBe('0.0');
  expect(P.due(r.state, D0)).toEqual([]);
  expect(P.progress(r.state, D0)).toMatchObject({ done: 1, weekDone: 1 });
  expect(P.complete(r.state, 'facile', D0)).toBeNull();         // non si conta due volte
});

test('piano: recupero entro 2 giorni, poi l\'uscita è persa', () => {
  const st = P.startPlan('primipassi', D0);
  expect(P.withStatus(st, D0 + 2)[0].status).toBe('late');
  expect(P.complete(st, 'facile', D0 + 2).state.done['0.0']).toBe(D0 + 2);
  expect(P.withStatus(st, D0 + 3)[0].status).toBe('missed');
  expect(P.complete(st, 'facile', D0 + 3)).toBeNull();
});

test('piano: spostare e saltare', () => {
  let st = P.startPlan('primipassi', D0);
  st = P.move(st, '0.0', D0 + 1, D0);
  expect(P.due(st, D0)).toEqual([]);
  expect(P.due(st, D0 + 1).map((s) => s.key)).toEqual(['0.0']);
  expect(P.move(st, '0.0', D0 - 1, D0)).toBe(st);              // non si sposta nel passato
  st = P.skip(P.startPlan('primipassi', D0), '0.0');
  expect(P.due(st, D0)).toEqual([]);
  expect(P.progress(st, D0).done).toBe(0);
  expect(P.due(P.move(st, '0.0', D0, D0), D0).length).toBe(1);  // una saltata si può rimettere
});

test('piano: fine del piano e promemoria', () => {
  let st = P.startPlan('primipassi', D0);
  for (const s of P.sessionsOf(st)) st = { ...st, done: { ...st.done, [s.key]: s.day } };
  expect(P.progress(st, D0 + 14).finished).toBe(true);
  const st2 = P.startPlan('primipassi', D0);
  const r = P.reminders(st2, '18:30', new Date(2026, 10, 9, 19, 0)); // oggi alle 18:30 è già passato
  expect(r.length).toBe(8);
  expect(r[0].at.getDate()).toBe(11); expect(r[0].at.getHours()).toBe(18); expect(r[0].at.getMinutes()).toBe(30);
  expect(new Set(r.map((x) => x.id)).size).toBe(8);
  expect(P.reminders(st2, '18:30', new Date(2026, 10, 9, 9, 0)).length).toBe(9);
  expect(P.reminders(st2, 'xx')).toEqual([]);
});

test.describe('interfaccia', () => {
  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    await page.addInitScript(() => {
      try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); localStorage.setItem('analytics', '0'); localStorage.setItem('ftp', '200'); localStorage.setItem('mass', '80'); localStorage.setItem('lang', 'it'); } } catch { /* niente storage */ }
    });
    await page.addInitScript({ path: FAKE_BLE });
    await page.goto('/index.html');
  });
  test.afterEach(({ page }) => { expect(page.errors, 'errori JavaScript non gestiti').toEqual([]); });

  async function choosePlan(page, id = 'primipassi') {
    await page.click('#openWorkouts');
    await page.click('#tabPlans');
    await page.click(`[data-plan="${id}"]`);
    await page.click('#planStart');
  }

  test('scelgo un piano: la home mostra "Oggi" e Avvia parte con l\'allenamento giusto', async ({ page }) => {
    await choosePlan(page);
    await page.click('[data-close="workoutSheet"]');
    const card = page.locator('#planCard');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Oggi: Giro facile');
    await expect(card).toContainText('Settimana 1 di 3');
    await expect(card.locator('.pl-week li')).toHaveCount(3);
    await card.locator('[data-pl-start]').click();
    await expect(page.locator('#workoutCard')).toBeVisible();
    await expect(page.locator('#wkName')).toHaveText('Giro facile');
  });

  test('fine allenamento del giorno: spunta nella settimana e messaggio di progresso', async ({ page }) => {
    await choosePlan(page);
    await page.click('[data-close="workoutSheet"]');
    const msg = await page.evaluate(async () => { const m = await import('/js/plans-ui.js'); return m.onWorkoutDone('facile')?.key; });
    expect(msg).toBe('0.0');
    await expect(page.locator('#planCard .pl-week li.done')).toHaveCount(1);
    await expect(page.locator('#planCard')).toContainText('Oggi si riposa');
    await expect(page.locator('#toast, .toast').first()).toContainText('Uscita del piano fatta! 1 su 9');
    // un allenamento che non è nel piano non cambia nulla
    expect(await page.evaluate(async () => (await import('/js/plans-ui.js')).onWorkoutDone('vo2'))).toBeNull();
  });

  test('sposto a domani e salto; poi abbandono il piano', async ({ page }) => {
    await choosePlan(page);
    await page.click('[data-close="workoutSheet"]');
    await page.click('[data-pl-move]');
    await expect(page.locator('#planCard')).toContainText('Oggi si riposa');
    await expect(page.locator('#planCard')).toContainText('Prossima: Giro facile');
    await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('plan')); p.moved = {}; localStorage.setItem('plan', JSON.stringify(p)); });
    await page.reload();
    page.once('dialog', (d) => d.accept());
    await page.click('[data-pl-skip]');
    await expect(page.locator('#planCard .pl-week li.skipped')).toHaveCount(1);
    await page.click('#openWorkouts'); await page.click('#tabPlans');
    page.once('dialog', (d) => d.accept());
    await page.click('#planAbandon');
    await expect(page.locator('#planCard')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('plan'))).toBeNull();
  });
});
