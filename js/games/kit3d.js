// Strumenti 3D comuni ai giochi (Three.js + modelli Kenney CC0).
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';

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
    this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix();
  }
  // da coordinate del mondo a pixel CSS dello schermo
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H, visible: v.z < 1 };
  }
  render() { this.renderer.render(this.scene, this.camera); }
  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
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
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), metal); arm.rotation.z = Math.PI / 2; crank.add(arm);
  g.add(crank);
  g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  return { group: g, wheels, crank, frameMat };
}

// Ciclista: bici + personaggio seduto che pedala; arma opzionale nella mano destra
export function rider(scene, gltf, color) {
  const root = new THREE.Group();
  const b = bike(color); root.add(b.group);
  const ch = character(null, gltf, 1.7);
  ch.play('sit'); ch.mixer.update(0.01);
  ch.root.updateMatrixWorld(true);
  const hip = new THREE.Vector3(); (ch.nodes['leg-left'] || ch.inner).getWorldPosition(hip);
  ch.root.position.set(0, 0.92 - hip.y, -0.3 - hip.z);
  root.add(ch.root);
  scene.add(root);
  const r = { root, bike: b, ch, phase: Math.random() * 6, gun: null };
  r.setGun = (gunGltf, scale = 1.7) => {
    if (r.gun) root.remove(r.gun);
    if (!gunGltf) { r.gun = null; return; }
    const gun = gunGltf.scene.clone(true); // la canna dei blaster Kenney punta verso +Z (avanti)
    gun.scale.setScalar(scale);
    gun.position.set(0.4, 1.28, 0.45);
    gun.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    root.add(gun); r.gun = gun;
  };
  r.pose = (dt, cadence = 85, aimArm = false) => {
    r.phase += (cadence / 60) * Math.PI * 2 * dt;
    b.crank.rotation.x = -r.phase;
    for (const w of b.wheels) w.rotation.x -= dt * 8;
    ch.mixer.update(dt);
    const L = ch.nodes['leg-left']; const R = ch.nodes['leg-right'];
    if (L) L.rotation.x += Math.sin(r.phase) * 0.55;
    if (R) R.rotation.x += Math.sin(r.phase + Math.PI) * 0.55;
    const al = ch.nodes['arm-left']; const ar = ch.nodes['arm-right'];
    if (al) al.rotation.x = -1.2;
    if (ar) ar.rotation.x = aimArm ? -1.55 : -1.2;
  };
  return r;
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
