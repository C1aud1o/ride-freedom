// PEDAL STRIKE — sparatutto a scorrimento orizzontale originale per rullo.
// Storia: il Barone Bullone ha rubato le bici della città e le ha trasformate in robot.
// Pedala per avanzare, i watt decidono la cadenza di tiro, lo sprint attiva l'OVERDRIVE.
// Comandi: + salta (in menu: conferma), − bomba (in menu: cambia eroe).

import { PixelScreen, sprite, flip, whiten, bandedSky, hash, hudText, Effort, rand, randInt, clamp, lerp, pick, pline, pring, ptext } from './engine.js';
import { SONGS } from './audio.js';
import { t, fmtDec } from '../i18n.js';

const PPM = 16; // pixel (del buffer) per metro
const G = 24;
const WORLD_SCALE = 0.62; // il mondo scorre più lento della bici: tempo per reagire
const LEVEL_LEN = 600;
const MAX_GRADE = 6;

// ---------- personaggi ----------
const BODY = [
  '....KjJJJK......',
  '...KjJJJJJKSS...',
  '...KjJJJJJK.....',
  '...KjJJJJK......',
  '....KjJJK.......',
];
const HEROES = [
  {
    id: 'rocco', name: 'games.shooter.hero.rocco.name', perk: 'games.shooter.hero.rocco.perk',
    hp: 6, bombs: 3, fire: 1, bike: '#e85d04', pants: '#264653',
    pal: { K: '#1b1b2f', H: '#e63946', V: '#7fe7ff', S: '#f2c29b', M: '#5b3a1e', J: '#f4a261', j: '#c7743a' },
    head: ['......KKKK......', '.....KHHHHK.....', '....KHHHHHHK....', '....KHHHVVVK....', '.....KSSSSSK....', '.....KMMMSK.....'],
  },
  {
    id: 'vale', name: 'games.shooter.hero.vale.name', perk: 'games.shooter.hero.vale.perk',
    hp: 5, bombs: 3, fire: 1.25, bike: '#ff4d9d', pants: '#2b2d42',
    pal: { K: '#1b1b2f', H: '#ff4d9d', V: '#7fe7ff', S: '#f6d0b1', Y: '#ffd166', J: '#7b2cbf', j: '#5a189a' },
    head: ['......KKKK......', '.....KHHHHK.....', '...YKHHHHHHK....', '..YYKHHHVVVK....', '..Y..KSSSSSK....', '.....KSSSSK.....'],
  },
  {
    id: 'gino', name: 'games.shooter.hero.gino.name', perk: 'games.shooter.hero.gino.perk',
    hp: 5, bombs: 6, fire: 1, bike: '#2a9d8f', pants: '#6c584c',
    pal: { K: '#1b1b2f', C: '#8d6e63', S: '#e8b796', W: '#f1f1f1', J: '#3a86ff', j: '#2559b5' },
    head: ['................', '.....KKKKK......', '....KCCCCCKK....', '....KCCCCCCCK...', '.....KSSSSSK....', '.....KWWWWSK....'],
  },
];

// ---------- armi ----------
const WEAPONS = {
  blaster: { name: 'games.shooter.weapon.blaster', rate: 1, ammo: Infinity, color: '#fff59d', sfx: 'shot' },
  mg: { name: 'games.shooter.weapon.mg', letter: 'M', rate: 2.4, ammo: 220, color: '#ffd166', sfx: 'mg' },
  rocket: { name: 'games.shooter.weapon.rocket', letter: 'R', rate: 0.55, ammo: 30, color: '#ff6b35', sfx: 'rocket' },
  flame: { name: 'games.shooter.weapon.flame', letter: 'F', rate: 3.5, ammo: 160, color: '#ff9f1c', sfx: 'flame' },
  laser: { name: 'games.shooter.weapon.laser', letter: 'L', rate: 1.2, ammo: 60, color: '#4de3ff', sfx: 'laser' },
};
const WEAPON_KEYS = ['mg', 'rocket', 'flame', 'laser'];

// ---------- missioni ----------
const LEVELS = [
  {
    name: 'games.shooter.level1', song: 'city', boss: 'tank',
    sky: ['#1d1135', '#3b1c4a', '#6b2b4f', '#a53f4f', '#d9644a', '#f2994a', '#f7c35f'],
    sun: '#ffe08a', far: '#4a2a5e', farLit: '#ffb347', mid: '#2b1a3d', ground: '#3a3347', groundTop: '#56506a', groundLine: '#f7c35f', dirt: '#251d31',
    mix: { walker: 5, drone: 2, barrel: 2, mine: 2, shield: 1, turret: 0 },
  },
  {
    name: 'games.shooter.level2', song: 'desert', boss: 'heli',
    sky: ['#2a6f97', '#3d8fb5', '#61a5c2', '#89c2d9', '#b8dbe6', '#f5e6c8', '#f9d48b'],
    sun: '#fff3c4', far: '#c9835b', farLit: '#e8a87c', mid: '#9c5a3c', ground: '#d9a45b', groundTop: '#f0c27b', groundLine: '#b7793f', dirt: '#a8723d',
    mix: { walker: 4, drone: 3, barrel: 2, mine: 2, shield: 2, turret: 2 },
  },
  {
    name: 'games.shooter.level3', song: 'factory', boss: 'trike',
    sky: ['#05050d', '#0b0b1a', '#141428', '#1c1c36', '#262646', '#33224a', '#4a2340'],
    sun: '#b8c4ff', far: '#1e1e33', farLit: '#ff4d4d', mid: '#15152a', ground: '#3b4252', groundTop: '#5c677d', groundLine: '#ffd166', dirt: '#252a36',
    mix: { walker: 4, drone: 3, barrel: 1, mine: 2, shield: 3, turret: 3 },
  },
];

const ENEMY_BASE = {
  walker: { w: 0.85, h: 1.15, hp: 3, score: 100 },
  shield: { w: 0.95, h: 1.2, hp: 4, score: 200 },
  drone: { w: 1.0, h: 0.55, hp: 2, score: 150 },
  barrel: { w: 0.8, h: 0.8, hp: 3, score: 80 },
  mine: { w: 0.7, h: 0.3, hp: 1, score: 50 },
  turret: { w: 1.1, h: 0.9, hp: 6, score: 250 },
  crate: { w: 0.7, h: 0.7, hp: 1, score: 20 },
  cage: { w: 1.0, h: 1.3, hp: 4, score: 0 },
};

export class Strike {
  constructor(canvas, hooks, audio) {
    this.canvas = canvas;
    this.hooks = hooks; // { connected(), speedKmh(), stats() -> {power, cadence}, setGrade(g) }
    this.audio = audio;
    this.active = false;
    this.best = Number(localStorage.getItem('strikeBest2')) || 0;
    this.heroIndex = Number(localStorage.getItem('strikeHero')) || 0;
    this.onResize = () => this.screen?.resize();
    this.loop = this.loop.bind(this);
    this.buildSprites();
  }

  // ---------- sprite ----------
  buildSprites() {
    this.heroSprites = HEROES.map((h) => {
      const pal = { ...h.pal };
      const s = sprite([...h.head, ...BODY], pal);
      return { body: s, white: whiten(s) };
    });
    const robotPal = { K: '#14141f', A: '#ffd166', B: '#a8b2c1', b: '#6b7785', E: '#ffffff', P: '#ff3b3b', R: '#ffd166', g: '#3d4451' };
    const walkerTop = ['.......A......', '.......K......', '...KKKKKKKK...', '..KBBBBBBBBK..', '..KBEEEEBBBK..', '..KBEPPEBBBK..',
      '..KBEEEEBBBK..', '..KBBBBBBBBK..', '..KRBBBBBBRK..', '...KKKKKKKK...', 'gggKbbbbbbK...', 'KKKbbbbbbbK...', '...KbbbbbbK...', '...KKKKKKKK...'];
    const legsA = ['....Kb..Kb....', '....Kb..Kb....', '....Kb..Kb....', '...KKK.KKK....'];
    const legsB = ['.....Kb..Kb...', '....Kb...Kb...', '...Kb.....Kb..', '..KKK....KKK..'];
    const shieldPal = { ...robotPal, B: '#6c7a89', b: '#46505c', P: '#ffb703' };
    this.walker = [sprite([...walkerTop, ...legsA], robotPal), sprite([...walkerTop, ...legsB], robotPal)];
    this.shieldBot = [sprite([...walkerTop, ...legsA], shieldPal), sprite([...walkerTop, ...legsB], shieldPal)];
    this.walkerW = this.walker.map(whiten); this.shieldW = this.shieldBot.map(whiten);
    const dronePal = { K: '#14141f', D: '#2ec4b6', d: '#1a8a80', E: '#fff', P: '#ff3b3b' };
    this.drone = sprite(['.......KK.......', '....KKKKKKKK....', '...KDDDDDDDDK...', '..KDDEEDDDDDDK..', '..KDDEPDDDDDDK..', '...KddddddddK...', '....KK....KK....'], dronePal);
    this.droneW = whiten(this.drone);
    const prisPal = { K: '#1b1b2f', H: '#ffd166', S: '#f2c29b', J: '#06d6a0', P: '#264653' };
    const pTop = ['...KKK...', '..KHHHK..', '..KSSSK..'];
    this.prisoner = [
      sprite([...pTop, '...KSK...', '.KJJJJJK.', 'KSKJJJKSK', '..KJJJK..', '..KPPPK..', '..KP.PK..', '..KK.KK..'], prisPal),
      sprite([...pTop, 'S..KSK..S', 'SKJJJJJKS', '..KJJJK..', '..KJJJK..', '..KPPPK..', '..KP.PK..', '..KK.KK..'], prisPal),
    ];
    const baronPal = { K: '#111', T: '#2b2b2b', t: '#7b2cbf', S: '#f2c29b', M: '#d4af37', W: '#fff', R: '#e63946' };
    this.baron = sprite(['..KKKKK..', '..KTTTK..', '..KTTTK..', '.KttttK..', 'KKKKKKKKK', '.KSSSSSK.', '.KSWMSSK.', '.KSSSSSK.', '.KRRRRRK.', '..KSSSK..'], baronPal);
  }

  // ---------- ciclo di vita ----------
  start() {
    this.active = true;
    this.screen = new PixelScreen(this.canvas, 240);
    window.addEventListener('resize', this.onResize);
    this.effort = new Effort();
    this.state = 'select';
    this.t = 0; this.selT = 0;
    this.texts = []; this.fx = []; this.items = [];
    this.power = 0; this.cadence = 0;
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

  newGame() {
    const h = HEROES[this.heroIndex];
    this.hero = h;
    this.p = { x: 0, y: 0, vy: 0, onGround: true, hp: h.hp, maxHp: h.hp, hurt: 0, bombs: h.bombs, fireT: 0, anim: 0, aim: 0, recoil: 0, pumpCd: 0, pumpT: 0, vehicle: null, cannonT: 0 };
    this.weapon = 'blaster'; this.ammo = Infinity;
    this.score = 0; this.combo = 0; this.comboT = 0; this.kills = 0; this.rescued = 0;
    this.loopN = 0; this.levelIndex = 0;
    this.overdrive = 0; this.odMeter = 0;
    this.startLevel();
  }

  startLevel() {
    this.level = LEVELS[this.levelIndex];
    this.diff = 1 + this.levelIndex * 0.2 + this.loopN * 0.5;
    this.p.x = 0; this.p.y = 0; this.p.vy = 0; this.p.onGround = true;
    this.terrain = [{ x0: -60, x1: 40, y0: 0, slope: 0 }];
    while (this.terrainEnd() < 300) this.addTerrain();
    this.bullets = []; this.ebullets = []; this.enemies = []; this.items = []; this.fx = []; this.props = []; this.texts = [];
    this.nextSpawn = 20; this.nextCage = 70; this.nextChallenge = 110; this.vehicleSpawned = false;
    this.boss = null; this.bossArena = null;
    this.camY = 0; this.shake = 0; this.freeze = 0; this.slow = 0; this.flash = 0;
    this.challenge = null; this.sentGrade = null;
    this.state = 'title'; this.stateT = 0;
    this.levelStats = { kills: 0, rescued: 0, start: this.score };
    this.audio.playSong(SONGS[this.level.song]);
  }

  terrainEnd() { return this.terrain[this.terrain.length - 1].x1; }
  addTerrain() {
    const last = this.terrain[this.terrain.length - 1];
    const y0 = last.y0 + last.slope * (last.x1 - last.x0);
    const nearBoss = last.x1 > LEVEL_LEN - 60;
    const r = Math.random();
    const slope = nearBoss ? 0 : r < 0.4 ? 0 : r < 0.8 ? rand(2, MAX_GRADE) / 100 : -rand(1, 4) / 100;
    this.terrain.push({ x0: last.x1, x1: last.x1 + (nearBoss ? 200 : rand(30, 80)), y0, slope });
    if (this.terrain.length > 60) this.terrain.shift();
  }
  seg(x) { for (const s of this.terrain) if (x >= s.x0 && x < s.x1) return s; return this.terrain[this.terrain.length - 1]; }
  ground(x) { const s = this.seg(x); return s.y0 + s.slope * (x - s.x0); }

  // ---------- input ----------
  input(dir) {
    this.audio.ensure();
    if (this.state === 'select') {
      if (dir < 0) { this.heroIndex = (this.heroIndex + 1) % HEROES.length; this.audio.sfx('select'); }
      else if (this.selT > 0.4) { localStorage.setItem('strikeHero', this.heroIndex); this.audio.sfx('pickup'); this.newGame(); }
      return;
    }
    if (this.state === 'over') {
      if (this.stateT < 1.2) return;
      if (dir > 0) this.newGame(); else { this.state = 'select'; this.selT = 0; this.audio.playSong(SONGS.menu); }
      return;
    }
    if (this.state === 'title' || this.state === 'clear') return;
    if (dir > 0) this.jump(); else this.bomb();
  }

  jump() {
    if (!this.p.onGround) return;
    this.p.vy = 9.2; this.p.onGround = false;
    this.audio.sfx('jump');
  }

  bomb() {
    if (this.p.bombs <= 0) { this.say(t('games.shooter.noBombs'), '#ff6b6b'); return; }
    this.p.bombs--;
    this.flash = 0.4; this.shake = 0.6; this.freeze = 0.08;
    this.audio.sfx('bomb');
    if (navigator.vibrate) navigator.vibrate([30, 30, 120]);
    for (const e of this.enemies) if (this.onScreen(e.x) && e.type !== 'cage') this.damage(e, 12, true);
    if (this.boss) this.damage(this.boss, 20, true);
    for (const b of this.ebullets) this.puff(b.x, b.y, 3);
    this.ebullets = [];
  }

  // ---------- coordinate ----------
  get vw() { return this.screen.vw; }
  get vh() { return this.screen.vh; }
  get viewW() { return this.vw / PPM; }
  get groundLine() { return Math.round(this.vh * 0.84); }
  get camX() { return this.p.x - this.viewW * 0.28; }
  sx(x) { return Math.round((x - this.camX) * PPM); }
  sy(y) { return Math.round(this.groundLine - (y - this.camY) * PPM); }
  onScreen(x) { return x > this.camX - 0.5 && x < this.camX + this.viewW + 0.5; }

  say(text, color = '#ffd34d', t = 1.6, big = false) { this.texts.push({ text, color, t, life: t, big }); }
  prog(stat, n = 1, xp = 0) { this.hooks.progress?.event(stat, n, xp); }

  // ---------- aggiornamento ----------
  update(dt) {
    this.t += dt;
    const connected = this.hooks.connected();
    const st = this.hooks.stats();
    // demo senza rullo: potenza che ogni tanto sale per mostrare l'overdrive
    const demoSprint = !connected && (this.t % 28) > 20;
    this.power = connected ? st.power || 0 : demoSprint ? 300 : 150;
    this.cadence = connected ? st.cadence || 0 : 88;
    const kmh = connected ? this.hooks.speedKmh() : 25;
    this.kmh = kmh;
    const sprinting = this.effort.update(this.power, dt, connected ? 50 : 0);
    this.sprinting = sprinting;

    // la musica segue la cadenza
    if (this.audio.song) this.audio.setTempo(this.audio.song.bpm * clamp((this.cadence || 85) / 88, 0.85, 1.2));

    this.selT += dt;
    this.texts.forEach((x) => { x.t -= dt; }); this.texts = this.texts.filter((x) => x.t > 0);
    this.updateFx(dt);
    if (this.state === 'select') return;
    this.stateT += dt;
    if (this.state === 'over') return;
    if (this.state === 'title' && this.stateT > 2.6) { this.state = 'play'; this.hooks.runStart?.(); }
    if (this.state === 'clear') {
      if (this.stateT > 5) {
        this.levelIndex++;
        if (this.levelIndex >= LEVELS.length) { this.levelIndex = 0; this.loopN++; this.say(t('games.shooter.baronBack'), '#ff6b6b', 3); }
        this.p.hp = Math.min(this.p.maxHp, this.p.hp + 2); this.p.bombs = Math.max(this.p.bombs, 3);
        this.startLevel();
      }
      return;
    }

    const p = this.p;
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.recoil = Math.max(0, p.recoil - dt * 8);
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;

    // OVERDRIVE: si carica restando sopra la soglia sprint
    if (this.overdrive > 0) {
      this.overdrive -= dt;
      if (this.overdrive <= 0) { this.audio.transpose = 0; this.say(t('games.shooter.odOver'), '#9aa3b5', 1); }
    } else {
      this.odMeter = clamp(this.odMeter + (sprinting ? dt / 4 : -dt / 20), 0, 1);
      if (this.odMeter >= 1) {
        this.overdrive = 8; this.odMeter = 0; this.audio.transpose = 2;
        this.audio.sfx('overdrive'); this.say(t('games.horde.overdrive'), '#4de3ff', 2, true); this.flash = 0.2; this.prog('overdrives', 1, 15);
      }
    }

    // movimento (fermo nell'arena del boss)
    const v = (kmh / 3.6) * WORLD_SCALE;
    const prevX = p.x;
    p.x += v * dt;
    if (this.bossArena != null) p.x = Math.min(p.x, this.bossArena);
    p.anim += (this.cadence || 0) / 60 * dt * Math.PI * 2 + (p.x - prevX) * 0.2;
    while (this.terrainEnd() < p.x + 120) this.addTerrain();

    const gy = this.ground(p.x);
    if (!p.onGround) {
      p.vy -= G * dt; p.y += p.vy * dt;
      if (p.y <= gy) { p.y = gy; p.vy = 0; p.onGround = true; this.audio.sfx('land'); this.dust(p.x, gy); }
    } else p.y = gy;
    this.camY += (gy - this.camY) * Math.min(1, dt * 4);

    // pendenza verso il rullo
    const grade = this.boss ? 2 : clamp(this.seg(p.x).slope * 100, -4, MAX_GRADE);
    this.grade = grade;
    const g = Math.round(grade * 2) / 2;
    if (g !== this.sentGrade) { this.sentGrade = g; this.hooks.setGrade(g); }

    this.shoot(dt);
    this.spawnStuff();
    this.updateChallenge(dt);

    for (const b of this.bullets) {
      if (b.homing) {
        const tgt = this.nearestTarget(b.x, b.y, 18);
        if (tgt) {
          const a = Math.atan2(tgt.y + tgt.h / 2 - b.y, tgt.x - b.x); const cur = Math.atan2(b.vy, b.vx);
          let d = a - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
          const na = cur + clamp(d, -5 * dt, 5 * dt); const sp = Math.hypot(b.vx, b.vy) + 20 * dt;
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
        if (Math.random() < 0.6) this.fx.push({ type: 'smoke', x: b.x, y: b.y, vx: 0, vy: 0.5, t: 0, life: 0.4, r: 1.5 });
      }
      if (b.grav) b.vy -= G * 0.3 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.y < this.ground(b.x) - 0.1) { b.life = 0; if (b.splash) this.explode(b.x, b.y + 0.2, 1.2, b.dmg); else this.spark(b.x, b.y + 0.1, b.color); }
    }
    for (const b of this.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.grav) b.vy -= G * 0.55 * dt;
      if (b.y < this.ground(b.x)) { b.life = 0; if (b.grav) this.explode(b.x, b.y, 1, 0, true); else this.spark(b.x, b.y, '#ff5252'); }
    }

    for (const e of this.enemies) this.updateEnemy(e, dt);
    if (this.boss) this.updateBoss(this.boss, dt);

    this.melee(dt);
    this.collisions();

    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.ebullets = this.ebullets.filter((b) => b.life > 0 && b.x > this.camX - 3);
    this.enemies = this.enemies.filter((e) => !e.dead && e.x > this.camX - 4);
    this.items = this.items.filter((it) => !it.taken && it.x > this.camX - 2);
  }

  nearestTarget(x, y, range) {
    let best = null; let bd = range;
    const list = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const e of list) {
      if (e.dead || e.type === 'mine' || e.type === 'cage' || e.type === 'crate') continue;
      const dx = e.x - x; if (dx < 0.3) continue;
      const d = Math.hypot(dx, e.y + e.h / 2 - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  shoot(dt) {
    const p = this.p;
    const w = WEAPONS[this.weapon];
    if (p.vehicle) { // cannone del Cargo-Cannone, in aggiunta all'arma
      p.cannonT -= dt;
      if (p.cannonT <= 0) {
        p.cannonT = 1.1 / (this.overdrive > 0 ? 1.6 : 1);
        const a = clamp(p.aim + 0.12, -0.3, 1);
        this.bullets.push({ x: p.x + 1.1, y: p.y + 0.95, vx: Math.cos(a) * 17, vy: Math.sin(a) * 17, life: 1.6, dmg: 6, kind: 'shell', splash: true, grav: true, color: '#ffd166' });
        this.fx.push({ type: 'muzzle', x: p.x + 1.2, y: p.y + 0.95, t: 0, life: 0.08, color: '#ffd166' });
        this.fx.push({ type: 'smoke', x: p.x + 1.2, y: p.y + 1, vx: 1, vy: 0.5, t: 0, life: 0.5, r: 3 });
        this.audio.sfx('boom'); this.shake = Math.max(this.shake, 0.06);
      }
    }
    const muzzle = { x: p.x + 0.55, y: p.y + 1.1 };
    // mira automatica sul bersaglio più vicino davanti (± 55°)
    const tgt = this.nearestTarget(muzzle.x, muzzle.y, this.weapon === 'flame' ? 5 : 15);
    const want = tgt ? clamp(Math.atan2(tgt.y + tgt.h * 0.55 - muzzle.y, tgt.x - muzzle.x), -0.5, 0.95) : 0;
    p.aim = lerp(p.aim, want, Math.min(1, dt * 12));
    const od = this.overdrive > 0;
    const rate = clamp(1.2 + this.power / 45, 1.5, 8) * w.rate * this.hero.fire * (od ? 1.5 : 1);
    this.fireRate = rate;
    p.fireT -= dt;
    if (p.fireT > 0) return;
    p.fireT = 1 / rate;
    const len = 0.5;
    const mx = muzzle.x + Math.cos(p.aim) * len; const my = muzzle.y + Math.sin(p.aim) * len;
    const dmgMul = od ? 2 : 1;
    const shot = (a, o) => this.bullets.push({ x: mx, y: my, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, life: o.life, dmg: o.dmg * dmgMul, color: o.color || w.color, ...o });
    if (this.weapon === 'blaster') shot(p.aim, { speed: 24, life: 0.9, dmg: 1, kind: 'pellet' });
    else if (this.weapon === 'mg') shot(p.aim + rand(-0.06, 0.06), { speed: 28, life: 0.8, dmg: 1, kind: 'pellet' });
    else if (this.weapon === 'laser') shot(p.aim, { speed: 40, life: 0.5, dmg: 2.5, kind: 'laser', pierce: true });
    else if (this.weapon === 'rocket') shot(p.aim + 0.25, { speed: 9, life: 2.2, dmg: 6, kind: 'rocket', homing: true, splash: true });
    else if (this.weapon === 'flame') for (let i = 0; i < 2; i++) shot(p.aim + rand(-0.18, 0.18), { speed: rand(9, 12), life: 0.38, dmg: 0.45, kind: 'flame', pierce: true });
    p.recoil = 1;
    this.fx.push({ type: 'muzzle', x: mx, y: my, t: 0, life: 0.05, color: w.color });
    if (this.weapon !== 'blaster' && this.weapon !== 'flame') this.fx.push({ type: 'casing', x: p.x + 0.3, y: p.y + 1.1, vx: rand(-2, -1), vy: rand(2, 4), t: 0, life: 0.6 });
    this.audio.sfx(w.sfx);
    if (this.weapon !== 'blaster') {
      this.ammo -= 1;
      if (this.ammo <= 0) { this.weapon = 'blaster'; this.ammo = Infinity; this.say(t('games.shooter.noAmmo'), '#9aa3b5', 1.2); }
    }
  }

  spawnStuff() {
    const p = this.p;
    const edge = this.camX + this.viewW + 1.5;
    if (!this.boss && p.x > LEVEL_LEN - 14) this.spawnBoss();
    if (this.boss) return;
    if (p.x >= this.nextSpawn) {
      const mix = this.level.mix; const total = Object.values(mix).reduce((a, b) => a + b, 0);
      let r = Math.random() * total; let type = 'walker';
      for (const [k, w] of Object.entries(mix)) { if ((r -= w) < 0) { type = k; break; } }
      const n = type === 'walker' && Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) this.spawnEnemy(type, edge + i * 1.4);
      if (Math.random() < 0.15) this.spawnEnemy('crate', edge + 3);
      this.nextSpawn = p.x + rand(4.5, 9) / Math.min(1.8, this.diff);
    }
    if (p.x >= this.nextCage) { this.spawnEnemy('cage', edge + 2); this.nextCage = p.x + rand(70, 110); }
    if (!this.vehicleSpawned && p.x > LEVEL_LEN * 0.4) { this.vehicleSpawned = true; this.items.push({ kind: 'vehicle', x: edge + 1, y: this.ground(edge + 1), t: 0 }); }
  }

  spawnEnemy(type, x) {
    const b = ENEMY_BASE[type];
    const gy = this.ground(x);
    const e = { type, x, y: gy, w: b.w, h: b.h, hp: Math.ceil(b.hp * (type === 'cage' || type === 'crate' ? 1 : this.diff)), t: rand(0, 3), fire: rand(1, 2.5), flash: 0 };
    if (type === 'drone') { e.baseY = gy + rand(2.2, 3.4); e.y = e.baseY; }
    if (type === 'shield') e.shield = Math.ceil(8 * this.diff);
    if (type === 'barrel') e.rot = 0;
    if (type === 'crate') e.weapon = pick(WEAPON_KEYS);
    this.enemies.push(e);
  }

  spawnBoss() {
    const kind = this.level.boss;
    this.bossArena = this.p.x + 4;
    const x = this.bossArena + this.viewW * 0.55;
    const hpBase = { tank: 110, heli: 120, trike: 160 }[kind];
    const hp = Math.round(hpBase * this.diff);
    const names = { tank: 'games.shooter.boss.tank', heli: 'games.shooter.boss.heli', trike: 'games.shooter.boss.trike' };
    this.boss = {
      type: 'boss', kind, name: names[kind], x, homeX: x, y: this.ground(x), w: kind === 'heli' ? 3.6 : 3.8, h: kind === 'heli' ? 1.6 : 2.6,
      hp, maxHp: hp, t: 0, a1: 2, a2: 4, a3: 6, flash: 0, enter: 1.5,
    };
    if (kind === 'heli') { this.boss.y = this.ground(x) + 4.5; }
    this.enemies = this.enemies.filter((e) => e.x < this.bossArena + 1);
    this.audio.sfx('alarm');
    this.audio.playSong(SONGS.boss);
    this.say(`⚠ ${t(names[kind])} ⚠`, '#ff4d4d', 3, true);
  }

  updateEnemy(e, dt) {
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    const p = this.p;
    const near = e.x - p.x;
    switch (e.type) {
      case 'walker': case 'shield': {
        if (this.overdrive > 0 && e.type === 'walker') e.x += 1.6 * dt; // scappano!
        else if (near < this.viewW * 0.75) e.x -= (e.type === 'shield' ? 0.6 : 1.1) * dt;
        e.y = this.ground(e.x);
        e.fire -= dt;
        if (e.fire <= 0 && this.onScreen(e.x) && near > 2) {
          e.fire = rand(1.8, 3.2) / Math.min(1.6, this.diff);
          this.ebullets.push({ x: e.x - 0.55, y: e.y + 0.55, vx: -7.5, vy: 0, life: 3 });
          this.fx.push({ type: 'muzzle', x: e.x - 0.55, y: e.y + 0.55, t: 0, life: 0.05, color: '#ff5252' });
        }
        break;
      }
      case 'drone': {
        e.x -= 2.4 * dt;
        const dive = Math.abs(near) < 3.5 ? 1.4 : 0;
        e.y = Math.max(this.ground(e.x) + 0.9, e.baseY + Math.sin(e.t * 2.4) * 0.7 - dive);
        break;
      }
      case 'barrel': {
        if (near < this.viewW * 0.8) { e.x -= 4.2 * dt; e.rot += 4.2 * dt / 0.4; }
        e.y = this.ground(e.x);
        break;
      }
      case 'turret': {
        e.y = this.ground(e.x);
        e.fire -= dt;
        if (e.fire <= 0 && this.onScreen(e.x) && near > 3) {
          e.fire = rand(2.2, 3.5) / Math.min(1.6, this.diff);
          const tt = 1.1; const dx = p.x - e.x;
          this.ebullets.push({ x: e.x - 0.3, y: e.y + 0.9, vx: dx / tt, vy: (G * 0.55 * tt) / 2 + (p.y - e.y) / tt, life: 4, grav: true });
          this.fx.push({ type: 'smoke', x: e.x - 0.3, y: e.y + 1, vx: 0, vy: 1, t: 0, life: 0.5, r: 3 });
        }
        break;
      }
      case 'cage': case 'crate': case 'mine': e.y = this.ground(e.x); break;
      case 'freed': {
        e.x -= 3 * dt; e.y = this.ground(e.x);
        if (e.t > 3) e.dead = true;
        break;
      }
      default: break;
    }
  }

  weakPoint(b) {
    if (b.kind === 'tank') return { x: b.x - 0.2, y: b.y + 2.0 };
    if (b.kind === 'heli') return { x: b.x - 1.05, y: b.y + 0.6 };
    return { x: b.x + 0.4, y: b.y + 2.8 };
  }

  updateBoss(b, dt) {
    b.t += dt; b.flash = Math.max(0, b.flash - dt);
    const p = this.p;
    const angry = b.hp < b.maxHp * 0.5;
    const spd = angry ? 1.5 : 1;
    if (b.enter > 0) { b.enter -= dt; return; }
    b.a1 -= dt * spd; b.a2 -= dt * spd; b.a3 -= dt * spd;
    if (b.kind === 'tank') {
      b.x = b.homeX + Math.sin(b.t * 0.5) * 1.6; b.y = this.ground(b.x);
      if (b.a1 <= 0) { // cannonate ad arco
        b.a1 = rand(2, 3);
        const shots = angry ? 3 : 1;
        for (let i = 0; i < shots; i++) {
          const tt = 1.2 + i * 0.25; const dx = p.x - (b.x - 1.8);
          this.ebullets.push({ x: b.x - 1.8, y: b.y + 2.2, vx: dx / tt, vy: (G * 0.55 * tt) / 2, life: 5, grav: true });
        }
        this.fx.push({ type: 'smoke', x: b.x - 2, y: b.y + 2.2, vx: -1, vy: 1, t: 0, life: 0.7, r: 5 });
        this.shake = Math.max(this.shake, 0.15); this.audio.sfx('boom');
      }
      if (b.a2 <= 0) { // raffica bassa: va saltata
        b.a2 = rand(3.5, 5);
        for (let i = 0; i < 5; i++) setTimeout(() => { if (this.boss === b) this.ebullets.push({ x: b.x - 2.2, y: b.y + 0.7, vx: -9, vy: 0, life: 3 }); }, i * 110);
      }
    } else if (b.kind === 'heli') {
      const gy = this.ground(b.x);
      b.x = b.homeX - 3 + Math.sin(b.t * 0.45) * 4;
      b.y = gy + 4.2 + Math.sin(b.t * 1.7) * 0.5;
      if (b.a1 <= 0) { // bombe a grappolo
        b.a1 = rand(1.6, 2.6);
        for (let i = 0; i < (angry ? 3 : 2); i++) this.ebullets.push({ x: b.x - 0.5 + i * 0.5, y: b.y - 0.4, vx: rand(-2, 1), vy: 0, life: 4, grav: true });
      }
      if (b.a2 <= 0) { // spazzata di mitragliatrice mirata
        b.a2 = rand(3, 4.5);
        for (let i = 0; i < 6; i++) {
          setTimeout(() => {
            if (this.boss !== b) return;
            const a = Math.atan2(this.p.y + 0.8 - (b.y - 0.3), this.p.x - (b.x - 1.6));
            this.ebullets.push({ x: b.x - 1.6, y: b.y - 0.3, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 3 });
          }, i * 120);
        }
      }
    } else if (b.kind === 'trike') {
      if (b.charge) {
        b.x -= 9 * dt;
        if (b.x < p.x + 1.2) { b.charge = false; b.back = true; this.shake = 0.4; this.audio.sfx('boom'); }
      } else if (b.back) {
        b.x += 5 * dt; if (b.x >= b.homeX) { b.x = b.homeX; b.back = false; }
      } else b.x = b.homeX + Math.sin(b.t * 0.7) * 1.2;
      b.y = this.ground(b.x);
      if (b.a1 <= 0) { // razzi a ricerca lenti
        b.a1 = rand(2.4, 3.4);
        for (let i = 0; i < (angry ? 3 : 2); i++) this.ebullets.push({ x: b.x - 1, y: b.y + 2.6, vx: -4 - i, vy: 4 + i, life: 4, grav: true });
      }
      if (b.a2 <= 0 && !b.back) { // carica: va saltata!
        b.a2 = rand(5, 7);
        b.charge = true; this.say(t('games.shooter.jump'), '#ffd34d', 1);
      }
      if (b.a3 <= 0) { // evoca robottini
        b.a3 = rand(6, 9);
        this.spawnEnemy('walker', b.x - 2.5);
      }
    }
  }

  collisions() {
    const p = this.p;
    const targets = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      for (const e of targets) {
        if (e.dead || e.type === 'freed' || (b.hits && b.hits.has(e))) continue;
        if (e.type === 'mine' && b.kind !== 'rocket' && b.kind !== 'flame') continue;
        if (Math.abs(b.x - e.x) < e.w / 2 + 0.1 && b.y > e.y - 0.1 && b.y < e.y + e.h + 0.35) {
          if (e.type === 'shield' && e.shield > 0 && b.x < e.x && b.kind !== 'rocket' && b.kind !== 'laser') {
            e.shield -= b.dmg; b.life = 0; this.spark(b.x, b.y, '#ffd166'); this.audio.sfx('clank');
            if (e.shield <= 0) { this.say(t('games.shooter.shieldBroken'), '#ffd166', 0.8); this.debris(e.x - 0.5, e.y + 0.6, '#ffb703', 6); }
            break;
          }
          let dmg = b.dmg;
          if (e === this.boss) { // punto debole: danno doppio
            const wp = this.weakPoint(e);
            if (Math.hypot(b.x - wp.x, b.y - wp.y) < 0.6) { dmg *= 2; this.fx.push({ type: 'spark', x: b.x, y: b.y, vx: 0, vy: 2, t: 0, life: 0.25, color: '#ffffff' }); if (Math.random() < 0.15) this.texts.push({ text: t('games.shooter.crit'), color: '#ffd34d', t: 0.6, life: 0.6, wx: wp.x, wy: wp.y + 0.6 }); }
          }
          if (b.splash) { this.explode(b.x, b.y, 1.3, dmg); b.life = 0; break; }
          this.damage(e, dmg);
          if (b.pierce) { b.hits = b.hits || new Set(); b.hits.add(e); } else { b.life = 0; this.spark(b.x, b.y, b.color); break; }
        }
      }
    }
    // danni al giocatore
    const inv = p.hurt > 0 || this.overdrive > 0;
    for (const b of this.ebullets) {
      if (b.life > 0 && Math.abs(b.x - p.x) < 0.45 && b.y > p.y && b.y < p.y + 1.5) {
        b.life = 0;
        if (b.grav) this.explode(b.x, b.y, 1, 0, true);
        if (!inv) this.hurt(); else this.spark(b.x, b.y, '#4de3ff');
      }
    }
    for (const e of this.enemies) {
      if (e.dead || e.type === 'cage' || e.type === 'crate' || e.type === 'freed') continue;
      if (Math.abs(e.x - p.x) < (e.w + 0.6) / 2 && p.y < e.y + e.h && p.y + 1.5 > e.y) {
        if (e.type === 'mine' || e.type === 'barrel') { this.damage(e, 99); if (!inv) this.hurt(); }
        else if (this.overdrive > 0) this.damage(e, 99);
        else if (!inv) this.hurt();
      }
    }
    if (this.boss && this.boss.kind === 'trike' && this.boss.charge && Math.abs(this.boss.x - p.x) < 1.6 && p.y < this.boss.y + 1.4 && !inv) this.hurt();
    for (const it of this.items) {
      if (!it.taken && Math.abs(it.x - p.x) < 0.8 && Math.abs(it.y + 0.4 - (p.y + 0.6)) < 1.3) this.take(it);
    }
  }

  damage(e, n, silent = false) {
    if (e.dead) return;
    e.hp -= n; e.flash = 0.06;
    if (!silent) this.audio.sfx('hit');
    if (e.hp > 0) return;
    if (e === this.boss) return this.killBoss(e);
    e.dead = true;
    if (e.type === 'cage') return this.freePrisoner(e);
    if (e.type === 'crate') {
      this.debris(e.x, e.y + 0.3, '#a1887f', 8); this.audio.sfx('clank');
      this.items.push({ kind: e.weapon, x: e.x, y: e.y, t: 0 });
      return;
    }
    this.kills++; this.levelStats.kills++;
    this.prog('kills', 1, 2);
    this.combo++; this.comboT = 2.2;
    const mult = Math.min(8, 1 + Math.floor(this.combo / 3));
    const pts = ENEMY_BASE[e.type].score * mult;
    this.score += pts;
    this.texts.push({ text: `+${pts}`, color: mult > 1 ? '#ffd34d' : '#fff', t: 0.8, life: 0.8, wx: e.x, wy: e.y + e.h + 0.3 });
    if (this.combo >= 3 && this.combo % 3 === 0) { this.say(t('games.shooter.comboSay', { n: mult }), '#ff9f1c', 1); this.hooks.progress?.setMax('maxCombo', mult); }
    this.explode(e.x, e.y + e.h / 2, e.type === 'mine' || e.type === 'barrel' ? 1.3 : 0.9, 0);
    this.debris(e.x, e.y + e.h / 2, e.type === 'drone' ? '#2ec4b6' : '#a8b2c1', 6);
    this.freeze = Math.max(this.freeze, 0.035);
    if (Math.random() < 0.06) this.items.push({ kind: pick(['bomb', 'heart']), x: e.x, y: this.ground(e.x), t: 0 });
  }

  freePrisoner(e) {
    this.rescued++; this.levelStats.rescued++;
    this.prog('rescued', 1, 20);
    this.score += 500;
    this.audio.sfx('rescue');
    this.debris(e.x, e.y + 0.8, '#9aa3b5', 8);
    this.enemies.push({ type: 'freed', x: e.x, y: e.y, w: 0.5, h: 1, hp: 1, t: 0 });
    this.items.push({ kind: pick([...WEAPON_KEYS, ...WEAPON_KEYS, 'bomb', 'heart']), x: e.x - 0.8, y: e.y, t: 0 });
    this.say(t(pick(['games.shooter.thanks1', 'games.shooter.thanks2', 'games.shooter.thanks3', 'games.shooter.thanks4'])), '#06d6a0', 1.6);
  }

  killBoss(b) {
    b.dead = true;
    const bonus = Math.round(2000 * this.diff);
    this.prog('bosses', 1, 150);
    if (this.levelIndex === LEVELS.length - 1) this.prog('campaigns', 1, 300);
    this.score += bonus;
    this.slow = 1.6; this.shake = 1.2; this.flash = 0.5;
    this.audio.sfx('bigboom');
    for (let i = 0; i < 12; i++) setTimeout(() => this.explode(b.x + rand(-2, 2), b.y + rand(0, b.h + 0.5), rand(1.2, 2), 0, true), i * 110);
    this.debris(b.x, b.y + 1, '#6d4c41', 20);
    this.say(t('games.shooter.bossDown', { name: t(b.name), bonus }), '#ffd34d', 3, true);
    setTimeout(() => {
      this.boss = null; this.bossArena = null; this.state = 'clear'; this.stateT = 0;
      this.hooks.progress?.addXp(100);
      this.audio.sfx('win'); this.audio.stopSong();
    }, 2200);
  }

  // colpo di pompa automatico sui nemici a contatto: salva la pelle e dà soddisfazione
  melee(dt) {
    const p = this.p;
    p.pumpCd -= dt; p.pumpT = Math.max(0, p.pumpT - dt);
    if (p.pumpCd > 0) return;
    for (const e of this.enemies) {
      if (e.dead || !['walker', 'shield', 'drone', 'barrel'].includes(e.type)) continue;
      const dx = e.x - p.x;
      if (dx > 0 && dx < 1.25 && e.y < p.y + 1.6 && e.y + e.h > p.y + 0.2) {
        p.pumpCd = 0.35; p.pumpT = 0.15;
        e.shield = 0;
        this.damage(e, 99);
        this.freeze = 0.06; this.audio.sfx('clank');
        this.say(t(pick(['games.shooter.pump1', 'games.shooter.pump2', 'games.shooter.pump3', 'games.shooter.pump4'])), '#fff', 0.6);
        this.prog('pumps', 1, 3);
        break;
      }
    }
  }

  hurt() {
    const p = this.p;
    if (p.vehicle) {
      p.vehicle.hp--; p.hurt = 0.8; this.shake = 0.3; this.audio.sfx('clank');
      if (p.vehicle.hp <= 0) {
        p.vehicle = null; p.hurt = 2;
        this.explode(p.x + 0.6, p.y + 0.6, 1.5, 4); this.say(t('games.shooter.cargoDown'), '#ff6b6b', 1.4);
      }
      return;
    }
    p.hp--; p.hurt = 1.6; this.shake = 0.35; this.flash = 0.12;
    this.combo = 0;
    this.audio.sfx('hurt');
    if (navigator.vibrate) navigator.vibrate(90);
    if (p.hp <= 0) {
      this.state = 'over'; this.stateT = 0;
      this.audio.stopSong(); this.audio.sfx('lose');
      if (this.score > this.best) { this.best = this.score; localStorage.setItem('strikeBest2', this.best); this.newRecord = true; } else this.newRecord = false;
      this.hooks.runEnd?.({ game: 'shooter', score: Math.round(this.score) });
    }
  }

  take(it) {
    it.taken = true;
    const p = this.p;
    if (WEAPONS[it.kind]) {
      if (this.weapon === it.kind) this.ammo += WEAPONS[it.kind].ammo; else { this.weapon = it.kind; this.ammo = WEAPONS[it.kind].ammo; }
      this.say(t(WEAPONS[it.kind].name) + '!', WEAPONS[it.kind].color, 1.4, true);
    } else if (it.kind === 'bomb') { p.bombs++; this.say(t('games.shooter.plusBomb'), '#ffd166', 1); }
    else if (it.kind === 'heart') { p.hp = Math.min(p.maxHp, p.hp + 1); this.say(t('games.shooter.plusLife'), '#ff5a7a', 1); }
    else if (it.kind === 'vehicle') { p.vehicle = { hp: 6, max: 6 }; this.say(t('games.shooter.cargoCannon'), '#ffd166', 2, true); this.audio.sfx('overdrive'); }
    this.audio.sfx('pickup');
  }

  // sfida sprint: un intervallo vero dentro il gioco
  updateChallenge(dt) {
    const p = this.p;
    if (!this.challenge && !this.boss && p.x > this.nextChallenge) {
      this.challenge = { phase: 'ready', t: 3, target: this.effort.threshold, held: 0, need: 10, time: 0 };
      this.audio.sfx('beep');
    }
    const c = this.challenge; if (!c) return;
    if (c.phase === 'ready') {
      c.t -= dt;
      if (c.t <= 0) { c.phase = 'go'; this.audio.sfx('go'); }
    } else if (c.phase === 'go') {
      c.time += dt;
      if (this.power >= c.target) c.held += dt;
      if (c.held >= c.need) {
        this.challenge = null; this.nextChallenge = p.x + rand(150, 220);
        this.score += 1000; this.items.push({ kind: pick(WEAPON_KEYS), x: p.x + 3, y: this.ground(p.x + 3), t: 0 });
        this.p.bombs++; this.audio.sfx('win'); this.say(t('games.shooter.challengeWon'), '#06d6a0', 2.2, true);
        this.prog('sprintsWon', 1, 40);
      } else if (c.time > 20) {
        this.challenge = null; this.nextChallenge = p.x + rand(120, 180);
        this.say(t('games.shooter.challengeLost'), '#9aa3b5', 1.6);
      }
    }
  }

  // ---------- effetti ----------
  explode(x, y, size, dmg = 0, enemyOwned = false) {
    this.fx.push({ type: 'boom', x, y, t: 0, life: 0.5, size });
    for (let i = 0; i < 5; i++) this.fx.push({ type: 'smoke', x: x + rand(-0.3, 0.3), y: y + rand(0, 0.4), vx: rand(-0.6, 0.6), vy: rand(0.6, 1.6), t: 0, life: rand(0.6, 1.1), r: rand(2, 4) * size });
    this.shake = Math.max(this.shake, 0.12 * size);
    this.audio.sfx(size > 1.1 ? 'boom' : 'boom');
    if (dmg > 0 && !enemyOwned) {
      const list = this.boss ? [...this.enemies, this.boss] : this.enemies;
      for (const e of list) if (!e.dead && e.type !== 'freed' && Math.hypot(e.x - x, e.y + e.h / 2 - y) < 1.6 * size) this.damage(e, dmg, true);
    }
  }
  spark(x, y, color) { for (let i = 0; i < 3; i++) this.fx.push({ type: 'spark', x, y, vx: rand(-4, 4), vy: rand(-1, 4), t: 0, life: 0.18, color }); }
  puff(x, y, r) { this.fx.push({ type: 'smoke', x, y, vx: 0, vy: 0.5, t: 0, life: 0.5, r }); }
  dust(x, y) { for (let i = 0; i < 4; i++) this.fx.push({ type: 'smoke', x: x + rand(-0.4, 0.4), y, vx: rand(-1, 1), vy: rand(0.2, 0.8), t: 0, life: 0.4, r: 1.5 }); }
  debris(x, y, color, n) { for (let i = 0; i < n; i++) this.fx.push({ type: 'debris', x, y, vx: rand(-5, 5), vy: rand(2, 8), t: 0, life: rand(0.6, 1), color, grav: true }); }

  updateFx(dt) {
    for (const f of this.fx) {
      f.t += dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
      if (f.grav || f.type === 'casing') f.vy -= G * dt;
    }
    this.fx = this.fx.filter((f) => f.t < f.life);
    for (const it of this.items) it.t += dt;
  }

  // ---------- disegno ----------
  draw() {
    const s = this.screen; const g = s.g;
    if (this.state === 'select') { this.drawSelect(); return; }
    const shakeX = this.shake > 0 ? rand(-3, 3) * Math.min(1, this.shake * 2) : 0;
    const shakeY = this.shake > 0 ? rand(-2, 2) * Math.min(1, this.shake * 2) : 0;
    this.drawBackground(g);
    this.drawGround(g);
    for (const it of this.items) this.drawItem(g, it);
    for (const e of this.enemies) this.drawEnemy(g, e);
    if (this.boss) this.drawBoss(g, this.boss);
    this.drawPlayer(g);
    this.drawBullets(g);
    this.drawFx(g);
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,235,${Math.min(0.8, this.flash * 2)})`; g.fillRect(0, 0, s.vw, s.vh); }
    s.present(shakeX, shakeY);
    this.drawHud();
  }

  drawBackground(g) {
    const L = this.level; const { vw } = this;
    const gl = this.groundLine;
    const camPx = this.camX * PPM;
    bandedSky(g, vw, gl, L.sky);
    // sole/luna a bande
    const sunY = gl * 0.42;
    pring(g, vw * 0.72, sunY, 22, L.sun, true);
    g.fillStyle = L.sky[4]; for (let i = 0; i < 4; i++) g.fillRect(vw * 0.72 - 24, sunY + 6 + i * 5, 48, 1 + i * 0.5);
    // nuvole/fumo
    for (let i = 0; i < 6; i++) {
      const x = ((hash(i) * 600 - camPx * 0.05 - this.t * 3) % (vw + 80) + vw + 80) % (vw + 80) - 40;
      const y = gl * (0.12 + hash(i + 9) * 0.3);
      g.fillStyle = this.levelIndex === 2 ? 'rgba(90,70,110,.5)' : 'rgba(255,255,255,.35)';
      g.fillRect(Math.round(x), Math.round(y), 30, 4); g.fillRect(Math.round(x) + 6, Math.round(y) - 3, 16, 3);
    }
    // strato lontano
    const farOff = camPx * 0.2;
    g.fillStyle = L.far;
    if (this.levelIndex === 1) {
      for (let x = 0; x < vw; x++) { const wx = x + farOff; const h = 18 + Math.sin(wx * 0.02) * 10 + Math.sin(wx * 0.053) * 6; g.fillRect(x, gl - 30 - h, 1, h + 30); }
      g.fillStyle = L.farLit; for (let i = -1; i < 4; i++) { const x = Math.round(i * 110 - (farOff * 0.6) % 110); g.fillRect(x, gl - 70, 34, 40); g.fillRect(x + 4, gl - 76, 26, 6); }
    } else {
      const w = 22; const start = Math.floor(farOff / w) - 1;
      for (let i = start; i < start + vw / w + 3; i++) {
        const h = 30 + hash(i) * 55; const x = Math.round(i * w - farOff);
        g.fillStyle = L.far; g.fillRect(x, gl - 22 - h, w - 3, h + 22);
        if (this.levelIndex === 2 && hash(i + 3) > 0.5) { // ciminiere con fumo
          g.fillRect(x + 6, gl - 40 - h, 5, 20);
          for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(80,80,100,.5)'; g.fillRect(x + 4 + ((this.t * 8 + k * 7) % 14), gl - 46 - h - k * 6 - (this.t * 6 % 6), 8, 4); }
          g.fillStyle = L.far;
        }
        g.fillStyle = L.farLit;
        for (let wy = gl - 18 - h; wy < gl - 26; wy += 6) for (let wx2 = 3; wx2 < w - 6; wx2 += 5) if (hash(i * 31 + wy * 7 + wx2) > 0.72) g.fillRect(x + wx2, wy, 2, 3);
      }
    }
    // strato medio
    const midOff = camPx * 0.5;
    const mw = 60; const ms = Math.floor(midOff / mw) - 1;
    for (let i = ms; i < ms + vw / mw + 3; i++) {
      const x = Math.round(i * mw - midOff); const r = hash(i + 100);
      g.fillStyle = L.mid;
      if (this.levelIndex === 0) { // case diroccate e lampioni
        const h = 20 + r * 26; g.fillRect(x, gl - 6 - h, 34, h + 6);
        g.fillRect(x + 4, gl - 12 - h, 10, 6);
        g.fillStyle = '#1a1028'; g.fillRect(x + 40, gl - 34, 2, 30); g.fillRect(x + 40, gl - 34, 8, 2);
        g.fillStyle = '#ffd166'; g.fillRect(x + 46, gl - 32, 2, 2);
      } else if (this.levelIndex === 1) { // cactus e rocce
        g.fillRect(x + 10, gl - 26, 5, 22); g.fillRect(x + 4, gl - 18, 6, 3); g.fillRect(x + 4, gl - 24, 3, 7); g.fillRect(x + 15, gl - 20, 6, 3); g.fillRect(x + 18, gl - 27, 3, 9);
        g.fillRect(x + 32, gl - 10 - r * 8, 18, 10 + r * 8);
      } else { // tubi e ingranaggi
        g.fillRect(x, gl - 40, 60, 5); g.fillRect(x + 20, gl - 40, 5, 36);
        const cx = x + 44; const cy = gl - 18; const a = this.t * (i % 2 ? 1 : -1);
        pring(g, cx, cy, 9, L.mid, true);
        g.fillStyle = '#ff4d4d'; g.fillRect(cx - 1, cy - 1, 3, 3);
        for (let k = 0; k < 6; k++) { const aa = a + (k * Math.PI) / 3; g.fillStyle = L.mid; g.fillRect(Math.round(cx + Math.cos(aa) * 10) - 2, Math.round(cy + Math.sin(aa) * 10) - 2, 4, 4); }
      }
    }
  }

  drawGround(g) {
    const L = this.level; const { vw, vh } = this;
    for (let px = 0; px < vw; px++) {
      const x = this.camX + px / PPM;
      const top = this.sy(this.ground(x));
      g.fillStyle = L.groundTop; g.fillRect(px, top, 1, 3);
      g.fillStyle = L.ground; g.fillRect(px, top + 3, 1, 9);
      g.fillStyle = L.dirt; g.fillRect(px, top + 12, 1, vh - top);
      const wx = Math.floor(x * PPM);
      if (this.levelIndex === 0 && wx % 24 < 10) { g.fillStyle = L.groundLine; g.fillRect(px, top + 6, 1, 1); }
      if (this.levelIndex === 1 && hash(wx) > 0.93) { g.fillStyle = L.groundLine; g.fillRect(px, top + 4 + Math.floor(hash(wx + 1) * 6), 1, 1); }
      if (this.levelIndex === 2) { if (wx % 32 === 0) { g.fillStyle = L.dirt; g.fillRect(px, top + 3, 1, 9); } if (wx % 16 < 8) { g.fillStyle = '#1b1b1b'; g.fillRect(px, top, 1, 1); } else { g.fillStyle = L.groundLine; g.fillRect(px, top, 1, 1); } }
      if (hash(wx * 3.1) > 0.97) { g.fillStyle = L.groundTop; g.fillRect(px, top + 14 + Math.floor(hash(wx) * 20), 1, 1); }
    }
  }

  drawPlayer(g) {
    const p = this.p;
    if (p.hurt > 0 && Math.floor(p.hurt * 14) % 2 && this.overdrive <= 0) return;
    const gx = this.sx(p.x); const gy = this.sy(p.y);
    const h = this.hero;
    const od = this.overdrive > 0;
    if (od) { // aura
      const r = 16 + Math.sin(this.t * 20) * 2;
      g.fillStyle = 'rgba(77,227,255,.25)'; pring(g, gx, gy - 13, r, 'rgba(77,227,255,.22)', true);
      for (let i = 0; i < 3; i++) { g.fillStyle = '#4de3ff'; g.fillRect(gx - 14 - rand(0, 10), gy - rand(4, 24), rand(4, 9), 1); }
    }
    // bici
    const wr = 6; const rear = { x: gx - 7, y: gy - wr }; const front = { x: gx + 8, y: gy - wr };
    const bb = { x: gx, y: gy - wr }; const seat = { x: gx - 3, y: gy - 15 }; const head = { x: gx + 6, y: gy - 14 };
    const spin = p.anim;
    for (const w of [rear, front]) {
      pring(g, w.x, w.y, wr, '#111');
      pring(g, w.x, w.y, wr - 1, '#2b2b2b');
      pline(g, w.x - Math.cos(spin) * (wr - 1), w.y - Math.sin(spin) * (wr - 1), w.x + Math.cos(spin) * (wr - 1), w.y + Math.sin(spin) * (wr - 1), '#888');
      pline(g, w.x - Math.cos(spin + 1.57) * (wr - 1), w.y - Math.sin(spin + 1.57) * (wr - 1), w.x + Math.cos(spin + 1.57) * (wr - 1), w.y + Math.sin(spin + 1.57) * (wr - 1), '#888');
    }
    const bc = od ? '#4de3ff' : h.bike;
    // gamba lontana
    const crank = 3; const ca = p.anim;
    const pedA = { x: bb.x + Math.cos(ca) * crank, y: bb.y + Math.sin(ca) * crank };
    const pedB = { x: bb.x - Math.cos(ca) * crank, y: bb.y - Math.sin(ca) * crank };
    const hip = { x: seat.x, y: seat.y - 1 };
    this.leg(g, hip, pedB, '#1b1b2f');
    pline(g, rear.x, rear.y, bb.x, bb.y, bc, 2); pline(g, rear.x, rear.y, seat.x, seat.y, bc, 1);
    pline(g, seat.x, seat.y, bb.x, bb.y, bc, 2); pline(g, bb.x, bb.y, head.x, head.y, bc, 2); pline(g, seat.x, seat.y, head.x, head.y, bc, 2);
    pline(g, head.x, head.y, front.x, front.y, '#bbb', 1); pline(g, head.x, head.y, head.x + 2, head.y - 2, '#bbb', 1);
    g.fillStyle = '#111'; g.fillRect(seat.x - 3, seat.y - 1, 5, 2);
    pline(g, pedA.x, pedA.y, pedB.x, pedB.y, '#555');
    // corpo
    const spr = this.heroSprites[this.heroIndex];
    g.drawImage(p.hurt > 0 && Math.floor(p.hurt * 14) % 2 ? spr.white : spr.body, hip.x - 6, hip.y - 10 - (p.onGround ? 0 : 1));
    this.leg(g, hip, pedA, h.pants);
    // arma (ruota con la mira)
    const sh = { x: hip.x + 7, y: hip.y - 4 };
    const w = WEAPONS[this.weapon];
    const len = 9 - p.recoil * 2;
    const ax = Math.cos(p.aim); const ay = -Math.sin(p.aim);
    pline(g, sh.x, sh.y, sh.x + ax * len, sh.y + ay * len, '#3d4451', 3);
    pline(g, sh.x + ax * 3, sh.y + ay * 3, sh.x + ax * len, sh.y + ay * len, this.weapon === 'blaster' ? '#9aa5b1' : w.color, 1);
    if (p.pumpT > 0) { // colpo di pompa
      const k = 1 - p.pumpT / 0.15;
      const a = -1.2 + k * 2.2;
      pline(g, sh.x, sh.y, sh.x + Math.cos(a) * 13, sh.y + Math.sin(a) * 13, '#e0e0e0', 2);
      g.fillStyle = '#fff'; g.fillRect(Math.round(sh.x + Math.cos(a) * 13) - 1, Math.round(sh.y + Math.sin(a) * 13) - 1, 3, 3);
    }
    if (p.vehicle) { // Cargo-Cannone: cassone corazzato con cannone
      const bx = gx + 3; const by = gy - 15;
      g.fillStyle = '#4a5d23'; g.fillRect(bx, by, 16, 10);
      g.fillStyle = '#6b8e23'; g.fillRect(bx, by, 16, 2);
      g.fillStyle = '#2f3d14'; for (let i = 0; i < 3; i++) g.fillRect(bx + 2 + i * 5, by + 4, 2, 2);
      const ca = clamp(p.aim + 0.12, -0.3, 1);
      pline(g, bx + 10, by, bx + 10 + Math.cos(ca) * 11, by - Math.sin(ca) * 11, '#2b2b2b', 3);
      for (let i = 0; i < p.vehicle.max; i++) { g.fillStyle = i < p.vehicle.hp ? '#06d6a0' : '#333'; g.fillRect(bx + i * 3, by - 4, 2, 2); }
    }
  }

  leg(g, hip, foot, color) {
    const a = 6; const dx = foot.x - hip.x; const dy = foot.y - hip.y;
    const d = Math.min(Math.hypot(dx, dy), 2 * a - 0.2);
    const mx = hip.x + dx / 2; const my = hip.y + dy / 2;
    const hgt = Math.sqrt(Math.max(0, a * a - (d / 2) ** 2));
    const nx = -dy / (Math.hypot(dx, dy) || 1); const ny = dx / (Math.hypot(dx, dy) || 1);
    const knee = { x: mx - nx * hgt, y: my - ny * hgt };
    if (knee.x < mx) { knee.x = mx + nx * hgt; knee.y = my + ny * hgt; }
    pline(g, hip.x, hip.y, knee.x, knee.y, color, 2); pline(g, knee.x, knee.y, foot.x, foot.y, color, 2);
    g.fillStyle = '#111'; g.fillRect(Math.round(foot.x) - 1, Math.round(foot.y), 3, 1);
  }

  drawEnemy(g, e) {
    const x = this.sx(e.x); const y = this.sy(e.y);
    const fl = e.flash > 0;
    switch (e.type) {
      case 'walker': case 'shield': {
        const frames = e.type === 'shield' ? (fl ? this.shieldW : this.shieldBot) : (fl ? this.walkerW : this.walker);
        const spr = frames[Math.floor(e.t * (this.overdrive > 0 ? 12 : 5)) % 2];
        g.drawImage(spr, x - 7, y - 18);
        if (this.overdrive > 0 && e.type === 'walker') ptext(g, '!', x - 1, y - 26, Math.floor(this.t * 8) % 2 ? '#ffd34d' : '#fff');
        if (e.type === 'shield' && e.shield > 0) {
          g.fillStyle = '#ffb703'; g.fillRect(x - 10, y - 19, 3, 17);
          g.fillStyle = '#1b1b1b'; for (let i = 0; i < 4; i++) g.fillRect(x - 10, y - 17 + i * 4, 3, 1);
          g.fillStyle = '#fff3b0'; g.fillRect(x - 9, y - 18, 1, 15);
        }
        break;
      }
      case 'drone': {
        g.drawImage(fl ? this.droneW : this.drone, x - 8, y - 9);
        const r = Math.abs(Math.sin(e.t * 40)) * 8;
        g.fillStyle = '#d0f4f1'; g.fillRect(Math.round(x - r), y - 10, Math.round(r * 2), 1);
        if (Math.random() < 0.3) { g.fillStyle = '#ff3b3b'; g.fillRect(x - 4, y - 5, 1, 1); }
        break;
      }
      case 'barrel': {
        pring(g, x, y - 6, 6, fl ? '#fff' : '#8d5524', true); pring(g, x, y - 6, 6, '#3e2412');
        for (let k = 0; k < 2; k++) { const a = e.rot + k * Math.PI / 2; pline(g, x - Math.cos(a) * 5, y - 6 - Math.sin(a) * 5, x + Math.cos(a) * 5, y - 6 + Math.sin(a) * 5, '#3e2412'); }
        g.fillStyle = '#ffd166'; g.fillRect(x - 1, y - 7, 2, 2);
        break;
      }
      case 'mine': {
        g.fillStyle = '#2b2b2b'; g.fillRect(x - 5, y - 3, 11, 3); g.fillRect(x - 3, y - 5, 7, 2);
        g.fillStyle = Math.sin(e.t * 9) > 0 ? '#ff3b3b' : '#5a0000'; g.fillRect(x, y - 6, 2, 1);
        break;
      }
      case 'turret': {
        g.fillStyle = fl ? '#fff' : '#5c677d'; g.fillRect(x - 8, y - 8, 17, 8); g.fillRect(x - 5, y - 13, 11, 5);
        g.fillStyle = '#2b2d42'; pline(g, x - 2, y - 12, x - 10, y - 17, '#2b2d42', 3);
        g.fillStyle = '#ffd166'; g.fillRect(x - 7, y - 4, 15, 1);
        break;
      }
      case 'crate': {
        g.fillStyle = fl ? '#fff' : '#b08968'; g.fillRect(x - 6, y - 11, 12, 11);
        g.fillStyle = '#7f5539'; g.fillRect(x - 6, y - 11, 12, 1); g.fillRect(x - 6, y - 1, 12, 1); g.fillRect(x - 6, y - 11, 1, 11); g.fillRect(x + 5, y - 11, 1, 11);
        ptext(g, WEAPONS[e.weapon].letter, x - 1, y - 8, '#1b1b1b');
        break;
      }
      case 'cage': {
        const pr = this.prisoner[Math.floor(e.t * 3) % 2];
        g.drawImage(pr, x - 4, y - 12);
        g.fillStyle = fl ? '#fff' : '#6b7785';
        g.fillRect(x - 8, y - 20, 17, 2); g.fillRect(x - 8, y - 1, 17, 1);
        for (let i = 0; i < 5; i++) g.fillRect(x - 8 + i * 4, y - 20, 1, 20);
        if (Math.floor(e.t * 2) % 2) ptext(g, 'H!', x - 4, y - 27, '#fff');
        break;
      }
      case 'freed': {
        g.drawImage(this.prisoner[Math.floor(e.t * 8) % 2], x - 4, y - 12);
        break;
      }
      default: break;
    }
  }

  drawBoss(g, b) {
    const x = this.sx(b.x); const y = this.sy(b.y);
    const fl = b.flash > 0;
    this.drawBossBody(g, b, x, y, fl);
    const wp = this.weakPoint(b);
    const pulse = Math.floor(this.t * 6) % 2;
    pring(g, this.sx(wp.x), this.sy(wp.y), 3 + pulse, pulse ? '#ffd34d' : '#ff3b3b');
  }

  drawBossBody(g, b, x, y, fl) {
    const c = (col) => (fl ? '#ffffff' : col);
    if (b.kind === 'tank') {
      g.fillStyle = c('#2b2d42'); g.fillRect(x - 30, y - 10, 60, 10);
      for (let i = 0; i < 7; i++) pring(g, x - 26 + i * 9, y - 5, 4, c('#5c677d'), true);
      g.fillStyle = c('#7f4f24'); g.fillRect(x - 28, y - 24, 56, 14);
      g.fillStyle = c('#936639'); g.fillRect(x - 28, y - 24, 56, 3);
      g.fillStyle = c('#582f0e'); g.fillRect(x - 14, y - 36, 30, 12);
      pline(g, x - 14, y - 31, x - 42, y - 33, c('#3a3a3a'), 4);
      g.fillStyle = '#ff3b3b'; g.fillRect(x - 8, y - 33, 6, 3);
      ptext(g, 'B', x + 6, y - 21, '#ffd166');
      g.drawImage(this.baron, x + 2, y - 46);
    } else if (b.kind === 'heli') {
      g.fillStyle = c('#386641'); g.fillRect(x - 24, y - 16, 40, 16); g.fillRect(x + 14, y - 12, 26, 5);
      g.fillStyle = c('#6a994e'); g.fillRect(x - 24, y - 16, 40, 3);
      g.fillStyle = '#9ad1ff'; g.fillRect(x - 22, y - 13, 10, 7);
      g.fillStyle = c('#1b1b1b'); g.fillRect(x - 20, y, 30, 2); g.fillRect(x - 16, y - 2, 2, 2); g.fillRect(x + 4, y - 2, 2, 2);
      const r = Math.abs(Math.sin(this.t * 30)) * 34; g.fillStyle = '#ddd'; g.fillRect(Math.round(x - 4 - r), y - 19, Math.round(r * 2), 1);
      g.fillRect(x - 5, y - 19, 2, 3);
      const tr = Math.abs(Math.sin(this.t * 35)) * 6; g.fillRect(x + 38, Math.round(y - 10 - tr), 1, Math.round(tr * 2));
      pline(g, x - 24, y - 6, x - 30, y - 4, '#2b2b2b', 2);
      ptext(g, 'B', x - 4, y - 11, '#ffd166');
    } else {
      // Mecha-Triciclo del Barone
      pring(g, x - 22, y - 12, 12, c('#2b2b2b'), true); pring(g, x - 22, y - 12, 7, c('#6c757d'), true);
      pring(g, x + 20, y - 9, 9, c('#2b2b2b'), true); pring(g, x + 20, y - 9, 5, c('#6c757d'), true);
      const sp = this.t * 4; pline(g, x - 22 - Math.cos(sp) * 10, y - 12 - Math.sin(sp) * 10, x - 22 + Math.cos(sp) * 10, y - 12 + Math.sin(sp) * 10, '#adb5bd');
      g.fillStyle = c('#7b2cbf'); g.fillRect(x - 14, y - 34, 40, 18);
      g.fillStyle = c('#9d4edd'); g.fillRect(x - 14, y - 34, 40, 3);
      pline(g, x - 14, y - 24, x - 22, y - 12, c('#5a189a'), 4);
      g.fillStyle = c('#d4af37'); g.fillRect(x - 4, y - 40, 20, 6);
      g.fillStyle = '#ffd166'; for (let i = 0; i < 3; i++) g.fillRect(x - 12 + i * 8, y - 28, 4, 4);
      g.fillStyle = c('#3d4451'); g.fillRect(x + 18, y - 44, 10, 10); g.fillRect(x + 26, y - 42, 6, 3);
      g.drawImage(this.baron, x + 2, y - 50);
      if (b.charge) for (let i = 0; i < 4; i++) { g.fillStyle = '#ffd166'; g.fillRect(x + 30 + rand(0, 12), y - rand(2, 30), rand(4, 10), 1); }
    }
  }

  drawItem(g, it) {
    const x = this.sx(it.x); const y = this.sy(it.y) - 6 - Math.round(Math.abs(Math.sin(it.t * 4)) * 3);
    const w = WEAPONS[it.kind];
    if (it.kind === 'vehicle') { // cassa speciale lampeggiante
      g.fillStyle = Math.floor(it.t * 6) % 2 ? '#ffd166' : '#4a5d23'; g.fillRect(x - 7, y - 6, 15, 12);
      g.fillStyle = '#1b1b2f'; g.fillRect(x - 7, y - 6, 15, 1); g.fillRect(x - 7, y + 5, 15, 1);
      ptext(g, 'V', x - 1, y - 2, '#1b1b2f');
      return;
    }
    const col = w ? w.color : it.kind === 'bomb' ? '#ffd166' : '#ff5a7a';
    pring(g, x, y, 5, '#1b1b2f', true); pring(g, x, y, 4, col, true);
    ptext(g, w ? w.letter : it.kind === 'bomb' ? 'B' : '+', x - 1, y - 2, '#1b1b2f');
    if (Math.floor(it.t * 6) % 2) { g.fillStyle = '#fff'; g.fillRect(x - 3, y - 3, 1, 1); }
  }

  drawBullets(g) {
    for (const b of this.bullets) {
      const x = this.sx(b.x); const y = this.sy(b.y);
      if (b.kind === 'laser') { pline(g, x - b.vx / 40 * 10, y + b.vy / 40 * 10, x, y, b.color, 2); g.fillStyle = '#fff'; g.fillRect(x - 1, y, 2, 1); }
      else if (b.kind === 'shell') { pring(g, x, y, 2, '#2b2b2b', true); g.fillStyle = '#ffd166'; g.fillRect(x - 1, y - 1, 1, 1); }
      else if (b.kind === 'rocket') { g.fillStyle = '#ddd'; g.fillRect(x - 2, y - 1, 4, 2); g.fillStyle = '#ff6b35'; g.fillRect(x - 4, y - 1, 2, 2); }
      else if (b.kind === 'flame') { const k = 1 - b.life / 0.38; g.fillStyle = k < 0.3 ? '#fff3b0' : k < 0.6 ? '#ff9f1c' : '#e85d04'; const r = 1 + Math.round(k * 3); g.fillRect(x - r, y - r, r * 2, r * 2); }
      else { g.fillStyle = b.color; g.fillRect(x - 2, y - 1, 4, 2); g.fillStyle = '#fff'; g.fillRect(x, y - 1, 2, 1); }
    }
    for (const b of this.ebullets) {
      const x = this.sx(b.x); const y = this.sy(b.y);
      if (b.grav) { pring(g, x, y, 3, '#1b1b1b', true); g.fillStyle = '#ff3b3b'; g.fillRect(x - 1, y - 1, 2, 2); }
      else { g.fillStyle = '#ff3b3b'; g.fillRect(x - 2, y - 1, 4, 3); g.fillStyle = '#ffd6d6'; g.fillRect(x - 1, y, 2, 1); }
    }
  }

  drawFx(g) {
    for (const f of this.fx) {
      const x = this.sx(f.x); const y = this.sy(f.y); const k = f.t / f.life;
      if (f.type === 'boom') {
        const r = (4 + k * 14) * f.size;
        pring(g, x, y, r, k < 0.3 ? '#fff3b0' : k < 0.6 ? '#ffb703' : '#e85d04', true);
        pring(g, x, y, r * 0.6, k < 0.4 ? '#ffffff' : '#ffd166', true);
      } else if (f.type === 'smoke') {
        const r = f.r * (0.6 + k * 0.8); const a = 0.55 * (1 - k);
        g.fillStyle = `rgba(70,62,80,${a})`; g.fillRect(Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
      } else if (f.type === 'debris') { g.fillStyle = f.color; g.fillRect(x, y, 2, 2); }
      else if (f.type === 'casing') { g.fillStyle = '#ffd166'; g.fillRect(x, y, 1, 2); }
      else if (f.type === 'spark') { g.fillStyle = f.color || '#fff59d'; g.fillRect(x, y, 1, 1); }
      else if (f.type === 'muzzle') { pring(g, x, y, 3, f.color, true); g.fillStyle = '#fff'; g.fillRect(x - 1, y - 1, 2, 2); }
    }
  }

  // ---------- interfaccia (piena risoluzione) ----------
  drawHud() {
    const ctx = this.screen.ctx; const W = this.screen.W; const H = this.screen.H;
    const top = 50;
    const p = this.p;
    // riga 1: punti e combo
    hudText(ctx, String(this.score).padStart(7, '0'), 14, top + 22, { size: 22, color: '#fff' });
    if (this.combo >= 3) hudText(ctx, t('games.shooter.combo', { n: Math.min(8, 1 + Math.floor(this.combo / 3)) }), 14, top + 44, { size: 14, color: '#ff9f1c' });
    hudText(ctx, t('games.shooter.mission', { n: `${this.levelIndex + 1}${this.loopN ? `+${this.loopN}` : ''}` }), W - 14, top + 22, { size: 14, color: '#ffd34d', align: 'right' });
    // vite e bombe
    let hx = 14; const hy = top + 54;
    for (let i = 0; i < p.maxHp; i++) { hudText(ctx, i < p.hp ? '♥' : '♡', hx, hy + 14, { size: 18, color: i < p.hp ? '#ff4d6d' : '#555' }); hx += 17; }
    hudText(ctx, `💣×${p.bombs}`, hx + 8, hy + 14, { size: 15 });
    const w = WEAPONS[this.weapon];
    hudText(ctx, `${t(w.name)} ${this.ammo === Infinity ? '∞' : this.ammo}`, W - 14, top + 44, { size: 14, color: w.color, align: 'right' });
    // misuratore potenza / soglia sprint / overdrive
    const gx = 14; const gy = hy + 26; const gw = W - 28; const gh = 14;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(gx, gy, gw, gh);
    const maxW = Math.max(400, (this.effort.threshold || 200) * 1.6);
    const pw = clamp(this.power / maxW, 0, 1);
    ctx.fillStyle = this.sprinting ? '#4de3ff' : '#fc6719'; ctx.fillRect(gx, gy, gw * pw, gh);
    const tx = gx + gw * clamp((this.effort.threshold || 0) / maxW, 0, 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(tx - 1, gy - 3, 2, gh + 6);
    hudText(ctx, `${Math.round(this.power)} W`, gx + 6, gy + 11, { size: 11 });
    hudText(ctx, t('games.shooter.sprintLine', { w: this.effort.threshold || '-' }), tx - 4, gy + 11, { size: 10, align: 'right', color: '#cfe' });
    hudText(ctx, t('games.horde.fireRate', { n: fmtDec(this.fireRate || 0, 1) }), gx + gw - 4, gy + 11, { size: 11, align: 'right', color: '#fff59d' });
    // overdrive
    const oy = gy + gh + 6;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(gx, oy, gw, 8);
    const ok = this.overdrive > 0 ? this.overdrive / 8 : this.odMeter;
    ctx.fillStyle = this.overdrive > 0 ? (Math.floor(this.t * 10) % 2 ? '#4de3ff' : '#fff') : '#2ec4b6'; ctx.fillRect(gx, oy, gw * ok, 8);
    hudText(ctx, this.overdrive > 0 ? t('games.horde.overdrive') : this.sprinting ? t('games.shooter.charging') : t('games.shooter.chargeHint'), W / 2, oy + 22, { size: 11, align: 'center', color: this.overdrive > 0 || this.sprinting ? '#4de3ff' : '#9aa3b5' });
    // progresso missione o vita del boss
    if (this.boss) {
      const b = this.boss; const by = H - 34;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(14, by, W - 28, 16);
      ctx.fillStyle = b.hp < b.maxHp * 0.5 ? '#ff3b3b' : '#ff9f1c'; ctx.fillRect(14, by, (W - 28) * Math.max(0, b.hp / b.maxHp), 16);
      hudText(ctx, t(b.name), W / 2, by + 13, { size: 12, align: 'center' });
    } else if (this.state === 'play') {
      const k = clamp(this.p.x / LEVEL_LEN, 0, 1); const by = H - 22;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(14, by, W - 28, 6);
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(14, by, (W - 28) * k, 6);
      hudText(ctx, '☠', W - 14, by + 6, { size: 14, align: 'right', color: '#ff4d4d' });
    }
    if (!this.hooks.connected()) hudText(ctx, t('games.common.demo'), W / 2, H - 40, { size: 11, align: 'center', color: '#ffd34d' });
    // sfida sprint
    const c = this.challenge;
    if (c) {
      const cy = H * 0.3;
      if (c.phase === 'ready') hudText(ctx, t('games.shooter.challenge', { need: c.need, target: c.target, t: Math.ceil(c.t) }), W / 2, cy, { size: 15, align: 'center', color: '#ffd34d' });
      else {
        hudText(ctx, t('games.shooter.sprintNow', { s: fmtDec(Math.max(0, c.need - c.held), 1) }), W / 2, cy, { size: 26, align: 'center', color: this.power >= c.target ? '#06d6a0' : '#ff6b6b' });
        hudText(ctx, t('games.shooter.aboveTime', { target: c.target, s: Math.ceil(20 - c.time) }), W / 2, cy + 20, { size: 12, align: 'center' });
      }
    }
    // testi
    let ty = H * 0.42;
    for (const x of this.texts) {
      ctx.globalAlpha = Math.min(1, x.t * 3);
      if (x.wx != null) {
        const pos = this.screen.toCss(this.sx(x.wx), this.sy(x.wy) - (1 - x.t / x.life) * 12);
        hudText(ctx, x.text, pos.x, pos.y, { size: 12, color: x.color, align: 'center' });
      } else {
        hudText(ctx, x.text, W / 2, ty, { size: x.big ? 24 : 16, color: x.color, align: 'center' }); ty += x.big ? 30 : 22;
      }
      ctx.globalAlpha = 1;
    }
    this.hooks.progress?.drawToasts(ctx, W, this.lastDt || 0.016);
    if (this.state === 'title') this.card(t('games.shooter.mission', { n: this.levelIndex + 1 }), t(this.level.name), this.levelIndex === 0 && !this.loopN ? t('games.shooter.missionHint') : '');
    if (this.state === 'clear') {
      const s = this.levelStats;
      this.card(t('games.shooter.clear'), t('games.shooter.clearStats', { kills: s.kills, rescued: s.rescued }), t('games.shooter.clearPoints', { n: this.score - s.start }));
    }
    if (this.state === 'over') {
      this.card(t('games.shooter.failed'), `${t('games.shooter.points', { n: this.score })}${this.newRecord ? t('games.shooter.newBest') : ''}`, t('games.shooter.failStats', { best: this.best, rescued: this.rescued }));
      if (this.stateT > 1.2) hudText(ctx, t('games.shooter.retryKeys'), W / 2, H * 0.62, { size: 15, align: 'center', color: '#ffd34d' });
    }
  }

  card(title, sub, sub2) {
    const ctx = this.screen.ctx; const W = this.screen.W; const H = this.screen.H;
    ctx.fillStyle = 'rgba(10,8,20,.72)'; ctx.fillRect(0, H * 0.36, W, 130);
    ctx.fillStyle = '#fc6719'; ctx.fillRect(0, H * 0.36, W, 3); ctx.fillRect(0, H * 0.36 + 127, W, 3);
    hudText(ctx, title, W / 2, H * 0.36 + 42, { size: 28, align: 'center', color: '#ffd34d' });
    hudText(ctx, sub, W / 2, H * 0.36 + 72, { size: 14, align: 'center' });
    if (sub2) hudText(ctx, sub2, W / 2, H * 0.36 + 98, { size: 12, align: 'center', color: '#cfd6e4' });
  }

  drawSelect() {
    const s = this.screen; const g = s.g;
    bandedSky(g, s.vw, s.vh, ['#120a24', '#1d1135', '#2b1748', '#3b1c4a', '#6b2b4f']);
    for (let i = 0; i < 40; i++) { g.fillStyle = hash(i) > 0.5 ? '#fff' : '#ffd166'; if ((this.t * 2 + hash(i) * 10) % 3 > 0.4) g.fillRect(Math.floor(hash(i + 1) * s.vw), Math.floor(hash(i + 2) * s.vh * 0.6), 1, 1); }
    // eroe selezionato, grande
    const h = HEROES[this.heroIndex];
    const spr = this.heroSprites[this.heroIndex].body;
    const cx = Math.round(s.vw / 2); const cy = Math.round(s.vh * 0.5);
    g.fillStyle = '#2b1d4e'; g.fillRect(cx - 40, cy + 26, 80, 6);
    g.save(); g.imageSmoothingEnabled = false; g.drawImage(spr, cx - 24, cy - 24, spr.width * 3, spr.height * 3); g.restore();
    // bici stilizzata sotto
    pring(g, cx - 18, cy + 22, 10, '#111'); pring(g, cx + 22, cy + 22, 10, '#111');
    pline(g, cx - 18, cy + 22, cx, cy + 22, h.bike, 3); pline(g, cx, cy + 22, cx + 16, cy + 6, h.bike, 3); pline(g, cx - 18, cy + 22, cx - 6, cy + 4, h.bike, 2); pline(g, cx + 16, cy + 6, cx + 22, cy + 22, '#bbb', 2);
    g.drawImage(this.baron, s.vw - 30, 18);
    s.present();
    const ctx = s.ctx; const W = s.W; const H = s.H;
    hudText(ctx, 'PEDAL STRIKE', W / 2, 92, { size: 34, align: 'center', color: '#fc6719' });
    hudText(ctx, t('games.shooter.story1'), W / 2, 118, { size: 12, align: 'center', color: '#cfd6e4' });
    hudText(ctx, t('games.shooter.story2'), W / 2, 134, { size: 12, align: 'center', color: '#cfd6e4' });
    hudText(ctx, t('games.shooter.pickHero'), W / 2, H * 0.3, { size: 16, align: 'center', color: '#ffd34d' });
    hudText(ctx, t(h.name), W / 2, H * 0.68, { size: 20, align: 'center' });
    hudText(ctx, t(h.perk), W / 2, H * 0.68 + 24, { size: 13, align: 'center', color: '#06d6a0' });
    hudText(ctx, HEROES.map((x, i) => (i === this.heroIndex ? '●' : '○')).join(' '), W / 2, H * 0.68 + 48, { size: 14, align: 'center' });
    hudText(ctx, t('games.shooter.heroKeys'), W / 2, H * 0.84, { size: 15, align: 'center', color: '#ffd34d' });
    hudText(ctx, t('games.shooter.inGame'), W / 2, H * 0.84 + 24, { size: 11, align: 'center', color: '#9aa3b5' });
    hudText(ctx, t('games.common.best', { n: this.best }), W / 2, H * 0.84 + 44, { size: 11, align: 'center', color: '#9aa3b5' });
    this.hooks.progress?.drawToasts(ctx, W, this.lastDt || 0.016);
  }

  loop(now) {
    if (!this.active) return;
    let dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    if (this.freeze > 0) { this.freeze -= dt; dt = 0; }
    if (this.slow > 0) { this.slow -= dt; dt *= 0.35; }
    this.lastDt = dt;
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }
}
