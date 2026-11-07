// PEDAL STRIKE 3D — stessa logica di Pedal Strike (strike.js), resa in 3D a scorrimento laterale
// con modelli Kenney (CC0): eroi in bici, scagnozzi del Barone armati, scenari 3D, esplosioni.
import { Strike } from './strike.js';
import { THREE, Stage, loadAll, character, rider, bike, scatter, mat4, Pool, Effects, labelTexture, skyTexture, lights } from './kit3d.js';
import { hudText, clamp, hash, pick } from './engine.js';
import { SONGS } from './audio.js';

const A = 'assets/3d';
const HERO_MODEL = ['d', 'c', 'h']; // Rocco, Vale, Nonno Gino
const HERO_COLOR = ['#e85d04', '#ff4d9d', '#2a9d8f'];
const GUN = { blaster: 'blaster-a', mg: 'blaster-n', rocket: 'blaster-h', flame: 'blaster-c', laser: 'blaster-l' };
const WCOLOR = { blaster: '#fff59d', mg: '#ffd166', rocket: '#ff6b35', flame: '#ff9f1c', laser: '#4de3ff' };
const THEMES = [
  { sky: ['#3a6fb0', '#8fbde6', '#f2d7a6'], fog: '#cfdbe6', ground: '#6b9a4a', side: '#5a4634', props: { tree_oak: 3, tree_default: 3, tree_fat: 2, plant_bushLarge: 3, rock_largeA: 1, flower_redA: 2, billboard: 1, tent: 1 } },
  { sky: ['#4f86c6', '#9cc7e8', '#f7e3b5'], fog: '#f0dcb4', ground: '#d9b26f', side: '#a8743d', props: { cactus_tall: 4, rock_largeC: 3, rock_largeE: 2, tree_palmShort: 2, rock_smallA: 2, log: 1 } },
  { sky: ['#0b0a1f', '#2a1745', '#5b2a52'], fog: '#2a1840', ground: '#3a4636', side: '#2a2420', props: { 'pine-crooked': 3, pine: 2, 'gravestone-cross': 3, 'gravestone-round': 2, 'crypt-small': 1, 'pumpkin-carved': 2, 'lightpost-double': 1, 'iron-fence': 2 } },
];

export class Strike3D extends Strike {
  async start() {
    this.active = true;
    this.stage = new Stage(this.canvas);
    const st = this.stage;
    this.screen = { get ctx() { return st.ctx; }, get W() { return st.W; }, get H() { return st.H; } };
    this.effort = new (await import('./engine.js')).Effort();
    this.state = 'loading'; this.t = 0; this.selT = 0;
    this.texts = []; this.fx = []; this.items = []; this.power = 0; this.cadence = 0;
    this.objs = new Map();
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    this.audio.playSong(SONGS.menu);
    try {
      const files = {};
      for (const c of 'cdhij') files[`char-${c}`] = `${A}/characters/character-${c}.glb`;
      for (const g of new Set(Object.values(GUN))) files[g] = `${A}/blasters/${g}.glb`;
      files['crate-small'] = `${A}/blasters/crate-small.glb`;
      for (const n of ['tree_oak', 'tree_default', 'tree_fat', 'plant_bushLarge', 'rock_largeA', 'flower_redA', 'cactus_tall', 'rock_largeC', 'rock_largeE', 'tree_palmShort', 'rock_smallA', 'log']) files[n] = `${A}/nature/${n}.glb`;
      for (const n of ['billboard', 'tent']) files[n] = `${A}/racing/${n}.gltf`;
      for (const n of ['pine-crooked', 'pine', 'gravestone-cross', 'gravestone-round', 'crypt-small', 'pumpkin-carved', 'lightpost-double', 'iron-fence']) files[n] = `${A}/graveyard/${n}.glb`;
      this.m = await loadAll(files, (p) => { this.loadPct = p; });
      this.setupScene();
      this.state = 'select'; this.selT = 0;
    } catch (err) { this.state = 'error'; this.error = err.message; }
  }

  stop() {
    this.active = false; this.audio.stopSong(); this.hooks.setGrade(null);
    this.stage?.dispose();
  }

  setupScene() {
    const { scene } = this.stage;
    this.sun = lights(scene, { sky: '#fff6e8', ground: '#4a4030', hemi: 1.5, sunI: 2.1 });
    this.fx3 = new Effects(scene, 180);
    const bg = new THREE.SphereGeometry(0.09, 8, 6);
    this.pPool = new Pool(scene, () => new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: '#fff59d' })), 160);
    this.ePool = new Pool(scene, () => new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4040' })), 80);
    this.bulletMesh = new Map(); this.ebulletMesh = new Map();
    this.showcase();
  }

  // eroe in vetrina nel menu
  showcase() {
    const { scene } = this.stage;
    const pl = this.objs.get('player'); if (pl) { scene.remove(pl.root); this.objs.delete('player'); }
    if (this.hero3) scene.remove(this.hero3.root);
    this.hero3 = rider(scene, this.m[`char-${HERO_MODEL[this.heroIndex]}`], HERO_COLOR[this.heroIndex]);
    this.hero3.setGun(this.m[GUN.blaster]);
    this.hero3.root.position.set(0, 0, 0);
    this.applyTheme(0, true);
  }

  input(dir) {
    const before = this.heroIndex;
    super.input(dir);
    if (this.state === 'select' && before !== this.heroIndex && this.m) this.showcase();
  }

  newGame() {
    super.newGame();
  }

  startLevel() {
    super.startLevel();
    if (this.levelIndex === 2) this.level = { ...this.level, name: 'CIMITERO DEL BARONE' };
    if (!this.stage || !this.m) return;
    this.applyTheme(this.levelIndex);
    // pulizia degli oggetti della missione precedente
    for (const [k, o] of this.objs) { if (k !== 'player') this.stage.scene.remove(o.root || o); }
    this.objs = new Map(Array.from(this.objs).filter(([k]) => k === 'player'));
    for (const m of this.bulletMesh.values()) m.visible = false; this.bulletMesh.clear();
    for (const m of this.ebulletMesh.values()) m.visible = false; this.ebulletMesh.clear();
    if (!this.objs.get('player')) {
      if (this.hero3) this.stage.scene.remove(this.hero3.root);
      const r = rider(this.stage.scene, this.m[`char-${HERO_MODEL[this.heroIndex]}`], HERO_COLOR[this.heroIndex]);
      r.root.rotation.y = Math.PI / 2;
      this.objs.set('player', r); this.hero3 = null; this.gunKey = null;
    }
  }

  applyTheme(i, menu = false) {
    const { scene } = this.stage;
    const T = THEMES[i];
    scene.background = skyTexture(...T.sky);
    scene.fog = new THREE.Fog(T.fog, 30, 95);
    this.theme = T; this.themeIndex = i;
    if (this.groundObjs) for (const o of this.groundObjs) scene.remove(o);
    this.groundObjs = []; this.segMesh = new Map(); this.propChunks = new Map();
    if (this.propObjs) for (const o of this.propObjs) { scene.remove(o); if (o.isInstancedMesh) o.dispose(); }
    this.propObjs = [];
    if (menu) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshLambertMaterial({ color: T.ground }));
      g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g); this.groundObjs.push(g);
    }
  }

  // terreno: una "fetta" 3D per ogni tratto di pendenza
  syncTerrain() {
    const { scene } = this.stage; const T = this.theme;
    const alive = new Set(this.terrain);
    for (const [seg, mesh] of this.segMesh) if (!alive.has(seg)) { scene.remove(mesh); this.segMesh.delete(seg); }
    for (const seg of this.terrain) {
      if (this.segMesh.has(seg)) continue;
      const x0 = seg.x0; const x1 = seg.x1; const y0 = seg.y0; const y1 = seg.y0 + seg.slope * (x1 - x0);
      const zb = -16; const zf = 2.5; const bottom = Math.min(y0, y1) - 60;
      const pos = [x0, y0, zb, x1, y1, zb, x0, y0, zf, x1, y1, zf, x0, y0, zf, x1, y1, zf, x0, bottom, zf, x1, bottom, zf];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex([0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7]);
      geo.addGroup(0, 6, 0); geo.addGroup(6, 6, 1);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, [new THREE.MeshLambertMaterial({ color: T.ground }), new THREE.MeshLambertMaterial({ color: T.side })]);
      mesh.receiveShadow = true;
      scene.add(mesh); this.segMesh.set(seg, mesh);
    }
    // scenografia dietro il percorso, a blocchi di 30 m
    const first = Math.floor((this.camX - 10) / 30); const last = Math.floor((this.camX + this.viewW + 30) / 30);
    for (let k = first; k <= last; k++) {
      if (this.propChunks.has(k)) continue;
      const sets = {}; const weights = Object.entries(T.props); const total = weights.reduce((a, [, w]) => a + w, 0);
      for (let x = k * 30; x < k * 30 + 30; x += 2.4) {
        if (hash(x * 1.7 + this.themeIndex) < 0.12) continue;
        let r = hash(x * 3.1) * total; let name = weights[0][0];
        for (const [n, w] of weights) if ((r -= w) < 0) { name = n; break; }
        const z = -4.5 - hash(x * 5.3) * 10;
        const small = /flower|rock_small|pumpkin/.test(name); const s = (name.startsWith('tree') || name.startsWith('pine') || name === 'cactus_tall' ? 4.5 : small ? 2.6 : 3.2) * (0.8 + hash(x) * 0.5);
        (sets[name] = sets[name] || []).push(mat4(x, this.ground(x) - 0.05, z, hash(x * 7) * 6, ['billboard', 'tent'].includes(name) ? 2.6 : s));
      }
      const objs = [];
      for (const [n, mats] of Object.entries(sets)) if (this.m[n]) objs.push(...scatter(this.stage.scene, this.m[n], mats));
      this.propChunks.set(k, objs); this.propObjs.push(...objs);
    }
  }

  get viewW() { const a = this.stage ? this.stage.W / this.stage.H : 0.5; return a < 1 ? 13 : 18; }
  get camX() { return (this.p?.x || 0) - this.viewW * 0.28; }

  // ---------- oggetti 3D per le entità della logica ----------
  makeObj(e) {
    const { scene } = this.stage;
    const face = (o) => { o.rotation.y = -Math.PI / 2; return o; };
    switch (e.type) {
      case 'walker': case 'shield': {
        const c = character(scene, this.m[e.type === 'shield' ? 'char-j' : 'char-i'], 1.75);
        face(c.root); c.play('walk', { speed: 0.6 });
        const gun = this.m['blaster-a'].scene.clone(true); gun.scale.setScalar(1.3); gun.position.set(0.35, 1.05, 0.4); c.root.add(gun);
        if (e.type === 'shield') {
          const sh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.0), new THREE.MeshLambertMaterial({ color: '#ffb703', emissive: '#4a3000' }));
          sh.position.set(0, 0.9, 0.7); c.root.add(sh); c.shieldMesh = sh;
        }
        return c;
      }
      case 'drone': {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshLambertMaterial({ color: '#2ec4b6' })); g.add(body);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 20), new THREE.MeshLambertMaterial({ color: '#1a8a80' })); ring.rotation.x = Math.PI / 2; g.add(ring);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b3b' })); eye.position.set(-0.36, 0, 0.1); g.add(eye);
        const rotor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.1), new THREE.MeshLambertMaterial({ color: '#dddddd' })); rotor.position.y = 0.55; g.add(rotor); g.rotor = rotor;
        scene.add(g); return { root: g };
      }
      case 'barrel': {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 14), new THREE.MeshLambertMaterial({ color: '#b5651d' }));
        b.rotation.x = Math.PI / 2; b.position.y = 0.42; g.add(b);
        for (const z of [-0.28, 0.28]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 6, 16), new THREE.MeshLambertMaterial({ color: '#3e2412' })); hoop.position.set(0, 0.42, z); g.add(hoop); }
        g.spin = b; scene.add(g); return { root: g };
      }
      case 'mine': {
        const g = new THREE.Group();
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.18, 12), new THREE.MeshLambertMaterial({ color: '#2b2b2b' })); b.position.y = 0.09; g.add(b);
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b3b' })); led.position.y = 0.22; g.add(led); g.led = led;
        scene.add(g); return { root: g };
      }
      case 'turret': {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.2), new THREE.MeshLambertMaterial({ color: '#5c677d' })); base.position.y = 0.35; g.add(base);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshLambertMaterial({ color: '#7d8597' })); head.position.y = 0.9; g.add(head);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.1, 8), new THREE.MeshLambertMaterial({ color: '#2b2d42' }));
        barrel.position.set(-0.45, 1.15, 0); barrel.rotation.z = Math.PI / 3.2; g.add(barrel);
        scene.add(g); return { root: g };
      }
      case 'crate': {
        const g = new THREE.Group();
        const c = this.m['crate-small'].scene.clone(true); c.scale.setScalar(1.7); g.add(c);
        const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(({ mg: 'M', rocket: 'R', flame: 'F', laser: 'L' })[e.weapon] || '?', '#1b1b1b', '#ffd166', 128, 128, '900 90px Arial') }));
        lab.scale.setScalar(0.55); lab.position.y = 1.2; g.add(lab);
        scene.add(g); return { root: g };
      }
      case 'cage': {
        const g = new THREE.Group();
        const pr = character(null, this.m['char-c'], 1.5); pr.play('emote-yes'); pr.root.rotation.y = 0; g.add(pr.root);
        const bar = new THREE.MeshLambertMaterial({ color: '#9aa3b5' });
        for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 6), bar); b.position.set(-0.6 + (i % 3) * 0.6, 1.0, i < 3 ? 0.6 : -0.6); g.add(b); }
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.4), bar); roof.position.y = 2.0; g.add(roof);
        scene.add(g); return { root: g, mixer: pr.mixer };
      }
      case 'freed': {
        const c = character(scene, this.m['char-c'], 1.5); face(c.root); c.play('sprint'); return c;
      }
      default: return null;
    }
  }

  makeBoss(b) {
    const { scene } = this.stage; const g = new THREE.Group();
    const L = (color) => new THREE.MeshLambertMaterial({ color });
    if (b.kind === 'tank') {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 2.4), L('#6b4a2b')); hull.position.y = 1.0; g.add(hull);
      for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.5, 12), L('#2b2b2b')); w.rotation.x = Math.PI / 2; w.position.set(-1.7 + i * 0.85, 0.42, 0); g.add(w); }
      const tur = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.6), L('#4a3320')); tur.position.set(0.2, 1.95, 0); g.add(tur);
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 10), L('#2b2b2b')); gun.rotation.z = Math.PI / 2 + 0.08; gun.position.set(-1.6, 2.05, 0); g.add(gun);
    } else if (b.kind === 'heli') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), L('#386641')); body.scale.set(1.6, 0.9, 0.9); body.position.y = 0.8; g.add(body);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 2.6, 8), L('#386641')); tail.rotation.z = Math.PI / 2; tail.position.set(2.2, 0.9, 0); g.add(tail);
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshLambertMaterial({ color: '#9ad1ff', emissive: '#103050' })); glass.position.set(-1.05, 0.95, 0); g.add(glass);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.05, 0.25), L('#dddddd')); rotor.position.y = 1.8; g.add(rotor); g.rotor = rotor;
      const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.08), L('#222')); skid.position.set(0, -0.05, 0.5); g.add(skid);
      const skid2 = skid.clone(); skid2.position.z = -0.5; g.add(skid2);
    } else {
      // il Barone in persona, gigante, sul suo triciclo
      const bk = bike('#7b2cbf'); bk.group.scale.setScalar(2.4); bk.group.rotation.y = -Math.PI / 2; g.add(bk.group); g.bike = bk;
      const extra = new THREE.Mesh(new THREE.TorusGeometry(0.34 * 2.4, 0.1, 8, 20), L('#1d1d22')); extra.position.set(1.25, 0.82, 0.9); g.add(extra);
      const baron = character(null, this.m['char-j'], 4.2); baron.play('sit'); baron.root.rotation.y = -Math.PI / 2; baron.root.position.set(0.5, 1.1, 0); g.add(baron.root); g.baron = baron;
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 12), L('#1b1b1b')); hat.position.set(0.45, 4.9, 0); g.add(hat);
    }
    g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    const weak = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd34d' }));
    scene.add(weak); g.weak = weak;
    scene.add(g); return { root: g };
  }

  // ---------- disegno ----------
  draw() {
    if (!this.stage || !this.m) return;
    const dt = this.lastDt || 0.016;
    if (this.state === 'select') return this.drawSelect3D(dt);
    this.syncTerrain();
    const { scene } = this.stage;
    const p = this.p;
    // giocatore
    const pr = this.objs.get('player');
    if (pr) {
      pr.root.position.set(p.x, p.y, 0);
      pr.root.rotation.set(0, Math.PI / 2, 0);
      pr.pose(dt, this.cadence || 85, true);
      const key = this.weapon;
      if (key !== this.gunKey) { pr.setGun(this.m[GUN[key]]); this.gunKey = key; }
      if (pr.gun) pr.gun.rotation.x = -p.aim;
      pr.root.visible = !(p.hurt > 0 && Math.floor(p.hurt * 14) % 2 && this.overdrive <= 0);
      if (p.vehicle && !pr.cargo) {
        const cg = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.1), new THREE.MeshLambertMaterial({ color: '#4a5d23' })); box.position.set(0, 0.75, 0.95); cg.add(box);
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 8), new THREE.MeshLambertMaterial({ color: '#222' })); can.rotation.x = Math.PI / 2; can.position.set(0, 1.15, 1.4); cg.add(can);
        pr.root.add(cg); pr.cargo = cg;
      }
      if (!p.vehicle && pr.cargo) { pr.root.remove(pr.cargo); pr.cargo = null; }
      if (this.overdrive > 0 && Math.random() < 0.5) this.fx3.spawn(p.x - 0.6, p.y + 0.8 + Math.random(), 0, { tex: 'blue', size: 0.8, life: 0.3, vx: -3 });
    }
    // nemici e oggetti
    const seen = new Set(['player']);
    for (const e of this.enemies) {
      let o = this.objs.get(e);
      if (!o) { o = this.makeObj(e); if (!o) continue; this.objs.set(e, o); }
      seen.add(e);
      o.root.position.set(e.x, e.y, 0);
      o.mixer?.update(dt);
      const pulse = e.flash > 0 ? 1.15 : 1;
      if (o.inner) o.inner.scale.setScalar(o.scale * pulse); else o.root.scale.setScalar(pulse);
      if (e.type === 'drone') o.root.rotor.rotation.y += dt * 30;
      if (e.type === 'barrel') o.root.spin.rotation.y = -e.rot;
      if (e.type === 'mine') o.root.led.visible = Math.sin(e.t * 9) > 0;
      if (o.shieldMesh) o.shieldMesh.visible = e.shield > 0;
      if (e.type === 'walker' && this.overdrive > 0) o.root.rotation.y = Math.PI / 2; else if (o.inner) o.root.rotation.y = -Math.PI / 2;
    }
    for (const it of this.items) {
      let o = this.objs.get(it);
      if (!o) {
        const color = { mg: '#ffd166', rocket: '#ff6b35', flame: '#ff9f1c', laser: '#4de3ff', bomb: '#ffd166', heart: '#ff5a7a', vehicle: '#6b8e23' }[it.kind] || '#fff';
        const letter = { mg: 'M', rocket: 'R', flame: 'F', laser: 'L', bomb: 'B', heart: '+', vehicle: 'V' }[it.kind] || '?';
        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 })); g.add(box);
        const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(letter, null, '#ffffff', 128, 128, '900 96px Arial'), depthTest: false })); lab.scale.setScalar(0.5); g.add(lab);
        this.stage.scene.add(g); o = { root: g, box }; this.objs.set(it, o);
      }
      seen.add(it);
      o.root.position.set(it.x, it.y + 0.6 + Math.abs(Math.sin(it.t * 3)) * 0.25, 0); o.box.rotation.y += dt * 2;
    }
    if (this.boss) {
      let o = this.objs.get(this.boss);
      if (!o) { o = this.makeBoss(this.boss); this.objs.set(this.boss, o); }
      seen.add(this.boss);
      const b = this.boss;
      o.root.position.set(b.x, b.y, 0);
      o.root.scale.setScalar(b.flash > 0 ? 1.06 : 1);
      if (o.root.rotor) o.root.rotor.rotation.y += dt * 25;
      if (o.root.baron) o.root.baron.mixer.update(dt);
      const wp = this.weakPoint(b); o.root.weak.position.set(wp.x, wp.y, 0.9); o.root.weak.scale.setScalar(1 + Math.sin(this.t * 10) * 0.25);
    }
    for (const [k, o] of this.objs) if (!seen.has(k)) { scene.remove(o.root); if (o.root.weak) scene.remove(o.root.weak); this.objs.delete(k); }
    // proiettili
    this.syncBullets(this.bullets, this.bulletMesh, this.pPool, (b) => (b.kind === 'flame' ? '#ff9f1c' : b.color || '#fff59d'), (b) => (b.kind === 'rocket' || b.kind === 'shell' ? 2.4 : b.kind === 'flame' ? 2 : 1));
    this.syncBullets(this.ebullets, this.ebulletMesh, this.ePool, (b) => (b.grav ? '#2b2b2b' : '#ff4040'), (b) => (b.grav ? 2.2 : 1));
    // effetti dalla logica 2D
    for (const f of this.fx) {
      if (f._3d) continue; f._3d = true;
      if (f.type === 'boom') this.fx3.explode(f.x, f.y, 0.3, f.size);
      else if (f.type === 'spark') this.fx3.spawn(f.x, f.y, 0.4, { tex: 'spark', size: 0.35, life: 0.18, vx: f.vx, vy: f.vy, grow: 0 });
      else if (f.type === 'muzzle') this.fx3.spawn(f.x, f.y, 0.3, { tex: 'spark', size: 0.6, life: 0.06, grow: 0 });
      else if (f.type === 'smoke' && Math.random() < 0.5) this.fx3.spawn(f.x, f.y, -0.2, { tex: 'smoke', size: f.r * 0.25, life: f.life, vy: 0.8, grow: 1.4, additive: false });
      else if (f.type === 'debris') this.fx3.spawn(f.x, f.y, 0.3, { tex: 'fire', size: 0.25, life: 0.6, vx: f.vx, vy: f.vy, grow: 0 });
    }
    this.fx3.update(dt);
    // telecamera laterale
    const cam = this.stage.camera; const a = this.stage.W / this.stage.H;
    const visW = this.viewW; const fov = 45; cam.fov = fov;
    const dist = visW / a / (2 * Math.tan((fov * Math.PI) / 360));
    const cx = this.camX + visW / 2;
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.8 : 0;
    // un po' dall'alto: si vedono la strada, lo scenario dietro e meno terra di taglio
    // in verticale si alza il punto di mira: meno terra in basso, più scenario e azione al centro
    const portrait = a < 1;
    cam.position.set(cx + sh, this.camY + dist * (portrait ? 0.3 : 0.42) + 2 + sh, dist);
    cam.lookAt(cx, this.camY + (portrait ? 6.5 : 1.6), -1.5);
    cam.updateProjectionMatrix();
    this.sun.position.set(cx + 10, this.camY + 25, 18); this.sun.target.position.set(cx, this.camY, 0);
    this.stage.render();
    this.drawHud3D();
  }

  syncBullets(list, map, pool, colorFn, sizeFn) {
    const live = new Set(list);
    for (const [b, m] of map) if (!live.has(b) || b.life <= 0) { m.visible = false; map.delete(b); }
    for (const b of list) {
      if (b.life <= 0) continue;
      let m = map.get(b);
      if (!m) { m = pool.get(); m.material.color.set(colorFn(b)); m.scale.setScalar(sizeFn(b)); map.set(b, m); }
      m.position.set(b.x, b.y, 0.2);
    }
  }

  drawHud3D() {
    const ctx = this.stage.ctx; ctx.clearRect(0, 0, this.stage.W, this.stage.H);
    const world = this.texts.filter((x) => x.wx != null);
    this.texts = this.texts.filter((x) => x.wx == null);
    this.drawHud();
    for (const x of world) {
      const pos = this.stage.project(x.wx, x.wy + (1 - x.t / x.life) * 0.8, 0);
      ctx.globalAlpha = Math.min(1, x.t * 3);
      hudText(ctx, x.text, pos.x, pos.y, { size: 13, color: x.color, align: 'center' });
      ctx.globalAlpha = 1;
    }
    this.texts.push(...world);
  }

  drawSelect3D(dt) {
    const { ctx, W, H } = this.stage;
    if (this.hero3) {
      this.hero3.root.rotation.y = this.t * 0.6;
      this.hero3.pose(dt, 70, true);
      const cam = this.stage.camera; cam.fov = 40; cam.updateProjectionMatrix();
      cam.position.set(0, 2.2, 8.4); cam.lookAt(0, 1.0, 0);
      this.sun.position.set(4, 10, 6); this.sun.target.position.set(0, 0, 0);
    }
    this.stage.render();
    ctx.clearRect(0, 0, W, H);
    const h = (this.HEROES || [])[this.heroIndex];
    const names = ['ROCCO "CHIAVE INGLESE"', 'VALE "LAMPO"', 'NONNO GINO'];
    const perks = ['Meccanico di quartiere: 6 vite invece di 5', 'Velocista: spara il 25% più veloce', 'Bici d\'acciaio del \'68: parte con 6 bombe'];
    hudText(ctx, 'PEDAL STRIKE', W / 2, 96, { size: 36, align: 'center', color: '#d9ff3d' });
    hudText(ctx, 'Il Barone Bullone ha rubato le bici della città.', W / 2, 122, { size: 12, align: 'center' });
    hudText(ctx, 'Riprenditele, una missione alla volta.', W / 2, 138, { size: 12, align: 'center' });
    hudText(ctx, 'SCEGLI L\'EROE', W / 2, H * 0.24, { size: 15, align: 'center', color: '#d9ff3d' });
    hudText(ctx, names[this.heroIndex], W / 2, H * 0.72, { size: 22, align: 'center' });
    hudText(ctx, perks[this.heroIndex], W / 2, H * 0.72 + 24, { size: 13, align: 'center', color: '#06d6a0' });
    hudText(ctx, [0, 1, 2].map((i) => (i === this.heroIndex ? '●' : '○')).join(' '), W / 2, H * 0.72 + 48, { size: 14, align: 'center' });
    hudText(ctx, '−  cambia eroe        +  inizia', W / 2, H * 0.86, { size: 15, align: 'center', color: '#d9ff3d' });
    hudText(ctx, 'In gioco: + salta · − bomba · avvicinati: colpo di pompa', W / 2, H * 0.86 + 24, { size: 11, align: 'center', color: '#e8e8e8' });
    hudText(ctx, `Record: ${this.best}`, W / 2, H * 0.86 + 44, { size: 11, align: 'center', color: '#e8e8e8' });
    this.hooks.progress?.drawToasts(ctx, W, dt);
  }

  loop(now) {
    if (!this.active) return;
    if (this.state === 'loading' || this.state === 'error') {
      const { ctx, W, H } = this.stage; ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0f0e0c'; ctx.fillRect(0, 0, W, H);
      hudText(ctx, this.state === 'error' ? `Errore: ${this.error}` : 'CARICAMENTO…', W / 2, H / 2, { size: 20, align: 'center', color: '#d9ff3d' });
      if (this.state === 'loading') hudText(ctx, `${Math.round((this.loadPct || 0) * 100)}%`, W / 2, H / 2 + 26, { size: 14, align: 'center' });
      this.last = now; requestAnimationFrame(this.loop); return;
    }
    super.loop(now);
  }
}
