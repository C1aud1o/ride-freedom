// Progressione condivisa tra i giochi: esperienza e livelli, sfide del giorno, obiettivi.
// Tutto resta nel browser del telefono (localStorage).
import { hudText } from './engine.js';

const KEY = 'rfProgress';

const DAILY_POOL = [
  { id: 'kills', text: 'Distruggi 40 robot', stat: 'kills', target: 40, xp: 150 },
  { id: 'rescued', text: 'Libera 4 ciclisti prigionieri', stat: 'rescued', target: 4, xp: 150 },
  { id: 'bosses', text: 'Abbatti un boss', stat: 'bosses', target: 1, xp: 200 },
  { id: 'overdrives', text: 'Attiva 3 volte l\'OVERDRIVE', stat: 'overdrives', target: 3, xp: 180 },
  { id: 'sprints', text: 'Vinci 2 sfide sprint', stat: 'sprintsWon', target: 2, xp: 200 },
  { id: 'races', text: 'Completa 2 gare', stat: 'races', target: 2, xp: 150 },
  { id: 'podium', text: 'Sali sul podio', stat: 'podiums', target: 1, xp: 200 },
  { id: 'coins', text: 'Raccogli 25 monete', stat: 'coins', target: 25, xp: 120 },
  { id: 'draft', text: 'Resta 60 s in scia', stat: 'draftSec', target: 60, xp: 150 },
  { id: 'jersey', text: 'Conquista una maglia (verde o a pois)', stat: 'jerseys', target: 1, xp: 220 },
  { id: 'items', text: 'Usa 4 oggetti con lo sprint', stat: 'itemsUsed', target: 4, xp: 150 },
  { id: 'pump', text: 'Fai 10 colpi di pompa', stat: 'pumps', target: 10, xp: 150 },
];

const ACHIEVEMENTS = [
  { id: 'firstBoss', name: 'Primo bullone', desc: 'Abbatti il tuo primo boss', test: (s) => s.bosses >= 1 },
  { id: 'baron', name: 'Addio Barone', desc: 'Completa le 3 missioni', test: (s) => s.campaigns >= 1 },
  { id: 'liberator', name: 'Liberatore', desc: 'Libera 25 ciclisti', test: (s) => s.rescued >= 25 },
  { id: 'scrap', name: 'Rottamatore', desc: 'Distruggi 500 robot', test: (s) => s.kills >= 500 },
  { id: 'combo', name: 'Combo ×8', desc: 'Arriva al moltiplicatore massimo', test: (s) => s.maxCombo >= 8 },
  { id: 'sprinter', name: 'Velocista', desc: 'Vinci 10 sfide sprint', test: (s) => s.sprintsWon >= 10 },
  { id: 'overdrive', name: 'Sovralimentato', desc: 'Attiva 25 volte l\'OVERDRIVE', test: (s) => s.overdrives >= 25 },
  { id: 'win', name: 'Prima vittoria', desc: 'Vinci una gara', test: (s) => s.wins >= 1 },
  { id: 'allTracks', name: 'Tre su tre', desc: 'Vinci su tutti e 3 i circuiti', test: (s) => (s.tracksWon || []).length >= 3 },
  { id: 'kom', name: 'Re della montagna', desc: 'Vinci la maglia a pois', test: (s) => s.kom >= 1 },
  { id: 'green', name: 'Maglia verde', desc: 'Vinci la classifica dei traguardi volanti', test: (s) => s.green >= 1 },
  { id: 'ghost', name: 'Ammazzafantasmi', desc: 'Batti il tuo record su un circuito', test: (s) => s.ghostBeaten >= 1 },
  { id: 'rich', name: 'Salvadanaio', desc: 'Raccogli 200 monete', test: (s) => s.coins >= 200 },
  { id: 'pump', name: 'Pompa magica', desc: '50 colpi di pompa', test: (s) => s.pumps >= 50 },
  { id: 'lvl10', name: 'Veterano', desc: 'Raggiungi il livello 10', test: (s, p) => p.level >= 10 },
];

const TITLES = ['Pedalatore', 'Gregario', 'Passista', 'Scalatore', 'Velocista', 'Capitano', 'Campione', 'Leggenda'];

function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function seeded(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); }

export class Progress {
  constructor() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* vuoto */ }
    this.xp = d.xp || 0;
    this.stats = d.stats || {};
    this.achievements = d.achievements || {};
    this.daily = d.daily || null;
    this.toasts = [];
    this.ensureDaily();
  }

  get level() { let l = 1; while (this.xp >= Progress.xpFor(l + 1)) l++; return l; }
  static xpFor(level) { return Math.round(120 * (level - 1) ** 1.6); }
  get title() { return TITLES[Math.min(TITLES.length - 1, Math.floor((this.level - 1) / 3))]; }

  ensureDaily() {
    const day = today();
    if (this.daily?.date === day) return;
    const rnd = seeded(day);
    const pool = [...DAILY_POOL]; const items = [];
    while (items.length < 3) { const i = Math.floor(rnd() * pool.length); items.push({ id: pool[i].id, progress: 0, done: false }); pool.splice(i, 1); }
    this.daily = { date: day, items };
    this.save();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify({ xp: this.xp, stats: this.stats, achievements: this.achievements, daily: this.daily })); } catch { /* pieno */ }
  }

  addXp(n) {
    const before = this.level;
    this.xp += Math.round(n);
    if (this.level > before) this.toast(`LIVELLO ${this.level}!`, `Sei un ${this.title}`, '#ffd34d');
  }

  // registra un evento di gioco: aggiorna statistiche, sfide del giorno, obiettivi
  event(stat, amount = 1, xp = 0) {
    this.ensureDaily();
    this.stats[stat] = (this.stats[stat] || 0) + amount;
    if (xp) this.addXp(xp);
    for (const it of this.daily.items) {
      const def = DAILY_POOL.find((d) => d.id === it.id);
      if (!def || it.done || def.stat !== stat) continue;
      it.progress = Math.min(def.target, it.progress + amount);
      if (it.progress >= def.target) { it.done = true; this.addXp(def.xp); this.toast('SFIDA DEL GIORNO COMPLETATA', `${def.text} · +${def.xp} XP`, '#06d6a0'); }
    }
    this.checkAchievements();
    this.save();
  }

  setMax(stat, value) { if ((this.stats[stat] || 0) < value) { this.stats[stat] = value; this.checkAchievements(); this.save(); } }
  addToList(stat, value) { const l = this.stats[stat] || []; if (!l.includes(value)) { l.push(value); this.stats[stat] = l; this.checkAchievements(); this.save(); } }

  checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (this.achievements[a.id] || !a.test(this.stats, this)) continue;
      this.achievements[a.id] = today();
      this.addXp(250);
      this.toast(`🏆 ${a.name}`, a.desc, '#ff9f1c');
    }
  }

  toast(title, sub, color) { this.toasts.push({ title, sub, color, t: 3.2 }); }

  // da chiamare nel disegno dell'interfaccia di ogni gioco
  drawToasts(ctx, W, dt) {
    const t = this.toasts[0];
    if (!t) return;
    t.t -= dt;
    if (t.t <= 0) { this.toasts.shift(); return; }
    const k = Math.min(1, (3.2 - t.t) * 4, t.t * 4);
    const y = -60 + k * 108;
    ctx.fillStyle = 'rgba(12,10,24,.92)'; ctx.fillRect(12, y, W - 24, 50);
    ctx.fillStyle = t.color; ctx.fillRect(12, y, 4, 50);
    hudText(ctx, t.title, 26, y + 21, { size: 15, color: t.color });
    hudText(ctx, t.sub, 26, y + 40, { size: 11, color: '#e8e8e8' });
  }

  // pannello nel menu dei giochi (HTML)
  renderMenu(el) {
    this.ensureDaily();
    const lvl = this.level; const a = Progress.xpFor(lvl); const b = Progress.xpFor(lvl + 1);
    const pct = Math.round(((this.xp - a) / (b - a)) * 100);
    const daily = this.daily.items.map((it) => {
      const d = DAILY_POOL.find((x) => x.id === it.id);
      return `<li class="${it.done ? 'done' : ''}"><span>${it.done ? '●' : '○'} ${d.text}</span><small>${it.progress}/${d.target} · +${d.xp} XP</small></li>`;
    }).join('');
    const got = ACHIEVEMENTS.filter((x) => this.achievements[x.id]).length;
    const ach = ACHIEVEMENTS.map((x) => `<li class="${this.achievements[x.id] ? 'done' : ''}">${this.achievements[x.id] ? '●' : '○'} <b>${x.name}</b> — ${x.desc}</li>`).join('');
    el.innerHTML = `
      <div class="prog-head"><span class="prog-lvl">${lvl}</span><div><b>${this.title}</b><small>${this.xp} XP · prossimo livello a ${b}</small>
      <div class="prog-bar"><i style="width:${pct}%"></i></div></div></div>
      <h3>Sfide di oggi</h3><ul class="prog-daily">${daily}</ul>
      <details><summary>Obiettivi ${got}/${ACHIEVEMENTS.length}</summary><ul class="prog-ach">${ach}</ul></details>`;
  }
}
