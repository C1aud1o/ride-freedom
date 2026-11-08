// Immagine riassuntiva dell'uscita (1080×1350, formato da social) da condividere o salvare.
import { t } from './i18n.js';

export async function shareCard({ title, date, stats, series, ftp, route }) {
  const W = 1080; const H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  try { await document.fonts?.load('italic 800 120px "Barlow Condensed"'); } catch { /* font di sistema */ }
  // sfondo
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#191a12'); bg.addColorStop(1, '#0d0d0b');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 700); glow.addColorStop(0, 'rgba(217,255,61,.22)'); glow.addColorStop(1, 'rgba(217,255,61,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  const cond = (size, w = 800) => `italic ${w} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const ui = (size, w = 500) => `${w} ${size}px Barlow, Arial, sans-serif`;
  // marchio
  g.font = cond(56); g.fillStyle = '#f2f0e6'; g.fillText('SPIN', 72, 120);
  const rw = g.measureText('SPIN').width; g.fillStyle = '#d9ff3d'; g.fillText('DRO', 72 + rw, 120);
  g.font = ui(30); g.fillStyle = 'rgba(242,240,230,.6)'; g.fillText(date, 72, 172);
  // titolo
  g.font = cond(110); g.fillStyle = '#f2f0e6'; wrap(g, title.toUpperCase(), 72, 320, W - 144, 110);
  // numeri
  const cells = stats.slice(0, 6);
  cells.forEach(([label, value, unit], i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const x = 72 + col * 480; const y = 520 + row * 190;
    g.font = ui(30, 700); g.fillStyle = 'rgba(242,240,230,.55)'; g.fillText(label.toUpperCase(), x, y);
    g.font = cond(120); g.fillStyle = i === 0 ? '#d9ff3d' : '#f2f0e6'; g.fillText(String(value), x, y + 112);
    const vw = g.measureText(String(value)).width; g.font = cond(44, 700); g.fillStyle = 'rgba(242,240,230,.55)'; g.fillText(unit || '', x + vw + 12, y + 112);
  });
  // grafico potenza
  if (series?.length > 2) {
    const gx = 72; const gy = 1110; const gw = W - 144; const gh = 150;
    const max = Math.max(ftp * 1.3, ...series) * 1.05;
    const X = (i) => gx + (i / (series.length - 1)) * gw; const Y = (v) => gy + gh - (v / max) * gh;
    const fill = g.createLinearGradient(0, gy, 0, gy + gh); fill.addColorStop(0, 'rgba(217,255,61,.5)'); fill.addColorStop(1, 'rgba(217,255,61,0)');
    g.beginPath(); g.moveTo(gx, gy + gh); series.forEach((v, i) => g.lineTo(X(i), Y(v))); g.lineTo(gx + gw, gy + gh); g.closePath(); g.fillStyle = fill; g.fill();
    g.beginPath(); series.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.strokeStyle = '#d9ff3d'; g.lineWidth = 4; g.stroke();
    g.font = ui(26); g.fillStyle = 'rgba(242,240,230,.5)'; g.fillText(route ? t('share.route', { route }) : t('home.power'), gx, gy - 20);
  }
  g.font = ui(26); g.fillStyle = 'rgba(242,240,230,.4)'; g.fillText('mta-world.com', 72, H - 50);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], `spindro-${Date.now()}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: t('share.imageTitle') }); return 'shared'; } catch (err) { if (err.name === 'AbortError') return 'aborted'; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'saved';
}

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = ''; let yy = y;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t;
  }
  g.fillText(line, x, yy);
}
