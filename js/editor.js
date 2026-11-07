// Editor di allenamenti: blocchi semplici (costante, rampa, ripetute) → passi in % della FTP.
import { drawProfile, duration, tss, fmtTime } from './workouts.js';

const TYPES = {
  warm: { name: 'Riscaldamento', make: () => ({ k: 'ramp', d: 10, p: 45, to: 75, label: 'Riscaldamento' }) },
  steady: { name: 'Costante', make: () => ({ k: 'steady', d: 10, p: 88, label: 'Ritmo costante' }) },
  reps: { name: 'Ripetute', make: () => ({ k: 'reps', n: 5, on: 180, onP: 110, off: 120, offP: 55 }) },
  ramp: { name: 'Rampa', make: () => ({ k: 'ramp', d: 5, p: 60, to: 100, label: 'Rampa' }) },
  cool: { name: 'Defaticamento', make: () => ({ k: 'ramp', d: 5, p: 60, to: 40, label: 'Defaticamento' }) },
};

// blocchi (unità comode: minuti e % FTP) → passi del motore (secondi e frazioni)
export function blocksToSteps(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.k === 'steady') out.push({ d: Math.round(b.d * 60), p: b.p / 100, label: b.label || 'Ritmo costante' });
    else if (b.k === 'ramp') out.push({ d: Math.round(b.d * 60), p: b.p / 100, to: b.to / 100, label: b.label || 'Rampa' });
    else if (b.k === 'reps') for (let i = 0; i < b.n; i++) {
      out.push({ d: Math.round(b.on), p: b.onP / 100, label: `Ripetuta ${i + 1}/${b.n}` });
      if (i < b.n - 1 && b.off > 0) out.push({ d: Math.round(b.off), p: b.offP / 100, label: 'Recupero' });
    }
  }
  return out.filter((x) => x.d > 0);
}

// passi già esistenti (es. importati) → blocchi modificabili
export function stepsToBlocks(steps) {
  return steps.map((x) => (x.to != null
    ? { k: 'ramp', d: +(x.d / 60).toFixed(2), p: Math.round(x.p * 100), to: Math.round(x.to * 100), label: x.label }
    : { k: 'steady', d: +(x.d / 60).toFixed(2), p: Math.round((x.p ?? 0.6) * 100), label: x.label })).filter((b) => b.d > 0);
}

const num = (label, key, val, { min = 0, max = 999, step = 1, unit = '' } = {}) => `<label class="ed-f"><span>${label}</span>
  <span class="unit-input"><input type="number" data-key="${key}" value="${val}" min="${min}" max="${max}" step="${step}" inputmode="decimal"><i>${unit}</i></span></label>`;

export class WorkoutEditor {
  constructor(root, { ftp, onSave }) { this.root = root; this.ftp = ftp; this.onSave = onSave; }

  open(w = null) {
    this.id = w?.custom ? w.id : null;
    this.name = w ? (w.custom ? w.name : `${w.name} (copia)`) : 'Il mio allenamento';
    this.blocks = w?.blocks ? structuredClone(w.blocks) : w ? stepsToBlocks(w.steps) : [TYPES.warm.make(), TYPES.reps.make(), TYPES.cool.make()];
    this.render();
  }

  steps() { return blocksToSteps(this.blocks); }

  render() {
    const r = this.root;
    r.innerHTML = `
      <label class="ed-name"><span>Nome</span><input type="text" id="edName" maxlength="30" value="${this.name.replace(/"/g, '&quot;')}"></label>
      <canvas id="edProfile" class="wk-profile ed-profile"></canvas>
      <p class="fine" id="edSum"></p>
      <div class="ed-blocks">${this.blocks.map((b, i) => this.blockHtml(b, i)).join('')}</div>
      <p class="fine">Aggiungi un blocco:</p>
      <div class="chips ed-add">${Object.entries(TYPES).map(([k, t]) => `<button data-add="${k}">+ ${t.name}</button>`).join('')}</div>
      <div class="ed-actions"><button class="cta" id="edSave">Salva allenamento</button></div>`;
    r.querySelector('#edName').addEventListener('input', (e) => { this.name = e.target.value; });
    r.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      const add = TYPES[b.dataset.add].make();
      // il defaticamento va in fondo, il resto prima del defaticamento finale
      const last = this.blocks[this.blocks.length - 1];
      if (b.dataset.add !== 'cool' && last?.label === 'Defaticamento') this.blocks.splice(this.blocks.length - 1, 0, add); else this.blocks.push(add);
      this.render();
    }));
    r.querySelectorAll('.ed-block').forEach((el) => {
      const i = +el.dataset.i;
      el.querySelectorAll('input[data-key]').forEach((inp) => inp.addEventListener('input', () => {
        const v = parseFloat(inp.value); if (!Number.isFinite(v)) return;
        this.blocks[i][inp.dataset.key] = v; this.preview();
      }));
      el.querySelector('[data-up]')?.addEventListener('click', () => { if (i > 0) { [this.blocks[i - 1], this.blocks[i]] = [this.blocks[i], this.blocks[i - 1]]; this.render(); } });
      el.querySelector('[data-del]').addEventListener('click', () => { this.blocks.splice(i, 1); this.render(); });
    });
    r.querySelector('#edSave').addEventListener('click', () => this.save());
    this.preview();
  }

  blockHtml(b, i) {
    const title = b.k === 'reps' ? 'Ripetute' : b.label || (b.k === 'ramp' ? 'Rampa' : 'Costante');
    const fields = b.k === 'reps'
      ? num('Quante', 'n', b.n, { min: 1, max: 40 }) + num('Lavoro', 'on', b.on, { min: 5, max: 3600, step: 5, unit: 's' }) + num('Intensità', 'onP', b.onP, { min: 30, max: 250, step: 5, unit: '%' })
        + num('Recupero', 'off', b.off, { min: 0, max: 3600, step: 5, unit: 's' }) + num('Intensità rec.', 'offP', b.offP, { min: 20, max: 150, step: 5, unit: '%' })
      : b.k === 'ramp'
        ? num('Durata', 'd', b.d, { min: 0.5, max: 180, step: 0.5, unit: 'min' }) + num('Da', 'p', b.p, { min: 20, max: 250, step: 5, unit: '%' }) + num('A', 'to', b.to, { min: 20, max: 250, step: 5, unit: '%' })
        : num('Durata', 'd', b.d, { min: 0.5, max: 300, step: 0.5, unit: 'min' }) + num('Intensità', 'p', b.p, { min: 20, max: 250, step: 5, unit: '%' });
    return `<div class="ed-block" data-i="${i}"><div class="ed-bhead"><b>${title}</b><span>${i ? '<button class="link" data-up>↑ Su</button>' : ''}<button class="link" data-del>Elimina</button></span></div><div class="ed-fields">${fields}</div></div>`;
  }

  preview() {
    const steps = this.steps(); const w = { steps };
    if (steps.length) drawProfile(this.root.querySelector('#edProfile'), w, this.ftp);
    const t = tss(w);
    this.root.querySelector('#edSum').textContent = steps.length
      ? `Durata ${fmtTime(duration(w))} · carico ${t} · le percentuali sono della tua FTP (${this.ftp} W)` : 'Aggiungi almeno un blocco';
  }

  save() {
    const steps = this.steps(); if (!steps.length) return;
    const mins = Math.round(duration({ steps }) / 60);
    this.onSave({ id: this.id || `my-${Date.now()}`, name: (this.name || 'Allenamento').trim().slice(0, 30), tag: `Mio · ${mins} min`, desc: 'Creato con l\'editor', steps, blocks: this.blocks, custom: true });
  }
}
