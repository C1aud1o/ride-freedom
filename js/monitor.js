// Monitoraggio rispettoso della privacy (docs/PIANO-LANCIO.md §6).
//  - Sentry: errori JavaScript, solo se SENTRY_DSN è impostato. Senza consenso (legittimo interesse), ma senza dati personali.
//  - GoatCounter: statistiche anonime senza cookie, SOLO con consenso dell'utente e se GOATCOUNTER_URL è impostato.
// Con le costanti vuote (default nel repo) non viene caricato né inviato nulla.
import { SENTRY_DSN, GOATCOUNTER_URL } from './config.js';

const SENTRY_SDK = 'https://browser.sentry-cdn.com/8.55.0/bundle.min.js';
const GC_SCRIPT = 'https://gc.zgo.at/count.js';

// ---- consenso: '1' sì, '0' no, assente = non ancora chiesto ----
export function consent() { try { return localStorage.getItem('analytics'); } catch { return null; } }
export const consentAsked = () => consent() !== null;
export const consentGiven = () => consent() === '1';
export function setConsent(yes) {
  try { localStorage.setItem('analytics', yes ? '1' : '0'); } catch { /* storage non disponibile */ }
  if (yes) loadGoatCounter(); else { queue.length = 0; }
}

const queue = [];
let gcState = 'idle'; // idle | loading | ready
function loadGoatCounter() {
  if (gcState !== 'idle' || !GOATCOUNTER_URL || !consentGiven()) return;
  gcState = 'loading';
  window.goatcounter = { no_onload: true, no_events: true, endpoint: GOATCOUNTER_URL };
  const s = document.createElement('script');
  s.async = true; s.src = GC_SCRIPT; s.dataset.goatcounter = GOATCOUNTER_URL;
  s.onload = () => { gcState = 'ready'; flush(); };
  s.onerror = () => { gcState = 'idle'; queue.length = 0; };
  document.head.append(s);
}
function flush() {
  while (queue.length && gcState === 'ready' && consentGiven()) {
    try { window.goatcounter.count(queue.shift()); } catch { /* le statistiche non devono mai rompere l'app */ }
  }
}

// Evento anonimo: nome corto + dettaglio facoltativo (es. nome del gioco, protocollo, lingua). Mai dati personali.
export function track(name, detail) {
  if (!GOATCOUNTER_URL || !consentGiven()) return;
  const path = detail ? `${name}/${String(detail).slice(0, 40)}` : name;
  queue.push({ path, title: path, event: true });
  if (gcState === 'idle') loadGoatCounter(); else flush();
}

// ---- Sentry ----
// Toglie tutto ciò che può identificare: query string e hash degli URL, nomi dei dispositivi, localStorage.
export function scrubEvent(event) {
  const clean = (u) => (typeof u === 'string' ? u.split(/[?#]/)[0] : u);
  if (event.request) {
    event.request.url = clean(event.request.url);
    delete event.request.query_string; delete event.request.cookies; delete event.request.headers; delete event.request.env;
  }
  delete event.user; delete event.server_name;
  if (event.contexts) { delete event.contexts.device; delete event.contexts.storage; }
  for (const b of event.breadcrumbs || []) {
    if (b.data) { for (const k of ['url', 'from', 'to']) if (b.data[k]) b.data[k] = clean(b.data[k]); }
    if (typeof b.message === 'string' && /localStorage|device|name=/i.test(b.message)) b.message = '[rimosso]';
  }
  return event;
}

function loadSentry({ release, environment }) {
  if (!SENTRY_DSN) return;
  const s = document.createElement('script');
  s.async = true; s.src = SENTRY_SDK; s.crossOrigin = 'anonymous';
  s.onload = () => {
    try {
      window.Sentry.init({
        dsn: SENTRY_DSN, release, environment,
        sendDefaultPii: false, // niente IP, niente cookie, niente utente
        defaultIntegrations: false,
        integrations: [window.Sentry.globalHandlersIntegration(), window.Sentry.linkedErrorsIntegration(), window.Sentry.dedupeIntegration()],
        beforeSend: scrubEvent,
        beforeBreadcrumb: (b) => (b.category === 'console' ? null : b),
      });
    } catch { /* il monitoraggio non deve mai rompere l'app */ }
  };
  document.head.append(s);
}

export function initMonitoring({ release, environment, lang }) {
  loadSentry({ release, environment });
  if (consentGiven()) {
    loadGoatCounter();
    track('app-open');
    if (lang) track('lang', lang);
  }
}
