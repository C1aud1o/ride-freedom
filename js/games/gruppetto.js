// GRUPPETTO — raccogli i ciclisti rimasti indietro: si accodano alla tua scia e il gruppo si allunga.
// Non urtare la recinzione né la coda del tuo gruppo. Più è lungo il gruppo, più sale la pendenza (tiri tu!).
// + / − girano a destra / sinistra (tenuti premuti: curva continua). Sprint = punti doppi.
import { THREE, rider, scatter, mat4, Effects, lights, skyTexture } from './kit3d.js';
import { hudText, clamp, lerp, pick } from './engine.js';
import { Base3D } from './base3d.js';
import { t } from '../i18n.js';

const A = 'assets/3d';
const HALF = 22;            // metà lato dell'arena
const GAP = 1.7;            // distanza tra i corridori in fila
const TURN = 2.3;           // rad/s con il tasto tenuto
const TAP = Math.PI / 6;    // un tocco = 30°
const COLORS = ['#4de3ff', '#ff4d9d', '#ffd166', '#06d6a0', '#ff922b', '#c77dff', '#ffffff'];

export class Gruppetto extends Base3D {
  constructor(hud, hooks, audio) {
    super(hud, hooks, audio, {
      key: 'gruppetto', title: 'games.gruppetto.hud.title', tagline: 'games.gruppetto.hud.tagline', song: 'city',
      rules: ['games.gruppetto.rule1', 'games.gruppetto.rule2', 'games.gruppetto.rule3', 'games.gruppetto.rule4', 'games.gruppetto.rule5'],
    });
  }

  assets() {
    const f = {};
    for (const c of 'abcdefghij') f[`char-${c}`] = `${A}/characters/character-${c}.glb`;
    for (const n of ['tree_oak', 'tree_default', 'tree_pineRoundA', 'plant_bushLarge', 'flower_redA', 'flower_yellowA', 'rock_largeA']) f[n] = `${A}/nature/${n}.glb`;
    f.hay = `${A}/graveyard/hay-bale.glb`;
    return f;
  }

  build() {
    const { scene } = this.stage;
    scene.background = skyTexture('#5aa9e6', '#9fd3f5', '#e8f4ff');
    scene.fog = new THREE.Fog('#cfe8f7', 60, 140);
    this.sun = lights(scene, { sky: '#ffffff', ground: '#4a6b3a', sun: '#fff2d6', hemi: 1.6, sunI: 2 });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: '#79b85a' }));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
    // pista: piazzale chiaro con griglia leggera per percepire la velocità
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#d9cba8'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
    g.strokeStyle = 'rgba(120,100,70,.25)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(9, 9); tex.colorSpace = THREE.SRGBColorSpace;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshLambertMaterial({ map: tex }));
    field.rotation.x = -Math.PI / 2; field.position.y = 0.01; field.receiveShadow = true; scene.add(field);
    // recinzione di balle di fieno
    const hay = [];
    for (let k = -HALF; k <= HALF; k += 2.2) { hay.push(mat4(k, 0, -HALF - 0.8, 0, 1.6), mat4(k, 0, HALF + 0.8, 0, 1.6), mat4(-HALF - 0.8, 0, k, Math.PI / 2, 1.6), mat4(HALF + 0.8, 0, k, Math.PI / 2, 1.6)); }
    scatter(scene, this.m.hay, hay);
    const deco = {};
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2; const r = HALF + 5 + Math.random() * 40;
      const n = pick(['tree_oak', 'tree_default', 'tree_pineRoundA', 'plant_bushLarge', 'flower_redA', 'flower_yellowA', 'rock_largeA']);
      (deco[n] = deco[n] || []).push(mat4(Math.cos(a) * r, 0, Math.sin(a) * r, Math.random() * 6, n.startsWith('tree') ? 4 + Math.random() * 3 : 2.5));
    }
    for (const [n, mats] of Object.entries(deco)) scatter(scene, this.m[n], mats);
    this.fx = new Effects(scene, 60);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#d9ff3d', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 36), ringMat); this.ring.rotation.x = -Math.PI / 2; scene.add(this.ring);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 3), new THREE.MeshBasicMaterial({ color: '#d9ff3d' }));
    this.arrow.rotation.order = 'YXZ'; scene.add(this.arrow);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.35, depthWrite: false });
  }

  reset() {
    const { scene } = this.stage;
    for (const r of this.train || []) scene.remove(r.root);
    for (const s of this.strays || []) { scene.remove(s.r.root); scene.remove(s.beacon); }
    if (this.player) scene.remove(this.player.root);
    this.player = rider(scene, this.m['char-a'], '#d9ff3d');
    this.x = 0; this.z = -HALF + 6; this.h = 0; this.hT = 0; this.camH = 0; this.lean = 0; this.hist = []; this.train = []; this.strays = [];
    this.dist = 0; this.score = 0; this.sprintT = 0; this.pending = 0;
    for (let i = 0; i < 3; i++) this.addStray();
    this.hooks.setGrade?.(0); this.sentGrade = 0;
  }

  onBegin() { this.say(t('games.gruppetto.go'), '#d9ff3d', 1.8, true); }

  addStray() {
    let x; let z; let guard = 0;
    do { x = (Math.random() * 2 - 1) * (HALF - 3); z = (Math.random() * 2 - 1) * (HALF - 3); } while (guard++ < 30 && (Math.hypot(x - this.x, z - this.z) < 9 || this.hitsTrain(x, z, 2.2, 0)));
    const id = 'bcdefghij'[Math.floor(Math.random() * 9)];
    const r = rider(this.stage.scene, this.m[`char-${id}`], pick(COLORS));
    r.root.position.set(x, 0, z); r.root.rotation.y = Math.random() * 6;
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 16, 1, true), this.beaconMat);
    beacon.position.set(x, 3, z); this.stage.scene.add(beacon);
    this.strays.push({ r, x, z, beacon, t: 0 });
  }

  // un tocco imposta la nuova direzione: la bici ci arriva con una curva morbida
  press(dir) { this.hT -= dir * TAP; }

  hitsTrain(x, z, rad, skip) {
    for (let i = skip; i < this.train.length; i++) { const p = this.train[i].root.position; if (Math.hypot(p.x - x, p.z - z) < rad) return true; }
    return false;
  }

  step(dt) {
    const v = clamp((this.kmh / 3.6) * 0.42, 2.2, 7) * (this.sprinting ? 1.15 : 1);
    this.hT -= this.steer(dt, TURN);
    // curva fluida verso la direzione voluta (velocità di sterzo limitata) e piega in curva
    const dh = this.hT - this.h; const turn = Math.sign(dh) * Math.min(Math.abs(dh), 3.2 * dt);
    this.h += turn; this.lean += ((turn / Math.max(dt, 1e-3)) * 0.12 - this.lean) * Math.min(1, dt * 8);
    this.x += Math.sin(this.h) * v * dt; this.z += Math.cos(this.h) * v * dt;
    this.dist += v * dt;
    this.hist.unshift({ x: this.x, z: this.z, h: this.h, d: this.dist });
    if (this.hist.length > 2000) this.hist.length = 2000;
    if (this.sprinting) this.sprintT += dt;
    // la fila segue la scia esatta
    for (let i = 0; i < this.train.length; i++) {
      const want = this.dist - (i + 1) * GAP;
      const p = this.hist.find((q) => q.d <= want) || this.hist[this.hist.length - 1];
      const r = this.train[i];
      r.root.position.x = lerp(r.root.position.x, p.x, Math.min(1, dt * 12));
      r.root.position.z = lerp(r.root.position.z, p.z, Math.min(1, dt * 12));
      r.root.rotation.y = p.h;
    }
    // raccolta
    for (const s of this.strays) {
      s.t += dt; s.beacon.material.opacity = 0.25 + Math.sin(this.t * 5) * 0.1;
      if (Math.hypot(s.x - this.x, s.z - this.z) < 1.5) {
        s.done = true; this.stage.scene.remove(s.beacon);
        this.train.push(s.r);
        const pts = (this.sprinting ? 2 : 1) * (10 + this.train.length * 2);
        this.score += pts; this.prog('rescues', 1, 3);
        this.audio.sfx('rescue'); this.pop(`+${pts}`, this.sprinting ? '#4de3ff' : '#ffd166', this.x, 2.4, this.z);
        this.fx.spawn(s.x, 1, s.z, { tex: 'green', size: 3, life: 0.4 });
        if (this.train.length % 5 === 0) this.say(t('games.gruppetto.groupOf', { n: this.train.length + 1 }), '#d9ff3d', 1.6, true);
      }
    }
    this.strays = this.strays.filter((s) => !s.done);
    const want = 2 + Math.min(4, Math.floor(this.train.length / 6));
    while (this.strays.length < want) this.addStray();
    // la pendenza sale con la lunghezza del gruppo
    const grade = Math.min(7, Math.round(this.train.length * 0.25 * 2) / 2);
    if (grade !== this.sentGrade) { this.sentGrade = grade; this.hooks.setGrade(grade); }
    this.score += dt * (this.sprinting ? 2 : 1) * (1 + this.train.length * 0.1);
    // urti
    if (Math.abs(this.x) > HALF - 0.4 || Math.abs(this.z) > HALF - 0.4) return this.crash(t('games.gruppetto.fence'));
    if (this.hitsTrain(this.x, this.z, 0.9, 3)) return this.crash(t('games.gruppetto.rearEnded'));
  }

  crash(why) {
    this.fx.explode(this.x, 1, this.z, 1); this.audio.sfx('hurt'); this.why = why;
    if (navigator.vibrate) navigator.vibrate(120);
    this.score = Math.round(this.score);
    this.hooks.progress?.setMax('gruppettoMax', this.train.length + 1);
    this.end(this.train.length * 2);
  }

  view(dt) {
    const cad = this.cadence || 80;
    this.player.root.position.set(this.x, 0, this.z); this.player.root.rotation.set(0, this.h, 0); this.player.root.rotateZ(clamp(this.lean, -0.35, 0.35));
    this.player.pose(dt, cad);
    for (const r of this.train) r.pose(dt, cad);
    for (const s of this.strays) s.r.pose(dt, 0);
    this.fx.update(dt);
    this.ring.position.set(this.x, 0.04, this.z);
    this.arrow.position.set(this.x + Math.sin(this.h) * 2.2, 0.3, this.z + Math.cos(this.h) * 2.2);
    this.arrow.rotation.set(Math.PI / 2, this.h, 0);
    const cam = this.stage.camera;
    const back = 9 + Math.min(8, this.train.length * 0.25);
    this.camH += (this.h - this.camH) * Math.min(1, dt * 3.5);
    const target = new THREE.Vector3(this.x - Math.sin(this.camH) * back, 9 + back * 0.4, this.z - Math.cos(this.camH) * back);
    if (!this.camInit) { cam.position.copy(target); this.camInit = true; }
    cam.position.lerp(target, Math.min(1, dt * 3));
    cam.lookAt(this.x + Math.sin(this.camH) * 6, 0, this.z + Math.cos(this.camH) * 6);
    cam.fov = 60; cam.updateProjectionMatrix();
    this.sun.position.set(this.x + 15, 30, this.z - 10); this.sun.target.position.set(this.x, 0, this.z);
  }

  hud(ctx, W) {
    const top = 56;
    hudText(ctx, String(Math.round(this.score)).padStart(5, '0'), 14, top + 24, { size: 24 });
    hudText(ctx, t('games.gruppetto.group', { n: this.train.length + 1 }), W - 14, top + 22, { size: 18, align: 'right', color: '#d9ff3d' });
    hudText(ctx, t('games.gruppetto.grade', { n: this.sentGrade || 0 }), W - 14, top + 40, { size: 12, align: 'right', color: '#e8e8e8' });
    this.powerBar(ctx, 14, top + 52, W - 28);
    if (this.sprinting) hudText(ctx, t('games.gruppetto.double'), W / 2, top + 84, { size: 14, align: 'center', color: '#4de3ff' });
  }

  summary() {
    return [this.why || t('games.gruppetto.over'), t('games.gruppetto.size', { n: this.train.length + 1 }), t('games.gruppetto.stats', { m: Math.round(this.dist), s: Math.round(this.sprintT) })];
  }
}
