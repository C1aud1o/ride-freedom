// La festa di fine allenamento: coriandoli, spunta che si disegna, numeri che contano, medaglie per i record.
// Tutto disegnato qui (nessuna animazione esterna); rispetta "riduci movimento" del sistema.

const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#d9ff3d', '#f2f0e6', '#4de3ff', '#ff4d9d', '#ffd166'];

// coriandoli che esplodono da un punto e ricadono
export function confetti(host, { x = 0.5, y = 0.18, count = 90, spread = 1 } = {}) {
  if (reduce()) return;
  const c = document.createElement('canvas'); c.className = 'confetti';
  host.appendChild(c);
  const r = host.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = r.width * dpr; c.height = r.height * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const ox = r.width * x; const oy = r.height * y;
  const ps = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1 * spread; const v = 260 + Math.random() * 420;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, col: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.3, wob: Math.random() * 6 };
  });
  let last = performance.now(); const t0 = last;
  const tick = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000); last = now; const age = (now - t0) / 1000;
    g.clearRect(0, 0, r.width, r.height);
    for (const p of ps) {
      p.vy += 900 * dt; p.vx *= 0.985; p.vy *= 0.985; p.wob += dt * 8;
      p.x += (p.vx + Math.sin(p.wob) * 30) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      g.save(); g.globalAlpha = Math.max(0, 1 - Math.max(0, age - 1.6) / 1.2); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.col;
      if (p.round) { g.beginPath(); g.arc(0, 0, p.h, 0, Math.PI * 2); g.fill(); } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.wob)));
      g.restore();
    }
    if (age < 2.8) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}

// numero che sale da 0 al valore (mantiene decimali e formato "mm:ss")
export function countUp(el, ms = 900) {
  const text = el.textContent.trim();
  if (reduce()) return;
  const time = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  const sep = text.includes(',') ? ',' : '.'; // separatore decimale della lingua
  const num = parseFloat(text.replace(',', '.'));
  if (!time && !Number.isFinite(num)) return;
  const dec = (text.split(sep)[1] || '').length;
  const total = time ? (time[3] != null ? +time[1] * 3600 + +time[2] * 60 + +time[3] : +time[1] * 60 + +time[2]) : num;
  const fmt = (v) => {
    if (!time) return v.toFixed(dec).replace('.', sep);
    const s = Math.round(v); const pad = (n) => String(n).padStart(2, '0');
    return time[3] != null ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
  };
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms); const e = 1 - (1 - k) ** 3;
    el.textContent = fmt(total * e);
    if (k < 1) requestAnimationFrame(step); else el.textContent = text;
  };
  requestAnimationFrame(step);
}

// medaglie (record, obiettivi) che entrano una dopo l'altra
export function badges(el, list) {
  el.innerHTML = list.map((b, i) => `<div class="badge" style="animation-delay:${0.5 + i * 0.25}s"><span class="b-ico">${b.ico}</span><span><b>${b.title}</b><small>${b.sub}</small></span></div>`).join('');
  el.hidden = !list.length;
}

// sequenza completa
export function party(sheet, { records = 0 } = {}) {
  sheet.querySelector('.celebrate')?.classList.remove('play'); void sheet.offsetWidth;
  sheet.querySelector('.celebrate')?.classList.add('play');
  sheet.querySelectorAll('.summary dd').forEach((d) => countUp(d));
  const body = sheet.querySelector('.sheet-body');
  setTimeout(() => confetti(body, { count: 70 + records * 30 }), 250);
  if (records) setTimeout(() => confetti(body, { x: 0.2, y: 0.35, count: 40, spread: 0.6 }), 900);
  if (records > 1) setTimeout(() => confetti(body, { x: 0.8, y: 0.35, count: 40, spread: 0.6 }), 1150);
}
