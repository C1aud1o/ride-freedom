// Piani di allenamento: scheda "Piani" nel pannello Allenamenti, card nella home e promemoria.
// La logica sta in plans.js (pura). Qui: schermo, localStorage e notifiche locali (solo app Android).
import { t, fmtDate } from './i18n.js';
import { LocalNotifications } from './native.js';
import * as P from './plans.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const REMIND_KEY = 'planRemind'; // { on: boolean, time: "HH:MM" }

let ctx = null; // { allWorkouts, startWorkout, toast, isNative, onChange }
let selected = null;

export const remindSettings = () => {
  try { const r = JSON.parse(localStorage.getItem(REMIND_KEY) || 'null'); if (r && /^\d{1,2}:\d{2}$/.test(r.time)) return { on: !!r.on, time: r.time }; } catch { /* vuoto */ }
  return { on: true, time: '18:00' };
};
const saveRemind = (r) => { try { localStorage.setItem(REMIND_KEY, JSON.stringify(r)); } catch { /* pieno */ } };
const today = () => P.dayNum();
const wkOf = (id) => ctx.allWorkouts().find((w) => w.id === id);
const wkName = (id) => wkOf(id)?.name || id;
const dayLabel = (day) => fmtDate(P.dayDate(day), { weekday: 'short', day: 'numeric', month: 'short' });
const when = (s) => (s.status === 'today' ? t('plans.today') : s.status === 'late' ? t('plans.late', { day: dayLabel(s.day) }) : dayLabel(s.day));

function setPlan(state) {
  P.savePlan(state); ctx.onChange?.(); syncReminders(); renderHome(); if (!$('wkPanePlans').hidden) renderPane();
}

// ---------- card nella home ----------
const ICON = { done: '✓', skipped: '⏭', missed: '✗', today: '●', late: '●', future: '○' };
export function renderHome(riding = false) {
  const el = $('planCard'); if (!el) return;
  const state = P.loadPlan();
  if (!state || riding) { el.hidden = true; return; }
  const pr = P.progress(state, today()); const plan = P.planById(state.id);
  el.hidden = false;
  const due = P.due(state, today());
  let body;
  if (!pr.started) body = `<p class="pl-today">${t('plans.startsOn', { day: dayLabel(state.start) })}</p>`;
  else if (pr.finished) body = `<p class="pl-today">${t('plans.finished')}</p><button class="ghost" id="plDrop">${t('plans.close')}</button>`;
  else if (!due.length) {
    const n = P.nextSession(state, today());
    body = `<p class="pl-today">${t('plans.rest')}${n ? ` ${t('plans.next', { name: esc(wkName(n.wk)), day: dayLabel(n.day) })}` : ''}</p>`;
  } else {
    body = `<ul class="pl-due">${due.map((s, k) => `<li data-key="${s.key}">
      <span class="pl-when">${k === 0 && s.status === 'today' ? t('plans.todayIs', { name: `<b>${esc(wkName(s.wk))}</b>` }) : `${when(s)}: <b>${esc(wkName(s.wk))}</b>`}</span>
      <small>${esc(wkOf(s.wk)?.tag || '')}</small>
      <span class="pl-act"><button class="cta-sm" data-pl-start="${s.wk}" data-key="${s.key}">${t('plans.start')}</button><button class="link" data-pl-move="${s.key}">${t('plans.moveTomorrow')}</button><button class="link" data-pl-skip="${s.key}">${t('plans.skip')}</button></span></li>`).join('')}</ul>`;
  }
  const label = { done: t('plans.st.done'), skipped: t('plans.st.skipped'), missed: t('plans.st.missed'), today: t('plans.st.today'), late: t('plans.st.late'), future: t('plans.st.future') };
  el.innerHTML = `<h2>${t('plans.homeTitle', { name: esc(t(`plans.${plan.id}.name`)) })}</h2>
    <small class="pl-sub">${pr.started ? t('plans.progress', { week: pr.week, weeks: pr.weeks, done: pr.done, total: pr.total }) : ''}${pr.deload ? ` · ${t('plans.deload')}` : ''}</small>
    ${body}
    ${pr.started ? `<ul class="pl-week" aria-label="${t('plans.thisWeek')}">${pr.inWeek.map((s) => `<li class="${s.status}" aria-label="${esc(`${wkName(s.wk)}, ${dayLabel(s.day)}: ${label[s.status]}`)}"><span class="pl-ico" aria-hidden="true">${ICON[s.status]}</span><span>${dayLabel(s.day)}</span><small>${esc(wkName(s.wk))}</small></li>`).join('')}</ul>` : ''}`;
  el.querySelectorAll('[data-pl-start]').forEach((b) => b.addEventListener('click', () => { const w = wkOf(b.dataset.plStart); if (w) ctx.startWorkout(w); }));
  el.querySelectorAll('[data-pl-move]').forEach((b) => b.addEventListener('click', () => {
    const st = P.loadPlan(); setPlan(P.move(st, b.dataset.plMove, today() + 1, today())); ctx.toast(t('plans.moved'));
  }));
  el.querySelectorAll('[data-pl-skip]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm(t('plans.confirmSkip'))) return;
    setPlan(P.skip(P.loadPlan(), b.dataset.plSkip)); ctx.toast(t('plans.skipped'));
  }));
  $('plDrop')?.addEventListener('click', () => setPlan(null));
}

// ---------- fine di un allenamento ----------
// Chiamata dall'app quando un allenamento finisce. Se era in programma nel piano: segno di spunta e messaggio.
export function onWorkoutDone(workoutId) {
  const state = P.loadPlan(); if (!state) return null;
  const r = P.complete(state, workoutId, today()); if (!r) return null;
  P.savePlan(r.state); ctx.onChange?.(); syncReminders(); renderHome(); if (!$('wkPanePlans').hidden) renderPane();
  const pr = P.progress(r.state, today());
  ctx.toast(pr.finished ? t('plans.doneAll') : pr.weekDone === pr.weekTotal ? t('plans.doneWeek', { week: pr.week, weeks: pr.weeks }) : t('plans.doneOne', { done: pr.done, total: pr.total, week: pr.week, weeks: pr.weeks }));
  return r.session;
}

// ---------- scheda "Piani" ----------
const planDesc = (p) => t('plans.meta', { weeks: p.weeks.length, perWeek: p.perWeek });
export function renderPane() {
  const el = $('wkPanePlans'); const state = P.loadPlan();
  if (state) {
    const plan = P.planById(state.id); const pr = P.progress(state, today());
    const rs = remindSettings();
    const all = P.withStatus(state, today());
    el.innerHTML = `<div class="pl-active"><h3>${esc(t(`plans.${plan.id}.name`))}</h3>
      <p class="fine">${pr.started ? t('plans.progress', { week: pr.week, weeks: pr.weeks, done: pr.done, total: pr.total }) : t('plans.startsOn', { day: dayLabel(state.start) })}</p>
      ${reminderControls(rs)}
      <details class="pl-all"><summary>${t('plans.allSessions')}</summary>${plan.weeks.map((_, w) => `<h4>${t('plans.weekN', { n: w + 1 })}${plan.deload.includes(w + 1) ? ` · ${t('plans.deload')}` : ''}</h4><ul class="pl-list">${all.filter((s) => s.w === w).map((s) => `<li class="${s.status}"><span class="pl-ico" aria-hidden="true">${ICON[s.status]}</span><span>${dayLabel(s.day)}</span><b>${esc(wkName(s.wk))}</b></li>`).join('')}</ul>`).join('')}</details>
      <button class="ghost danger" id="planAbandon">${t('plans.abandon')}</button></div>`;
    $('planAbandon').addEventListener('click', () => { if (confirm(t('plans.confirmAbandon'))) setPlan(null); });
    bindReminderControls(el);
    return;
  }
  const start = P.inputFromDay(today());
  el.innerHTML = `<p class="fine">${t('plans.intro')}</p>
    <div class="pl-choices" role="radiogroup" aria-label="${t('plans.tab')}">${P.PLANS.map((p) => `<button class="wk-item pl-choice${selected === p.id ? ' on' : ''}" role="radio" aria-checked="${selected === p.id}" data-plan="${p.id}">
      <span class="row"><b>${esc(t(`plans.${p.id}.name`))}</b><small>${planDesc(p)}</small></span><small>${esc(t(`plans.${p.id}.desc`))}</small></button>`).join('')}</div>
    <label class="pl-date">${t('plans.startDay')}<input id="planStartDay" type="date" value="${start}" min="${start}"></label>
    ${reminderControls(remindSettings())}
    <button class="cta-sm pl-go" id="planStart"${selected ? '' : ' disabled'}>${t('plans.begin')}</button>`;
  el.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => { selected = b.dataset.plan; renderPane(); }));
  $('planStart').addEventListener('click', async () => {
    const day = P.dayFromInput($('planStartDay').value) ?? today();
    const st = P.startPlan(selected, Math.max(day, today())); if (!st) return;
    selected = null; setPlan(st);
    if (remindSettings().on && ctx.isNative) await askPermission();
    ctx.toast(t('plans.started'));
  });
  bindReminderControls(el);
}

// su web niente notifiche: il promemoria è la card in home
function reminderControls(rs) {
  if (!ctx.isNative) return `<p class="fine pl-web">${t('plans.webReminder')}</p>`;
  return `<div class="pl-remind"><label><input type="checkbox" id="plRemindOn"${rs.on ? ' checked' : ''}> ${t('plans.remind')}</label><label class="pl-time">${t('plans.remindAt')} <input type="time" id="plRemindTime" value="${rs.time.padStart(5, '0')}"></label></div>`;
}
function bindReminderControls(el) {
  const on = el.querySelector('#plRemindOn'); const time = el.querySelector('#plRemindTime'); if (!on) return;
  const save = async () => {
    saveRemind({ on: on.checked, time: time.value || '18:00' });
    if (on.checked && !(await askPermission())) { on.checked = false; saveRemind({ on: false, time: time.value || '18:00' }); ctx.toast(t('plans.noPermission')); }
    syncReminders();
  };
  on.addEventListener('change', save); time.addEventListener('change', save);
}

// ---------- promemoria (notifiche locali, app Android) ----------
async function askPermission() {
  if (!LocalNotifications) return false;
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch { return false; }
}
let syncing = Promise.resolve();
// rifà da zero le notifiche del piano: cancella le vecchie e programma le prossime. Senza piano o con promemoria spento resta solo la cancellazione.
export function syncReminders() {
  if (!LocalNotifications) return syncing;
  syncing = syncing.then(async () => {
    try {
      await LocalNotifications.cancel({ notifications: Array.from({ length: P.REMIND_MAX }, (_, i) => ({ id: P.REMIND_BASE_ID + i })) });
      const rs = remindSettings(); const state = P.loadPlan();
      if (!rs.on || !state) return;
      const list = P.reminders(state, rs.time);
      if (!list.length || (await LocalNotifications.checkPermissions()).display !== 'granted') return;
      await LocalNotifications.schedule({ notifications: list.map((r) => ({
        id: r.id, title: t('plans.notif.title'), body: t('plans.notif.body', { name: wkName(r.wk) }), schedule: { at: r.at, allowWhileIdle: true },
      })) });
    } catch { /* senza notifiche l'app funziona lo stesso */ }
  });
  return syncing;
}

// ---------- avvio ----------
export function initPlans(c) {
  ctx = c;
  const tabs = { main: $('tabWk'), plans: $('tabPlans') };
  const show = (which) => {
    $('wkPaneMain').hidden = which !== 'main'; $('wkPanePlans').hidden = which !== 'plans';
    for (const [k, b] of Object.entries(tabs)) { b.classList.toggle('on', k === which); b.setAttribute('aria-selected', String(k === which)); }
    if (which === 'plans') renderPane();
  };
  tabs.main.addEventListener('click', () => show('main'));
  tabs.plans.addEventListener('click', () => show('plans'));
  syncReminders();
  return { show, renderHome, renderPane, onWorkoutDone };
}
