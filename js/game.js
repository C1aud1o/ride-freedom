// "Turbo Pedali": corsa arcade originale.
// - Velocità = velocità reale in bici (dal rullo); senza rullo c'è la modalità demo.
// - Tasti +/− del Click (o frecce / tocco sui lati dello schermo) = cambio corsia.
// - Il percorso ha salite e discese: la pendenza viene inviata al rullo.

const LANES = [-2, 0, 2]; // metri
const ROAD_HALF = 3.2;
const DRAW_DIST = 160;
const MAX_GRADE = 6;
const PLAYER_Z = 6;
const WORLD_SCALE = 1.5; // il mondo scorre un po' più veloce della realtà: più ritmo
const SPAWN_AHEAD = 110; // metri tra telecamera e ciclista // limite del Van Rysel D100

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

export class Game {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks; // { speedKmh(), stats(), setGrade(g), connected() }
    this.active = false;
    this.best = Number(localStorage.getItem('turboBest')) || 0;
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
    this.dist = 0; // metri percorsi
    this.lane = 1; this.laneX = 0;
    this.score = 0; this.coins = 0; this.lives = 3;
    this.turbo = 0; this.hurt = 0; this.over = false;
    this.objects = [];
    this.nextSpawn = 10;
    this.track = [];
    this.trackEnd = 0;
    this.grade = 0; this.sentGrade = null;
    this.popups = [];
    this.demoSpeed = 25;
    while (this.trackEnd < 3000) this.addSection();
  }

  addSection() {
    const len = rand(250, 600);
    const r = Math.random();
    const grade = r < 0.35 ? 0 : r < 0.75 ? Math.round(rand(2, MAX_GRADE)) : -Math.round(rand(1, 3));
    const curve = Math.random() < 0.4 ? 0 : rand(-1, 1);
    this.track.push({ start: this.trackEnd, end: this.trackEnd + len, grade, curve });
    this.trackEnd += len;
  }

  sectionAt(d) {
    return this.track.find((s) => d >= s.start && d < s.end) || this.track[this.track.length - 1];
  }

  // pendenza con transizione morbida di 80 m tra un tratto e l'altro
  gradeAt(d) {
    const s = this.sectionAt(d);
    const i = this.track.indexOf(s);
    const prev = this.track[i - 1];
    if (prev && d - s.start < 80) return lerp(prev.grade, s.grade, (d - s.start) / 80);
    return s.grade;
  }

  curveAt(d) {
    const s = this.sectionAt(d);
    const i = this.track.indexOf(s);
    const prev = this.track[i - 1];
    if (prev && d - s.start < 60) return lerp(prev.curve, s.curve, (d - s.start) / 60);
    return s.curve;
  }

  input(dir) {
    if (this.over) { if (dir) this.reset(); return; }
    this.lane = Math.max(0, Math.min(2, this.lane + dir));
    if (navigator.vibrate) navigator.vibrate(10);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = r.width * dpr; this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  spawn() {
    const d = this.dist + SPAWN_AHEAD;
    const r = Math.random();
    if (r < 0.35) {
      // fila di monete
      const lane = Math.floor(rand(0, 3));
      for (let i = 0; i < 5; i++) this.objects.push({ type: 'coin', lane, d: d + i * 4 });
    } else if (r < 0.65) {
      // ostacoli: lasciano sempre una corsia libera
      const free = Math.floor(rand(0, 3));
      const n = Math.random() < 0.5 ? 1 : 2;
      const lanes = [0, 1, 2].filter((l) => l !== free).sort(() => Math.random() - 0.5).slice(0, n);
      for (const lane of lanes) this.objects.push({ type: Math.random() < 0.5 ? 'cone' : 'barrier', lane, d });
    } else if (r < 0.92) {
      // i rivali vanno un po' più piano di te: li puoi sempre sorpassare
      this.objects.push({ type: 'rival', lane: Math.floor(rand(0, 3)), d, speed: (Math.max(this.speed || 0, 10) / 3.6) * rand(0.45, 0.75), hue: Math.floor(rand(0, 360)), passed: false });
    } else {
      this.objects.push({ type: 'turbo', lane: Math.floor(rand(0, 3)), d });
    }
    this.nextSpawn = this.dist + rand(16, 34);
  }

  update(dt) {
    const connected = this.hooks.connected();
    const kmh = connected ? this.hooks.speedKmh() : this.demoSpeed;
    const v = kmh / 3.6;
    this.speed = kmh;
    this.laneX = lerp(this.laneX, LANES[this.lane], Math.min(1, dt * 10));
    this.hurt = Math.max(0, this.hurt - dt);
    this.turbo = Math.max(0, this.turbo - dt);
    for (const p of this.popups) p.t -= dt;
    this.popups = this.popups.filter((p) => p.t > 0);
    if (this.over) return;

    this.dist += v * WORLD_SCALE * dt;
    this.grade = this.gradeAt(this.dist);
    const mult = (this.turbo > 0 ? 2 : 1) * (1 + Math.max(0, this.grade) / 5);
    this.score += v * dt * mult;

    // invia la pendenza al rullo solo quando cambia di almeno 0.5%
    const g = Math.round(this.grade * 2) / 2;
    if (g !== this.sentGrade) { this.sentGrade = g; this.hooks.setGrade(g); }

    while (this.trackEnd < this.dist + 3000) this.addSection();
    if (this.dist >= this.nextSpawn) this.spawn();

    for (const o of this.objects) {
      if (o.type === 'rival') o.d += o.speed * WORLD_SCALE * dt;
      const z = o.d - this.dist;
      const sameLane = Math.abs(LANES[o.lane] - this.laneX) < 1.1;
      const zp = this.zPlayer || 1.2;
      if (!o.hit && Math.abs(z - zp) < 0.9 && sameLane) {
        o.hit = true;
        this.collide(o);
      }
      if (o.type === 'rival' && !o.passed && z < zp - 1 && !o.hit) {
        o.passed = true;
        this.score += 50;
        this.popup('+50 sorpasso!', '#ffd34d');
      }
    }
    this.objects = this.objects.filter((o) => o.d - this.dist > 0 && !(o.hit && o.type !== 'rival'));
  }

  collide(o) {
    if (o.type === 'coin') { this.coins++; this.score += 10 * (this.turbo > 0 ? 2 : 1); return; }
    if (o.type === 'turbo') { this.turbo = 10; this.popup('TURBO ×2!', '#4de3ff'); return; }
    if (this.hurt > 0 || this.turbo > 0) { o.hit = false; o.passed = true; return; } // invulnerabile
    this.lives--;
    this.hurt = 2;
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    this.popup('Ahi!', '#ff5a5a');
    if (this.lives <= 0) {
      this.over = true;
      if (this.score > this.best) { this.best = Math.round(this.score); localStorage.setItem('turboBest', this.best); }
    }
  }

  popup(text, color) { this.popups.push({ text, color, t: 1.2 }); }

  // ---------- disegno ----------
  // Telecamera dietro al ciclista: il ciclista sta a PLAYER_Z metri, in basso sullo schermo.
  project(x, z) {
    const { W, H } = this;
    const horizon = H * 0.38 - this.grade * H * 0.012;
    const f = Math.min(W * 0.95, H * 1.1);
    const camH = ((H * 0.9 - horizon) * PLAYER_Z) / f;
    const s = f / z;
    // la curva sposta la strada lateralmente in modo parabolico con la distanza
    const bend = this.curveAt(this.dist) * z * z * 0.0025;
    return { x: W / 2 + (x - this.laneX * 0.7 + bend) * s, y: horizon + camH * s, s, horizon };
  }

  draw() {
    const { ctx, W, H } = this;
    const horizon = this.project(0, 10).horizon;
    this.zPlayer = this.playerZ();

    // cielo e montagne
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#1b2a6b'); sky.addColorStop(1, '#f08a5d');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon + 1);
    ctx.fillStyle = '#ffd38a';
    ctx.beginPath(); ctx.arc(W * 0.75, horizon - H * 0.08, H * 0.05, 0, Math.PI * 2); ctx.fill();
    const shift = (this.dist * 0.02 + this.curveAt(this.dist) * 50) % W;
    ctx.fillStyle = '#3d2f63';
    ctx.beginPath(); ctx.moveTo(-W, horizon);
    for (let x = -W; x <= W * 2; x += W / 8) ctx.lineTo(x - shift, horizon - H * (0.05 + 0.05 * Math.abs(Math.sin(x * 0.013))));
    ctx.lineTo(W * 2, horizon); ctx.fill();

    // prato
    ctx.fillStyle = '#2f7d3b'; ctx.fillRect(0, horizon, W, H - horizon);

    // strada a strisce, dal fondo verso di noi (in più passate per evitare righe tra le strisce)
    const seg = 6;
    const offset = this.dist % (seg * 2);
    const N = 240;
    const pts = [];
    for (let i = N; i >= 0; i--) {
      const z = 2 + DRAW_DIST * (i / N) ** 2;
      pts.push({ p: this.project(0, z), band: Math.floor((z + offset) / seg) % 2 === 0 });
    }
    const edge = (half, color) => {
      ctx.fillStyle = color; ctx.beginPath();
      pts.forEach(({ p }, i) => (i ? ctx.lineTo(p.x - half * p.s, p.y) : ctx.moveTo(p.x - half * p.s, p.y)));
      const last = pts[pts.length - 1].p; ctx.lineTo(last.x - half * last.s, H + 50); ctx.lineTo(last.x + half * last.s, H + 50);
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].p.x + half * pts[i].p.s, pts[i].p.y);
      ctx.fill();
    };
    edge(ROAD_HALF + 0.6, '#d9d9d9');
    for (let i = 1; i < pts.length; i++) if (!pts[i].band) this.quad(pts[i - 1].p, pts[i].p, ROAD_HALF + 0.6, '#c0392b');
    edge(ROAD_HALF, '#585d69');
    for (let i = 1; i < pts.length; i++) {
      if (!pts[i].band) continue;
      for (const lx of [-1, 1]) this.quad(pts[i - 1].p, pts[i].p, 0.08, '#f4f4f4', lx);
    }

    // oggetti, dal più lontano
    const zp = this.zPlayer;
    const objs = this.objects.map((o) => ({ o, z: o.d - this.dist })).filter((e) => e.z > 0.4 && e.z < DRAW_DIST).sort((a, b) => b.z - a.z);
    for (const { o, z } of objs) if (z >= zp) this.drawObject(o, z);
    this.drawPlayer();
    for (const { o, z } of objs) if (z < zp) this.drawObject(o, z);
    this.drawHud();
  }

  quad(a, b, half, color, centerOffset = 0) {
    const { ctx } = this;
    const c = centerOffset;
    ctx.fillStyle = color;
    ctx.beginPath();
    // +1 px sul bordo vicino per evitare le righe tra una striscia e l'altra
    ctx.moveTo(a.x + (c - half) * a.s, a.y); ctx.lineTo(a.x + (c + half) * a.s, a.y);
    ctx.lineTo(b.x + (c + half) * b.s, b.y + 1); ctx.lineTo(b.x + (c - half) * b.s, b.y + 1);
    ctx.fill();
  }

  drawObject(o, z) {
    const { ctx } = this;
    const p = this.project(LANES[o.lane], z);
    const s = p.s;
    if (o.type === 'coin') {
      const r = 0.35 * s; const wob = Math.abs(Math.cos(performance.now() / 200 + o.d));
      ctx.fillStyle = '#ffcc33'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.6 * s, r * wob + 1, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (o.type === 'cone') {
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath(); ctx.moveTo(p.x - 0.45 * s, p.y); ctx.lineTo(p.x + 0.45 * s, p.y); ctx.lineTo(p.x, p.y - 1.1 * s); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 0.25 * s, p.y - 0.55 * s, 0.5 * s, 0.15 * s);
    } else if (o.type === 'barrier') {
      ctx.fillStyle = '#f5f5f5'; ctx.fillRect(p.x - 0.9 * s, p.y - 0.9 * s, 1.8 * s, 0.5 * s);
      ctx.fillStyle = '#e53935';
      for (let i = 0; i < 3; i++) ctx.fillRect(p.x - 0.9 * s + i * 0.6 * s, p.y - 0.9 * s, 0.3 * s, 0.5 * s);
      ctx.fillStyle = '#777'; ctx.fillRect(p.x - 0.8 * s, p.y - 0.4 * s, 0.1 * s, 0.4 * s); ctx.fillRect(p.x + 0.7 * s, p.y - 0.4 * s, 0.1 * s, 0.4 * s);
    } else if (o.type === 'turbo') {
      ctx.fillStyle = '#4de3ff';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2; const r = (i % 2 ? 0.2 : 0.5) * s;
        ctx.lineTo(p.x + Math.cos(a) * r, p.y - 0.8 * s + Math.sin(a) * r);
      }
      ctx.fill();
    } else if (o.type === 'rival') {
      this.drawRider(p.x, p.y, s, `hsl(${o.hue} 80% 55%)`, o.d);
    }
  }

  drawRider(x, y, s, color, phase) {
    const { ctx } = this;
    const pedal = Math.sin(phase * 1.5) * 0.12 * s;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, y, 0.5 * s, 0.12 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(x - 0.06 * s, y - 0.7 * s, 0.12 * s, 0.7 * s); // ruota
    ctx.fillStyle = '#333'; ctx.fillRect(x - 0.22 * s, y - 0.75 * s + pedal, 0.12 * s, 0.4 * s); // gambe
    ctx.fillRect(x + 0.1 * s, y - 0.75 * s - pedal, 0.12 * s, 0.4 * s);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y - 1.0 * s, 0.32 * s, 0.38 * s, 0, 0, Math.PI * 2); ctx.fill(); // busto
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath(); ctx.arc(x, y - 1.45 * s, 0.18 * s, 0, Math.PI * 2); ctx.fill(); // casco
  }

  // distanza (m) dalla camera a cui sta il ciclista: in basso sullo schermo
  playerZ() { return PLAYER_Z; }

  drawPlayer() {
    const p = this.project(this.laneX, this.zPlayer);
    const { x, y, s } = p;
    if (this.hurt > 0 && Math.floor(this.hurt * 10) % 2) return; // lampeggia
    if (this.turbo > 0) {
      this.ctx.fillStyle = 'rgba(77,227,255,.35)';
      this.ctx.beginPath(); this.ctx.ellipse(x, y - 1.0 * s, 0.8 * s, 1.1 * s, 0, 0, Math.PI * 2); this.ctx.fill();
    }
    this.drawRider(x, y, s, '#fc6719', this.dist);
  }

  drawHud() {
    const { ctx, W, H } = this;
    const st = this.hooks.stats();
    ctx.textBaseline = 'top';
    const box = (x, y, w, h) => { ctx.fillStyle = 'rgba(10,12,18,.6)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); };
    const pad = 12; const top = 56;
    box(pad, top, W - pad * 2, 54);
    const cols = [
      ['Punti', Math.round(this.score)], ['km/h', this.speed.toFixed(0)], ['W', st.power ?? '--'],
      ['Pend.', `${this.grade.toFixed(1)}%`], ['Marcia', st.gear ?? '--'],
    ];
    const cw = (W - pad * 2) / cols.length;
    cols.forEach(([k, v], i) => {
      ctx.fillStyle = '#9aa3b5'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(k, pad + cw * i + cw / 2, top + 8);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui';
      ctx.fillText(String(v), pad + cw * i + cw / 2, top + 24);
    });
    ctx.textAlign = 'left'; ctx.font = '18px system-ui'; ctx.fillStyle = '#fff';
    ctx.fillText(`${'❤️'.repeat(Math.max(0, this.lives))}   🪙 ${this.coins}${this.turbo > 0 ? `   ⚡ ${Math.ceil(this.turbo)}s` : ''}`, pad + 4, top + 64);
    if (!this.hooks.connected()) {
      ctx.textAlign = 'center'; ctx.font = '13px system-ui'; ctx.fillStyle = '#ffd34d';
      ctx.fillText('Demo: rullo non connesso (velocità fissa 25 km/h)', W / 2, top + 90);
    }
    // salita in arrivo
    const ahead = this.gradeAt(this.dist + 150);
    if (ahead >= 3 && ahead > this.grade + 1) {
      ctx.textAlign = 'center'; ctx.font = 'bold 16px system-ui'; ctx.fillStyle = '#ffb347';
      ctx.fillText(`⛰ Salita al ${Math.round(ahead)}% in arrivo`, W / 2, top + 110);
    }
    this.popups.forEach((p, i) => {
      ctx.globalAlpha = Math.min(1, p.t * 2);
      ctx.textAlign = 'center'; ctx.font = 'bold 28px system-ui'; ctx.fillStyle = p.color;
      ctx.fillText(p.text, W / 2, H * 0.45 - (1.2 - p.t) * 60 - i * 34);
      ctx.globalAlpha = 1;
    });
    if (this.over) {
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px system-ui'; ctx.fillText('Fine corsa!', W / 2, H * 0.33);
      ctx.font = '20px system-ui';
      ctx.fillText(`Punti: ${Math.round(this.score)}   Record: ${this.best}`, W / 2, H * 0.33 + 50);
      ctx.fillText(`${(this.dist / 1000).toFixed(2)} km · ${this.coins} monete`, W / 2, H * 0.33 + 80);
      ctx.fillStyle = '#ffd34d';
      ctx.fillText('Premi + o − per ripartire', W / 2, H * 0.33 + 130);
    }
  }

  loop(now) {
    if (!this.active) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }
}
