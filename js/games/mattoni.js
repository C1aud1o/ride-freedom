// MATTONI — rimbalzi in 3D: la tua bici fa da racchetta, la cadenza decide la velocità della palla.
// Tieni premuto + / − per spostarti. Lo sprint rende la palla infuocata (sfonda tutto).
import { THREE, rider, Effects, lights, skyTexture } from './kit3d.js';
import { hudText, clamp, pick } from './engine.js';
import { Base3D } from './base3d.js';
import { t } from '../i18n.js';

const A = 'assets/3d';
const HW = 8;               // metà larghezza del campo
const TOP = 26;             // fondo del campo
const PZ = 1.6;             // linea della racchetta
const MOVE = 15;            // m/s tenendo premuto
const COLORS = ['#ff4d6d', '#ff922b', '#ffd166', '#06d6a0', '#4de3ff', '#c77dff'];
// livelli: ogni carattere è un mattone (numero = colpi necessari, # = indistruttibile, . = vuoto)
const LEVELS = [
  ['1111111111', '1111111111', '1111111111', '..........', '..........'],
  ['2222222222', '1111111111', '1.1.1.1.1.', '.1.1.1.1.1', '1111111111'],
  ['..222222..', '.21111112.', '2113113112', '.21111112.', '..222222..'],
  ['3333333333', '1#1#11#1#1', '2222222222', '1111111111', '.2.2.2.2.2'],
  ['1.2.33.2.1', '#22222222#', '.31111113.', '##111111##', '3333333333'],
];
const POWERS = [
  { id: 'wide', text: 'games.mattoni.pu.wide', color: '#4de3ff' },
  { id: 'multi', text: 'games.mattoni.pu.multi', color: '#d9ff3d' },
  { id: 'slow', text: 'games.mattoni.pu.slow', color: '#ffd166' },
  { id: 'life', text: 'games.shooter.plusLife', color: '#ff4d6d' },
];

export class Mattoni extends Base3D {
  constructor(hud, hooks, audio) {
    super(hud, hooks, audio, {
      key: 'mattoni', title: 'games.mattoni.hud.title', tagline: 'games.mattoni.hud.tagline', song: 'desert',
      rules: ['games.mattoni.rule1', 'games.mattoni.rule2', 'games.mattoni.rule3', 'games.mattoni.rule4', 'games.mattoni.rule5'],
    });
  }

  assets() { return { 'char-a': `${A}/characters/character-a.glb` }; }

  build() {
    const { scene } = this.stage;
    scene.background = skyTexture('#10132a', '#1d2350', '#3a2c6b');
    this.sun = lights(scene, { sky: '#c6c8ff', ground: '#20203a', sun: '#ffffff', hemi: 1.4, sunI: 1.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 2, TOP + 6), new THREE.MeshLambertMaterial({ color: '#1f2342' }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, TOP / 2 - 1); floor.receiveShadow = true; scene.add(floor);
    const grid = new THREE.GridHelper(TOP + 6, 16, '#3d4580', '#2a3060'); grid.position.set(0, 0.01, TOP / 2 - 1); scene.add(grid);
    const wallMat = new THREE.MeshLambertMaterial({ color: '#5560c8', emissive: '#2a3080', emissiveIntensity: 0.6 });
    for (const [x, z, w, d] of [[-HW - 0.5, TOP / 2, 1, TOP + 4], [HW + 0.5, TOP / 2, 1, TOP + 4], [0, TOP + 0.5, HW * 2 + 2, 1]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), wallMat); m.position.set(x, 0.6, z); m.castShadow = true; scene.add(m);
    }
    this.brickGeo = new THREE.BoxGeometry(1.5, 0.9, 0.8);
    this.ballGeo = new THREE.SphereGeometry(0.32, 16, 12);
    this.ballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.5 });
    this.fireMat = new THREE.MeshStandardMaterial({ color: '#ff9f43', emissive: '#ff6b35', emissiveIntensity: 1.4 });
    this.paddle = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 0.7), new THREE.MeshStandardMaterial({ color: '#d9ff3d', emissive: '#7d9900', emissiveIntensity: 0.6 }));
    this.paddle.position.set(0, 0.2, PZ); scene.add(this.paddle);
    this.fx = new Effects(scene, 80);
  }

  reset() {
    const { scene } = this.stage;
    for (const b of this.bricks || []) scene.remove(b.mesh);
    for (const b of this.balls || []) scene.remove(b.mesh);
    for (const c of this.caps || []) scene.remove(c.mesh);
    if (this.player) scene.remove(this.player.root);
    this.player = rider(scene, this.m['char-a'], '#d9ff3d');
    this.player.root.rotation.y = 0;
    this.px = 0; this.pw = 3.2; this.wideT = 0; this.slowT = 0; this.lives = 3; this.level = 0; this.combo = 0; this.score = 0;
    this.balls = []; this.caps = []; this.bricks = [];
    this.loadLevel(0);
  }

  loadLevel(n) {
    const { scene } = this.stage;
    for (const b of this.bricks) scene.remove(b.mesh);
    this.bricks = [];
    const rows = LEVELS[n % LEVELS.length];
    const extra = Math.floor(n / LEVELS.length); // dopo l'ultimo livello si ricomincia, più duri
    rows.forEach((row, r) => [...row.padEnd(10, '.')].forEach((ch, c) => {
      if (ch === '.') return;
      const solid = ch === '#'; const hp = solid ? Infinity : Number(ch) + extra;
      const mat = new THREE.MeshStandardMaterial({ color: solid ? '#8a8fa8' : COLORS[(r + Math.min(hp, 3)) % COLORS.length], roughness: 0.5 });
      const mesh = new THREE.Mesh(this.brickGeo, mat);
      const x = -HW + 0.8 + c * 1.6; const z = TOP - 2.5 - r * 1.1;
      mesh.position.set(x, 0.45, z); mesh.castShadow = true; scene.add(mesh);
      this.bricks.push({ mesh, x, z, hp, solid });
    }));
    for (const b of this.balls) scene.remove(b.mesh);
    this.balls = []; this.serve();
    this.hooks.setGrade?.(clamp(1 + (n % 4), 0, 5));
  }

  serve() { this.addBall(this.px, PZ + 0.8, 0, 0, true); }

  addBall(x, z, vx, vz, stuck = false) {
    const mesh = new THREE.Mesh(this.ballGeo, this.ballMat); mesh.castShadow = true;
    mesh.position.set(x, 0.45, z); this.stage.scene.add(mesh);
    this.balls.push({ mesh, x, z, vx, vz, stuck });
  }

  onBegin() { this.say(t('games.mattoni.level', { n: this.level + 1 }), '#d9ff3d', 1.6, true); this.say(t('games.mattoni.launch'), '#ffffff', 2); }

  press(dir) {
    const stuck = this.balls.find((b) => b.stuck);
    if (stuck) { stuck.stuck = false; stuck.vx = (Math.random() - 0.5) * 4; stuck.vz = 10; this.audio.sfx('jump'); return; }
    this.px = clamp(this.px - dir * 1.4, -HW + this.pw / 2, HW - this.pw / 2);
  }

  speed() { return 11 * clamp((this.cadence || 85) / 85, 0.75, 1.4) * (this.slowT > 0 ? 0.7 : 1) * (1 + this.level * 0.04); }

  step(dt) {
    this.px = clamp(this.px - this.steer(dt, MOVE), -HW + this.pw / 2, HW - this.pw / 2);
    this.wideT = Math.max(0, this.wideT - dt); this.slowT = Math.max(0, this.slowT - dt);
    this.pw += ((this.wideT > 0 ? 5 : 3.2) - this.pw) * Math.min(1, dt * 6);
    const fire = this.sprinting;
    const sp = this.speed();
    for (const b of this.balls) {
      if (b.stuck) { b.x = this.px; b.z = PZ + 0.8; continue; }
      // velocità costante (si adegua alla cadenza)
      const v = Math.hypot(b.vx, b.vz) || 1; b.vx *= sp / v; b.vz *= sp / v;
      const steps = 3;
      for (let k = 0; k < steps; k++) {
        b.x += (b.vx * dt) / steps; b.z += (b.vz * dt) / steps;
        if (b.x < -HW + 0.3) { b.x = -HW + 0.3; b.vx = Math.abs(b.vx); this.audio.sfx('clank'); }
        if (b.x > HW - 0.3) { b.x = HW - 0.3; b.vx = -Math.abs(b.vx); this.audio.sfx('clank'); }
        if (b.z > TOP - 0.3) { b.z = TOP - 0.3; b.vz = -Math.abs(b.vz); this.audio.sfx('clank'); }
        // racchetta: l'angolo dipende da dove colpisci
        if (b.vz < 0 && b.z < PZ + 0.55 && b.z > PZ - 0.4 && Math.abs(b.x - this.px) < this.pw / 2 + 0.3) {
          const off = clamp((b.x - this.px) / (this.pw / 2), -1, 1);
          const a = off * 1.05; b.vx = Math.sin(a) * sp; b.vz = Math.cos(a) * sp; b.z = PZ + 0.55;
          this.combo = 0; this.audio.sfx('land');
          this.fx.spawn(b.x, 0.5, b.z, { tex: 'green', size: 1.2, life: 0.15 });
        }
        for (const br of this.bricks) {
          if (br.dead || Math.abs(b.x - br.x) > 1.05 || Math.abs(b.z - br.z) > 0.72) continue;
          if (!(fire && !br.solid)) {
            // rimbalza sul lato più vicino
            const dx = (b.x - br.x) / 1.05; const dz = (b.z - br.z) / 0.72;
            if (Math.abs(dx) > Math.abs(dz)) b.vx = Math.sign(dx) * Math.abs(b.vx); else b.vz = Math.sign(dz) * Math.abs(b.vz);
          }
          this.hitBrick(br, fire);
          if (!fire) break;
        }
      }
      b.mesh.position.set(b.x, 0.45, b.z);
      b.mesh.material = fire ? this.fireMat : this.ballMat;
      if (fire && Math.random() < 0.5) this.fx.spawn(b.x, 0.5, b.z, { tex: 'fire', size: 0.8, life: 0.2, grow: 0.5 });
      if (b.z < -1.5) b.lost = true;
    }
    for (const b of this.balls.filter((x) => x.lost)) this.stage.scene.remove(b.mesh);
    this.balls = this.balls.filter((b) => !b.lost);
    if (!this.balls.length) {
      this.lives--; this.audio.sfx('hurt'); this.combo = 0;
      if (navigator.vibrate) navigator.vibrate(100);
      if (this.lives <= 0) return this.end(this.level * 15);
      this.say(t('games.mattoni.lives', { n: this.lives }), '#ff4d6d', 1.4, true); this.serve();
    }
    // capsule
    for (const c of this.caps) {
      c.z -= 5 * dt; c.mesh.position.z = c.z; c.mesh.rotation.y += dt * 3;
      if (c.z < PZ + 0.5 && c.z > PZ - 0.6 && Math.abs(c.x - this.px) < this.pw / 2 + 0.4) { c.done = true; this.power(c.p); }
      if (c.z < -1) c.done = true;
      if (c.done) this.stage.scene.remove(c.mesh);
    }
    this.caps = this.caps.filter((c) => !c.done);
    if (!this.bricks.some((b) => !b.dead && !b.solid)) {
      this.level++; this.score += 200 * this.level; this.audio.sfx('win'); this.prog('races', 0, 25);
      this.hooks.progress?.setMax('mattoniLevel', this.level + 1);
      this.say(t('games.mattoni.levelUp', { n: this.level + 1 }), '#d9ff3d', 2, true);
      this.loadLevel(this.level);
    }
  }

  hitBrick(br, fire) {
    if (br.solid && !fire) { this.audio.sfx('clank'); return; }
    br.hp -= fire ? 99 : 1;
    if (br.hp > 0) { br.mesh.material.color.set(COLORS[(Math.min(br.hp, 3) + 2) % COLORS.length]); this.audio.sfx('hit'); return; }
    br.dead = true; this.stage.scene.remove(br.mesh);
    this.combo++; const pts = 10 * this.combo * (1 + this.level);
    this.score += pts;
    this.pop(this.combo > 1 ? `+${pts} ×${this.combo}` : `+${pts}`, this.combo > 4 ? '#4de3ff' : '#ffd166', br.x, 1.2, br.z, 0.7);
    this.fx.explode(br.x, 0.5, br.z, 0.5); this.audio.sfx(this.combo > 4 ? 'coin' : 'hit');
    if (Math.random() < 0.13) {
      const p = pick(POWERS);
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 4, 10), new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.6 }));
      mesh.rotation.z = Math.PI / 2; mesh.position.set(br.x, 0.5, br.z); this.stage.scene.add(mesh);
      this.caps.push({ mesh, x: br.x, z: br.z, p });
    }
  }

  power(p) {
    this.audio.sfx('pickup'); this.pop(t(p.text), p.color, this.px, 1.6, PZ);
    if (p.id === 'wide') this.wideT = 14;
    if (p.id === 'slow') this.slowT = 10;
    if (p.id === 'life') this.lives = Math.min(5, this.lives + 1);
    if (p.id === 'multi') {
      const src = this.balls.find((b) => !b.stuck) || this.balls[0]; if (!src) return;
      for (const a of [-0.5, 0.5]) this.addBall(src.x, src.z, Math.sin(a) * 10, Math.abs(Math.cos(a) * 10));
    }
  }

  view(dt) {
    this.paddle.position.x = this.px; this.paddle.scale.x = this.pw;
    this.player.root.position.set(this.px, 0.35, PZ - 0.4);
    this.player.pose(dt, this.cadence || 80);
    this.fx.update(dt);
    const cam = this.stage.camera;
    const target = new THREE.Vector3(this.px * 0.2, 27, -4);
    if (!this.camInit) { cam.position.copy(target); this.camInit = true; }
    cam.position.lerp(target, Math.min(1, dt * 3));
    cam.lookAt(0, 0, TOP * 0.5);
    const aspect = this.stage.W / this.stage.H;
    cam.fov = aspect < 0.7 ? 62 : 46; cam.updateProjectionMatrix();
    this.sun.position.set(6, 30, -6); this.sun.target.position.set(0, 0, TOP / 2);
  }

  hud(ctx, W) {
    const top = 56;
    hudText(ctx, String(Math.round(this.score)).padStart(6, '0'), 14, top + 24, { size: 24 });
    hudText(ctx, t('games.mattoni.level', { n: this.level + 1 }), W - 14, top + 22, { size: 18, align: 'right', color: '#d9ff3d' });
    let hx = 14; for (let i = 0; i < this.lives; i++) { hudText(ctx, '♥', hx, top + 46, { size: 18, color: '#ff4d6d' }); hx += 17; }
    hudText(ctx, t('games.mattoni.ball', { kmh: Math.round(this.speed() * 3.6), rpm: Math.round(this.cadence) }), W - 14, top + 42, { size: 12, align: 'right', color: '#e8e8e8' });
    this.powerBar(ctx, 14, top + 56, W - 28);
    if (this.sprinting) hudText(ctx, t('games.mattoni.fire'), W / 2, top + 88, { size: 14, align: 'center', color: '#ff9f43' });
  }

  summary() { return [t('games.mattoni.over'), t('games.mattoni.reached', { n: this.level + 1 })]; }
}
