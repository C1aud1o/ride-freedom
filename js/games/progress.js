// Progressione condivisa tra i giochi: esperienza e livelli, sfide del giorno, obiettivi.
// Tutto resta nel browser del telefono (localStorage).
import { hudText } from './engine.js';
import { t } from '../i18n.js';

const KEY = 'rfProgress';

const DAILY_POOL = [
  { id: 'kills', text: 'games.progress.daily.kills', stat: 'kills', target: 40, xp: 150 },
  { id: 'rescued', text: 'games.progress.daily.rescued', stat: 'rescued', target: 4, xp: 150 },
  { id: 'bosses', text: 'games.progress.daily.bosses', stat: 'bosses', target: 1, xp: 200 },
  { id: 'overdrives', text: 'games.progress.daily.overdrives', stat: 'overdrives', target: 3, xp: 180 },
  { id: 'sprints', text: 'games.progress.daily.sprints', stat: 'sprintsWon', target: 2, xp: 200 },
  { id: 'races', text: 'games.progress.daily.races', stat: 'races', target: 2, xp: 150 },
  { id: 'podium', text: 'games.progress.daily.podium', stat: 'podiums', target: 1, xp: 200 },
  { id: 'coins', text: 'games.progress.daily.coins', stat: 'coins', target: 25, xp: 120 },
  { id: 'draft', text: 'games.progress.daily.draft', stat: 'draftSec', target: 60, xp: 150 },
  { id: 'jersey', text: 'games.progress.daily.jersey', stat: 'jerseys', target: 1, xp: 220 },
  { id: 'items', text: 'games.progress.daily.items', stat: 'itemsUsed', target: 4, xp: 150 },
  { id: 'pump', text: 'games.progress.daily.pump', stat: 'pumps', target: 10, xp: 150 },
];

const ACHIEVEMENTS = [
  { id: 'firstBoss', name: 'games.progress.ach.firstBoss.name', desc: 'games.progress.ach.firstBoss.desc', test: (s) => s.bosses >= 1 },
  { id: 'baron', name: 'games.progress.ach.baron.name', desc: 'games.progress.ach.baron.desc', test: (s) => s.campaigns >= 1 },
  { id: 'liberator', name: 'games.progress.ach.liberator.name', desc: 'games.progress.ach.liberator.desc', test: (s) => s.rescued >= 25 },
  { id: 'scrap', name: 'games.progress.ach.scrap.name', desc: 'games.progress.ach.scrap.desc', test: (s) => s.kills >= 500 },
  { id: 'combo', name: 'games.progress.ach.combo.name', desc: 'games.progress.ach.combo.desc', test: (s) => s.maxCombo >= 8 },
  { id: 'sprinter', name: 'games.progress.ach.sprinter.name', desc: 'games.progress.ach.sprinter.desc', test: (s) => s.sprintsWon >= 10 },
  { id: 'overdrive', name: 'games.progress.ach.overdrive.name', desc: 'games.progress.ach.overdrive.desc', test: (s) => s.overdrives >= 25 },
  { id: 'win', name: 'games.progress.ach.win.name', desc: 'games.progress.ach.win.desc', test: (s) => s.wins >= 1 },
  { id: 'allTracks', name: 'games.progress.ach.allTracks.name', desc: 'games.progress.ach.allTracks.desc', test: (s) => (s.tracksWon || []).length >= 3 },
  { id: 'kom', name: 'games.progress.ach.kom.name', desc: 'games.progress.ach.kom.desc', test: (s) => s.kom >= 1 },
  { id: 'green', name: 'games.progress.ach.green.name', desc: 'games.progress.ach.green.desc', test: (s) => s.green >= 1 },
  { id: 'ghost', name: 'games.progress.ach.ghost.name', desc: 'games.progress.ach.ghost.desc', test: (s) => s.ghostBeaten >= 1 },
  { id: 'rich', name: 'games.progress.ach.rich.name', desc: 'games.progress.ach.rich.desc', test: (s) => s.coins >= 200 },
  { id: 'pump', name: 'games.progress.ach.pump.name', desc: 'games.progress.ach.pump.desc', test: (s) => s.pumps >= 50 },
  { id: 'lvl10', name: 'games.progress.ach.lvl10.name', desc: 'games.progress.ach.lvl10.desc', test: (s, p) => p.level >= 10 },
];

const TITLES = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `games.progress.title.${i}`);

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
  get title() { return t(TITLES[Math.min(TITLES.length - 1, Math.floor((this.level - 1) / 3))]); }

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
    if (this.level > before) this.toast(t('games.progress.levelUp', { n: this.level }), t('games.progress.youAre', { title: this.title }), '#ffd34d');
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
      if (it.progress >= def.target) { it.done = true; this.addXp(def.xp); this.toast(t('games.progress.dailyDone'), `${t(def.text)} · +${def.xp} XP`, '#06d6a0'); }
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
      this.toast(`🏆 ${t(a.name)}`, t(a.desc), '#ff9f1c');
    }
  }

  toast(title, sub, color) { this.toasts.push({ title, sub, color, t: 3.2 }); }

  // da chiamare nel disegno dell'interfaccia di ogni gioco
  drawToasts(ctx, W, dt) {
    const tt = this.toasts[0];
    if (!tt) return;
    tt.t -= dt;
    if (tt.t <= 0) { this.toasts.shift(); return; }
    const k = Math.min(1, (3.2 - tt.t) * 4, tt.t * 4);
    const y = -60 + k * 108;
    ctx.fillStyle = 'rgba(12,10,24,.92)'; ctx.fillRect(12, y, W - 24, 50);
    ctx.fillStyle = tt.color; ctx.fillRect(12, y, 4, 50);
    hudText(ctx, tt.title, 26, y + 21, { size: 15, color: tt.color });
    hudText(ctx, tt.sub, 26, y + 40, { size: 11, color: '#e8e8e8' });
  }

  // pannello nel menu dei giochi (HTML)
  renderMenu(el) {
    this.ensureDaily();
    const lvl = this.level; const a = Progress.xpFor(lvl); const b = Progress.xpFor(lvl + 1);
    const pct = Math.round(((this.xp - a) / (b - a)) * 100);
    const daily = this.daily.items.map((it) => {
      const d = DAILY_POOL.find((x) => x.id === it.id);
      return `<li class="${it.done ? 'done' : ''}"><span>${it.done ? '●' : '○'} ${t(d.text)}</span><small>${it.progress}/${d.target} · +${d.xp} XP</small></li>`;
    }).join('');
    const got = ACHIEVEMENTS.filter((x) => this.achievements[x.id]).length;
    const ach = ACHIEVEMENTS.map((x) => `<li class="${this.achievements[x.id] ? 'done' : ''}">${this.achievements[x.id] ? '●' : '○'} <b>${t(x.name)}</b> — ${t(x.desc)}</li>`).join('');
    el.innerHTML = `
      <div class="prog-head"><span class="prog-lvl">${lvl}</span><div><b>${this.title}</b><small>${t('games.progress.next', { xp: this.xp, next: b })}</small>
      <div class="prog-bar"><i style="width:${pct}%"></i></div></div></div>
      <h3>${t('games.progress.today')}</h3><ul class="prog-daily">${daily}</ul>
      <details><summary>${t('games.progress.achievements', { got, n: ACHIEVEMENTS.length })}</summary><ul class="prog-ach">${ach}</ul></details>`;
  }
}
