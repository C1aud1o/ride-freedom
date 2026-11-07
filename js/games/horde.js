// L'ORDA — sparatutto "a orde" su bici, in 3D (modelli Kenney CC0).
// Parti con una pistola contro pochi zombi; ondate sempre più grandi, armi che evolvono,
// portali che danno alleati e potenziamenti. + / − cambiano corsia, i watt decidono la cadenza,
// lo sprint scatena l'OVERDRIVE.
import { THREE, Stage, loadAll, character, rider, scatter, mat4, Pool, Effects, labelTexture, skyTexture, lights } from './kit3d.js';
import { hudText, Effort, clamp, lerp, pick, hash } from './engine.js';
import { SONGS } from './audio.js';

const A = 'assets/3d';
// strada larga: ti muovi liberamente (tieni premuto + / − per sterzare)
const ROAD = 7.2;           // metà larghezza percorribile
const ROAD_W = 17;          // larghezza asfalto
const NUDGE = 1.6;          // spostamento di un tocco singolo
const STEER = 9;            // m/s tenendo premuto
const CHUNK = 60;
const SPAWN_Z = 120;        // i nemici compaiono lontano e si vedono arrivare
const MAX_ALIVE = 140;
// i nemici diventano più robusti a ogni ondata: le armi migliori servono davvero
const waveHp = (w) => Math.pow(1.2, w - 1);
const FORMATION = [[-1.3, -1.6], [1.3, -1.6], [0, -2.8], [-2.6, -2.8], [2.6, -2.8], [-1.3, -4], [1.3, -4], [-2.6, -5.2], [2.6, -5.2], [0, -5.2], [-1.3, -6.4], [1.3, -6.4]];

const WEAPONS = [
  { name: 'PISTOLA', model: 'blaster-a', rate: 2.2, dmg: 1, shots: 1, spread: 0, speed: 38, color: '#fff3a0', xp: 20 },
  { name: 'REVOLVER', model: 'blaster-k', rate: 2.6, dmg: 1.6, shots: 1, spread: 0, speed: 40, color: '#ffd166', xp: 50 },
  { name: 'MITRAGLIETTA', model: 'blaster-j', rate: 6, dmg: 1, shots: 1, spread: 0.05, speed: 42, color: '#ffe08a', xp: 135 },
  { name: 'FUCILE A POMPA', model: 'blaster-c', rate: 1.6, dmg: 1.4, shots: 6, spread: 0.32, speed: 34, color: '#ff9f43', xp: 210 },
  { name: 'MITRAGLIATRICE', model: 'blaster-n', rate: 9, dmg: 1.4, shots: 1, spread: 0.06, speed: 46, color: '#ffd166', xp: 330 },
  { name: 'FUCILE D\'ASSALTO', model: 'blaster-g', rate: 7, dmg: 2.4, shots: 2, spread: 0.08, speed: 50, color: '#b8f2ff', xp: 480 },
  { name: 'LANCIARAZZI', model: 'blaster-h', rate: 1.6, dmg: 10, shots: 1, spread: 0, speed: 26, color: '#ff6b35', splash: 3.2, xp: 690 },
  { name: 'CANNONE AL PLASMA', model: 'blaster-b', rate: 3.2, dmg: 7, shots: 1, spread: 0, speed: 34, color: '#c77dff', splash: 2.2, pierce: true, xp: 960 },
  { name: 'MINIGUN', model: 'blaster-p', rate: 18, dmg: 2.2, shots: 1, spread: 0.1, speed: 52, color: '#7dff6a', xp: 1350 },
  { name: 'LASER', model: 'blaster-l', rate: 10, dmg: 5, shots: 1, spread: 0, speed: 80, color: '#4de3ff', pierce: true, xp: Infinity },
];

const ENEMIES = {
  zombie: { model: 'character-zombie', hp: 3, speed: 1.7, anim: 'walk', height: 2.0, xp: 1, score: 10 },
  skeleton: { model: 'character-skeleton', hp: 2, speed: 3.6, anim: 'sprint', height: 2.0, xp: 1, score: 15 },
  ghost: { model: 'character-ghost', hp: 4, speed: 2.6, anim: 'sprint', height: 2.0, xp: 2, score: 20, float: true },
  vampire: { model: 'character-vampire', hp: 14, speed: 2.0, anim: 'walk', height: 2.4, xp: 4, score: 50 },
  keeper: { model: 'character-keeper', hp: 260, speed: 1.1, anim: 'walk', height: 5.6, xp: 40, score: 1000, boss: true },
};

const GATES = [
  { text: '+1 ALLEATO', good: true, w: 5, apply: (g) => g.addAllies(1) },
  { text: '+2 ALLEATI', good: true, w: 3, apply: (g) => g.addAllies(2) },
  { text: '×2 ALLEATI', good: true, w: 1, apply: (g) => g.addAllies(Math.max(1, g.allies.length)) },
  { text: 'CADENZA +30%', good: true, w: 4, apply: (g) => { g.rateMul *= 1.3; } },
  { text: 'DANNO +40%', good: true, w: 4, apply: (g) => { g.dmgMul *= 1.4; } },
  { text: '+1 VITA', good: true, w: 2, apply: (g) => { g.hp = Math.min(g.maxHp, g.hp + 1); } },
  { text: 'ARMA ▲', good: true, w: 2, apply: (g) => g.evolve() },
  { text: '−1 ALLEATO', good: false, w: 3, apply: (g) => g.loseAlly() },
  { text: 'CADENZA −20%', good: false, w: 2, apply: (g) => { g.rateMul *= 0.8; } },
];

export class Horde {
  constructor(hudCanvas, hooks, audio) {
    this.hudCanvas = hudCanvas; this.hooks = hooks; this.audio = audio;
    this.active = false; this.best = Number(localStorage.getItem('hordeBest')) || 0;
    this.loop = this.loop.bind(this);
  }

  async start() {
    this.active = true;
    this.stage = new Stage(this.hudCanvas);
    this.effort = new Effort();
    this.state = 'loading'; this.t = 0; this.texts = []; this.power = 0; this.cadence = 0;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    this.audio.playSong(SONGS.menu);
    try {
      const files = {};
      for (const e of Object.values(ENEMIES)) files[e.model] = `${A}/graveyard/${e.model}.glb`;
      for (const w of WEAPONS) files[w.model] = `${A}/blasters/${w.model}.glb`;
      for (const c of 'abcdefghij') files[`char-${c}`] = `${A}/characters/character-${c}.glb`;
      for (const p of ['pine', 'pine-crooked', 'gravestone-cross', 'gravestone-round', 'gravestone-bevel', 'gravestone-broken', 'iron-fence', 'iron-fence-damaged', 'lightpost-double', 'pumpkin-carved', 'crypt-small', 'fire-basket', 'rocks', 'trunk', 'cross']) files[p] = `${A}/graveyard/${p}.glb`;
      this.m = await loadAll(files, (p) => { this.loadPct = p; });
      this.build();
      this.state = 'menu'; this.stateT = 0;
    } catch (err) { this.state = 'error'; this.error = err.message; }
  }

  stop() {
    this.active = false; this.audio.stopSong(); this.hooks.setGrade(null);
    this.stage?.dispose();
  }

  // ---------- scena ----------
  build() {
    const { scene } = this.stage;
    scene.background = skyTexture('#0b0a1f', '#2a1745', '#5b2a52');
    scene.fog = new THREE.Fog('#2a1840', 60, 175);
    this.sun = lights(scene, { sky: '#b9a6ff', ground: '#1a1426', sun: '#ffd9b0', hemi: 1.3, sunI: 1.6 });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff4d6', fog: false }));
    moon.position.set(-60, 55, 260); scene.add(moon); this.moon = moon;
    this.roadTex = roadTexture();
    this.chunks = new Map();
    // proiettili
    const bulletGeo = new THREE.SphereGeometry(0.13, 8, 6);
    this.bullets = []; this.bulletPool = new Pool(scene, () => new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: '#fff3a0' })), 260);
    this.fx = new Effects(scene, 160);
    this.gemGeo = new THREE.OctahedronGeometry(0.32); this.gemMat = new THREE.MeshBasicMaterial({ color: '#7dff6a' });
    // segnalino del giocatore: anello luminoso a terra + linea di mira verso dove stai andando
    const ringMat = new THREE.MeshBasicMaterial({ color: '#d9ff3d', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 40), ringMat); this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 2; scene.add(this.ring);
    this.aim = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.4), new THREE.MeshBasicMaterial({ color: '#d9ff3d', transparent: true, opacity: 0.5, depthWrite: false })); this.aim.rotation.x = -Math.PI / 2; scene.add(this.aim);
    // raggio del magnete per le gemme
    this.magnet = new THREE.Mesh(new THREE.RingGeometry(3.9, 4, 48), new THREE.MeshBasicMaterial({ color: '#7dff6a', transparent: true, opacity: 0.18, depthWrite: false })); this.magnet.rotation.x = -Math.PI / 2; scene.add(this.magnet);
    this.pops = [];
    this.reset();
  }

  reset() {
    const { scene } = this.stage;
    for (const e of this.enemies || []) scene.remove(e.c.root);
    for (const a of this.allies || []) scene.remove(a.r.root);
    for (const g of this.gates || []) scene.remove(g.group);
    for (const gm of this.gems || []) scene.remove(gm.mesh);
    if (this.player) scene.remove(this.player.root);
    for (const b of this.bullets) b.mesh.visible = false;
    this.bullets = [];
    this.z = 0; this.x = 0; this.tx = 0; this.held = 0; this.heldT = 0; this.hp = 5; this.maxHp = 6; this.pops = [];
    this.pressure = 1; this.calmT = 0; this.waveKills = 0;
    this.weapon = 0; this.xp = 0; this.rateMul = 1; this.dmgMul = 1;
    this.kills = 0; this.score = 0; this.wave = 1; this.waveT = 0; this.spawnAcc = 0;
    this.enemies = []; this.allies = []; this.gates = []; this.gems = [];
    this.nextGate = 60; this.overdrive = 0; this.odMeter = 0; this.hurtT = 0; this.shake = 0; this.bossAlive = false;
    this.player = rider(scene, this.m['char-a'], '#d9ff3d');
    this.player.setGun(this.m[WEAPONS[0].model]);
    this.fireT = 0;
    this.ensureChunks();
  }

  ensureChunks() {
    const first = Math.floor((this.z - 25) / CHUNK); const last = Math.floor((this.z + 190) / CHUNK);
    for (let k = first; k <= last; k++) if (!this.chunks.has(k)) this.chunks.set(k, this.makeChunk(k));
    for (const [k, objs] of this.chunks) if (k < first - 1) { objs.forEach((o) => { this.stage.scene.remove(o); if (o.isInstancedMesh) o.dispose(); }); this.chunks.delete(k); }
  }

  makeChunk(k) {
    const { scene } = this.stage; const z0 = k * CHUNK; const objs = [];
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CHUNK), new THREE.MeshLambertMaterial({ map: this.roadTex }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, z0 + CHUNK / 2); road.receiveShadow = true;
    scene.add(road); objs.push(road);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, CHUNK), new THREE.MeshLambertMaterial({ color: k % 2 ? '#2c3a2a' : '#2a3727' }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, z0 + CHUNK / 2); ground.receiveShadow = true;
    scene.add(ground); objs.push(ground);
    // scenografia
    const sets = {};
    const add = (name, x, z, rot, s) => { (sets[name] = sets[name] || []).push(mat4(x, 0, z, rot, s)); };
    for (let z = z0; z < z0 + CHUNK; z += 6) {
      for (const side of [-1, 1]) {
        add(hash(z * 3 + side) > 0.5 ? 'iron-fence' : 'iron-fence-damaged', side * (ROAD_W / 2 + 0.6), z + 3, Math.PI / 2, 2.6);
        const r = hash(z * 1.7 + side * 5);
        const x = side * (ROAD_W / 2 + 2.5 + hash(z + side) * 16);
        if (r < 0.35) add(pick(['gravestone-cross', 'gravestone-round', 'gravestone-bevel', 'gravestone-broken', 'cross']), x, z + hash(z) * 5, hash(z * 9) * 6, 2.6);
        else if (r < 0.65) add(pick(['pine', 'pine-crooked']), x + side * 4, z, hash(z * 7) * 6, 5 + hash(z * 2) * 3);
        else if (r < 0.75) add('pumpkin-carved', side * (ROAD_W / 2 + 1.6), z + 2, side > 0 ? -1 : 1, 2.2);
        else if (r < 0.82) add('crypt-small', x + side * 6, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, 3.2);
        else if (r < 0.9) add('rocks', x, z, hash(z) * 6, 3);
      }
      if (Math.round(z / 6) % 3 === 0) { add('lightpost-double', -ROAD_W / 2 - 0.2, z, 0, 2.6); add('lightpost-double', ROAD_W / 2 + 0.2, z + 9, 0, 2.6); }
    }
    for (const [name, mats] of Object.entries(sets)) if (this.m[name]) objs.push(...scatter(scene, this.m[name], mats));
    return objs;
  }

  // ---------- gioco ----------
  input(dir) {
    this.audio.ensure();
    if (this.state === 'menu') { if (dir > 0 && this.stateT > 0.4) this.begin(); return; }
    if (this.state === 'over') { if (this.stateT > 1.4) { this.reset(); this.begin(); } return; }
    if (this.state !== 'play') return;
    this.tx = clamp(this.tx + dir * NUDGE, -ROAD, ROAD);
  }

  // tenuto premuto: sterzata continua
  hold(dir) { this.held = dir; this.heldT = 0; }

  begin() {
    this.state = 'play'; this.stateT = 0;
    this.audio.playSong(SONGS.factory); this.audio.sfx('go');
    this.say('ONDATA 1', '#d9ff3d', 2, true);
  }

  // testo che sale dal giocatore (feedback immediato di cosa hai preso)
  pop(text, color, t = 1) { this.pops.push({ text, color, t, t0: t, x: this.x, z: this.z }); }

  say(text, color = '#ffd34d', t = 1.6, big = false) { this.texts.push({ text, color, t, big }); }
  prog(stat, n = 1, xp = 0) { this.hooks.progress?.event(stat, n, xp); }

  addAllies(n) {
    const ids = 'bcdefghij';
    for (let i = 0; i < n && this.allies.length < FORMATION.length; i++) {
      const r = rider(this.stage.scene, this.m[`char-${ids[this.allies.length % ids.length]}`], pick(['#4de3ff', '#ff4d9d', '#ffd166', '#06d6a0', '#ff922b']));
      r.setGun(this.m[WEAPONS[this.weapon].model]);
      const slot = FORMATION[this.allies.length];
      const a = { r, slot, fireT: Math.random() * 0.5, x: this.x + slot[0], z: this.z + slot[1] - 4 };
      this.allies.push(a);
      this.fx.spawn(a.x, 1, a.z, { tex: 'green', size: 2.5, life: 0.5 });
    }
    this.say(`ALLEATI: ${this.allies.length}`, '#06d6a0', 1.4);
  }

  loseAlly() {
    const a = this.allies.pop(); if (!a) return;
    this.fx.explode(a.r.root.position.x, 1, a.r.root.position.z, 0.8);
    this.stage.scene.remove(a.r.root);
  }

  evolve() {
    if (this.weapon >= WEAPONS.length - 1) { this.dmgMul *= 1.15; return; }
    this.weapon++; this.xp = 0;
    const w = WEAPONS[this.weapon];
    this.player.setGun(this.m[w.model]);
    for (const a of this.allies) a.r.setGun(this.m[w.model]);
    this.say(`NUOVA ARMA: ${w.name}!`, w.color, 2.4, true);
    this.audio.sfx('overdrive'); this.shake = 0.3;
    this.fx.spawn(this.x, 1.4, this.z, { tex: 'spark', size: 4, life: 0.6 });
  }

  spawnEnemy(type, x, z) {
    const def = ENEMIES[type];
    const c = character(this.stage.scene, this.m[def.model], def.height);
    c.root.rotation.y = Math.PI; c.root.position.set(x, def.float ? 0.4 : 0, z);
    c.play(def.anim, { speed: def.speed / 2 });
    const hp = Math.round(def.hp * waveHp(this.wave) * (def.boss ? 1.6 : 1));
    this.enemies.push({ type, def, c, x, z, hp, maxHp: hp, dead: false, deadT: 0, flash: 0, wob: Math.random() * 6 });
  }

  update(dt) {
    this.t += dt;
    const connected = this.hooks.connected(); const st = this.hooks.stats();
    const demoSprint = !connected && (this.t % 20) > 15;
    this.power = connected ? st.power || 0 : demoSprint ? 320 : 180;
    this.cadence = connected ? st.cadence || 0 : 88;
    const kmh = connected ? this.hooks.speedKmh() : 28;
    this.sprinting = this.effort.update(this.power, dt, connected ? 50 : 0);
    if (this.audio.song) this.audio.setTempo(this.audio.song.bpm * clamp((this.cadence || 85) / 88, 0.85, 1.25));
    this.texts.forEach((x) => { x.t -= dt; }); this.texts = this.texts.filter((x) => x.t > 0);
    if (this.state === 'loading' || this.state === 'error') return;
    this.fx.update(dt);
    this.stateT += dt;
    if (this.state !== 'play') { this.animateIdle(dt); return; }

    // avanzamento
    const v = Math.max(1.5, (kmh / 3.6) * 0.75);
    this.z += v * dt;
    if (this.held) { this.heldT += dt; if (this.heldT > 0.12) this.tx = clamp(this.tx + this.held * STEER * dt, -ROAD, ROAD); }
    this.x = lerp(this.x, this.tx, Math.min(1, dt * 8));
    this.ensureChunks();
    this.shake = Math.max(0, this.shake - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    const g = this.bossAlive ? 4 : Math.round((1.5 + 1.5 * Math.sin(this.z / 140)) * 2) / 2;
    if (g !== this.sentGrade) { this.sentGrade = g; this.hooks.setGrade(g); }

    // overdrive
    if (this.overdrive > 0) { this.overdrive -= dt; if (this.overdrive <= 0) this.audio.transpose = 0; }
    else {
      this.odMeter = clamp(this.odMeter + (this.sprinting ? dt / 3 : -dt / 25), 0, 1);
      if (this.odMeter >= 1) { this.overdrive = 7; this.odMeter = 0; this.audio.transpose = 2; this.audio.sfx('overdrive'); this.say('OVERDRIVE!', '#4de3ff', 2, true); this.prog('overdrives', 1, 15); }
    }

    // ondate
    this.waveT += dt;
    // l'ondata finisce quando ne abbatti abbastanza (o dopo 45 s): il ritmo segue la tua forza
    if (this.waveKills >= 12 + this.wave * 10 || this.waveT > 45) {
      this.waveT = 0; this.wave++; this.waveKills = 0;
      this.hooks.progress?.setMax('hordeWave', this.wave);
      if (this.wave % 5 === 0) { this.spawnEnemy('keeper', 0, this.z + 70); this.bossAlive = true; this.audio.sfx('alarm'); this.say(`ONDATA ${this.wave}: IL CUSTODE!`, '#ff4d4d', 3, true); }
      else this.say(`ONDATA ${this.wave}`, '#d9ff3d', 2, true);
    }
    // regista: i nemici arrivano a gocce e poi a fiumi; si adatta a come stai andando
    this.calmT += dt;
    if (this.calmT > 12) this.pressure = Math.min(1.8, this.pressure + dt * 0.006);
    const alive = this.enemies.filter((e) => !e.dead).length;
    const firepower = (1 + this.allies.length * 0.85) * WEAPONS[this.weapon].rate * WEAPONS[this.weapon].dmg * WEAPONS[this.weapon].shots * this.rateMul * this.dmgMul;
    const hpScale = waveHp(this.wave);
    // quanti nemici al secondo riesci (circa) ad abbattere: la pressione resta un po' sotto o sopra
    const killRate = firepower / (3 * hpScale);
    const rate = clamp(killRate * (this.wave === 1 ? 0.45 : 0.62 + this.wave * 0.07) * this.pressure, 0.35, 40) * (this.bossAlive ? 0.25 : 1);
    this.spawnAcc += rate * dt;
    const cap = Math.min(MAX_ALIVE, Math.round((14 + this.wave * 12) * Math.min(1.3, this.pressure)));
    while (this.spawnAcc >= 1 && alive < cap) {
      const group = Math.min(16, 1 + Math.floor(Math.random() * (1 + this.wave * 0.9)));
      this.spawnAcc -= group;
      const r = Math.random();
      const type = this.wave >= 3 && r < 0.1 ? 'vampire' : this.wave >= 2 && r < 0.35 ? 'skeleton' : this.wave >= 4 && r < 0.5 ? 'ghost' : 'zombie';
      const cx = (Math.random() * 2 - 1) * (ROAD - 1);
      for (let i = 0; i < group; i++) this.spawnEnemy(type, clamp(cx + (Math.random() - 0.5) * (2 + group * 0.5), -ROAD - 0.5, ROAD + 0.5), this.z + SPAWN_Z + Math.random() * 10 + i * 0.7);
    }
    if (alive >= cap) this.spawnAcc = Math.min(this.spawnAcc, 1);

    // portali
    if (this.z + 70 > this.nextGate && !this.bossAlive) { this.spawnGates(this.nextGate + 0); this.nextGate += 150; }

    this.updateShooters(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt, v);
    this.updateGates();
    this.updateGems(dt);
    this.animate(dt);
  }

  spawnGates(z) {
    const total = GATES.reduce((a, g) => a + g.w, 0);
    const roll = () => { let r = Math.random() * total; for (const g of GATES) if ((r -= g.w) < 0) return g; return GATES[0]; };
    let a = roll(); let b = roll(); let guard = 0;
    while ((b === a || (!a.good && !b.good)) && guard++ < 10) b = roll();
    for (const [def, x] of [[a, -ROAD / 2], [b, ROAD / 2]]) {
      const group = new THREE.Group();
      const col = def.good ? '#2b8cff' : '#ff3b3b';
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(ROAD - 0.3, 2.8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }));
      panel.position.y = 1.5; group.add(panel);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), new THREE.MeshBasicMaterial({ map: labelTexture(def.text, null, '#ffffff'), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      label.position.set(0, 1.6, -0.02); label.rotation.y = Math.PI; group.add(label);
      const postMat = new THREE.MeshLambertMaterial({ color: def.good ? '#9cd2ff' : '#ff9c9c', emissive: col, emissiveIntensity: 0.4 });
      for (const px of [-(ROAD / 2 - 0.1), ROAD / 2 - 0.1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3, 0.18), postMat); post.position.set(px, 1.5, 0); group.add(post); }
      group.position.set(x, 0, z);
      this.stage.scene.add(group);
      this.gates.push({ def, x, z, group, used: false });
    }
  }

  updateGates() {
    for (const g of this.gates) {
      if (g.used || this.z < g.z) continue;
      g.used = true;
      // passa dal portale della propria metà strada (la corsia centrale passa in mezzo)
      if (Math.abs(this.x - g.x) < ROAD / 2 + 0.2) {
        g.def.apply(this);
        this.pop(g.def.text, g.def.good ? '#4de3ff' : '#ff6b6b', 1.4);
        this.say(g.def.text, g.def.good ? '#4de3ff' : '#ff6b6b', 1.6, true);
        this.audio.sfx(g.def.good ? 'rescue' : 'hurt');
        this.fx.spawn(g.x, 1.5, g.z, { tex: g.def.good ? 'blue' : 'red', size: 6, life: 0.5 });
        g.group.visible = false;
      }
    }
    this.gates = this.gates.filter((g) => { if (g.z < this.z - 15) { this.stage.scene.remove(g.group); return false; } return true; });
  }

  shooters() { return [{ x: this.x, z: this.z, r: this.player, self: true }, ...this.allies.map((a) => ({ x: a.x, z: a.z, r: a.r, ally: a }))]; }

  updateShooters(dt) {
    const w = WEAPONS[this.weapon];
    const od = this.overdrive > 0;
    const effortMul = clamp(0.55 + 0.45 * (this.power / Math.max(80, this.effort.avg || this.power || 1)), 0.55, 1.5);
    this.fireRate = w.rate * this.rateMul * effortMul * (od ? 2 : 1);
    for (const s of this.shooters()) {
      const holder = s.self ? this : s.ally;
      holder.fireT = (holder.fireT || 0) - dt;
      if (holder.fireT > 0) continue;
      const target = this.nearest(s.x, s.z, 62);
      if (!target) { holder.fireT = 0.1; continue; }
      holder.fireT = (1 / this.fireRate) * (s.self ? 1 : 1.15);
      const ang = Math.atan2(target.x - s.x, target.z - s.z);
      for (let k = 0; k < w.shots; k++) {
        const a = ang + (w.shots > 1 ? (k / (w.shots - 1) - 0.5) * w.spread : (Math.random() - 0.5) * w.spread);
        const mesh = this.bulletPool.get();
        mesh.material.color.set(od ? '#ffffff' : w.color);
        mesh.scale.setScalar(w.splash ? 2.2 : od ? 1.4 : 1);
        mesh.position.set(s.x + Math.sin(a) * 0.7, 1.25, s.z + Math.cos(a) * 0.7);
        this.bullets.push({ mesh, vx: Math.sin(a) * w.speed, vz: Math.cos(a) * w.speed, life: 1.8, dmg: w.dmg * this.dmgMul * (od ? 2 : 1), splash: w.splash, pierce: w.pierce || od, hits: null });
      }
      this.fx.spawn(s.x + Math.sin(ang) * 0.8, 1.3, s.z + Math.cos(ang) * 0.8, { tex: 'spark', size: 0.7, life: 0.06, grow: 0 });
      if (s.self) this.audio.sfx(w.splash ? 'rocket' : w.rate > 8 ? 'mg' : w.pierce ? 'laser' : 'shot');
    }
  }

  nearest(x, z, range) {
    let best = null; let bd = range;
    for (const e of this.enemies) {
      if (e.dead || e.z < z - 1) continue;
      const d = Math.hypot(e.x - x, (e.z - z) * 0.8) - (e.def.boss ? 1 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.mesh.position.x += b.vx * dt; b.mesh.position.z += b.vz * dt; b.life -= dt;
      const bx = b.mesh.position.x; const bz = b.mesh.position.z;
      for (const e of this.enemies) {
        if (e.dead || (b.hits && b.hits.has(e))) continue;
        const rad = e.def.boss ? 2.2 : e.def.height > 2 ? 0.75 : 0.55;
        if (Math.abs(e.z - bz) < rad && Math.abs(e.x - bx) < rad) {
          if (b.splash) {
            this.fx.explode(bx, 1, bz, b.splash / 2.5);
            this.audio.sfx('boom'); this.shake = Math.max(this.shake, 0.12);
            for (const o of this.enemies) if (!o.dead && Math.hypot(o.x - bx, o.z - bz) < b.splash) this.damage(o, b.dmg);
          } else { this.damage(e, b.dmg); this.fx.spawn(bx, 1.2, bz, { tex: 'spark', size: 0.6, life: 0.12, grow: 0 }); }
          if (b.pierce) (b.hits = b.hits || new Set()).add(e); else { b.life = 0; break; }
        }
      }
      if (b.life <= 0) b.mesh.visible = false;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  damage(e, n) {
    if (e.dead) return;
    e.hp -= n; e.flash = 0.08;
    if (e.hp > 0) return;
    e.dead = true; e.deadT = 0;
    e.c.play('die', { once: true, fade: 0.05 });
    this.kills++; this.waveKills++; this.score += e.def.score * this.wave;
    this.prog('kills', 1, e.def.boss ? 200 : 1);
    this.xp += e.def.xp;
    if (this.xp >= WEAPONS[this.weapon].xp) this.evolve();
    if (Math.random() < 0.3 || e.def.boss) this.dropGem(e.x, e.z, e.def.boss ? 12 : e.def.xp > 2 ? 3 : 1);
    if (e.def.boss) {
      this.bossAlive = false; this.fx.explode(e.x, 2.5, e.z, 2.5); this.shake = 0.8;
      this.audio.sfx('win'); this.say('IL CUSTODE È CADUTO!', '#d9ff3d', 2.6, true); this.prog('bosses', 1, 150);
      this.addAllies(2);
    }
  }

  dropGem(x, z, n) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(this.gemGeo, this.gemMat);
      mesh.position.set(x + (Math.random() - 0.5) * (n > 1 ? 4 : 0.5), 0.6, z + (Math.random() - 0.5) * (n > 1 ? 4 : 0.5));
      this.stage.scene.add(mesh); this.gems.push({ mesh, t: 0 });
    }
  }

  updateGems(dt) {
    for (const g of this.gems) {
      g.t += dt; g.mesh.rotation.y += dt * 4; g.mesh.position.y = 0.7 + Math.sin(g.t * 5) * 0.15;
      const dx = this.x - g.mesh.position.x; const dz = this.z - g.mesh.position.z; const d = Math.hypot(dx, dz) || 1;
      // restano a terra: le prendi passandoci vicino (anello verde = raggio del magnete)
      if (d < 4 || g.pull) {
        g.pull = true;
        g.mesh.position.x += (dx / d) * 26 * dt; g.mesh.position.z += (dz / d) * 26 * dt + 6 * dt;
        if (d < 1) {
          g.done = true; this.stage.scene.remove(g.mesh); this.xp += 2; this.score += 5 * this.wave;
          this.audio.sfx('coin'); this.pop('+2', '#7dff6a', 0.8); this.ringPulse = 0.25;
          if (this.xp >= WEAPONS[this.weapon].xp) this.evolve();
        }
      } else if (dz > 6) { g.done = true; this.stage.scene.remove(g.mesh); }
    }
    this.gems = this.gems.filter((g) => !g.done);
  }

  updateEnemies(dt, v) {
    for (const e of this.enemies) {
      e.c.mixer.update(dt);
      if (e.dead) {
        e.deadT += dt;
        if (e.deadT > 0.9) e.c.root.position.y -= dt * 1.5;
        continue;
      }
      // camminano verso di te (convergendo un po')
      e.z -= e.def.speed * dt;
      const near = e.z - this.z < 28;
      e.x += clamp(this.x - e.x, -1, 1) * dt * (near ? (e.type === 'skeleton' ? 1.6 : 1.0) : 0.15);
      e.wob += dt;
      e.c.root.position.set(e.x, e.def.float ? 0.4 + Math.sin(e.wob * 3) * 0.2 : 0, e.z);
      e.flash = Math.max(0, e.flash - dt);
      e.c.inner.scale.setScalar(e.c.scale * (e.flash > 0 ? 1.12 : 1));
      // contatto con te o con un alleato
      const hit = (sx, sz) => Math.abs(e.z - sz) < (e.def.boss ? 2 : 0.8) && Math.abs(e.x - sx) < (e.def.boss ? 3 : 1);
      for (const a of this.allies) if (hit(a.x, a.z)) { a.dead = true; e.hp -= 3; }
      if (this.allies.some((a) => a.dead)) {
        for (const a of this.allies.filter((x) => x.dead)) { this.fx.explode(a.x, 1, a.z, 0.8); this.stage.scene.remove(a.r.root); }
        this.allies = this.allies.filter((a) => !a.dead);
        this.audio.sfx('hurt');
      }
      if (hit(this.x, this.z)) {
        if (this.overdrive > 0) { this.damage(e, 999); continue; }
        if (this.hurtT <= 0) {
          this.hp -= e.def.boss ? 2 : 1; this.hurtT = 1.2; this.shake = 0.4; this.audio.sfx('hurt');
          this.pressure = Math.max(0.55, this.pressure * 0.78); this.calmT = 0; this.pop('−1 ♥', '#ff4d6d', 1);
          if (navigator.vibrate) navigator.vibrate(90);
          if (this.hp <= 0) return this.gameOver();
        }
        if (!e.def.boss) this.damage(e, 999);
      }
      if (e.z < this.z - 6) { e.dead = true; e.deadT = 2; this.passed = (this.passed || 0) + 1; } // superati
    }
    this.enemies = this.enemies.filter((e) => {
      if (e.dead && e.deadT > 1.6) { this.stage.scene.remove(e.c.root); return false; }
      return true;
    });
  }

  gameOver() {
    this.state = 'over'; this.stateT = 0;
    this.audio.stopSong(); this.audio.sfx('lose');
    const dist = Math.round(this.z);
    this.newBest = this.score > this.best;
    if (this.newBest) { this.best = this.score; localStorage.setItem('hordeBest', this.best); }
    this.prog('races', 0, 40 + this.wave * 10);
    this.hooks.setGrade(0);
    this.finalDist = dist;
  }

  animate(dt) {
    const cad = this.cadence || 85;
    this.player.root.position.set(this.x, 0, this.z);
    this.player.root.rotation.set(0, clamp((this.tx - this.x) * 0.12, -0.5, 0.5), (this.tx - this.x) * -0.06);
    this.ringPulse = Math.max(0, (this.ringPulse || 0) - dt);
    this.ring.position.set(this.x, 0.05, this.z); this.ring.scale.setScalar(1 + this.ringPulse * 1.6);
    this.ring.material.color.set(this.hurtT > 0 ? '#ff4d6d' : this.overdrive > 0 ? '#4de3ff' : this.ringPulse > 0 ? '#7dff6a' : '#d9ff3d');
    this.aim.position.set(this.tx, 0.04, this.z + 2.2); this.aim.visible = Math.abs(this.tx - this.x) > 0.3;
    this.magnet.position.set(this.x, 0.03, this.z);
    this.player.pose(dt, cad, true);
    this.player.root.visible = !(this.hurtT > 0 && Math.floor(this.hurtT * 12) % 2);
    for (const a of this.allies) {
      a.x = lerp(a.x, this.x + a.slot[0], Math.min(1, dt * 5)); a.z = lerp(a.z, this.z + a.slot[1], Math.min(1, dt * 5));
      a.r.root.position.set(a.x, 0, a.z); a.r.pose(dt, cad, true);
    }
    for (const g of this.gates) g.group.children[0].material.opacity = 0.3 + Math.sin(this.t * 6) * 0.08;
    this.camera(dt);
  }

  animateIdle(dt) {
    if (!this.player) return;
    if (this.state === 'menu') this.z += dt * 3;
    this.ensureChunks();
    this.player.root.position.set(this.x, 0, this.z);
    this.player.pose(dt, 70, true);
    for (const e of this.enemies) e.c.mixer.update(dt);
    this.camera(dt);
  }

  camera(dt) {
    const cam = this.stage.camera;
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const target = new THREE.Vector3(this.x * 0.6 + sx, 11, this.z - 12.5);
    if (!this.camInit) { cam.position.copy(target); this.camInit = true; }
    cam.position.lerp(target, Math.min(1, dt * 5));
    cam.lookAt(this.x * 0.7, 0, this.z + 19);
    cam.fov = 62 + (this.overdrive > 0 ? 6 : 0); cam.far = 400; cam.updateProjectionMatrix();
    this.sun.position.set(this.x + 15, 30, this.z - 10); this.sun.target.position.set(this.x, 0, this.z + 8);
    this.moon.position.set(-60, 55, this.z + 260);
  }

  // ---------- interfaccia ----------
  drawHud(dt) {
    const { ctx, W, H } = this.stage;
    ctx.clearRect(0, 0, W, H);
    if (this.state === 'loading') { ctx.fillStyle = '#0f0e0c'; ctx.fillRect(0, 0, W, H); hudText(ctx, 'CARICAMENTO…', W / 2, H / 2, { size: 22, align: 'center', color: '#d9ff3d' }); hudText(ctx, `${Math.round((this.loadPct || 0) * 100)}%`, W / 2, H / 2 + 28, { size: 14, align: 'center' }); return; }
    if (this.state === 'error') { hudText(ctx, `Errore: ${this.error}`, W / 2, H / 2, { size: 14, align: 'center', color: '#ff6b6b' }); return; }
    if (this.state === 'menu') {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(10,6,20,.85)'); g.addColorStop(0.45, 'rgba(10,6,20,.2)'); g.addColorStop(1, 'rgba(10,6,20,.9)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      hudText(ctx, "L'ORDA", W / 2, 120, { size: 56, align: 'center', color: '#d9ff3d' });
      hudText(ctx, 'Pedala. Spara. Sopravvivi.', W / 2, 150, { size: 15, align: 'center' });
      const lines = ['Parti con una pistola: le ondate crescono sempre', 'Ogni uccisione fa evolvere l\'arma (10 armi)', 'Portali blu: alleati e potenziamenti. Rossi: evitali', 'Tieni premuto + / − per sterzare · più watt = più colpi', 'Passa sulle gemme verdi: l\'anello le attira', 'Sprint sopra soglia = OVERDRIVE', 'Ogni 5 ondate arriva il Custode'];
      lines.forEach((l, i) => hudText(ctx, '· ' + l, W / 2, H * 0.62 + i * 20, { size: 12, align: 'center', color: '#e8e8e8' }));
      hudText(ctx, `Record: ${this.best}`, W / 2, H * 0.62 + 130, { size: 12, align: 'center', color: '#bbb' });
      hudText(ctx, '+  INIZIA', W / 2, H - 50, { size: 20, align: 'center', color: '#d9ff3d' });
      this.hooks.progress?.drawToasts(ctx, W, dt);
      return;
    }
    const top = 56; const w = WEAPONS[this.weapon];
    hudText(ctx, String(this.score).padStart(6, '0'), 14, top + 24, { size: 24 });
    hudText(ctx, `ONDATA ${this.wave}`, W - 14, top + 22, { size: 18, align: 'right', color: '#d9ff3d' });
    hudText(ctx, `${this.kills} abbattuti · ${Math.round(this.z)} m`, W - 14, top + 40, { size: 12, align: 'right', color: '#e8e8e8' });
    let hx = 14; for (let i = 0; i < this.maxHp; i++) { hudText(ctx, i < this.hp ? '♥' : '♡', hx, top + 48, { size: 18, color: i < this.hp ? '#ff4d6d' : '#666' }); hx += 17; }
    hudText(ctx, `ALLEATI ${this.allies.length}`, hx + 10, top + 47, { size: 13, color: '#06d6a0' });
    // arma e barra evoluzione
    const by = top + 62;
    ctx.fillStyle = 'rgba(10,8,16,.6)'; ctx.fillRect(14, by, W - 28, 30);
    hudText(ctx, w.name, 22, by + 13, { size: 13, color: w.color });
    hudText(ctx, `${(this.fireRate || 0).toFixed(1)} colpi/s`, W - 22, by + 13, { size: 11, align: 'right', color: '#fff3a0' });
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(22, by + 19, W - 44, 6);
    ctx.fillStyle = w.color; ctx.fillRect(22, by + 19, (W - 44) * (Number.isFinite(w.xp) ? clamp(this.xp / w.xp, 0, 1) : 1), 6);
    // potenza e overdrive
    const py = by + 36;
    ctx.fillStyle = 'rgba(10,8,16,.6)'; ctx.fillRect(14, py, W - 28, 12);
    const maxW = Math.max(400, (this.effort.threshold || 200) * 1.6);
    ctx.fillStyle = this.sprinting ? '#4de3ff' : '#d9ff3d'; ctx.fillRect(14, py, (W - 28) * clamp(this.power / maxW, 0, 1), 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(14 + (W - 28) * clamp((this.effort.threshold || 0) / maxW, 0, 1) - 1, py - 3, 2, 18);
    hudText(ctx, `${Math.round(this.power)} W`, 20, py + 10, { size: 10 });
    ctx.fillStyle = 'rgba(10,8,16,.6)'; ctx.fillRect(14, py + 16, W - 28, 6);
    ctx.fillStyle = this.overdrive > 0 ? '#fff' : '#4de3ff'; ctx.fillRect(14, py + 16, (W - 28) * (this.overdrive > 0 ? this.overdrive / 7 : this.odMeter), 6);
    // barra vita del boss
    const boss = this.enemies.find((e) => e.def.boss && !e.dead);
    if (boss) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(14, H - 40, W - 28, 16);
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(14, H - 40, (W - 28) * clamp(boss.hp / boss.maxHp, 0, 1), 16);
      hudText(ctx, 'IL CUSTODE', W / 2, H - 27, { size: 12, align: 'center' });
    }
    if (!this.hooks.connected()) hudText(ctx, 'DEMO: rullo non connesso', W / 2, H - 12, { size: 11, align: 'center', color: '#ffd34d' });
    let ty = H * 0.34;
    for (const x of this.texts) {
      ctx.globalAlpha = Math.min(1, x.t * 3);
      hudText(ctx, x.text, W / 2, ty, { size: x.big ? 28 : 15, color: x.color, align: 'center' }); ty += x.big ? 34 : 22;
      ctx.globalAlpha = 1;
    }
    const v3 = new THREE.Vector3();
    for (const p of this.pops) {
      p.t -= dt; const k = 1 - p.t / p.t0;
      v3.set(p.x, 2.6 + k * 2.2, p.z).project(this.stage.camera);
      ctx.globalAlpha = clamp(p.t / p.t0 * 2, 0, 1);
      hudText(ctx, p.text, (v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H, { size: 20, align: 'center', color: p.color });
      ctx.globalAlpha = 1;
    }
    this.pops = this.pops.filter((p) => p.t > 0);
    if (this.hurtT > 0.9) { ctx.fillStyle = `rgba(255,0,40,${(this.hurtT - 0.9) * 0.9})`; ctx.fillRect(0, 0, W, H); }
    if (this.state === 'over') {
      ctx.fillStyle = 'rgba(8,4,14,.8)'; ctx.fillRect(0, 0, W, H);
      hudText(ctx, "L'ORDA HA VINTO", W / 2, H * 0.32, { size: 32, align: 'center', color: '#ff4d6d' });
      hudText(ctx, `Punti ${this.score}${this.newBest ? '  · RECORD!' : ''}`, W / 2, H * 0.32 + 40, { size: 18, align: 'center' });
      hudText(ctx, `Ondata ${this.wave} · ${this.kills} abbattuti · ${this.finalDist} m`, W / 2, H * 0.32 + 66, { size: 13, align: 'center', color: '#e8e8e8' });
      hudText(ctx, `Arma: ${w.name} · Alleati: ${this.allies.length}`, W / 2, H * 0.32 + 88, { size: 13, align: 'center', color: '#e8e8e8' });
      if (this.stateT > 1.4) hudText(ctx, '+  RIPROVA', W / 2, H * 0.32 + 140, { size: 20, align: 'center', color: '#d9ff3d' });
    }
    this.hooks.progress?.drawToasts(ctx, W, dt);
  }

  loop(now) {
    if (!this.active) return;
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.update(dt);
    if (this.player) this.stage.render();
    this.drawHud(dt);
    requestAnimationFrame(this.loop);
  }
}

function roadTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3d3a44'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 1600; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.08)'; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  g.fillStyle = '#d8d2c4'; g.fillRect(3, 0, 3, 256); g.fillRect(122, 0, 3, 256);
  g.fillStyle = 'rgba(216,210,196,.8)'; for (let y = 0; y < 256; y += 64) { g.fillRect(42, y, 2, 34); g.fillRect(84, y, 2, 34); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
