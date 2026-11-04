// Utilità comuni ai giochi: schermo pixel-art a bassa risoluzione, sprite da griglie, matematica.

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Il gioco disegna su un buffer piccolo (es. 240 px di larghezza) che viene ingrandito
// senza sfumature: tutto, anche cerchi e linee, prende un aspetto pixel-art coerente.
// Il testo dell'interfaccia viene invece disegnato a piena risoluzione sopra.
export class PixelScreen {
  constructor(canvas, baseW = 240) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.baseW = baseW;
    this.buf = document.createElement('canvas');
    this.g = this.buf.getContext('2d');
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    this.W = r.width; this.H = r.height; // pixel CSS
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    // in verticale si ingrandisce di più (la scena è più stretta)
    const base = r.height > r.width ? this.baseW * 0.75 : this.baseW * 1.25;
    this.scale = Math.max(1, Math.floor(this.canvas.width / base));
    this.vw = Math.ceil(this.canvas.width / this.scale);
    this.vh = Math.ceil(this.canvas.height / this.scale);
    this.buf.width = this.vw; this.buf.height = this.vh;
    this.g.imageSmoothingEnabled = false;
  }

  // copia il buffer sullo schermo e prepara il contesto per l'interfaccia (coordinate CSS)
  present(shakeX = 0, shakeY = 0) {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.buf, Math.round(shakeX * this.scale), Math.round(shakeY * this.scale), this.vw * this.scale, this.vh * this.scale);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // da coordinate del buffer a coordinate CSS (per scrivere testo sopra un oggetto)
  toCss(x, y) { return { x: (x * this.scale) / this.dpr, y: (y * this.scale) / this.dpr }; }
}

// Crea uno sprite da una griglia di caratteri e una tavolozza ('.' = trasparente).
export function sprite(rows, pal) {
  const h = rows.length; const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ' || !pal[ch]) return;
    g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1);
  }));
  return c;
}

export function flip(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}

// versione bianca di uno sprite (lampo quando viene colpito)
export function whiten(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// gradiente "a bande" in stile retrò
export function bandedSky(g, w, h, colors) {
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i];
    g.fillRect(0, Math.floor((i * h) / n), w, Math.ceil(h / n) + 1);
  }
}

// rumore pseudo-casuale deterministico (per scenari ripetibili)
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// testo dell'interfaccia con contorno, in pixel CSS
export function hudText(ctx, text, x, y, { size = 16, color = '#fff', align = 'left', weight = 800, stroke = '#000', base = 'alphabetic' } = {}) {
  ctx.font = `${weight} ${size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
  ctx.textAlign = align; ctx.textBaseline = base;
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 4); ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

// Misura dello sforzo comune ai giochi: soglia sprint relativa alla tua media recente.
export class Effort {
  constructor() { this.avg = 0; this.samples = 0; }
  update(power, dt, minW = 50) {
    const k = Math.min(1, dt / 45); // media mobile ~45 s
    this.avg = this.samples < 1 ? power : this.avg + (power - this.avg) * k;
    this.samples += dt;
    this.threshold = Math.max(minW + 60, Math.round((this.avg * 1.3) / 5) * 5);
    return power >= this.threshold;
  }
}

// ---------- primitive pixel-art nitide (nessun antialias) ----------
export function pline(g, x0, y0, x1, y1, color, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy; g.fillStyle = color;
  const o = Math.floor(w / 2);
  for (let i = 0; i < 400; i++) {
    g.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function pring(g, cx, cy, r, color, fill = false) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  g.fillStyle = color;
  let x = r; let y = 0; let err = 1 - r;
  while (x >= y) {
    if (fill) {
      g.fillRect(cx - x, cy + y, 2 * x + 1, 1); g.fillRect(cx - x, cy - y, 2 * x + 1, 1);
      g.fillRect(cx - y, cy + x, 2 * y + 1, 1); g.fillRect(cx - y, cy - x, 2 * y + 1, 1);
    } else {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) g.fillRect(cx + a, cy + b, 1, 1);
    }
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}

// font pixel 3x5 per lettere sulle casse e piccoli testi nel mondo
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', F: '111100110100100', L: '100100100100111',
  M: '101111111101101', R: '110101110101101', S: '011100010001110', H: '101101111101101', '+': '000010111010000',
  '!': '010010010000010', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  G: '011100101101011', O: '010101101101010', V: '101101101101010', I: '111010010010111', N: '110101101101101',
  E: '111100110100111', P: '110101110100100', T: '111010010010010', U: '101101101101111', K: '101101110101101',
};
export function ptext(g, text, x, y, color) {
  g.fillStyle = color;
  [...text.toUpperCase()].forEach((ch, i) => {
    const bits = FONT[ch]; if (!bits) return;
    for (let k = 0; k < 15; k++) if (bits[k] === '1') g.fillRect(Math.round(x) + i * 4 + (k % 3), Math.round(y) + Math.floor(k / 3), 1, 1);
  });
}
