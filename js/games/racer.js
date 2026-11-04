// TURBO PEDALI — corsa arcade in pseudo-3D, originale.
// 8 ciclisti, 3 giri, 3 circuiti. + / − cambi corsia, lo SPRINT (watt sopra soglia) usa l'oggetto.
// Stare dietro a un rivale dà la SCIA (+velocità), come nel ciclismo vero.
// Le salite del circuito vengono inviate al rullo come pendenza reale.

import { PixelScreen, sprite, whiten, bandedSky, hash, hudText, Effort, rand, clamp, lerp, pick, pring, pline, ptext } from './engine.js';
import { SONGS } from './audio.js';

const SEG = 200; // unità per segmento (1 segmento = 5 m)
const UNITS_PER_M = SEG / 5;
const ROAD_W = 2000;
const CAM_H = 900;
const DEPTH = 0.84; // 1 / tan(fov/2)
const DRAW = 140;
const LAPS = 3;
const WORLD_SCALE = 1.35;
const HILL_VIS = 5; // le salite si vedono più ripide di quanto sono
const LANES = [-0.62, 0, 0.62];

const TRACKS = [
  {
    name: 'LITORALE AL TRAMONTO', desc: 'Veloce e piatto, curve dolci sul mare',
    sky: ['#2d1b4e', '#5b2a6e', '#9b3d6d', '#d9555d', '#f28a4b', '#f7b955'], sun: '#ffe9a8', sea: '#2a4d8f', seaLight: '#e98d6b',
    grass: ['#e3c088', '#d8b47a'], rumble: ['#ffffff', '#e63946'], road: ['#6c6a75', '#67656f'], lane: '#fff',
    scenery: ['palm', 'palm', 'umbrella', 'fans', 'palm', 'flag'],
    layout: [[30, 0, 0], [40, 2, 0], [30, 0, 1], [50, -3, 0], [30, 0, 2], [40, 3, -1], [30, 0, 0], [60, -2, 1.5], [40, 0, -2], [40, 4, 0], [30, 0, 0]],
  },
  {
    name: 'PASSO DELLE NUVOLE', desc: 'Salite vere fino al 6%: qui si fa fatica!',
    sky: ['#4a7bbf', '#6a97cf', '#8fb4dd', '#b5cfe9', '#d8e6f3', '#eef4fa'], sun: '#fffbe6', mountains: '#7d8fa8', snow: '#f4f8ff',
    grass: ['#5c9e4a', '#548f43'], rumble: ['#ffffff', '#2a9d8f'], road: ['#5a5d66', '#555861'], lane: '#fff',
    scenery: ['pine', 'pine', 'rock', 'fans', 'cow', 'pine', 'flag'],
    layout: [[30, 0, 0], [60, 1, 5], [40, -3, 4], [40, 2, 6], [30, 0, 3], [50, -2, -3], [40, 3, -4], [40, 0, 0], [50, -4, 5], [40, 2, -3], [40, 0, -2]],
  },
  {
    name: 'CITTÀ AL NEON', desc: 'Notte, curve strette e scie preziose',
    sky: ['#05030f', '#0d0820', '#160d33', '#221247', '#33155a', '#4a1a63'], sun: '#ff4fd8', city: '#140b2b', neon: ['#ff4fd8', '#4de3ff', '#ffe14d'],
    grass: ['#1d1a2b', '#1a1726'], rumble: ['#ff4fd8', '#1b1b2f'], road: ['#2c2a3a', '#292736'], lane: '#4de3ff',
    scenery: ['lamp', 'building', 'neon', 'fans', 'lamp', 'building'],
    layout: [[30, 0, 0], [30, 5, 0], [20, 0, 1], [30, -5, 0], [40, 3, 2], [30, -4, -1], [20, 0, 0], [40, 6, 0], [30, -3, 2], [40, 0, -2], [30, 4, 0], [30, 0, 0]],
  },
];

const RIVALS = [
  { name: 'Gianni Gambalunga', jersey: '#2a9d8f', helmet: '#e9f5db', skill: 1.02, line: 'Gambe lunghe, fiato corto!' },
  { name: 'Turbo Tina', jersey: '#ff4d9d', helmet: '#ffd6ec', skill: 1.05, line: 'Ciao ciao, lumaca!' },
  { name: 'Il Conte Catena', jersey: '#7b2cbf', helmet: '#d4af37', skill: 1.04, line: 'Un nobile non perde mai.' },
  { name: 'Mirko Muro', jersey: '#e63946', helmet: '#1d3557', skill: 0.98, line: 'Di qui non si passa!' },
  { name: 'Lia Leggera', jersey: '#ffd166', helmet: '#06d6a0', skill: 1.0, line: 'In salita volo!' },
  { name: 'Bruno Borraccia', jersey: '#3a86ff', helmet: '#ffffff', skill: 0.95, line: 'Sempre idratato!' },
  { name: 'Zia Salita', jersey: '#f77f00', helmet: '#fcbf49', skill: 0.97, line: 'Ai miei tempi...' },
];

const ITEMS = {
  gel: { name: 'GEL TURBO', color: '#ffd166', desc: '+40% per 4 s' },
  tacks: { name: 'CHIODINI', color: '#adb5bd', desc: 'rallenta chi ti segue' },
  shield: { name: 'SCUDO', color: '#4de3ff', desc: 'para un urto' },
  wind: { name: 'VENTO A FAVORE', color: '#06d6a0', desc: '+25% per 7 s' },
};

function riderSprites(jersey, helmet) {
  const pal = { K: '#14141f', H: helmet, S: '#f2c29b', J: jersey, j: shade(jersey), P: '#1d1d2b', W: '#2b2b2b', w: '#9aa5b1' };
  const top = ['....KKKK....', '...KHHHHK...', '..KHHHHHHK..', '..KHHHHHHK..', '...KSSSSK...', '..KJJJJJJK..', '.KJJjJJjJJK.', 'KSKJJJJJJKSK', 'KSKJJJJJJKSK', '.K.KjJJjK.K.', '...KPPPPK...'];
  const a = [...top, '...KP..PK...', '...KP..KK...', '...KK.KWK...', '.....KwWK...', '.....KWK....', '.....KWK....'];
  const b = [...top, '...KP..PK...', '...KK..PK...', '...KWK.KK...', '...KWwK.....', '....KWK.....', '....KWK.....'];
  return [sprite(a, pal), sprite(b, pal)];
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.72));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export class Racer {
  constructor(canvas, hooks, audio) {
    this.canvas = canvas; this.hooks = hooks; this.audio = audio;
    this.active = false;
    this.trackIndex = Number(localStorage.getItem('racerTrack')) || 0;
    this.onResize = () => this.screen?.resize();
    this.loop = this.loop.bind(this);
    this.playerSprites = riderSprites('#fc6719', '#ffffff');
    this.greenSprites = riderSprites('#2fa84f', '#ffffff');
    this.polkaSprites = riderSprites('#ffffff', '#e63946'); // bianca con pois rossi (le pieghe 'j')
    this.ghostSprites = this.playerSprites.map(whiten);
    this.labels = { SPRINT: labelSprite('SPRINT', '#2fa84f'), GPM: labelSprite('GPM', '#e63946') };
    this.rivalSprites = RIVALS.map((r) => riderSprites(r.jersey, r.helmet));
    this.buildScenerySprites();
  }

  buildScenerySprites() {
    const S = {};
    S.palm = sprite(['....GG.GG...', '..GGGGGGGGG.', '.GGG.GGG.GGG', 'GG...TG...GG', '.....T......', '.....T......', '.....TT.....', '......T.....', '......T.....', '......T.....', '......T.....', '.....TTT....'], { G: '#2d6a4f', T: '#7f5539' });
    S.pine = sprite(['.....G.....', '....GGG....', '...GGGGG...', '....GGG....', '..GGGGGGG..', '...GGGGG...', '.GGGGGGGGG.', '..GGGGGGG..', 'GGGGGGGGGGG', '.....T.....', '.....T.....'], { G: '#1b4332', T: '#5c3d2e' });
    S.rock = sprite(['...RRRR..', '.RRRrRRR.', 'RRrrRRRRR', 'RRRRRrRRR'], { R: '#8d99ae', r: '#6c757d' });
    S.cow = sprite(['KK.......', 'WWWWWWWW.', 'WKKWWKWWW', 'WWWWWKKWW', '.K.K..K.K'], { K: '#222', W: '#f1f1f1' });
    S.umbrella = sprite(['..RRWWRR..', '.RRWWRRWW.', 'RRWWRRWWRR', '....T.....', '....T.....', '....T.....', '....T.....'], { R: '#e63946', W: '#fff', T: '#555' });
    S.lamp = sprite(['TTTTT', 'T..YY', 'T....', 'T....', 'T....', 'T....', 'T....', 'T....', 'T....', 'TT...'], { T: '#3d4451', Y: '#ffe14d' });
    S.building = sprite(['BBBBBBBB', 'BYBBYBBB', 'BBBBBBYB', 'BYBBBBBB', 'BBBYBBYB', 'BBBBBBBB', 'BYBBYBBB', 'BBBBBBBB'], { B: '#1e1438', Y: '#ffe14d' });
    S.neon = sprite(['PPPPPPP', 'P.....P', 'P.CCC.P', 'P.....P', 'PPPPPPP', '...T...', '...T...', '...T...'], { P: '#ff4fd8', C: '#4de3ff', T: '#333' });
    S.flag = sprite(['TRRRR', 'TRRWW', 'TWWGG', 'TGG..', 'T....', 'T....', 'T....'], { T: '#444', R: '#e63946', W: '#fff', G: '#2a9d8f' });
    const fanPal = { K: '#14141f', S: '#f2c29b', A: '#e63946', B: '#3a86ff', C: '#ffd166' };
    S.fans = [sprite(['.S..S..S.', 'KSK.KSKKS', 'AAA.BBBCC', 'AAA.BBBCC', 'K.K.K.KK.'], fanPal), sprite(['S...S...S', 'KS.KSK.SK', 'AAA.BBBCC', 'AAA.BBBCC', 'K.K.K.KK.'], fanPal)];
    S.box = (t) => sprite(['KKKKKKK', 'KYYYYYK', 'KYKKKYK', 'KYYYKYK', 'KYYKYYK', 'KYYYYYK', 'KYYKYYK', 'KKKKKKK'], { K: '#14141f', Y: `hsl(${(t * 200) % 360} 90% 60%)` });
    S.coin = sprite(['.YYY.', 'YYWYY', 'YYWYY', 'YYWYY', '.YYY.'], { Y: '#ffcc33', W: '#fff7c2' });
    S.tacks = sprite(['.K..K.K..', 'KWK.KWKK.', '..K.W..WK'], { K: '#222', W: '#ddd' });
    this.S = S;
  }

  // ---------- circuito ----------
  buildTrack() {
    const T = TRACKS[this.trackIndex];
    this.T = T;
    const segs = [];
    let y = 0;
    const add = (n, curve, grade) => {
      const prev = segs.length ? segs[segs.length - 1] : null;
      const startCurve = prev ? prev.curve : 0; const startGrade = prev ? prev.grade : 0;
      for (let i = 0; i < n; i++) {
        const k = Math.min(1, i / Math.min(15, n / 2)); // transizione morbida
        const c = lerp(startCurve, curve, k); const gr = lerp(startGrade, grade, k);
        const y1 = y; y += (gr / 100) * SEG * HILL_VIS;
        segs.push({ index: segs.length, curve: c, grade: gr, p1: { y: y1, z: segs.length * SEG }, p2: { y, z: (segs.length + 1) * SEG }, sprites: [], items: [] });
      }
    };
    for (const [n, c, g] of T.layout) add(n, c, g);
    // chiusura: riporta l'altezza a zero
    const closeN = 40; const dy = -y / closeN;
    for (let i = 0; i < closeN; i++) {
      const y1 = y; y += dy;
      segs.push({ index: segs.length, curve: 0, grade: (dy / (SEG * HILL_VIS)) * 100, p1: { y: y1, z: segs.length * SEG }, p2: { y, z: (segs.length + 1) * SEG }, sprites: [], items: [] });
    }
    // scenografia
    segs.forEach((s, i) => {
      if (i % 3 === 0) {
        const kind = T.scenery[Math.floor(hash(i) * T.scenery.length)];
        const side = hash(i + 7) > 0.5 ? 1 : -1;
        s.sprites.push({ kind, offset: side * (1.25 + hash(i + 3) * 1.4), seed: hash(i + 11) });
      }
      if (s.grade >= 4 && i % 4 === 0) s.sprites.push({ kind: 'fans', offset: (hash(i) > 0.5 ? 1 : -1) * 1.45, seed: hash(i) });
      // scatole oggetto e monete
      if (i > 20 && i % 45 === 0) for (const l of LANES) s.items.push({ type: 'box', x: l, taken: 0 });
      if (i > 10 && i % 28 === 14) { const l = LANES[Math.floor(hash(i) * 3)]; for (let k = 0; k < 4; k++) segs[(i + k * 2) % segs.length].items.push({ type: 'coin', x: l, taken: 0 }); }
    });
    // traguardo volante a metà giro, Gran Premio della Montagna nel punto più alto
    let top = 0; segs.forEach((sg, i) => { if (sg.p2.y > segs[top].p2.y) top = i; });
    if (segs[top].p2.y < 50) top = Math.floor(segs.length * 0.8);
    const mid = Math.floor(segs.length * 0.45);
    this.lines = [{ type: 'green', seg: mid, z: mid * SEG }, { type: 'kom', seg: top, z: top * SEG }];
    segs[mid].sprites.push({ kind: 'arch', label: 'SPRINT', offset: 0 });
    segs[top].sprites.push({ kind: 'arch', label: 'GPM', offset: 0 });
    this.segs = segs;
    this.trackLen = segs.length * SEG;
  }

  segAt(z) { return this.segs[Math.floor(((z % this.trackLen) + this.trackLen) % this.trackLen / SEG)]; }

  // ---------- ciclo di vita ----------
  start() {
    this.active = true;
    this.screen = new PixelScreen(this.canvas, 220);
    window.addEventListener('resize', this.onResize);
    this.effort = new Effort();
    this.state = 'select'; this.t = 0; this.selT = 0; this.texts = [];
    this.power = 0; this.cadence = 0;
    this.buildTrack();
    this.audio.playSong(SONGS.menu);
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.active = false;
    window.removeEventListener('resize', this.onResize);
    this.audio.stopSong();
    this.hooks.setGrade(null);
  }

  newRace() {
    this.buildTrack();
    this.pos = 0; this.x = 0; this.lane = 1; this.speed = 0; this.lap = 1; this.raceT = 0;
    this.item = null; this.itemT = 0; this.boost = 0; this.boostKind = null; this.shield = false; this.bumpT = 0;
    this.draft = 0; this.coins = 0; this.sprintHeld = 0; this.finished = false;
    this.tacks = []; this.lean = 0;
    this.points = { green: {}, kom: {} }; this.lineCount = {}; this.draftAcc = 0;
    this.ghostRec = []; this.ghostT = 0;
    try { this.ghost = JSON.parse(localStorage.getItem(`racerGhost${this.trackIndex}`) || 'null'); } catch { this.ghost = null; }
    // griglia di partenza: il giocatore parte in fondo
    this.rivals = RIVALS.map((r, i) => ({
      ...r, i, sprites: this.rivalSprites[i],
      z: (7 - i) * 3 * UNITS_PER_M + 6 * UNITS_PER_M, x: LANES[i % 3], targetX: LANES[i % 3], speed: 0, laps: 0, finished: null,
      boost: 0, slow: 0, phase: rand(0, 6), said: 0,
    }));
    this.state = 'countdown'; this.stateT = 0; this.lastBeep = 4;
    this.sentGrade = null;
    this.audio.playSong(SONGS.race);
    this.audio.setTempo(0);
  }

  input(dir) {
    this.audio.ensure();
    if (this.state === 'select') {
      if (dir < 0) { this.trackIndex = (this.trackIndex + 1) % TRACKS.length; this.buildTrack(); this.audio.sfx('select'); }
      else if (this.selT > 0.4) { localStorage.setItem('racerTrack', this.trackIndex); this.audio.sfx('pickup'); this.newRace(); }
      return;
    }
    if (this.state === 'results') {
      if (this.stateT < 1.5) return;
      if (dir > 0) this.newRace(); else { this.state = 'select'; this.selT = 0; this.audio.playSong(SONGS.menu); }
      return;
    }
    if (this.state !== 'race') return;
    const prev = this.lane;
    this.lane = clamp(this.lane + dir, 0, 2);
    if (prev !== this.lane) { this.audio.sfx('select'); this.lean = dir; }
  }

  // ---------- logica ----------
  get raceDist() { return (this.lap - 1) * this.trackLen + this.pos; }

  update(dt) {
    this.t += dt; this.selT += dt;
    const connected = this.hooks.connected();
    const st = this.hooks.stats();
    const demoSprint = !connected && (this.t % 18) > 14;
    this.power = connected ? st.power || 0 : demoSprint ? 300 : 160;
    this.cadence = connected ? st.cadence || 0 : 88;
    const kmh = connected ? this.hooks.speedKmh() : 30;
    this.sprinting = this.effort.update(this.power, dt, connected ? 50 : 0);
    if (this.audio.song) this.audio.setTempo(this.audio.song.bpm * clamp((this.cadence || 85) / 88, 0.85, 1.2));
    this.texts.forEach((x) => { x.t -= dt; }); this.texts = this.texts.filter((x) => x.t > 0);
    if (this.state === 'select') return;
    this.stateT += dt;
    this.lean *= Math.pow(0.02, dt);

    if (this.state === 'countdown') {
      const left = 3 - Math.floor(this.stateT);
      if (left !== this.lastBeep && left > 0) { this.lastBeep = left; this.audio.sfx('beep'); }
      if (this.stateT >= 3) { this.state = 'race'; this.stateT = 0; this.audio.sfx('go'); this.say('VIA!', '#06d6a0', 1, true); }
      return;
    }
    if (this.state === 'results') return;

    // velocità del giocatore
    let v = (kmh / 3.6) * WORLD_SCALE;
    let mult = 1 + Math.min(10, this.coins) * 0.01;
    if (this.draft > 0.99) mult += 0.12;
    if (this.boost > 0) { this.boost -= dt; mult += this.boostKind === 'gel' ? 0.4 : 0.25; if (this.boost <= 0) this.boostKind = null; }
    if (this.bumpT > 0) { this.bumpT -= dt; mult *= 0.6; }
    v *= mult;
    this.speed = v;
    this.x = lerp(this.x, LANES[this.lane], Math.min(1, dt * 8));
    if (!this.finished) this.raceT += dt;
    const prevPos = this.pos;
    this.pos += v * UNITS_PER_M * dt;
    this.checkLines('TU', prevPos, this.pos, this.lap);
    this.ghostT += dt;
    if (this.ghostT >= 0.25) { this.ghostT -= 0.25; this.ghostRec.push(Math.round(this.raceDist / UNITS_PER_M)); }
    if (this.draft >= 1) { this.draftAcc += dt; if (this.draftAcc >= 1) { this.draftAcc -= 1; this.prog('draftSec', 1, 1); } }
    if (this.pos >= this.trackLen) {
      this.pos -= this.trackLen; this.lap++;
      if (this.lap > LAPS) this.finish();
      else { this.say(this.lap === LAPS ? 'ULTIMO GIRO!' : `GIRO ${this.lap}/${LAPS}`, '#ffd34d', 2, true); this.audio.sfx('pickup'); }
    }

    // pendenza al rullo
    const seg = this.segAt(this.pos + CAM_H);
    this.grade = clamp(seg.grade, -4, 6);
    const g = Math.round(this.grade * 2) / 2;
    if (g !== this.sentGrade) { this.sentGrade = g; this.hooks.setGrade(g); }

    // sprint = usa l'oggetto
    if (this.sprinting) this.sprintHeld += dt; else this.sprintHeld = Math.max(0, this.sprintHeld - dt * 2);
    if (this.item && this.sprintHeld >= 1.2) { this.useItem(); this.sprintHeld = 0; }

    this.updateRivals(dt, v);
    this.pickups();
  }

  say(text, color = '#ffd34d', t = 1.5, big = false) { this.texts.push({ text, color, t, big }); }

  prog(stat, n = 1, xp = 0) { this.hooks.progress?.event(stat, n, xp); }

  // traguardo volante e GPM: punti 5/3/1 ai primi tre che passano, a ogni giro
  checkLines(name, from, to, lap) {
    for (const ln of this.lines) {
      if (!(from < ln.z && to >= ln.z)) continue;
      const key = `${ln.type}${lap}`;
      const n = this.lineCount[key] || 0; this.lineCount[key] = n + 1;
      if (n > 2) continue;
      const pts = [5, 3, 1][n];
      this.points[ln.type][name] = (this.points[ln.type][name] || 0) + pts;
      if (name === 'TU') {
        this.audio.sfx(n === 0 ? 'win' : 'coin');
        this.say(`${ln.type === 'kom' ? 'GPM' : 'TRAGUARDO VOLANTE'}: ${n + 1}° · +${pts} punti`, ln.type === 'kom' ? '#e63946' : '#2fa84f', 2, n === 0);
      }
    }
  }

  leader(type) {
    const e = Object.entries(this.points?.[type] || {}).sort((a, b) => b[1] - a[1])[0];
    return e ? { name: e[0], pts: e[1] } : null;
  }

  ghostDistAt(t) {
    const g = this.ghost; if (!g || !g.length) return null;
    const i = t / 0.25; const a = Math.floor(i);
    if (a >= g.length - 1) return g[g.length - 1] * UNITS_PER_M;
    return lerp(g[a], g[a + 1], i - a) * UNITS_PER_M;
  }

  pickups() {
    const seg = this.segAt(this.pos + CAM_H * 1.6);
    for (const it of seg.items) {
      if (it.taken > this.t - 6 || Math.abs(it.x - this.x) > 0.3) continue;
      it.taken = this.t;
      if (it.type === 'coin') { this.coins++; this.audio.sfx('coin'); this.prog('coins', 1, 1); if (this.coins === 10) this.say('10 MONETE: VELOCITÀ MAX +10%', '#ffcc33', 2); }
      else if (it.type === 'box' && !this.item) this.rollItem();
    }
    // chiodini lasciati dai rivali
    for (const tk of this.tacks) {
      if (tk.owner === 'player' || tk.hit) continue;
      const d = ((tk.z - this.pos - CAM_H * 1.6) % this.trackLen + this.trackLen) % this.trackLen;
      if (d < 40 && Math.abs(tk.x - this.x) < 0.3) { tk.hit = true; this.bump('CHIODINI!'); }
    }
  }

  rollItem() {
    const place = this.place();
    // oggetti migliori a chi è indietro (tiene la gara combattuta)
    const pool = place <= 2 ? ['shield', 'tacks', 'tacks', 'gel'] : place <= 5 ? ['gel', 'tacks', 'shield', 'gel', 'wind'] : ['gel', 'wind', 'wind', 'gel'];
    this.item = pick(pool);
    this.audio.sfx('pickup');
    this.say(`${ITEMS[this.item].name}! Fai uno SPRINT per usarlo`, ITEMS[this.item].color, 2.2);
  }

  useItem() {
    const it = this.item; this.item = null;
    this.audio.sfx('overdrive');
    this.prog('itemsUsed', 1, 10);
    if (it === 'gel') { this.boost = 4; this.boostKind = 'gel'; this.audio.sfx('boost'); }
    if (it === 'wind') { this.boost = 7; this.boostKind = 'wind'; this.audio.sfx('boost'); }
    if (it === 'shield') this.shield = true;
    if (it === 'tacks') this.tacks.push({ z: this.pos + CAM_H - 10 * UNITS_PER_M, x: this.x, owner: 'player', laps: this.lap });
    this.say(`${ITEMS[it].name}!`, ITEMS[it].color, 1.4, true);
  }

  bump(text) {
    if (this.shield) { this.shield = false; this.say('SCUDO!', '#4de3ff', 1); this.audio.sfx('clank'); return; }
    if (this.bumpT > 0) return;
    this.bumpT = 1; this.audio.sfx('hurt'); this.say(text, '#ff6b6b', 1);
    if (navigator.vibrate) navigator.vibrate(60);
  }

  updateRivals(dt, playerV) {
    const avgV = Math.max(4, ((this.effort.avg || 150) / 160) * 8.3 * WORLD_SCALE); // ~velocità media "tua"
    const myDist = this.raceDist;
    this.draftTarget = null;
    let drafting = false;
    for (const r of this.rivals) {
      if (r.finished != null) { r.z += r.speed * UNITS_PER_M * dt * 0.3; continue; }
      const rd = r.laps * this.trackLen + r.z;
      const gap = (rd - myDist) / UNITS_PER_M; // metri (positivo = davanti a te)
      // elastico: i rivali restano vicini per rendere la gara combattuta
      const band = clamp(1 - gap / 260, 0.82, 1.18);
      const seg = this.segAt(r.z);
      const climb = 1 - Math.max(0, seg.grade) * (r.name === 'Lia Leggera' ? 0.01 : 0.03);
      let target = avgV * r.skill * band * climb * (1 + Math.sin(this.t * 0.3 + r.phase) * 0.04);
      if (this.state === 'race' && this.lap === LAPS && this.pos > this.trackLen * 0.75) target *= 1.06; // volata finale
      if (r.boost > 0) { r.boost -= dt; target *= 1.3; }
      if (r.slow > 0) { r.slow -= dt; target *= 0.6; }
      r.speed = lerp(r.speed, target, Math.min(1, dt * 0.8));
      const pz = r.z;
      r.z += r.speed * UNITS_PER_M * dt;
      this.checkLines(r.name, pz, r.z, r.laps + 1);
      if (r.z >= this.trackLen) { r.z -= this.trackLen; r.laps++; if (r.laps >= LAPS) r.finished = this.raceT; }
      // cambi di corsia e oggetti casuali
      if (Math.random() < dt * 0.25) r.targetX = pick(LANES);
      if (Math.random() < dt * 0.03) r.boost = 2.5;
      r.x = lerp(r.x, r.targetX, Math.min(1, dt * 2));
      for (const tk of this.tacks) {
        if (tk.owner !== 'player' || tk.hits?.has(r)) continue;
        const d = ((r.z - tk.z) % this.trackLen + this.trackLen) % this.trackLen;
        if (d < 30 && Math.abs(r.x - tk.x) < 0.3) { r.slow = 1.5; (tk.hits = tk.hits || new Set()).add(r); this.say(`${r.name} sui chiodini!`, '#adb5bd', 1.2); }
      }
      // interazione con il giocatore
      const sameLane = Math.abs(r.x - this.x) < 0.35;
      if (sameLane && gap > 2 && gap < 14) { drafting = true; this.draftTarget = r; }
      if (sameLane && gap > -0.5 && gap < 2.2 && playerV > r.speed) { this.bump('URTO!'); r.boost = 0.6; }
      if (gap < -1 && gap > -3 && r.said < this.t - 20 && Math.random() < dt * 2) { r.said = this.t; this.say(`${r.name}: "${r.line}"`, r.jersey, 2); }
    }
    this.draft = clamp(this.draft + (drafting ? dt / 1.2 : -dt * 2), 0, 1);
    if (this.draft >= 1 && !this.draftShown) { this.draftShown = true; this.say('SCIA! +12%', '#4de3ff', 1); this.audio.sfx('boost'); }
    if (this.draft < 0.5) this.draftShown = false;
    // classifica attuale
    this.standing = this.ranking();
  }

  ranking() {
    const list = [{ name: 'TU', me: true, d: this.raceDist, fin: this.finished ? this.finishT : null }];
    for (const r of this.rivals) list.push({ name: r.name, color: r.jersey, d: r.laps * this.trackLen + r.z, fin: r.finished });
    list.sort((a, b) => {
      if (a.fin != null && b.fin != null) return a.fin - b.fin;
      if (a.fin != null) return -1; if (b.fin != null) return 1;
      return b.d - a.d;
    });
    return list;
  }

  place() { return (this.standing || this.ranking()).findIndex((x) => x.me) + 1; }

  finish() {
    this.finished = true; this.finishT = this.raceT;
    this.standing = this.ranking();
    const place = this.place();
    this.state = 'results'; this.stateT = 0;
    this.audio.stopSong();
    this.audio.sfx(place <= 3 ? 'win' : 'lose');
    const key = `racerBest${this.trackIndex}`;
    const best = Number(localStorage.getItem(key)) || Infinity;
    this.newBest = this.raceT < best;
    if (this.newBest) {
      localStorage.setItem(key, this.raceT.toFixed(1));
      try { localStorage.setItem(`racerGhost${this.trackIndex}`, JSON.stringify(this.ghostRec)); } catch { /* spazio */ }
      if (this.ghost) this.prog('ghostBeaten', 1, 100);
    }
    this.prog('races', 1, 60 + ([100, 70, 50][place - 1] || 0));
    if (place <= 3) this.prog('podiums', 1, 0);
    if (place === 1) { this.prog('wins', 1, 0); this.hooks.progress?.addToList('tracksWon', this.trackIndex); }
    this.jerseyWon = [];
    if (this.leader('green')?.name === 'TU') { this.jerseyWon.push('green'); this.prog('green', 1, 80); this.prog('jerseys', 1, 0); }
    if (this.leader('kom')?.name === 'TU') { this.jerseyWon.push('kom'); this.prog('kom', 1, 80); this.prog('jerseys', 1, 0); }
    this.hooks.setGrade(0);
  }

  // ---------- disegno ----------
  project(p, camX, camY, camZ, w, h) {
    const cz = p.z - camZ;
    const s = DEPTH / cz;
    return { x: Math.round(w / 2 + s * (p.x - camX) * w / 2), y: Math.round(h / 2 - s * (p.y - camY) * h / 2), w: Math.round(s * ROAD_W * w / 2), s, cz };
  }

  draw() {
    const scr = this.screen; const g = scr.g; const w = scr.vw; const h = scr.vh;
    if (this.state === 'select') { this.drawSelect(); return; }
    const T = this.T;
    const horizonY = Math.round(h * 0.42);
    // cielo e sfondo
    bandedSky(g, w, horizonY + 20, T.sky);
    const curveShift = (this.segAt(this.pos).curve * 3 + this.pos / 4000) % w;
    this.drawBackdrop(g, w, horizonY, curveShift);

    const base = this.segAt(this.pos);
    const basePct = (this.pos % SEG) / SEG;
    const pz = this.pos + CAM_H * 1.6;
    const ps = this.segAt(pz);
    const ppct = (pz % SEG) / SEG;
    const playerY = lerp(ps.p1.y, ps.p2.y, ppct);
    let x = 0; let dx = -base.curve * basePct;
    let maxy = h;
    const camY = playerY + CAM_H;
    const camX = this.x * ROAD_W;
    const visible = [];
    for (let n = 0; n < DRAW; n++) {
      const seg = this.segs[(base.index + n) % this.segs.length];
      const looped = seg.index < base.index;
      const camZ = this.pos - (looped ? this.trackLen : 0);
      const p1 = this.project({ x: 0, y: seg.p1.y, z: seg.p1.z }, camX - x, camY, camZ, w, h * 0.84);
      const p2 = this.project({ x: 0, y: seg.p2.y, z: seg.p2.z }, camX - x - dx, camY, camZ, w, h * 0.84);
      p1.y += Math.round(h * 0.08); p2.y += Math.round(h * 0.08);
      x += dx; dx += seg.curve;
      seg.clip = maxy;
      seg.proj = { p1, p2, looped };
      if (p1.cz <= DEPTH || p2.y >= p1.y || p2.y >= maxy) continue;
      this.drawSegment(g, w, p1, p2, seg.index, n);
      maxy = p1.y;
      visible.push(seg);
    }
    // oggetti dal più lontano al più vicino
    const sprites = [];
    for (const seg of visible) {
      const { p1 } = seg.proj;
      for (const sp of seg.sprites) sprites.push({ kind: sp.kind, seed: sp.seed, sx: p1.x + p1.w * sp.offset, sy: p1.y, s: p1.w, clip: seg.clip, d: p1.cz });
      for (const it of seg.items) if (it.taken < this.t - 6 || !it.taken) sprites.push({ kind: it.type, sx: p1.x + p1.w * it.x, sy: p1.y, s: p1.w, clip: seg.clip, d: p1.cz });
    }
    const segOf = (z) => this.segAt(z);
    for (const tk of this.tacks) {
      const seg = segOf(tk.z); if (!seg.proj || seg.clip == null) continue;
      const { p1 } = seg.proj; if (p1.cz <= DEPTH) continue;
      sprites.push({ kind: 'tacks', sx: p1.x + p1.w * tk.x, sy: p1.y, s: p1.w, clip: seg.clip, d: p1.cz });
    }
    for (const r of this.rivals) {
      const rel = ((r.z - this.pos) % this.trackLen + this.trackLen) % this.trackLen;
      if (rel > DRAW * SEG * 0.8 || rel < CAM_H * 0.8) continue;
      const seg = segOf(r.z); if (!seg.proj) continue;
      const pct = (r.z % SEG) / SEG;
      const { p1, p2 } = seg.proj; if (p1.cz <= DEPTH) continue;
      const sx = lerp(p1.x, p2.x, pct) + lerp(p1.w, p2.w, pct) * r.x; const sy = lerp(p1.y, p2.y, pct); const s = lerp(p1.w, p2.w, pct);
      sprites.push({ kind: 'rival', r, sx, sy, s, clip: seg.clip, d: p1.cz - pct * SEG });
    }
    // fantasma del tuo record
    if (this.ghost && this.state === 'race') {
      const gd = this.ghostDistAt(this.raceT);
      if (gd != null) {
        const gz = gd % this.trackLen;
        const rel = ((gz - this.pos) % this.trackLen + this.trackLen) % this.trackLen;
        const seg = segOf(gz);
        if (rel > CAM_H * 0.8 && rel < DRAW * SEG * 0.8 && seg.proj && seg.proj.p1.cz > DEPTH) {
          const pct = (gz % SEG) / SEG; const { p1, p2 } = seg.proj;
          sprites.push({ kind: 'ghost', sx: lerp(p1.x, p2.x, pct), sy: lerp(p1.y, p2.y, pct), s: lerp(p1.w, p2.w, pct), clip: seg.clip, d: p1.cz - pct * SEG });
        }
      }
    }
    sprites.sort((a, b) => b.d - a.d);
    for (const sp of sprites) this.drawSprite(g, sp);

    this.drawPlayer(g, w, h);
    scr.present(this.bumpT > 0.7 ? rand(-2, 2) : 0, 0);
    this.drawHud();
  }

  drawBackdrop(g, w, hy, shift) {
    const T = this.T;
    pring(g, w * 0.7 - shift * 0.2, hy - 26, 16, T.sun, true);
    if (this.trackIndex === 0) {
      g.fillStyle = T.sea; g.fillRect(0, hy - 2, w, 24);
      g.fillStyle = T.seaLight; for (let i = 0; i < 6; i++) g.fillRect(Math.round(w * 0.7 - shift * 0.2 - 12 + (i % 2) * 4), hy + i * 3, 24 - i * 3, 1);
    } else if (this.trackIndex === 1) {
      for (let x = 0; x < w; x++) {
        const wx = x + shift * 0.4; const mh = 26 + Math.sin(wx * 0.035) * 12 + Math.sin(wx * 0.011) * 10;
        g.fillStyle = T.mountains; g.fillRect(x, hy + 14 - mh, 1, mh + 10);
        if (mh > 34) { g.fillStyle = T.snow; g.fillRect(x, hy + 14 - mh, 1, Math.round((mh - 34) * 0.7) + 1); }
      }
    } else {
      for (let i = -1; i < w / 14 + 2; i++) {
        const bx = Math.round(i * 14 - (shift * 0.5) % 14); const bh = 14 + hash(i + Math.floor(shift * 0.5 / 14)) * 34;
        g.fillStyle = T.city; g.fillRect(bx, hy + 16 - bh, 12, bh + 6);
        for (let k = 0; k < bh / 5; k++) if (hash(i * 13 + k) > 0.55) { g.fillStyle = pick(T.neon); g.fillRect(bx + 2 + (k % 3) * 3, hy + 18 - bh + k * 4, 1, 1); }
      }
    }
  }

  drawSegment(g, w, p1, p2, index, n) {
    const T = this.T;
    const alt = Math.floor(index / 2) % 2;
    // erba
    g.fillStyle = T.grass[alt]; g.fillRect(0, p2.y, w, p1.y - p2.y + 1);
    const quad = (x1, y1, w1, x2, y2, w2, col) => {
      g.fillStyle = col; g.beginPath();
      g.moveTo(x1 - w1, y1 + 1); g.lineTo(x1 + w1, y1 + 1); g.lineTo(x2 + w2, y2); g.lineTo(x2 - w2, y2); g.fill();
    };
    quad(p1.x, p1.y, p1.w * 1.12, p2.x, p2.y, p2.w * 1.12, T.rumble[alt]);
    quad(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, T.road[alt]);
    if (alt) for (const lx of [-0.31, 0.31]) {
      const cx1 = p1.x + p1.w * lx; const cx2 = p2.x + p2.w * lx;
      quad(cx1, p1.y, Math.max(0.5, p1.w * 0.02), cx2, p2.y, Math.max(0.5, p2.w * 0.02), T.lane);
    }
    // linea del traguardo
    if (index < 2) for (let k = 0; k < 8; k++) {
      const a = -1 + k / 4; const b = a + 0.25;
      g.fillStyle = (k + index) % 2 ? '#fff' : '#111';
      g.beginPath(); g.moveTo(p1.x + p1.w * a, p1.y + 1); g.lineTo(p1.x + p1.w * b, p1.y + 1); g.lineTo(p2.x + p2.w * b, p2.y); g.lineTo(p2.x + p2.w * a, p2.y); g.fill();
    }
    // nebbia in lontananza
    if (n > DRAW * 0.6) { g.fillStyle = `rgba(${this.trackIndex === 2 ? '20,10,40' : '230,220,240'},${((n - DRAW * 0.6) / (DRAW * 0.4)) * 0.5})`; g.fillRect(0, p2.y, w, p1.y - p2.y + 1); }
  }

  drawSprite(g, sp) {
    const S = this.S;
    let img;
    let worldW = 0.5; // larghezza rispetto alla mezza strada
    if (sp.kind === 'arch') { this.drawArch(g, sp); return; }
    if (sp.kind === 'ghost') g.globalAlpha = 0.45;
    switch (sp.kind) {
      case 'ghost': img = this.ghostSprites[frame2(this.t * 3)]; worldW = 0.2; break;
      case 'rival': img = sp.r.sprites[frame2(this.t * Math.max(1, sp.r.speed / 2.5))]; worldW = 0.2; break;
      case 'palm': img = S.palm; worldW = 0.9; break;
      case 'pine': img = S.pine; worldW = 0.9; break;
      case 'rock': img = S.rock; worldW = 0.6; break;
      case 'cow': img = S.cow; worldW = 0.6; break;
      case 'umbrella': img = S.umbrella; worldW = 0.7; break;
      case 'lamp': img = S.lamp; worldW = 0.4; break;
      case 'building': img = S.building; worldW = 1.6; break;
      case 'neon': img = S.neon; worldW = 0.8; break;
      case 'flag': img = S.flag; worldW = 0.45; break;
      case 'fans': img = S.fans[frame2(this.t * 4 + (sp.seed || 0) * 10)]; worldW = 0.5; break;
      case 'box': img = S.box(this.t); worldW = 0.16; break;
      case 'coin': img = S.coin; worldW = 0.1; break;
      case 'tacks': img = S.tacks; worldW = 0.18; break;
      default: return;
    }
    const dw = Math.max(1, Math.round(sp.s * worldW));
    const dh = Math.round((dw * img.height) / img.width);
    if (dw > 400) return;
    let dy = sp.sy - dh;
    if (sp.kind === 'box' || sp.kind === 'coin') dy -= Math.round(dh * 0.4 + Math.sin(this.t * 5) * dh * 0.1);
    const clipH = sp.clip != null ? Math.max(0, sp.clip - dy) : dh;
    if (clipH <= 0) return;
    const srcH = Math.min(img.height, Math.ceil((clipH / dh) * img.height));
    g.drawImage(img, 0, 0, img.width, srcH, Math.round(sp.sx - dw / 2), dy, dw, Math.round((srcH / img.height) * dh));
    g.globalAlpha = 1;
    if (sp.kind === 'rival' && dw > 14) {
      const r = sp.r;
      g.fillStyle = r.jersey; g.fillRect(Math.round(sp.sx - 1), dy - 4, 3, 2);
    }
  }

  drawArch(g, sp) {
    const half = sp.s * 1.15; const hgt = Math.round(sp.s * 0.75);
    if (hgt < 2) return;
    const top = sp.sy - hgt;
    if (sp.clip != null && top > sp.clip) return;
    const pw = Math.max(1, Math.round(sp.s * 0.04));
    g.fillStyle = '#ddd';
    g.fillRect(Math.round(sp.sx - half), top, pw, hgt); g.fillRect(Math.round(sp.sx + half - pw), top, pw, hgt);
    const lab = this.labels[sp.label];
    const bh = Math.max(2, Math.round(sp.s * 0.16));
    g.drawImage(lab, Math.round(sp.sx - half), top, Math.round(half * 2), bh);
  }

  drawPlayer(g, w, h) {
    const set = this.leader('kom')?.name === 'TU' ? this.polkaSprites : this.leader('green')?.name === 'TU' ? this.greenSprites : this.playerSprites;
    const img = set[frame2(this.t * Math.max(2, (this.cadence || 0) / 30))];
    const scale = Math.max(2, Math.round(w / 60));
    const dw = img.width * scale; const dh = img.height * scale;
    const px = Math.round(w / 2 - dw / 2 + this.lean * 4); const py = Math.round(h * 0.92 - dh);
    // ombra
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px + scale * 2, py + dh - scale, dw - scale * 4, scale * 2);
    if (this.boost > 0) for (let i = 0; i < 6; i++) { g.fillStyle = this.boostKind === 'gel' ? pick(['#ffd166', '#ff9f1c', '#fff3b0']) : pick(['#06d6a0', '#b7efc5']); g.fillRect(px + dw / 2 + rand(-dw / 3, dw / 3), py + dh + rand(0, 8), scale, scale * rand(1, 3)); }
    if (this.draft >= 1) for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(77,227,255,.7)'; g.fillRect(rand(0, w), rand(h * 0.4, h), 1, rand(6, 16)); }
    g.save();
    g.translate(px + dw / 2, py + dh); g.rotate(this.lean * 0.12);
    g.drawImage(img, -dw / 2, -dh, dw, dh);
    g.restore();
    if (this.shield) pring(g, px + dw / 2, py + dh / 2, Math.round(dw * 0.75), 'rgba(77,227,255,.8)');
  }

  // ---------- interfaccia ----------
  drawHud() {
    const ctx = this.screen.ctx; const W = this.screen.W; const H = this.screen.H;
    const top = 52;
    const place = this.place();
    if (this.state === 'race' || this.state === 'results' || this.state === 'countdown') {
      hudText(ctx, `${place}°`, 14, top + 40, { size: 44, color: place <= 3 ? '#ffd34d' : '#fff' });
      hudText(ctx, '/8', 14 + (place >= 10 ? 62 : 44), top + 40, { size: 18, color: '#cfd6e4' });
      hudText(ctx, `GIRO ${Math.min(this.lap, LAPS)}/${LAPS}`, W - 14, top + 20, { size: 16, align: 'right' });
      hudText(ctx, fmt(this.raceT), W - 14, top + 40, { size: 14, align: 'right', color: '#cfd6e4' });
      hudText(ctx, `${Math.round((this.speed / WORLD_SCALE) * 3.6)} km/h  ${Math.round(this.power)} W  ${this.grade?.toFixed(1) ?? 0}%`, W - 14, top + 58, { size: 12, align: 'right', color: '#cfd6e4' });
      hudText(ctx, `🪙 ${this.coins}`, 14, top + 62, { size: 14, color: '#ffcc33' });
      // oggetto
      const iy = top + 78;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(14, iy, 170, 48);
      if (this.item) {
        const it = ITEMS[this.item];
        hudText(ctx, it.name, 22, iy + 16, { size: 13, color: it.color });
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(22, iy + 22, 154, 8);
        ctx.fillStyle = this.sprinting ? '#4de3ff' : '#888'; ctx.fillRect(22, iy + 22, 154 * clamp(this.sprintHeld / 1.2, 0, 1), 8);
        hudText(ctx, `sprint sopra ${this.effort.threshold} W per usarlo`, 22, iy + 43, { size: 10, color: '#cfd6e4' });
      } else hudText(ctx, 'nessun oggetto: prendi una ?', 22, iy + 28, { size: 11, color: '#888' });
      // scia
      if (this.draft > 0.05) {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W - 134, iy, 120, 16);
        ctx.fillStyle = this.draft >= 1 ? '#4de3ff' : '#2a6f97'; ctx.fillRect(W - 134, iy, 120 * this.draft, 16);
        hudText(ctx, this.draft >= 1 ? 'IN SCIA +12%' : 'scia…', W - 74, iy + 12, { size: 11, align: 'center' });
      }
      // maglie e fantasma
      const gr = this.leader('green'); const km = this.leader('kom');
      hudText(ctx, `🟢 ${gr ? `${gr.name === 'TU' ? 'TU' : gr.name.split(' ')[0]} ${gr.pts}` : '-'}   🔴⚪ ${km ? `${km.name === 'TU' ? 'TU' : km.name.split(' ')[0]} ${km.pts}` : '-'}`, W - 14, top + 76 + 40, { size: 11, align: 'right', color: '#e8e8e8' });
      if (this.ghost && this.state === 'race') {
        const gd = this.ghostDistAt(this.raceT);
        if (gd != null) {
          const gap = (gd - this.raceDist) / UNITS_PER_M / Math.max(1, this.speed);
          hudText(ctx, `👻 ${gap > 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}s`, W - 14, top + 76 + 58, { size: 13, align: 'right', color: gap > 0 ? '#ff6b6b' : '#06d6a0' });
        }
      }
      // classifica live
      const list = this.standing || this.ranking();
      list.slice(0, 8).forEach((r, i) => {
        const y = H - 140 + i * 14;
        hudText(ctx, `${i + 1}. ${r.me ? 'TU' : r.name}`, 14, y, { size: 11, color: r.me ? '#fc6719' : '#e8e8e8' });
      });
      // barra progresso giro
      const k = this.pos / this.trackLen; const by = H - 18;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(14, by, W - 28, 6);
      ctx.fillStyle = '#fc6719'; ctx.fillRect(14, by, (W - 28) * k, 6);
      for (const r of this.rivals) { ctx.fillStyle = r.jersey; ctx.fillRect(14 + (W - 28) * (r.z / this.trackLen) - 2, by - 3, 4, 12); }
      if (!this.hooks.connected()) hudText(ctx, 'DEMO: rullo non connesso', W - 14, H - 30, { size: 11, align: 'right', color: '#ffd34d' });
    }
    let ty = H * 0.3;
    for (const x of this.texts) {
      ctx.globalAlpha = Math.min(1, x.t * 3);
      hudText(ctx, x.text, W / 2, ty, { size: x.big ? 26 : 14, color: x.color, align: 'center' }); ty += x.big ? 32 : 20;
      ctx.globalAlpha = 1;
    }
    if (this.state === 'countdown') {
      const n = 3 - Math.floor(this.stateT);
      // semaforo
      const cx = W / 2; const cy = H * 0.24;
      ctx.fillStyle = '#111'; ctx.fillRect(cx - 60, cy - 20, 120, 40);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < 4 - n ? '#ff3b3b' : '#330000'; ctx.beginPath(); ctx.arc(cx - 36 + i * 36, cy, 13, 0, Math.PI * 2); ctx.fill(); }
      hudText(ctx, String(n), W / 2, H * 0.4, { size: 64, align: 'center', color: '#ffd34d' });
      hudText(ctx, this.T.name, W / 2, H * 0.4 + 36, { size: 14, align: 'center' });
    }
    if (this.state === 'results') this.drawResults(ctx, W, H);
    this.hooks.progress?.drawToasts(ctx, W, this.lastDt || 0.016);
  }

  drawResults(ctx, W, H) {
    ctx.fillStyle = 'rgba(8,6,20,.82)'; ctx.fillRect(0, 0, W, H);
    const place = this.place();
    hudText(ctx, place === 1 ? 'VITTORIA!' : place <= 3 ? 'PODIO!' : 'TRAGUARDO', W / 2, H * 0.14, { size: 34, align: 'center', color: place <= 3 ? '#ffd34d' : '#fff' });
    hudText(ctx, `${place}° posto · ${fmt(this.finishT)}${this.newBest ? '  ★ RECORD!' : ''}`, W / 2, H * 0.14 + 30, { size: 15, align: 'center' });
    // podio
    const base = H * 0.42; const top3 = this.standing.slice(0, 3);
    const order = [1, 0, 2]; const heights = [60, 84, 44];
    order.forEach((idx, k) => {
      const r = top3[idx]; if (!r) return;
      const x = W / 2 + (k - 1) * 92;
      ctx.fillStyle = ['#c0c0c0', '#ffd34d', '#cd7f32'][idx]; ctx.fillRect(x - 40, base - heights[k] + 40, 80, heights[k]);
      hudText(ctx, String(idx + 1), x, base + 30, { size: 22, align: 'center', color: '#1b1b2f', stroke: 'transparent' });
      hudText(ctx, r.me ? 'TU' : r.name.split(' ')[0], x, base - heights[k] + 30, { size: 13, align: 'center', color: r.me ? '#fc6719' : '#fff' });
    });
    const gr = this.leader('green'); const km = this.leader('kom');
    hudText(ctx, `Maglia verde: ${gr ? (gr.name === 'TU' ? 'TU!' : gr.name) : '-'}   ·   Maglia a pois: ${km ? (km.name === 'TU' ? 'TU!' : km.name) : '-'}`, W / 2, H * 0.53, { size: 12, align: 'center', color: '#e8e8e8' });
    this.standing.forEach((r, i) => hudText(ctx, `${i + 1}. ${r.me ? 'TU' : r.name}${r.fin != null ? '  ' + fmt(r.fin) : ''}`, W / 2, H * 0.57 + i * 19, { size: 13, align: 'center', color: r.me ? '#fc6719' : '#e8e8e8' }));
    if (this.stateT > 1.5) hudText(ctx, '+ rivincita   ·   − cambia circuito', W / 2, H * 0.92, { size: 15, align: 'center', color: '#ffd34d' });
  }

  drawSelect() {
    const scr = this.screen; const g = scr.g; const T = TRACKS[this.trackIndex];
    this.T = T;
    // anteprima animata del circuito
    this.pos = (this.t * 2500) % this.trackLen; this.x = 0; this.lane = 1; this.lean = 0; this.rivals = this.rivals || [];
    this.tacks = []; this.boost = 0; this.draft = 0; this.shield = false; this.cadence = 90;
    const saveState = this.state; this.state = 'preview';
    this.draw();
    this.state = saveState;
    const ctx = scr.ctx; const W = scr.W; const H = scr.H;
    ctx.fillStyle = 'rgba(8,6,20,.55)'; ctx.fillRect(0, 0, W, H);
    hudText(ctx, 'TURBO PEDALI', W / 2, 96, { size: 34, align: 'center', color: '#fc6719' });
    hudText(ctx, '8 ciclisti · 3 giri · vince chi spinge di più', W / 2, 120, { size: 12, align: 'center', color: '#cfd6e4' });
    hudText(ctx, 'SCEGLI IL CIRCUITO', W / 2, H * 0.3, { size: 16, align: 'center', color: '#ffd34d' });
    hudText(ctx, T.name, W / 2, H * 0.3 + 36, { size: 20, align: 'center' });
    hudText(ctx, T.desc, W / 2, H * 0.3 + 58, { size: 13, align: 'center', color: '#06d6a0' });
    const best = Number(localStorage.getItem(`racerBest${this.trackIndex}`));
    if (best) hudText(ctx, `Record: ${fmt(best)}`, W / 2, H * 0.3 + 80, { size: 12, align: 'center', color: '#cfd6e4' });
    hudText(ctx, TRACKS.map((x, i) => (i === this.trackIndex ? '●' : '○')).join(' '), W / 2, H * 0.3 + 104, { size: 14, align: 'center' });
    const tips = ['+ / − cambi corsia', 'Monete: +1% velocità (max 10)', 'Stai dietro a un rivale: SCIA +12%', 'Scatole ?: oggetti. Si usano con uno SPRINT', 'In salita la resistenza sale davvero', 'Traguardo volante e GPM: maglia verde e a pois', 'Batti il tuo FANTASMA 👻'];
    tips.forEach((tip, i) => hudText(ctx, '• ' + tip, W / 2, H * 0.55 + i * 19, { size: 12, align: 'center', color: '#e8e8e8' }));
    this.hooks.progress?.drawToasts(ctx, W, this.lastDt || 0.016);
    hudText(ctx, '−  cambia circuito        +  via!', W / 2, H * 0.92, { size: 15, align: 'center', color: '#ffd34d' });
  }

  loop(now) {
    if (!this.active) return;
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.lastDt = dt;
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }
}

function labelSprite(text, bg) {
  const c = document.createElement('canvas'); c.width = text.length * 4 + 3; c.height = 7;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  ptext(g, text, 2, 1, '#fff');
  return c;
}

function frame2(n) { return ((Math.floor(n) % 2) + 2) % 2 || 0; }

function fmt(s) {
  if (!Number.isFinite(s)) return '--:--';
  const m = Math.floor(s / 60); const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
