#!/usr/bin/env node
// Genera site/assets/og.png (1200x630) con Playwright da un piccolo HTML/SVG. Segnaposto: si può sostituire con una grafica vera.
//   node site/make-og.mjs
import { chromium, launchOptions } from './pw.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
// font incorporati in base64: con setContent la pagina (about:blank) non può leggere file://
const font = (f) => `data:font/woff2;base64,${readFileSync(join(here, 'assets/fonts', f)).toString('base64')}`;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:BC;font-weight:700;font-style:italic;src:url("${font('barlow-condensed-latin-700-italic.woff2')}")}
@font-face{font-family:B;font-weight:700;src:url("${font('barlow-latin-700-normal.woff2')}")}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0f0f0d;color:#f1ece2;position:relative;overflow:hidden;font-family:B,sans-serif}
.glow{position:absolute;right:-180px;top:-160px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,rgba(217,255,61,.28),rgba(217,255,61,0) 65%)}
svg{position:absolute;right:70px;top:90px;width:430px;height:430px}
.t{position:absolute;left:80px;top:150px;width:680px}
.k{display:inline-block;font-size:24px;letter-spacing:.1em;text-transform:uppercase;color:#d9ff3d;border:2px solid rgba(217,255,61,.4);border-radius:99px;padding:10px 20px}
h1{font:italic 700 150px/.95 BC,sans-serif;text-transform:uppercase;margin-top:28px}
h1 b{color:#d9ff3d}
p{font-size:38px;line-height:1.25;margin-top:26px;color:rgba(241,236,226,.85)}
.bar{position:absolute;left:0;right:0;bottom:0;height:14px;background:#d9ff3d}
</style><div class="glow"></div>
<svg viewBox="0 0 64 64" fill="none" stroke="#d9ff3d" stroke-linecap="round"><circle cx="32" cy="32" r="17" stroke-width="6"/><g stroke-width="5"><path d="M32 6v6M32 52v6M6 32h6M52 32h6M14 14l4 4M46 46l4 4M50 14l-4 4M18 46l-4 4"/></g><circle cx="32" cy="32" r="5" fill="#f1ece2" stroke="none"/></svg>
<div class="t"><span class="k">Free · Open source</span><h1>Spin<b>dro</b></h1><p>Free, open-source smart trainer app.<br>No subscription.</p></div><div class="bar"></div>`;

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(here, 'assets/og.png') });
await browser.close();
console.log('site/assets/og.png creato');
