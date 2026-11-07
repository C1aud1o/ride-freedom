// Strumenti 3D comuni ai giochi (Three.js + modelli Kenney CC0).
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from '../../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';

// bagliore (bloom): colpi, luci, gemme e lampi brillano. Si spegne da solo se il telefono fatica.
export const glowSetting = { get on() { return localStorage.getItem('gameGlow') !== '0'; }, set on(v) { localStorage.setItem('gameGlow', v ? '1' : '0'); } };

export { THREE };
const loader = new GLTFLoader();
const cache = new Map();
export function loadModel(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(path));
  return cache.get(path);
}
export async function loadAll(map, onProgress) {
  const out = {}; let done = 0; const entries = Object.entries(map);
  await Promise.all(entries.map(async ([k, p]) => { out[k] = await loadModel(p); done++; onProgress?.(done / entries.length); }));
  return out;
}

// Palcoscenico: canvas WebGL sotto il canvas dell'interfaccia (2D)
export class Stage {
  constructor(hudCanvas) {
    this.hud = hudCanvas;
    this.gl = document.createElement('canvas');
    this.gl.className = 'game-gl';
    hudCanvas.parentElement.insertBefore(this.gl, hudCanvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.gl, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.ctx = hudCanvas.getContext('2d');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
    if (glowSetting.on) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      // soglia alta: brillano solo le cose davvero luminose (scie, vampate, lune, gemme)
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.frames = []; this.lastFrame = 0;
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }
  resize() {
    const r = this.hud.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.hud.width = Math.round(r.width * dpr); this.hud.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.setSize(r.width, r.height, false);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(r.width, r.height); }
    this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix();
  }
  // da coordinate del mondo a pixel CSS dello schermo
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H, visible: v.z < 1 };
  }
  render() {
    if (this.composer) {
      // se per 3 secondi si va sotto i ~28 fps, il bagliore si spegne per questa partita
      const now = performance.now();
      if (this.lastFrame) { this.frames.push(now - this.lastFrame); if (this.frames.length > 90) this.frames.shift(); }
      this.lastFrame = now;
      if (this.frames.length >= 90 && this.frames.reduce((a, b) => a + b, 0) / 90 > 36) { this.composer.dispose?.(); this.composer = null; }
      else { this.composer.render(); return; }
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    this.composer?.dispose?.();
    this.renderer.dispose();
    this.gl.remove();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.hud.width, this.hud.height);
  }
}

export function lights(scene, { sky = '#ffffff', ground = '#444444', sun = '#ffffff', hemi = 1.5, sunI = 2 } = {}) {
  scene.add(new THREE.HemisphereLight(sky, ground, hemi));
  const d = new THREE.DirectionalLight(sun, sunI);
  d.castShadow = true;
  d.shadow.mapSize.set(1024, 1024);
  Object.assign(d.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 120 });
  scene.add(d); scene.add(d.target);
  return d;
}

// Personaggio animato (Kenney: nodi separati per gambe, braccia, testa)
export function character(scene, gltf, height = 1.75) {
  const inner = gltf.scene.clone(true);
  inner.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  const box = new THREE.Box3().setFromObject(inner);
  const s = height / ((box.max.y - box.min.y) || 1);
  inner.scale.setScalar(s);
  const root = new THREE.Group(); root.add(inner);
  scene?.add(root);
  const mixer = new THREE.AnimationMixer(inner);
  const nodes = {}; inner.traverse((c) => { if (c.name) nodes[c.name] = c; });
  let current = null;
  const play = (name, { once = false, fade = 0.15, speed = 1 } = {}) => {
    const clip = gltf.animations.find((a) => a.name === name); if (!clip) return null;
    const act = mixer.clipAction(clip);
    act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    act.clampWhenFinished = once; act.timeScale = speed;
    if (current && current !== act) { act.reset().play(); current.crossFadeTo(act, fade, false); } else act.reset().play();
    current = act; return act;
  };
  return { root, inner, mixer, nodes, play, scale: s, anim: () => current?.getClip().name };
}

// Bici low-poly
export function bike(color = '#d9ff3d') {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: '#1d1d22' });
  const metal = new THREE.MeshLambertMaterial({ color: '#c9ced6' });
  const wheelGeo = new THREE.TorusGeometry(0.34, 0.04, 8, 28);
  const wheels = [];
  for (const z of [-0.52, 0.52]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, dark); tyre.rotation.y = Math.PI / 2; w.add(tyre);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.64, 0.012), metal); sp.rotation.x = (k * Math.PI) / 3; w.add(sp); }
    w.position.set(0, 0.34, z); g.add(w); wheels.push(w);
  }
  const tube = (a, b, r, mat = frameMat) => {
    const va = new THREE.Vector3(...a); const vb = new THREE.Vector3(...b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 6), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    g.add(m);
  };
  const rear = [0, 0.34, -0.52]; const front = [0, 0.34, 0.52]; const bb = [0, 0.32, -0.02]; const seat = [0, 0.86, -0.24]; const head = [0, 0.84, 0.4];
  tube(rear, bb, 0.022); tube(rear, seat, 0.018); tube(bb, seat, 0.03); tube(bb, head, 0.032); tube(seat, head, 0.028);
  tube(head, front, 0.022, metal); tube(head, [0, 0.98, 0.38], 0.02, metal); tube([-0.2, 0.98, 0.4], [0.2, 0.98, 0.4], 0.016, dark);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.26), dark); saddle.position.set(0, 0.9, -0.26); g.add(saddle);
  const crank = new THREE.Group(); crank.position.set(0, 0.32, -0.02);
  // pedivelle opposte con i pedali (girano con la cadenza)
  for (const [side, up] of [[1, 1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.19, 0.03), metal); arm.position.set(side * 0.09, up * 0.085, 0); crank.add(arm);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.06), dark); pedal.position.set(side * 0.13, up * 0.17, 0); crank.add(pedal);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 20), metal); ring.rotation.y = Math.PI / 2; ring.position.x = 0.07; crank.add(ring);
  g.add(crank);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return { group: g, wheels, crank, frameMat };
}

// Ciclista: bici + personaggio che pedala davvero. I personaggi Kenney hanno gambe rigide (senza ginocchio):
// ogni gamba ruota dall'anca verso il proprio pedale e si allunga/accorcia un poco, così il piede resta sul pedale.
const CRANK = { y: 0.32, z: -0.02, r: 0.17 };
const BAR = { y: 0.98, z: 0.38 };
export function rider(scene, gltf, color) {
  const root = new THREE.Group();
  const b = bike(color); root.add(b.group);
  const ch = character(null, gltf, 1.7);
  ch.mixer.stopAllAction();
  const legs = ['leg-left', 'leg-right'].map((n) => ch.nodes[n]).filter(Boolean);
  const arms = ['arm-left', 'arm-right'].map((n) => ch.nodes[n]).filter(Boolean);
  // posizione in sella: anca sopra la sella, un po' arretrata
  root.add(ch.root); root.updateMatrixWorld(true);
  const hip0 = new THREE.Vector3(); (legs[0] || ch.inner).getWorldPosition(hip0);
  ch.root.position.set(0, 0.95 - hip0.y, -0.28 - hip0.z);
  ch.root.rotation.x = 0.12; // busto leggermente in avanti
  root.updateMatrixWorld(true);
  // misure a riposo (nello spazio della bici)
  const toLocal = (o) => root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  const len = (node, pivot) => { const box = new THREE.Box3().setFromObject(node); return Math.max(0.1, pivot.y - root.worldToLocal(box.min.clone()).y); };
  const legInfo = legs.map((n) => { const p = toLocal(n); return { n, p, len: len(n, p) }; });
  const armInfo = arms.map((n) => { const p = toLocal(n); return { n, p, len: len(n, p) }; });
  scene.add(root);
  const r = { root, bike: b, ch, phase: Math.random() * 6, gun: null };
  r.setGun = (gunGltf, scale = 1.7) => {
    if (r.gun) root.remove(r.gun);
    if (!gunGltf) { r.gun = null; return; }
    const gun = gunGltf.scene.clone(true); // la canna dei blaster Kenney punta verso +Z (avanti)
    gun.scale.setScalar(scale);
    gun.position.set(0.32, 1.2, 0.5);
    gun.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    root.add(gun); r.gun = gun;
  };
  // orienta un arto rigido dal suo perno verso un bersaglio (y, z) e ne adatta la lunghezza
  const reach = (info, ty, tz, minS = 0.7, maxS = 1.2) => {
    const pivot = info.p; const dy = ty - pivot.y; const dz = tz - pivot.z;
    // l'arto a riposo punta in basso: ruotarlo di a attorno a X lo porta verso (−cos a, sin a) in (y, z)
    info.n.rotation.set(Math.atan2(-dz, -dy) - ch.root.rotation.x, 0, 0);
    info.n.scale.y = Math.min(maxS, Math.max(minS, Math.hypot(dy, dz) / info.len));
  };
  r.pose = (dt, cadence = 85, aimArm = false) => {
    r.phase += (cadence / 60) * Math.PI * 2 * dt;
    b.crank.rotation.x = -r.phase;
    for (const w of b.wheels) w.rotation.x -= dt * 8;
    legInfo.forEach((info, i) => {
      const f = r.phase + (i ? Math.PI : 0);
      reach(info, CRANK.y + CRANK.r * Math.cos(f), CRANK.z - CRANK.r * Math.sin(f));
    });
    armInfo.forEach((info, i) => {
      if (aimArm && i === 1) { info.n.rotation.set(-Math.PI / 2 - ch.root.rotation.x + 0.05, 0, 0); info.n.scale.y = 1; return; }
      reach(info, BAR.y, BAR.z, 0.8, 1.15);
    });
  };
  r.pose(0, 0);
  return r;
}

// Folla: un modello "congelato" in un'unica geometria, disegnato tante volte con un solo draw call.
// Si usa per i personaggi lontani (non serve l'animazione completa a 60 m).
export function crowd(scene, gltf, height, capacity = 200) {
  const root = gltf.scene.clone(true); root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root); const s = height / ((box.max.y - box.min.y) || 1);
  const geos = []; const mats = [];
  root.traverse((c) => {
    if (!c.isMesh) return;
    let g = c.geometry.clone(); g.applyMatrix4(c.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    geos.push(g); mats.push(Array.isArray(c.material) ? c.material[0] : c.material);
  });
  const geo = mergeGeometries(geos, true);
  geo.translate(0, -box.min.y, 0); geo.scale(s, s, s);
  const mesh = new THREE.InstancedMesh(geo, mats, capacity);
  mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false;
  scene.add(mesh);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const p = new THREE.Vector3(); const sc = new THREE.Vector3(1, 1, 1);
  return {
    mesh,
    begin() { mesh.count = 0; },
    add(x, y, z, rotY, tilt = 0) {
      if (mesh.count >= capacity) return;
      e.set(tilt, rotY, 0); q.setFromEuler(e); p.set(x, y, z);
      mesh.setMatrixAt(mesh.count++, m.compose(p, q, sc));
    },
    end() { mesh.instanceMatrix.needsUpdate = true; },
  };
}

// Molti oggetti uguali con un solo draw call per mesh
export function scatter(scene, gltf, matrices, { shadows = false } = {}) {
  gltf.scene.updateMatrixWorld(true);
  const list = [];
  const m = new THREE.Matrix4();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const inst = new THREE.InstancedMesh(o.geometry, o.material, matrices.length);
    matrices.forEach((mm, i) => { m.multiplyMatrices(mm, o.matrixWorld); inst.setMatrixAt(i, m); });
    inst.castShadow = shadows; inst.receiveShadow = true;
    scene.add(inst); list.push(inst);
  });
  return list;
}
export function mat4(x, y, z, rotY = 0, s = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(s, s, s));
}

// Proiettili ed esplosioni riciclati (niente creazione di oggetti a ogni colpo)
export class Pool {
  constructor(scene, make, size) { this.items = []; for (let i = 0; i < size; i++) { const o = make(); o.visible = false; scene.add(o); this.items.push(o); } this.i = 0; }
  get() { for (let k = 0; k < this.items.length; k++) { const o = this.items[(this.i + k) % this.items.length]; if (!o.visible) { this.i = (this.i + k + 1) % this.items.length; o.visible = true; return o; } } const o = this.items[this.i]; this.i = (this.i + 1) % this.items.length; return o; }
}

// Scia luminosa per i proiettili: nucleo bianco, bordo colorato sfumato, coda che svanisce.
// Due quadrati incrociati (orizzontale + verticale) così si vede da qualsiasi inquadratura; lunghezza lungo +Z.
let tracerTex = null;
function tracerTexture() {
  if (tracerTex) return tracerTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const along = g.createLinearGradient(0, 0, 0, 256); // testa in alto (y=0) → coda in basso
  along.addColorStop(0, 'rgba(255,255,255,0)'); along.addColorStop(0.06, 'rgba(255,255,255,1)'); along.addColorStop(0.35, 'rgba(255,255,255,.55)'); along.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = along; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(0.3, 'rgba(0,0,0,.5)'); across.addColorStop(0.5, 'rgba(0,0,0,1)'); across.addColorStop(0.7, 'rgba(0,0,0,.5)'); across.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = across; g.fillRect(0, 0, 64, 256);
  tracerTex = new THREE.CanvasTexture(c); tracerTex.colorSpace = THREE.SRGBColorSpace;
  return tracerTex;
}
let tracerGeo = null;
export function tracer(color = '#fff3a0') {
  if (!tracerGeo) {
    const a = new THREE.PlaneGeometry(1, 1); a.rotateX(-Math.PI / 2); // orizzontale, lunghezza lungo Z
    const b = new THREE.PlaneGeometry(1, 1); b.rotateX(-Math.PI / 2); b.rotateZ(Math.PI / 2); // verticale
    const pos = [...a.attributes.position.array, ...b.attributes.position.array];
    const uv = [...a.attributes.uv.array, ...b.attributes.uv.array];
    const idx = [...a.index.array, ...b.index.array.map((i) => i + 4)];
    tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tracerGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tracerGeo.setIndex(idx);
  }
  // nucleo bianco quasi puro + alone colorato (due passaggi additivi)
  const group = new THREE.Group();
  const glow = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ map: tracerTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const core = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ map: tracerTexture(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  glow.scale.set(0.42, 1, 1.7); core.scale.set(0.12, 1, 1.4); core.position.z = 0.1;
  group.add(glow, core); group.glow = glow; group.core = core;
  // forma: lunghezza e spessore a scelta
  group.shape = (len = 1.7, width = 0.42) => { glow.scale.set(width, width, len); core.scale.set(width * 0.3, width * 0.3, len * 0.8); };
  return group;
}

export function glowTexture(color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// effetti: lampi, esplosioni, scintille con sprite additivi
export class Effects {
  constructor(scene, size = 120) {
    this.list = [];
    this.tex = { fire: glowTexture('#ffb02e'), spark: glowTexture('#fff3a0'), blue: glowTexture('#4de3ff'), red: glowTexture('#ff4040'), green: glowTexture('#7dff6a'), smoke: glowTexture('#55505a') };
    this.pool = new Pool(scene, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), size);
  }
  spawn(x, y, z, { tex = 'fire', size = 1, life = 0.4, vx = 0, vy = 0, vz = 0, grow = 2, additive = true } = {}) {
    const s = this.pool.get();
    s.material.map = this.tex[tex]; s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending; s.material.needsUpdate = true;
    s.position.set(x, y, z); s.scale.setScalar(size);
    this.list.push({ s, t: 0, life, vx, vy, vz, size, grow });
  }
  explode(x, y, z, size = 1) {
    this.spawn(x, y, z, { size: 2.2 * size, life: 0.35, grow: 2.5 });
    for (let i = 0; i < 6; i++) this.spawn(x, y, z, { tex: 'spark', size: 0.5 * size, life: 0.5, vx: (Math.random() - 0.5) * 9 * size, vy: Math.random() * 7 * size, vz: (Math.random() - 0.5) * 9 * size, grow: 0.2 });
    for (let i = 0; i < 3; i++) this.spawn(x + (Math.random() - 0.5), y + 0.3, z, { tex: 'smoke', size: 1.4 * size, life: 0.9, vy: 1.2, grow: 1.6, additive: false });
  }
  update(dt) {
    for (const p of this.list) {
      p.t += dt; const k = p.t / p.life;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt; p.vy -= 9 * dt * (p.grow < 1 ? 1 : 0);
      p.s.scale.setScalar(p.size * (1 + k * p.grow));
      p.s.material.opacity = 1 - k;
      if (k >= 1) p.s.visible = false;
    }
    this.list = this.list.filter((p) => p.t < p.life);
  }
}

export function labelTexture(text, bg = '#1b1b1b', fg = '#ffffff', w = 512, h = 128, font = 'italic 800 76px "Barlow Condensed", Arial Narrow, sans-serif') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function skyTexture(top, mid, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
