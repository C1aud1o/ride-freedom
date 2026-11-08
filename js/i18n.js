// Internazionalizzazione minuscola, senza librerie.
//   t('chiave', { nome: 'x' })        → interpolazione {nome}
//   t('chiave', { count: 3 })         → plurali: chiave.one / chiave.other (Intl.PluralRules)
// Fallback: lingua scelta → en → it → la chiave stessa.
// I dizionari (locales/*.json) si caricano con un top-level await: chi importa questo modulo li trova già pronti.

// Lingue disponibili: il selettore nelle Impostazioni si popola da qui.
export const LANGS = { it: 'Italiano', en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch' };
const BASE = 'en';
const FALLBACKS = ['en', 'it'];
const dicts = {};
let lang = BASE;
const hasWindow = typeof window !== 'undefined' && typeof document !== 'undefined';

function stored() { try { return localStorage.getItem('lang'); } catch { return null; } }
export function detectLang() {
  const s = stored();
  if (s && LANGS[s]) return s;
  const prefs = (typeof navigator !== 'undefined' && (navigator.languages?.length ? navigator.languages : [navigator.language])) || [];
  for (const p of prefs) { const base = String(p || '').toLowerCase().split('-')[0]; if (LANGS[base]) return base; }
  return BASE;
}

async function load(l) {
  if (dicts[l]) return;
  try {
    const res = await fetch(new URL(`../locales/${l}.json`, import.meta.url));
    dicts[l] = res.ok ? await res.json() : {};
  } catch { dicts[l] = {}; }
}

const rules = {};
function plural(n) { try { return (rules[lang] ||= new Intl.PluralRules(lang)).select(n); } catch { return n === 1 ? 'one' : 'other'; } }

function lookup(key, count) {
  for (const l of [lang, ...FALLBACKS]) {
    const d = dicts[l]; if (!d) continue;
    if (count != null) {
      const form = l === lang ? plural(count) : (count === 1 ? 'one' : 'other');
      const v = d[`${key}.${form}`] ?? d[`${key}.other`];
      if (v != null) return v;
    }
    if (d[key] != null) return d[key];
  }
  return null;
}

export function t(key, params) {
  const s = lookup(key, params?.count);
  if (s == null) return key;
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m)) : s;
}
export const has = (key) => lookup(key) != null;
export const getLang = () => lang;

// ---- numeri e date secondo la lingua (le unità restano metriche) ----
// TODO(miglia): aggiungere una preferenza km/mi e convertire distanza, velocità e dislivello.
export function fmtNum(n, opts) { return new Intl.NumberFormat(lang, opts).format(n); }
export function fmtDec(n, digits = 1) { return fmtNum(n, { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
export function fmtDate(d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) { return new Intl.DateTimeFormat(lang, opts).format(d); }
export const fmtTimeOfDay = (d = new Date()) => new Intl.DateTimeFormat(lang, { timeStyle: 'medium' }).format(d);
// "tra 3 giorni" / "ieri" ecc. non servono: i testi relativi hanno chiavi proprie.
// 1°, 2°… / 1st, 2nd… : le forme (one/two/few/other) e i testi stanno in locales/*.json (chiavi ordinal.*)
export function ordinal(n) {
  let form = 'other';
  try { form = new Intl.PluralRules(lang, { type: 'ordinal' }).select(n); } catch { /* resta other */ }
  return t(has(`ordinal.${form}`) ? `ordinal.${form}` : 'ordinal.other', { n });
}
export function speechLang() { return { it: 'it-IT', en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[lang] || lang; }

// ---- HTML statico ----
//   data-i18n="k"  data-i18n-html="k"  data-i18n-attr="placeholder:k;aria-label:k2"
export function applyI18n(root = document) {
  if (!hasWindow) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const i = pair.indexOf(':'); if (i < 0) continue;
      el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
    }
  });
}

export async function setLang(l) {
  if (!LANGS[l]) return;
  try { localStorage.setItem('lang', l); } catch { /* storage non disponibile */ }
  lang = l;
  await Promise.all([l, ...FALLBACKS].map(load));
  if (hasWindow) {
    document.documentElement.lang = l;
    applyI18n();
    window.dispatchEvent(new CustomEvent('langchange', { detail: l }));
  }
}

export async function initI18n() {
  lang = detectLang();
  await Promise.all([lang, ...FALLBACKS].map(load));
  if (hasWindow) { document.documentElement.lang = lang; applyI18n(); }
}
await initI18n();
