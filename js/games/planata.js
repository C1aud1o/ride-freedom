// PLANATA — un aereo a pedali: i tuoi watt sono la quota. Più spingi, più sali.
// Passa negli anelli, scavalca le creste spingendo, abbassati sotto i ponti di roccia calando i watt.
// È un allenamento a intervalli travestito: le sezioni alte chiedono potenza, quelle basse recupero.
import { THREE, rider, scatter, mat4, Effects, lights, skyTexture } from './kit3d.js';
import { hudText, clamp, lerp, pick } from './engine.js';
import { Base3D } from './base3d.js';
import { t } from '../i18n.js';

const A = 'assets/3d';
const SIDE = 6.5;           // spostamento laterale massimo
const YMAX = 15;            // quota massima
const SEG = 26;             // metri tra un elemento e l'altro

export class Planata extends Base3D {
  constructor(hud, hooks, audio) {
    super(hud, hooks, audio, {
      key: 'planata', title: 'games.planata.hud.title', tagline: 'games.planata.hud.tagline', song: 'race',
      rules: ['games.planata.rule1', 'games.planata.rule2', 'games.planata.rule3', 'games.planata.rule4', 'games.planata.rule5'],
    });
  }

  assets() {
    const f = { 'char-a': `${A}/characters/character-a.glb` };
    for (const n of ['tree_pineTallA', 'tree_pineRoundA', 'tree_default', 'rock_largeA', 'rock_largeC', 'stone_tallA']) f[n] = `${A}/nature/${n}.glb`;
    return f;
  }

  build() {
    const { scene } = this.stage;
    scene.background = skyTexture('#3d7bd9', '#8cc4f2', '#f5e6c8');
    scene.fog = new THREE.Fog('#d9e6f2', 50, 190);
    this.sun = lights(scene, { sky: '#ffffff', ground: '#557a46', sun: '#fff0d0', hemi: 1.6, sunI: 2 });
    // aereo a pedali: bici + ala + elica che gira con la cadenza
    this.plane = new THREE.Group(); scene.add(this.plane);
    const r = rider(new THREE.Scene(), this.m['char-a'], '#d9ff3d');
    this.plane.add(r.root); this.rider = r;
    const wingMat = new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.6, side: THREE.DoubleSide });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 1.3), wingMat); wing.position.set(0, 2.5, 0.1); wing.castShadow = true; this.plane.add(wing);
    const tip = new THREE.MeshStandardMaterial({ color: '#d9ff3d' });
    for (const x of [-4.5, 4.5]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.3), tip); t.position.set(x, 2.7, 0.1); this.plane.add(t); }
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4), wingMat); strut.position.set(0, 1.9, 0.2); this.plane.add(strut);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.6), wingMat); tail.position.set(0, 1.6, -2.4); this.plane.add(tail);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4), wingMat); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.6, -1.3); this.plane.add(boom);
    this.prop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: '#333' })); this.prop.position.set(0, 1.4, 1.3); this.plane.add(this.prop);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.fx = new Effects(scene, 60);
    this.ringGeo = new THREE.TorusGeometry(1.9, 0.18, 10, 36);
    this.ringMat = new THREE.MeshStandardMaterial({ color: '#ffcc33', emissive: '#ff9f1a', emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 });
    this.rockMat = new THREE.MeshLambertMaterial({ color: '#9c8466' });
    this.rockTop = new THREE.MeshLambertMaterial({ color: '#6aa84f' });
    this.ground = [];
  }

  reset() {
    const { scene } = this.stage;
    for (const o of this.items || []) scene.remove(o.group);
    for (const g of this.ground) g.forEach((o) => scene.remove(o));
    this.ground = []; this.groundTo = -40;
    this.z = 0; this.x = 0; this.y = 6; this.vy = 0; this.lives = 3; this.hurtT = 0; this.combo = 0; this.score = 0;
    this.items = []; this.nextZ = 50; this.phase = 0; this.rings = 0;
    this.extendGround();
  }

  onBegin() { this.say(t('games.planata.climb'), '#d9ff3d', 1.8, true); this.hooks.setGrade(2); }

  extendGround() {
    const { scene } = this.stage;
    while (this.groundTo < this.z + 220) {
      const z0 = this.groundTo; const objs = [];
      const g = new THREE.Mesh(new THREE.PlaneGeometry(260, 60), new THREE.MeshLambertMaterial({ color: (z0 / 60) % 2 ? '#7bb661' : '#74ad5b' }));
      g.rotation.x = -Math.PI / 2; g.position.set(0, 0, z0 + 30); g.receiveShadow = true; scene.add(g); objs.push(g);
      const river = new THREE.Mesh(new THREE.PlaneGeometry(5, 60), new THREE.MeshLambertMaterial({ color: '#5ab0e0' }));
      river.rotation.x = -Math.PI / 2; river.position.set(Math.sin(z0 / 90) * 3, 0.02, z0 + 30); scene.add(river); objs.push(river);
      const sets = {};
      for (let i = 0; i < 26; i++) {
        const side = Math.random() < 0.5 ? -1 : 1; const x = side * (10 + Math.random() * 60);
        const n = pick(['tree_pineTallA', 'tree_pineRoundA', 'tree_default', 'tree_pineTallA', 'rock_largeA']);
        (sets[n] = sets[n] || []).push(mat4(x, 0, z0 + Math.random() * 60, Math.random() * 6, n.startsWith('tree') ? 5 + Math.random() * 5 : 4));
      }
      for (const [n, m] of Object.entries(sets)) objs.push(...scatter(scene, this.m[n], m));
      this.ground.push(objs); this.groundTo += 60;
    }
    while (this.ground.length > 6) this.ground.shift().forEach((o) => scene.remove(o));
  }

  // generatore: alterna tratti "alti" (potenza) e "bassi" (recupero), sempre più fitti
  spawnNext() {
    const z = this.nextZ; const lvl = Math.min(1, this.z / 2500);
    this.phase = (this.phase + 1) % 14;
    const high = this.phase >= 7; // 7 elementi alti, 7 bassi
    const r = Math.random();
    if (r < 0.55 - lvl * 0.15) {
      const y = high ? 9 + Math.random() * 4 : 2.5 + Math.random() * 3;
      this.addRing((Math.random() * 2 - 1) * (SIDE - 1.5), y, z);
    } else if (high) this.addRidge(z, 6 + Math.random() * 2 + lvl * 2);
    else this.addArch(z, 6.5 - lvl * 1.5);
    this.nextZ += SEG - lvl * 8;
  }

  addRing(x, y, z) {
    const group = new THREE.Group(); const m = new THREE.Mesh(this.ringGeo, this.ringMat); group.add(m);
    group.position.set(x, y, z); this.stage.scene.add(group);
    this.items.push({ kind: 'ring', group, x, y, z });
  }

  // cresta: muro dal suolo fino a "top" → devi stare sopra
  addRidge(z, top) {
    const group = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(SIDE * 2 + 8, top, 3), this.rockMat); wall.position.y = top / 2; wall.castShadow = true; group.add(wall);
    const grass = new THREE.Mesh(new THREE.BoxGeometry(SIDE * 2 + 8.2, 0.5, 3.2), this.rockTop); grass.position.y = top; group.add(grass);
    group.position.set(0, 0, z); this.stage.scene.add(group);
    this.items.push({ kind: 'ridge', group, z, top });
  }

  // arco di roccia: lastra da "bottom" in su → devi passare sotto
  addArch(z, bottom) {
    const group = new THREE.Group(); const h = 2.4;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(SIDE * 2 + 8, h, 3), this.rockMat); slab.position.y = bottom + h / 2; slab.castShadow = true; group.add(slab);
    for (const x of [-(SIDE + 3), SIDE + 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2, bottom, 3), this.rockMat); p.position.set(x, bottom / 2, 0); group.add(p); }
    group.position.set(0, 0, z); this.stage.scene.add(group);
    this.items.push({ kind: 'arch', group, z, bottom });
  }

  // quota obiettivo dai watt, relativa alla tua media (così funziona per tutti i livelli)
  ref() { return Math.max(90, this.effort.avg || 150); }
  targetY() { return clamp(((this.power / this.ref()) - 0.45) / 1.1, 0, 1) * (YMAX - 1) + 1; }
  wattsFor(y) { return Math.round((((y - 1) / (YMAX - 1)) * 1.1 + 0.45) * this.ref() / 5) * 5; }

  // in demo (senza rullo) l'aereo vola da solo verso il prossimo obiettivo
  demoPower() {
    const n = this.next && this.items ? this.next() : null;
    const y = !n ? 6 : n.kind === 'ring' ? n.y : n.kind === 'ridge' ? n.top + 2.5 : n.bottom - 3;
    return this.wattsFor(y);
  }

  press(dir) { this.x = clamp(this.x - dir * 1.2, -SIDE, SIDE); }

  step(dt) {
    const v = clamp((this.kmh / 3.6) * 0.9, 5, 14);
    this.z += v * dt;
    this.x = clamp(this.x - this.steer(dt, 7), -SIDE, SIDE);
    const ty = this.targetY();
    this.y = lerp(this.y, ty, Math.min(1, dt * 1.4));
    this.hurtT = Math.max(0, this.hurtT - dt);
    while (this.nextZ < this.z + 160) this.spawnNext();
    this.extendGround();
    for (const it of this.items) {
      if (it.done || this.z < it.z) continue;
      it.done = true;
      if (it.kind === 'ring') {
        if (Math.hypot(this.x - it.x, this.y - it.y) < 2.1) {
          this.combo++; this.rings++; const pts = 25 * this.combo;
          this.score += pts; this.audio.sfx('coin'); this.prog('coins', 1, 1);
          this.pop(this.combo > 1 ? `+${pts} ×${this.combo}` : `+${pts}`, '#ffcc33', it.x, it.y + 1.5, it.z);
          this.fx.spawn(it.x, it.y, it.z, { tex: 'spark', size: 4, life: 0.35 });
          it.group.visible = false;
        } else if (this.combo) { this.combo = 0; }
      } else {
        const ok = it.kind === 'ridge' ? this.y > it.top + 0.6 : this.y < it.bottom - 1;
        if (ok) { this.score += 40; this.pop('+40', '#d9ff3d', this.x, this.y + 2, this.z); this.audio.sfx('select'); }
        else if (this.hurtT <= 0) this.hit(it);
      }
    }
    this.items = this.items.filter((it) => { if (it.z < this.z - 20) { this.stage.scene.remove(it.group); return false; } return true; });
    this.score += v * dt;
  }

  hit(it) {
    this.lives--; this.hurtT = 1.5; this.combo = 0;
    this.audio.sfx('hurt'); this.fx.explode(this.x, this.y + 1, this.z, 1);
    this.say(it.kind === 'ridge' ? t('games.planata.tooLow') : t('games.planata.tooHigh'), '#ff6b6b', 1.8);
    if (navigator.vibrate) navigator.vibrate(120);
    if (this.lives <= 0) { this.score = Math.round(this.score); this.hooks.progress?.setMax('planataDist', Math.round(this.z)); this.end(Math.round(this.z / 100)); }
  }

  next() { return this.items.find((it) => !it.done && it.z > this.z); }

  view(dt) {
    const cad = this.cadence || 80;
    const ty = this.state === 'play' ? this.targetY() : 6;
    if (this.state !== 'play') this.z += dt * 8;
    this.plane.position.set(this.x, this.y, this.z);
    this.plane.rotation.set(-clamp((ty - this.y) * 0.08, -0.35, 0.35), 0, clamp(this.held * 0.25, -0.3, 0.3));
    this.rider.pose(dt, cad);
    this.prop.rotation.z += dt * (cad / 60) * 18;
    this.plane.visible = !(this.hurtT > 0 && Math.floor(this.hurtT * 12) % 2);
    this.shadow.position.set(this.x, 0.05, this.z); this.shadow.scale.setScalar(1 + this.y * 0.05);
    for (const it of this.items) if (it.kind === 'ring') it.group.rotation.y = Math.sin(this.t * 2 + it.z) * 0.2;
    this.fx.update(dt);
    const cam = this.stage.camera;
    const target = new THREE.Vector3(this.x * 0.7, this.y + 4.2, this.z - 10.5);
    if (!this.camInit) { cam.position.copy(target); this.camInit = true; }
    cam.position.lerp(target, Math.min(1, dt * 3));
    cam.lookAt(this.x * 0.8, this.y + 1, this.z + 16);
    cam.fov = 64; cam.updateProjectionMatrix();
    this.sun.position.set(this.x + 20, 50, this.z - 10); this.sun.target.position.set(this.x, 0, this.z + 10);
  }

  hud(ctx, W, H) {
    const top = 56;
    hudText(ctx, String(Math.round(this.score)).padStart(6, '0'), 14, top + 24, { size: 24 });
    hudText(ctx, `${Math.round(this.z)} m`, W - 14, top + 22, { size: 18, align: 'right', color: '#d9ff3d' });
    let hx = 14; for (let i = 0; i < this.lives; i++) { hudText(ctx, '♥', hx, top + 46, { size: 18, color: '#ff4d6d' }); hx += 17; }
    if (this.combo > 1) hudText(ctx, t('games.planata.combo', { n: this.combo }), W - 14, top + 42, { size: 13, align: 'right', color: '#ffcc33' });
    this.powerBar(ctx, 14, top + 56, W - 28);
    // altimetro: dove sei e dove devi essere per il prossimo elemento
    const ax = W - 34; const ay = top + 90; const ah = H * 0.42;
    const yToPx = (y) => ay + ah - (y / YMAX) * ah;
    ctx.fillStyle = 'rgba(10,10,20,.55)'; ctx.fillRect(ax, ay, 20, ah);
    const n = this.next();
    if (n) {
      let lo; let hi; let label;
      if (n.kind === 'ring') { lo = n.y - 1.6; hi = n.y + 1.6; label = `${this.wattsFor(n.y)} W`; }
      else if (n.kind === 'ridge') { lo = n.top + 0.6; hi = YMAX; label = `> ${this.wattsFor(n.top + 0.6)} W`; }
      else { lo = 0; hi = n.bottom - 1; label = `< ${this.wattsFor(n.bottom - 1)} W`; }
      ctx.fillStyle = n.kind === 'ring' ? 'rgba(255,204,51,.55)' : 'rgba(217,255,61,.4)';
      ctx.fillRect(ax, yToPx(Math.min(YMAX, hi)), 20, yToPx(Math.max(0, lo)) - yToPx(Math.min(YMAX, hi)));
      hudText(ctx, label, ax - 6, yToPx((lo + Math.min(YMAX, hi)) / 2) + 4, { size: 13, align: 'right', color: n.kind === 'ring' ? '#ffcc33' : '#d9ff3d' });
      const dist = Math.round(n.z - this.z);
      hudText(ctx, t(`games.planata.ahead.${n.kind}`, { dist }), W / 2, H - 34, { size: 15, align: 'center', color: n.kind === 'ring' ? '#ffcc33' : n.kind === 'ridge' ? '#ff9f43' : '#4de3ff' });
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(ax - 4, yToPx(this.y) - 2, 28, 4);
  }

  summary() { return [t('games.planata.over'), t('games.planata.stats', { m: Math.round(this.z), rings: this.rings })]; }
}
