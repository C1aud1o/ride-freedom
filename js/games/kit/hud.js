// HUD dei giochi 3D: numeri grandi e contrastati, leggibili in bici a 1 m dal telefono.
// Regole (docs/giochi-stile.md): numeri chiave ≥ 44 px, etichette ≥ 13 px, contorno scuro, pannelli semitrasparenti.
export const HUD_FONT = '"Barlow Condensed", "Roboto Condensed", "Arial Narrow", "sans-serif-condensed", system-ui, sans-serif';
export const HUD = { lime: '#d9ff3d', cyan: '#4de3ff', red: '#ff5a6a', gold: '#ffd34d', white: '#ffffff', dim: '#d8d8d8', ink: 'rgba(12,12,18,.62)' };

// testo con contorno; size in px CSS; restituisce la larghezza
export function txt(ctx, text, x, y, { size = 16, color = '#fff', align = 'left', weight = 800, stroke = 'rgba(0,0,0,.85)', base = 'alphabetic', italic = false } = {}) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${HUD_FONT}`;
  ctx.textAlign = align; ctx.textBaseline = base;
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); }
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  return ctx.measureText(text).width;
}

export function panel(ctx, x, y, w, h, { r = 10, fill = HUD.ink, border = null } = {}) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fill();
  if (border) { ctx.lineWidth = 2; ctx.strokeStyle = border; ctx.stroke(); }
}

// scala dell'interfaccia: 1 su un telefono in verticale, fino a 1.45 su schermi grandi
export function uiScale(W, H) { return Math.max(1, Math.min(1.45, Math.min(W, H) / 390)); }

// colore della potenza rispetto alla soglia sprint (zona facile → bianco, vicino → giallo, sopra → ciano)
export function powerColor(power, threshold) {
  if (!threshold) return HUD.white;
  if (power >= threshold) return HUD.cyan;
  if (power >= threshold * 0.8) return HUD.gold;
  return HUD.white;
}

// colore della pendenza: discesa ciano, piano bianco, salita da giallo a rosso
export function gradeColor(g) {
  if (g <= -1) return HUD.cyan;
  if (g < 1.5) return HUD.white;
  if (g < 4) return HUD.gold;
  return HUD.red;
}
