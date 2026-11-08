#!/usr/bin/env node
// Generatore del sito vetrina Spindro: template + JSON di testi -> site/dist/. Nessuna dipendenza.
//   node site/build.mjs            costruisce site/dist/
//   node site/build.mjs --out dir  scrive altrove (per i test)
// Per aggiungere una lingua: copia site/i18n/en.json in fr.json, traduci e aggiungi "fr" a "langs" in site/config.json.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? resolve(process.argv[outArg + 1]) : join(here, 'dist');

const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));
const cfg = json(join(here, 'config.json'));
const SITE_URL = cfg.siteUrl.replace(/\/$/, '');   // dominio: l'unica costante da cambiare è in config.json
const compat = json(join(here, 'data/compatibility.json'));
const T = Object.fromEntries(cfg.langs.map((l) => [l, json(join(here, `i18n/${l}.json`))]));
const tpl = Object.fromEntries(['base', 'home', 'compat', 'legal', 'notfound'].map((n) => [n, read(join(here, `templates/${n}.html`))]));
const cssVersion = createHash('sha1').update(read(join(here, 'assets/style.css'))).digest('hex').slice(0, 8);

// ---------- utilità ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
/** {{a.b}} = testo con escape, {{{a.b}}} = HTML già pronto. Una chiave mancante è un errore, non una pagina rotta. */
function render(template, ctx) {
  return template
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => { const v = get(ctx, k); if (v == null) throw new Error(`manca ${k}`); return v; })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => { const v = get(ctx, k); if (v == null) throw new Error(`manca ${k}`); return esc(v); });
}
const langPrefix = (l) => (l === cfg.defaultLang ? '' : `/${l}`);
const pageUrl = (l, slug = '') => `${langPrefix(l)}/${slug ? `${slug}/` : ''}`;
const abs = (path) => SITE_URL + path;

// ---------- icone (SVG semplici, 24x24, tratto) ----------
const ICONS = {
  gears: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  modes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  workouts: '<path d="M4 20V13M9 20V8M14 20v-9M19 20V4"/>',
  route: '<path d="M5 19c4 0 3-6 7-6s3-8 7-8"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
  game: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4M16 11h.01M18 14h.01"/>',
  history: '<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/>',
  strava: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  coach: '<path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  app: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
const iconBox = (name) => `<div class="ico">${svg(name)}</div>`;

// ---------- segnaposto o screenshot veri ----------
function imageSize(file) { // legge larghezza e altezza dai primi byte di PNG/JPEG
  const b = readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return [390, 844];
}
function shotHtml(s, t) {
  const file = ['jpg', 'png', 'webp'].map((e) => `${s.k}.${e}`).find((f) => existsSync(join(here, 'assets/shots', f)));
  const fig = file
    ? (([w, h]) => `<img src="/assets/shots/${file}" width="${w}" height="${h}" loading="lazy" decoding="async" alt="${esc(s.c)}">`)(imageSize(join(here, 'assets/shots', file)))
    : `<div class="shot-ph" role="img" aria-label="${esc(s.c)}">${esc(t.home.shotPh)}</div>`;
  return `<figure>${fig}<figcaption>${esc(s.c)}</figcaption></figure>`;
}

// ---------- markdown -> html (solo quello che usano i testi legali) ----------
function inline(s, lang) {
  const parts = String(s).split(/(`[^`]+`)/g);
  return parts.map((p, i) => {
    if (i % 2) return `<code>${esc(p.slice(1, -1))}</code>`;
    let h = esc(p);
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
      const m = href.match(/^(privacy|terms|account-deletion|licenses|trademarks)\.(?:en|it)\.md$/);
      if (m) return `<a href="${pageUrl(lang, m[1])}">${text}</a>`;
      return `<a href="${href}"${/^https?:/.test(href) ? ' rel="noopener"' : ''}>${text}</a>`;
    });
    return h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>');
  }).join('');
}
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function md(src, lang) {
  const lines = src.replace(/\r/g, '').split('\n');
  const html = []; let title = ''; let i = 0;
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      const n = m[1].length; if (n === 1 && !title) title = m[2];
      html.push(`<h${n} id="${slug(m[2])}">${inline(m[2], lang)}</h${n}>`); i++;
    } else if (/^---+\s*$/.test(l)) { html.push('<hr>'); i++; }
    else if (l.startsWith('>')) {
      const q = []; while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote><p>${inline(q.join(' '), lang)}</p></blockquote>`);
    } else if (l.startsWith('|')) {
      const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const head = cells(rows[0]); const body = rows.slice(2).map(cells);
      html.push(`<div class="tablewrap"><table><thead><tr>${head.map((c) => `<th>${inline(c, lang)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c, lang)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l)) {
      const ordered = /^\d+\./.test(l); const re = ordered ? /^\d+\.\s+/ : /^[-*]\s+/; const items = [];
      while (i < lines.length && re.test(lines[i])) {
        let t = lines[i++].replace(re, '');
        while (i < lines.length && lines[i].trim() && /^\s+\S/.test(lines[i]) && !re.test(lines[i])) t += ' ' + lines[i++].trim();
        items.push(`<li>${inline(t, lang)}</li>`);
      }
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
    } else {
      const p = []; while (i < lines.length && lines[i].trim() && !/^(#|>|\||---|[-*]\s|\d+\.\s)/.test(lines[i])) p.push(lines[i++].trim());
      html.push(`<p>${inline(p.join(' '), lang)}</p>`);
    }
  }
  return { html: html.join('\n'), title };
}

// ---------- contesto comune di una pagina ----------
const written = []; // { path, url, alternates, index }
function ctxFor(lang, extra) {
  const t = T[lang];
  const androidLive = cfg.playStoreLive;
  const releases = `${cfg.github}/releases`;
  return {
    ...t, ...extra,
    htmlLang: t.htmlLang, cssVersion,
    homeUrl: pageUrl(lang), compatUrl: pageUrl(lang, 'compatibility'), appUrl: cfg.appPath,
    github: cfg.github, issues: cfg.contactIssues,
    androidUrl: androidLive ? cfg.playStore : cfg.apk,
    androidNote: androidLive
      ? `<a href="${esc(cfg.apk)}" rel="noopener">${esc(t.cta.apk)}</a>`
      : `${esc(t.cta.soon)} · <a href="${esc(releases)}" rel="noopener">${esc(t.cta.apk)}</a>`,
    ogImage: abs('/assets/og.png'), ogAlt: t.og.alt,
    icon: Object.fromEntries(['app', 'download', 'code'].map((n) => [n, svg(n)])),
    legalLinks: cfg.legalPages.map((p) => `<li><a href="${pageUrl(lang, p)}">${esc(t.legalNames[p])}</a></li>`).join(''),
  };
}

function writePage({ lang, slug: pslug = '', tplName, extra, title, description, jsonld = '', index = true, langsAvailable = cfg.langs, file }) {
  const t = T[lang];
  const path = pageUrl(lang, pslug);
  const alternates = langsAvailable.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(pageUrl(l, pslug))}">`);
  if (langsAvailable.includes(cfg.defaultLang)) alternates.push(`<link rel="alternate" hreflang="x-default" href="${abs(pageUrl(cfg.defaultLang, pslug))}">`);
  const langLinks = langsAvailable.filter((l) => l !== lang).map((l) => `<a class="lang" href="${pageUrl(l, pslug)}" hreflang="${l}" lang="${l}" aria-label="${esc(T[l].langName)}" title="${esc(T[l].langName)}">${l.toUpperCase()}</a>`).join('');
  const body = render(tpl[tplName], { ...ctxFor(lang, extra) });
  const ctx = {
    ...ctxFor(lang, extra), title, description, content: body,
    robots: index ? 'index, follow' : 'noindex, follow',
    canonical: abs(path), alternates: alternates.join('\n'), langLinks,
    ogLocaleAlt: langsAvailable.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${T[l].ogLocale}">`).join('\n'),
    compatCurrent: pslug === 'compatibility' ? ' aria-current="page"' : '',
    jsonld,
  };
  const outFile = file || join(out, path, 'index.html');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, render(tpl.base, ctx));
  if (!file) written.push({ path, alternates: langsAvailable.map((l) => [l, pageUrl(l, pslug)]), index });
}

// ---------- costruzione ----------
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(here, 'assets'), join(out, 'assets'), { recursive: true });

const gearbar = Array.from({ length: 24 }, (_, i) => `<i${i < 13 ? ' class="on"' : ''} style="height:${30 + i * 3}%"></i>`).join('');

for (const lang of cfg.langs) {
  const t = T[lang]; const h = t.home;
  const ld = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Spindro: Smart Trainer Cycling', alternateName: 'Spindro',
    description: h.description, applicationCategory: 'HealthApplication', operatingSystem: 'Android, Web (Chrome, Edge)',
    url: abs(pageUrl(lang)), downloadUrl: cfg.apk, inLanguage: lang, isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    image: abs('/assets/og.png'), sameAs: [cfg.github], license: undefined,
  };
  writePage({
    lang, tplName: 'home', title: h.title, description: h.description,
    jsonld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
    extra: {
      gearbar,
      steps: h.steps.map((s) => `<li><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></li>`).join(''),
      features: h.features.map((f) => `<div class="card">${iconBox(f.i)}<h3>${esc(f.t)}</h3><p>${esc(f.d)}</p></div>`).join(''),
      watchPoints: h.watchPoints.map((p) => `<li>${esc(p)}</li>`).join(''),
      clickPoints: h.clickPoints.map((p) => `<li>${esc(p)}</li>`).join(''),
      games: h.games.map((g) => `<div class="card"><h3>${esc(g.t)}</h3><p>${esc(g.d)}</p></div>`).join(''),
      shots: h.shots.map((s) => shotHtml(s, t)).join(''),
      faq: h.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join(''),
    },
  });

  // compatibilità
  const c = t.compat;
  const table = (rows) => `<div class="tablewrap"><table class="ctable"><thead><tr><th scope="col">${esc(c.cols.device)}</th><th scope="col">${esc(c.cols.protocol)}</th><th scope="col">${esc(c.cols.status)}</th><th scope="col">${esc(c.cols.note)}</th></tr></thead><tbody>${rows.map((r) => {
    const reports = r.reports ? ` (${r.reports})` : '';
    return `<tr><td data-l="${esc(c.cols.device)}"><strong>${esc(r.name)}</strong>${r.brand ? `<span class="brand">${esc(r.brand)}</span>` : ''}</td><td data-l="${esc(c.cols.protocol)}">${esc(r.protocol)}</td><td data-l="${esc(c.cols.status)}"><span class="badge ${r.status}">${esc(c.status[r.status])}${reports}</span></td><td data-l="${esc(c.cols.note)}">${esc(r.note[lang] || r.note.en)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
  writePage({
    lang, slug: 'compatibility', tplName: 'compat', title: c.title, description: c.description,
    extra: {
      legend: ['verified', 'expected', 'reported'].map((k) => `<li><span class="badge ${k}">${esc(c.status[k])}</span> ${esc(c.statusDesc[k])}</li>`).join(''),
      tableTrainers: table(compat.trainers), tableControllers: table(compat.controllers), tableWatches: table(compat.watches),
    },
  });
}

// pagine legali da docs/legal/*.md (en e it; le altre lingue ripiegano sull'inglese)
const legalWarnings = [];
for (const lang of cfg.langs) {
  const t = T[lang];
  for (const p of cfg.legalPages) {
    const have = (l) => existsSync(join(repo, `docs/legal/${p}.${l}.md`));
    const contentLang = have(lang) ? lang : 'en';
    const src = read(join(repo, `docs/legal/${p}.${contentLang}.md`));
    const { html, title } = md(src, lang);
    const placeholders = [...new Set(src.match(/\[[A-ZÀ-Ü][A-ZÀ-Ü0-9 .…\/-]{2,}\]/g) || [])];
    const draft = placeholders.length > 0 || /DRAFT|BOZZA/.test(src);
    if (draft && lang === cfg.defaultLang) legalWarnings.push(`${p}: ${placeholders.join(' ') || 'bozza'}`);
    writePage({
      lang, slug: p, tplName: 'legal', title: t.legal.title.replace('{title}', title), description: t.legal.title.replace('{title}', title),
      index: !draft, langsAvailable: cfg.langs.filter(have),
      extra: { body: html, contentLang, draftNote: draft ? `<blockquote><p>${esc(t.legal.draft)}</p></blockquote>` : '' },
    });
  }
}
// se la lingua non ha il documento, writePage usa comunque `lang` per la scheda; la lista alternates contiene solo le lingue con testo vero.

// 404 (GitHub Pages lo serve per gli URL inesistenti)
{
  const t = T[cfg.defaultLang];
  writePage({ lang: cfg.defaultLang, tplName: 'notfound', title: `${t.notFound.title} | Spindro`, description: t.notFound.text, index: false, file: join(out, '404.html') });
}

// sitemap, robots
const urls = written.filter((w) => w.index);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.map((w) => `  <url>\n    <loc>${abs(w.path)}</loc>\n${w.alternates.map(([l, p]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(p)}"/>`).join('\n')}\n  </url>`).join('\n')}\n</urlset>\n`;
writeFileSync(join(out, 'sitemap.xml'), sitemap);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`site: ${written.length} pagine in ${out} (${cfg.langs.join(', ')}), dominio ${SITE_URL}`);
if (legalWarnings.length) console.log(`pagine legali ancora bozza (noindex, fuori dalla sitemap):\n  - ${legalWarnings.join('\n  - ')}`);
for (const l of cfg.langs) for (const f of ['home', 'compat']) if (!T[l][f]) throw new Error(`${l}: manca ${f}`);
