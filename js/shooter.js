// "Pedal Strike": sparatutto a scorrimento orizzontale originale.
// - Pedalando avanzi; più watt produci, più spari veloce.
// - Tasto + = salto, tasto − = bomba (pulisce lo schermo). Tocco: metà destra salto, sinistra bomba.
// - Il terreno ha salite e discese reali (pendenza inviata al rullo, max 6%).
// - Ogni ~600 m arriva un carro armato boss: lo scorrimento si ferma e conta solo la potenza.

const G = 22; // gravità (m/s²)
const MAX_GRADE = 6;
const WORLD_SCALE = 1.3;
const BOSS_EVERY = 600;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Shooter {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks; // { speedKmh(), stats(), setGrade(g), connected() }
    this.active = false;
    this.best = Number(localStorage.getItem('strikeBest')) || 0;
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
  }

  start() {
    this.active = true;
    this.reset();
    window.addEventListener('resize', this.resize);
    this.resize();
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.active = false;
    window.removeEventListener('resize', this.resize);
    this.hooks.setGrade(null);
  }

  reset() {
    this.terrain = [{ x0: -50, x1: 40, y0: 0, slope: 0 }];
    while (this.terrainEnd() < 400) this.addTerrain();
    this.p = { x: 0, y: 0, vy: 0, onGround: true, hp: 5, hurt: 0, spread: 0, bombs: 3, fireT: 0, anim: 0 };
    this.bullets = []; this.ebullets = []; this.enemies = []; this.items = []; this.fx = [];
    this.score = 0; this.over = false; this.overT = 0;
    this.nextSpawn = 18; this.nextBoss = BOSS_EVERY; this.boss = null; this.level = 1;
    this.shake = 0; this.flash = 0; this.sentGrade = null; this.camY = 0;
    this.banner = { text: 'Pedala per avanzare!', t: 2.5 };
  }

  // ---------- terreno ----------
  terrainEnd() { return this.terrain[this.terrain.length - 1].x1; }
  addTerrain() {
    const last = this.terrain[this.terrain.length - 1];
    const y0 = last.y0 + last.slope * (last.x1 - last.x0);
    const r = Math.random();
    const slope = r < 0.4 ? 0 : r < 0.8 ? rand(2, MAX_GRADE) / 100 : -rand(1, 4) / 100;
    this.terrain.push({ x0: last.x1, x1: last.x1 + rand(30, 80), y0, slope });
    if (this.terrain.length > 60) this.terrain.shift();
  }
  seg(x) { return this.terrain.find((s) => x >= s.x0 && x < s.x1) || this.terrain[this.terrain.length - 1]; }
  ground(x) { const s = this.seg(x); return s.y0 + s.slope * (x - s.x0); }

  // ---------- input ----------
  input(dir) {
    if (this.over) { if (this.overT > 1) this.reset(); return; }
    if (dir > 0) this.jump(); else this.bomb();
  }
  jump() {
    if (!this.p.onGround) return;
    this.p.vy = 8.5; this.p.onGround = false;
    if (navigator.vibrate) navigator.vibrate(10);
  }
  bomb() {
    if (this.p.bombs <= 0) { this.banner = { text: 'Bombe finite!', t: 1 }; return; }
    this.p.bombs--;
    this.flash = 0.35; this.shake = 0.5;
    if (navigator.vibrate) navigator.vibrate([30, 30, 80]);
    for (const e of this.enemies) if (this.onScreen(e.x)) this.damage(e, 10);
    if (this.boss) this.damage(this.boss, 15);
    this.ebullets = [];
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = r.width * dpr; this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ppm = Math.min(this.W / 10, this.H / 9); // pixel per metro
  }

  get viewW() { return this.W / this.ppm; }
  get camX() { return this.p.x - this.viewW * 0.25; }
  onScreen(x) { return x > this.camX - 1 && x < this.camX + this.viewW + 1; }

  // ---------- logica ----------
  update(dt) {
    const st = this.hooks.stats();
    const connected = this.hooks.connected();
    const kmh = connected ? this.hooks.speedKmh() : 25;
    this.power = connected ? st.power || 0 : 150;
    this.kmh = kmh;
    const p = this.p;
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.fx.forEach((f) => { f.t += dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt; if (f.vy !== undefined) f.vy -= G * 0.5 * dt; });
    this.fx = this.fx.filter((f) => f.t < f.life);
    if (this.over) { this.overT += dt; return; }

    // movimento: bloccato durante il boss
    const v = (kmh / 3.6) * WORLD_SCALE;
    if (!this.boss || p.x < this.boss.arena) p.x += v * dt;
    if (this.boss) p.x = Math.min(p.x, this.boss.arena);
    p.anim += v * dt;
    while (this.terrainEnd() < p.x + 200) this.addTerrain();

    // salto
    const gy = this.ground(p.x);
    if (!p.onGround) {
      p.vy -= G * dt; p.y += p.vy * dt;
      if (p.y <= gy) { p.y = gy; p.vy = 0; p.onGround = true; }
    } else p.y = gy;
    this.camY += (gy - this.camY) * Math.min(1, dt * 4);

    // pendenza al rullo (in arena boss: 2% costante)
    const grade = this.boss ? 2 : clamp(this.seg(p.x).slope * 100, -4, MAX_GRADE);
    const g = Math.round(grade * 2) / 2;
    if (g !== this.sentGrade) { this.sentGrade = g; this.hooks.setGrade(g); }
    this.grade = grade;

    // fuoco automatico: cadenza di tiro proporzionale alla potenza
    this.fireRate = clamp(0.8 + this.power / 45, 1, 9);
    p.fireT -= dt;
    if (p.fireT <= 0) {
      p.fireT = 1 / this.fireRate;
      const angles = p.spread > 0 ? [-0.18, 0, 0.18] : [0];
      for (const a of angles) this.bullets.push({ x: p.x + 0.9, y: p.y + 1.25, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, life: 0.9 });
      this.fx.push({ type: 'muzzle', x: p.x + 1.0, y: p.y + 1.25, t: 0, life: 0.06 });
    }
    p.spread = Math.max(0, p.spread - dt);
    p.hurt = Math.max(0, p.hurt - dt);

    // spawn nemici e boss
    if (!this.boss && p.x >= this.nextBoss - 12) this.spawnBoss();
    if (!this.boss && p.x >= this.nextSpawn) this.spawn();

    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
    for (const b of this.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.grav) b.vy -= G * 0.6 * dt;
      if (b.y < this.ground(b.x)) { b.life = 0; this.explode(b.x, b.y, b.grav ? 0.9 : 0.3); }
    }

    for (const e of this.enemies) this.updateEnemy(e, dt);
    if (this.boss) this.updateBoss(this.boss, dt);

    // collisioni proiettili del giocatore
    const targets = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const b of this.bullets) {
      for (const e of targets) {
        if (e.hp > 0 && b.life > 0 && Math.abs(b.x - e.x) < e.w / 2 && b.y > e.y && b.y < e.y + e.h) {
          b.life = 0; this.damage(e, 1);
          this.fx.push({ type: 'spark', x: b.x, y: b.y, t: 0, life: 0.12 });
        }
      }
    }
    // colpi nemici e contatto
    const box = { x: p.x, y: p.y, w: 1.0, h: 1.7 };
    for (const b of this.ebullets) if (b.life > 0 && Math.abs(b.x - box.x) < 0.5 && b.y > box.y && b.y < box.y + box.h) { b.life = 0; this.hit(b.dmg || 1); }
    for (const e of this.enemies) if (e.hp > 0 && Math.abs(e.x - p.x) < (e.w + box.w) / 2 && p.y < e.y + e.h && p.y + box.h > e.y) {
      if (e.type === 'crate') continue;
      this.hit(1); if (e.type === 'mine') this.damage(e, 99);
    }
    for (const it of this.items) if (!it.taken && Math.abs(it.x - p.x) < 0.8 && Math.abs(it.y - p.y) < 1.6) this.take(it);

    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.ebullets = this.ebullets.filter((b) => b.life > 0);
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.x > this.camX - 4);
    this.items = this.items.filter((it) => !it.taken && it.x > this.camX - 2);
  }

  spawn() {
    const x = this.camX + this.viewW + 2;
    const lvl = this.level;
    const r = Math.random();
    const gy = this.ground(x);
    if (r < 0.4) this.enemies.push({ type: 'walker', x, y: gy, w: 0.9, h: 1.6, hp: 3 + lvl, fire: rand(1, 2.5), t: 0 });
    else if (r < 0.65) this.enemies.push({ type: 'drone', x, y: gy + rand(2.6, 4), baseY: gy + 3.2, w: 1.1, h: 0.6, hp: 2 + lvl, t: rand(0, 6) });
    else if (r < 0.82) this.enemies.push({ type: 'mine', x, y: gy, w: 0.7, h: 0.4, hp: 1, t: 0 });
    else this.enemies.push({ type: 'crate', x, y: gy, w: 1, h: 1, hp: 2, t: 0 });
    this.nextSpawn = this.p.x + rand(7, 14) / Math.min(1.6, 0.8 + lvl * 0.2);
  }

  spawnBoss() {
    const arena = this.p.x + 12;
    const x = arena + this.viewW * 0.55;
    const hp = 50 + this.level * 25;
    this.boss = { type: 'tank', x, homeX: x, y: this.ground(x), w: 4.2, h: 2.6, hp, maxHp: hp, t: 0, shell: 2.5, burst: 4, arena };
    this.banner = { text: `⚠ CARRO ARMATO ${this.level}! Spingi sui pedali per sparare più forte`, t: 3.5 };
    this.enemies = this.enemies.filter((e) => e.x < arena);
  }

  updateEnemy(e, dt) {
    e.t += dt;
    const p = this.p;
    if (e.type === 'walker') {
      e.x -= 1.1 * dt; e.y = this.ground(e.x);
      e.fire -= dt;
      if (e.fire <= 0 && this.onScreen(e.x) && e.x > p.x + 2) {
        e.fire = rand(1.8, 3.2);
        this.ebullets.push({ x: e.x - 0.5, y: e.y + 1.1, vx: -7, vy: 0, life: 3 });
      }
    } else if (e.type === 'drone') {
      e.x -= 2.6 * dt;
      e.y = Math.max(this.ground(e.x) + 1.2, e.baseY + Math.sin(e.t * 2.5) * 1.2 - (Math.abs(e.x - p.x) < 3 ? 1.2 : 0));
    }
  }

  updateBoss(b, dt) {
    b.t += dt;
    b.x = b.homeX + Math.sin(b.t * 0.6) * 1.5;
    b.y = this.ground(b.x);
    b.shell -= dt; b.burst -= dt;
    const p = this.p;
    if (b.shell <= 0) {
      b.shell = rand(2, 3.2) / (1 + this.level * 0.15);
      const dx = p.x - (b.x - 1.6); const tt = 1.3;
      this.ebullets.push({ x: b.x - 1.6, y: b.y + 2.2, vx: dx / tt, vy: (G * 0.6 * tt) / 2, life: 4, grav: true, dmg: 1 });
    }
    if (b.burst <= 0) {
      b.burst = 4.5;
      for (let i = 0; i < 3; i++) setTimeout(() => this.boss && this.ebullets.push({ x: b.x - 2.1, y: b.y + 0.9, vx: -9, vy: 0, life: 3 }), i * 180);
    }
  }

  damage(e, n) {
    e.hp -= n;
    e.flash = 0.08;
    if (e.hp > 0) return;
    if (e === this.boss) {
      this.score += 1000 * this.level;
      for (let i = 0; i < 8; i++) setTimeout(() => this.explode(e.x + rand(-2, 2), e.y + rand(0, 2.5), 1.4), i * 120);
      this.shake = 1; this.banner = { text: `CARRO DISTRUTTO! +${1000 * this.level}`, t: 2.5 };
      this.items.push({ kind: 'heart', x: e.x - 3, y: this.ground(e.x - 3) });
      this.boss = null; this.level++; this.nextBoss = this.p.x + BOSS_EVERY; this.nextSpawn = this.p.x + 15;
      return;
    }
    this.score += { walker: 100, drone: 120, mine: 30, crate: 20 }[e.type] || 50;
    this.explode(e.x, e.y + e.h / 2, e.type === 'crate' ? 0.6 : 0.9);
    if (e.type === 'crate' || Math.random() < 0.12) {
      const kind = ['spread', 'bomb', 'heart'][Math.floor(rand(0, 3))];
      this.items.push({ kind, x: e.x, y: this.ground(e.x) });
    }
  }

  hit(n) {
    const p = this.p;
    if (p.hurt > 0) return;
    p.hp -= n; p.hurt = 1.5; this.shake = 0.3;
    if (navigator.vibrate) navigator.vibrate(80);
    if (p.hp <= 0) {
      this.over = true; this.overT = 0;
      if (this.score > this.best) { this.best = this.score; localStorage.setItem('strikeBest', this.best); }
    }
  }

  take(it) {
    it.taken = true;
    const p = this.p;
    if (it.kind === 'spread') { p.spread = 15; this.banner = { text: 'Colpo triplo!', t: 1.2 }; }
    if (it.kind === 'bomb') { p.bombs++; this.banner = { text: '+1 bomba', t: 1.2 }; }
    if (it.kind === 'heart') { p.hp = Math.min(5, p.hp + 1); this.banner = { text: '+1 vita', t: 1.2 }; }
  }

  explode(x, y, size) {
    this.fx.push({ type: 'boom', x, y, t: 0, life: 0.45, size });
    for (let i = 0; i < 6; i++) this.fx.push({ type: 'debris', x, y, vx: rand(-4, 4), vy: rand(2, 7), t: 0, life: 0.7 });
    this.shake = Math.max(this.shake, 0.15 * size);
  }

  // ---------- disegno ----------
  sx(x) { return (x - this.camX) * this.ppm; }
  sy(y) { return this.H * 0.78 - (y - this.camY) * this.ppm; }

  draw() {
    const { ctx, W, H } = this;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-6, 6) * this.shake, rand(-6, 6) * this.shake);

    // cielo e sfondo a parallasse
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2b1d4e'); sky.addColorStop(0.6, '#c4553a'); sky.addColorStop(1, '#e8a25a');
    ctx.fillStyle = sky; ctx.fillRect(-10, -10, W + 20, H + 20);
    this.layer(0.15, H * 0.55, 60, '#4a2f5e', 0.9);
    this.layer(0.35, H * 0.62, 40, '#3a2546', 1.6);
    this.ruins();

    // terreno
    ctx.fillStyle = '#5b3d2b';
    ctx.beginPath();
    const step = 0.5;
    ctx.moveTo(-10, H + 10);
    for (let x = this.camX - 1; x <= this.camX + this.viewW + 1; x += step) ctx.lineTo(this.sx(x), this.sy(this.ground(x)));
    ctx.lineTo(W + 10, H + 10); ctx.fill();
    ctx.strokeStyle = '#8bc34a'; ctx.lineWidth = 5; ctx.beginPath();
    for (let x = this.camX - 1; x <= this.camX + this.viewW + 1; x += step) {
      const px = this.sx(x); const py = this.sy(this.ground(x));
      if (x === this.camX - 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    for (const it of this.items) this.drawItem(it);
    for (const e of this.enemies) this.drawEnemy(e);
    if (this.boss) this.drawTank(this.boss);
    this.drawPlayer();

    ctx.fillStyle = '#fff59d';
    for (const b of this.bullets) ctx.fillRect(this.sx(b.x) - 6, this.sy(b.y) - 2, 12, 4);
    for (const b of this.ebullets) {
      ctx.fillStyle = b.grav ? '#212121' : '#ff5252';
      ctx.beginPath(); ctx.arc(this.sx(b.x), this.sy(b.y), b.grav ? 7 : 4, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of this.fx) this.drawFx(f);
    ctx.restore();

    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,230,${this.flash * 2})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud();
  }

  layer(speed, base, amp, color, freq) {
    const { ctx, W, H } = this;
    const off = this.camX * this.ppm * speed;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const wx = (x + off) / 100 * freq;
      ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(wx) * Math.cos(wx * 0.37)));
    }
    ctx.lineTo(W, H); ctx.fill();
  }

  ruins() {
    // edifici diroccati in silhouette (secondo piano)
    const { ctx, H } = this;
    const off = this.camX * this.ppm * 0.6;
    ctx.fillStyle = '#2a1b33';
    const start = Math.floor(off / 140) - 1;
    for (let i = start; i < start + Math.ceil(this.W / 140) + 3; i++) {
      const seed = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      const x = i * 140 - off; const h = 60 + seed * 110; const w = 50 + seed * 50;
      const top = H * 0.7 - h;
      ctx.fillRect(x, top, w, h + 40);
      ctx.fillStyle = '#ffb74d';
      for (let wy = top + 12; wy < H * 0.7 - 10; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) if ((wx * wy) % 7 < 1.2) ctx.fillRect(wx, wy, 6, 8);
      ctx.fillStyle = '#2a1b33';
    }
  }

  drawPlayer() {
    const { ctx } = this;
    const p = this.p; const m = this.ppm;
    if (p.hurt > 0 && Math.floor(p.hurt * 12) % 2) return;
    const x = this.sx(p.x); const y = this.sy(p.y);
    const wheel = 0.38 * m;
    // bici da combattimento
    ctx.lineWidth = Math.max(2, m * 0.07); ctx.strokeStyle = '#222';
    for (const wx of [-0.45, 0.5]) {
      ctx.beginPath(); ctx.arc(x + wx * m, y - wheel, wheel, 0, Math.PI * 2); ctx.stroke();
      const a = p.anim * 3;
      ctx.beginPath(); ctx.moveTo(x + wx * m + Math.cos(a) * wheel, y - wheel + Math.sin(a) * wheel); ctx.lineTo(x + wx * m - Math.cos(a) * wheel, y - wheel - Math.sin(a) * wheel); ctx.stroke();
    }
    ctx.strokeStyle = '#fc6719'; ctx.lineWidth = Math.max(3, m * 0.1);
    ctx.beginPath(); ctx.moveTo(x - 0.45 * m, y - wheel); ctx.lineTo(x, y - 0.85 * m); ctx.lineTo(x + 0.5 * m, y - wheel); ctx.lineTo(x + 0.35 * m, y - 1.0 * m); ctx.stroke();
    // ciclista
    const leg = Math.sin(p.anim * 3) * 0.15 * m;
    ctx.strokeStyle = '#37474f'; ctx.lineWidth = Math.max(3, m * 0.12);
    ctx.beginPath(); ctx.moveTo(x - 0.05 * m, y - 1.15 * m); ctx.lineTo(x + 0.05 * m + leg, y - 0.55 * m); ctx.stroke();
    ctx.fillStyle = '#546e7a'; ctx.beginPath(); ctx.ellipse(x - 0.05 * m, y - 1.35 * m, 0.25 * m, 0.32 * m, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(x + 0.12 * m, y - 1.78 * m, 0.2 * m, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4de3ff'; ctx.fillRect(x + 0.18 * m, y - 1.83 * m, 0.14 * m, 0.08 * m);
    // blaster
    ctx.fillStyle = p.spread > 0 ? '#4de3ff' : '#90a4ae';
    ctx.fillRect(x + 0.1 * m, y - 1.32 * m, 0.8 * m, 0.16 * m);
  }

  drawEnemy(e) {
    const { ctx } = this; const m = this.ppm;
    const x = this.sx(e.x); const y = this.sy(e.y);
    const flash = e.flash > 0; if (e.flash) e.flash -= 1 / 60;
    if (e.type === 'walker') {
      const step = Math.sin(e.t * 6) * 0.12 * m;
      ctx.fillStyle = flash ? '#fff' : '#7e57c2';
      ctx.fillRect(x - 0.35 * m, y - 1.5 * m, 0.7 * m, 0.8 * m);
      ctx.fillStyle = flash ? '#fff' : '#5e35b1';
      ctx.fillRect(x - 0.3 * m + step, y - 0.7 * m, 0.18 * m, 0.7 * m); ctx.fillRect(x + 0.12 * m - step, y - 0.7 * m, 0.18 * m, 0.7 * m);
      ctx.fillStyle = '#ff1744'; ctx.fillRect(x - 0.3 * m, y - 1.35 * m, 0.25 * m, 0.12 * m);
      ctx.fillStyle = '#424242'; ctx.fillRect(x - 0.75 * m, y - 1.15 * m, 0.45 * m, 0.12 * m);
    } else if (e.type === 'drone') {
      ctx.fillStyle = flash ? '#fff' : '#26a69a';
      ctx.beginPath(); ctx.ellipse(x, y - 0.3 * m, 0.55 * m, 0.22 * m, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b2dfdb'; ctx.lineWidth = 2;
      const r = Math.abs(Math.sin(e.t * 30)) * 0.5 * m;
      ctx.beginPath(); ctx.moveTo(x - r, y - 0.62 * m); ctx.lineTo(x + r, y - 0.62 * m); ctx.stroke();
      ctx.fillStyle = '#ff1744'; ctx.beginPath(); ctx.arc(x - 0.25 * m, y - 0.3 * m, 0.08 * m, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'mine') {
      ctx.fillStyle = flash ? '#fff' : '#424242';
      ctx.beginPath(); ctx.ellipse(x, y - 0.12 * m, 0.35 * m, 0.16 * m, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = Math.sin(e.t * 8) > 0 ? '#ff1744' : '#7f0000';
      ctx.beginPath(); ctx.arc(x, y - 0.28 * m, 0.07 * m, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'crate') {
      ctx.fillStyle = flash ? '#fff' : '#a1887f'; ctx.fillRect(x - 0.5 * m, y - m, m, m);
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3; ctx.strokeRect(x - 0.5 * m, y - m, m, m);
      ctx.beginPath(); ctx.moveTo(x - 0.5 * m, y - m); ctx.lineTo(x + 0.5 * m, y); ctx.stroke();
    }
  }

  drawTank(b) {
    const { ctx } = this; const m = this.ppm;
    const x = this.sx(b.x); const y = this.sy(b.y);
    const flash = b.flash > 0; if (b.flash) b.flash -= 1 / 60;
    ctx.fillStyle = '#263238';
    ctx.beginPath(); ctx.roundRect(x - 2.1 * m, y - 0.8 * m, 4.2 * m, 0.8 * m, 0.4 * m); ctx.fill();
    ctx.fillStyle = '#455a64';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x - 1.7 * m + i * 0.68 * m, y - 0.4 * m, 0.25 * m, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = flash ? '#fff' : '#6d4c41';
    ctx.fillRect(x - 1.9 * m, y - 1.6 * m, 3.8 * m, 0.85 * m);
    ctx.beginPath(); ctx.roundRect(x - 0.9 * m, y - 2.4 * m, 1.9 * m, 0.85 * m, 0.3 * m); ctx.fill();
    ctx.fillStyle = '#3e2723'; ctx.fillRect(x - 2.6 * m, y - 2.15 * m, 1.8 * m, 0.25 * m);
    ctx.fillStyle = '#ff1744'; ctx.fillRect(x - 0.6 * m, y - 2.15 * m, 0.4 * m, 0.15 * m);
  }

  drawItem(it) {
    const { ctx } = this; const m = this.ppm;
    const x = this.sx(it.x); const y = this.sy(it.y) - 0.5 * m - Math.abs(Math.sin(performance.now() / 300)) * 0.2 * m;
    const col = { spread: '#4de3ff', bomb: '#ffca28', heart: '#ff5a7a' }[it.kind];
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 0.32 * m, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.font = `bold ${Math.round(0.35 * m)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText({ spread: 'S', bomb: 'B', heart: '♥' }[it.kind], x, y + 1);
  }

  drawFx(f) {
    const { ctx } = this; const m = this.ppm;
    const x = this.sx(f.x); const y = this.sy(f.y); const k = f.t / f.life;
    if (f.type === 'boom') {
      ctx.fillStyle = `rgba(255,${Math.round(200 - 150 * k)},40,${1 - k})`;
      ctx.beginPath(); ctx.arc(x, y, (0.4 + k * 1.2) * f.size * m, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,200,${1 - k})`;
      ctx.beginPath(); ctx.arc(x, y, (0.2 + k * 0.5) * f.size * m, 0, Math.PI * 2); ctx.fill();
    } else if (f.type === 'debris') {
      ctx.fillStyle = `rgba(80,60,50,${1 - k})`; ctx.fillRect(x - 3, y - 3, 6, 6);
    } else if (f.type === 'spark' || f.type === 'muzzle') {
      ctx.fillStyle = '#fff59d'; ctx.beginPath(); ctx.arc(x, y, (f.type === 'muzzle' ? 0.18 : 0.12) * m, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawHud() {
    const { ctx, W, H } = this;
    const pad = 12; const top = 56;
    ctx.fillStyle = 'rgba(10,12,18,.6)'; ctx.beginPath(); ctx.roundRect(pad, top, W - pad * 2, 54, 10); ctx.fill();
    const cols = [['Punti', this.score], ['W', Math.round(this.power)], ['Colpi/s', this.fireRate?.toFixed(1) ?? '-'], ['km/h', Math.round(this.kmh || 0)], ['Pend.', `${(this.grade || 0).toFixed(1)}%`]];
    const cw = (W - pad * 2) / cols.length;
    ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    cols.forEach(([k, v], i) => {
      ctx.fillStyle = '#9aa3b5'; ctx.font = '11px system-ui'; ctx.fillText(k, pad + cw * i + cw / 2, top + 8);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui'; ctx.fillText(String(v), pad + cw * i + cw / 2, top + 24);
    });
    ctx.textAlign = 'left'; ctx.font = '18px system-ui'; ctx.fillStyle = '#fff';
    ctx.fillText(`${'❤️'.repeat(Math.max(0, this.p.hp))}  💣${this.p.bombs}${this.p.spread > 0 ? `  🔷${Math.ceil(this.p.spread)}s` : ''}`, pad + 4, top + 64);
    if (!this.hooks.connected()) {
      ctx.textAlign = 'center'; ctx.font = '13px system-ui'; ctx.fillStyle = '#ffd34d';
      ctx.fillText('Demo: rullo non connesso (25 km/h, 150 W)', W / 2, top + 90);
    }
    if (this.boss) {
      const bw = W - pad * 2; const k = Math.max(0, this.boss.hp / this.boss.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(pad, H - 34, bw, 16);
      ctx.fillStyle = '#ff5252'; ctx.fillRect(pad, H - 34, bw * k, 16);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`CARRO ARMATO ${this.level}`, W / 2, H - 26);
    } else {
      const left = Math.max(0, Math.round(this.nextBoss - this.p.x));
      ctx.textAlign = 'right'; ctx.font = '13px system-ui'; ctx.fillStyle = '#ffd6a0'; ctx.textBaseline = 'top';
      ctx.fillText(`Boss tra ${left} m`, W - pad - 4, top + 66);
    }
    if (this.banner) {
      ctx.globalAlpha = Math.min(1, this.banner.t * 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px system-ui'; ctx.fillStyle = '#ffd34d';
      this.wrap(this.banner.text, W / 2, H * 0.36, W - 40, 26);
      ctx.globalAlpha = 1;
    }
    if (this.over) {
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px system-ui'; ctx.fillText('Missione fallita', W / 2, H * 0.36);
      ctx.font = '20px system-ui';
      ctx.fillText(`Punti: ${this.score}   Record: ${this.best}`, W / 2, H * 0.36 + 48);
      ctx.fillText(`Carri distrutti: ${this.level - 1}`, W / 2, H * 0.36 + 78);
      if (this.overT > 1) { ctx.fillStyle = '#ffd34d'; ctx.fillText('Premi + o − per riprovare', W / 2, H * 0.36 + 126); }
    }
  }

  wrap(text, x, y, maxW, lh) {
    const words = text.split(' '); const lines = []; let line = '';
    for (const w of words) { const t = line ? `${line} ${w}` : w; if (this.ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
    lines.forEach((l, i) => this.ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
  }

  loop(now) {
    if (!this.active) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }
}
