// TURBO PEDALI 3D — tappa in linea in 3D con modelli Kenney (CC0) e Three.js (MIT).
// + / − cambiano corsia, lo SPRINT (watt sopra soglia) usa l'oggetto, la scia dà +12%.
// Le salite della tappa arrivano al rullo come pendenza reale.

import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';
import { hudText, Effort, clamp, lerp, pick, hash } from './engine.js';
import { SONGS } from './audio.js';
import { t, fmtDec, ordinal } from '../i18n.js';
const you = () => t('games.racer.you'); // il giocatore è riconosciuto dal nome interno 'TU'
const first = (n) => (n === 'TU' ? you() : n.split(' ')[0]);
const who = (n) => (n === 'TU' ? you() : n);
import { rider } from './kit3d.js';

const STEP = 2;            // campionamento della strada (m)
const ROAD_W = 8.4;
const LANES = [-2.6, 0, 2.6];
const WORLD_SCALE = 1.25;  // il mondo scorre un po' più veloce della bici
const VIS_GRADE = 1.5;     // le salite si vedono un po' più ripide
const ASSETS = 'assets/3d';

const STAGES = [
  {
    name: 'games.racer.stage1.name', desc: 'games.racer.stage1.desc',
    sky: ['#f6c177', '#f08a5d', '#7b3f7a'], fog: '#e7a477', grass: '#7fae55', grass2: '#6a9a47', far: 'sea',
    scenery: { tree_palmTall: 5, tree_palmBend: 4, tree_palmShort: 3, plant_bushLarge: 3, plant_bush: 3, rock_largeA: 2, flower_redA: 2, flower_yellowA: 2, grass_large: 3 },
    layout: [[200, 0, 0], [250, 14, 1], [200, 0, 3], [300, -18, 0], [250, 8, -2], [200, 0, 4], [300, 20, 0], [250, -10, -2], [300, 0, 2], [250, -16, 0], [200, 0, 0]],
  },
  {
    name: 'games.racer.stage2.name', desc: 'games.racer.stage2.desc',
    sky: ['#cfe6ff', '#8fbef0', '#4d7fc4'], fog: '#c9dcf0', grass: '#5f9a4a', grass2: '#4f8540', far: 'mountains',
    scenery: { tree_pineTallA: 6, tree_pineTallB: 5, tree_pineRoundA: 3, tree_pineDefaultA: 4, rock_largeC: 3, rock_largeE: 2, rock_smallA: 2, stone_tallA: 1, grass_leafsLarge: 2 },
    layout: [[200, 0, 0], [300, 10, 4], [250, -16, 5], [300, 14, 6], [200, 0, 3], [250, -12, 5], [300, 18, 6], [200, 0, 2], [300, -14, -4], [250, 10, -3], [200, 0, 0]],
  },
  {
    name: 'games.racer.stage3.name', desc: 'games.racer.stage3.desc',
    sky: ['#ffe2b8', '#f2b880', '#c56b52'], fog: '#efc9a0', grass: '#a3b05a', grass2: '#8f9c4c', far: 'hills',
    scenery: { tree_oak_fall: 5, tree_default_fall: 5, tree_tall_fall: 4, tree_oak: 2, tree_fat: 2, plant_bushDetailed: 3, rock_largeA: 1, log: 1, flower_purpleA: 2, grass_large: 2 },
    layout: [[200, 0, 0], [250, -12, 3], [250, 16, -3], [200, 0, 4], [300, -20, -2], [250, 12, 3], [250, 0, -3], [300, 16, 5], [250, -14, -4], [250, 8, 2], [200, 0, 0]],
  },
];

const RIVALS = [
  { name: 'games.racer.rival1.name', color: '#2a9d8f', model: 'b', skill: 1.02, line: 'games.racer.rival1.line' },
  { name: 'games.racer.rival2.name', color: '#ff4d9d', model: 'c', skill: 1.05, line: 'games.racer.rival2.line' },
  { name: 'games.racer.rival3.name', color: '#7b2cbf', model: 'd', skill: 1.04, line: 'games.racer.rival3.line' },
  { name: 'games.racer.rival4.name', color: '#e63946', model: 'e', skill: 0.98, line: 'games.racer.rival4.line' },
  { name: 'games.racer.rival5.name', color: '#ffd166', model: 'f', skill: 1.0, line: 'games.racer.rival5.line' },
  { name: 'games.racer.rival6.name', color: '#3a86ff', model: 'g', skill: 0.95, line: 'games.racer.rival6.line' },
  { name: 'games.racer.rival7.name', color: '#f77f00', model: 'h', skill: 0.97, line: 'games.racer.rival7.line' },
];

const ITEMS = {
  gel: { name: 'games.racer.item.gel', color: '#ffd166' },
  wind: { name: 'games.racer.item.wind', color: '#06d6a0' },
  shield: { name: 'games.racer.item.shield', color: '#4de3ff' },
};

const loader = new GLTFLoader();
const cache = new Map();
function loadModel(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(path));
  return cache.get(path);
}

export class Racer3D {
  constructor(hudCanvas, hooks, audio) {
    this.hud = hudCanvas; this.hooks = hooks; this.audio = audio;
    this.active = false;
    this.stageIndex = Number(localStorage.getItem('racer3dStage')) || 0;
    this.loop = this.loop.bind(this);
    this.onResize = () => this.resize();
  }

  // ---------- ciclo di vita ----------
  async start() {
    this.active = true;
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.className = 'game-gl';
    this.hud.parentElement.insertBefore(this.glCanvas, this.hud);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.glCanvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.hctx = this.hud.getContext('2d');
    window.addEventListener('resize', this.onResize);
    this.effort = new Effort();
    this.texts = []; this.t = 0; this.state = 'loading'; this.power = 0; this.cadence = 0;
    this.resize();
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    this.audio.playSong(SONGS.menu);
    try {
      await this.loadAssets();
      await this.buildStage();
      this.state = 'select'; this.selT = 0;
    } catch (err) {
      this.state = 'error'; this.error = err.message;
    }
  }

  stop() {
    this.active = false;
    window.removeEventListener('resize', this.onResize);
    this.audio.stopSong();
    this.hooks.setGrade(null);
    this.renderer?.dispose();
    this.glCanvas?.remove();
    this.hctx?.clearRect(0, 0, this.hud.width, this.hud.height);
  }

  resize() {
    const r = this.hud.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.hud.width = Math.round(r.width * dpr); this.hud.height = Math.round(r.height * dpr);
    this.hctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer?.setSize(r.width, r.height, false);
    if (this.camera) { this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
  }

  async loadAssets() {
    const names = new Set(['overhead', 'overheadLights', 'grandStandCovered', 'tent', 'flagCheckers', 'flagRed', 'barrierRed', 'barrierWhite', 'billboard']);
    this.models = {};
    const natureNames = new Set(STAGES.flatMap((s) => Object.keys(s.scenery)));
    const jobs = [];
    for (const n of names) jobs.push(loadModel(`${ASSETS}/racing/${n}.gltf`).then((g) => { this.models[n] = g; }));
    for (const n of natureNames) jobs.push(loadModel(`${ASSETS}/nature/${n}.glb`).then((g) => { this.models[n] = g; }));
    jobs.push(loadModel(`${ASSETS}/pickups/coin-gold.glb`).then((g) => { this.models.coin = g; }));
    this.chars = {};
    for (const c of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) jobs.push(loadModel(`${ASSETS}/characters/character-${c}.glb`).then((g) => { this.chars[c] = g; }));
    let done = 0;
    jobs.forEach((j) => j.then(() => { done++; this.loadPct = done / jobs.length; }));
    await Promise.all(jobs);
  }

  // ---------- costruzione della tappa ----------
  async buildStage() {
    const S = STAGES[this.stageIndex];
    this.S = S;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = skyTexture(S.sky);
    scene.fog = new THREE.Fog(S.fog, 60, 420);
    this.camera = new THREE.PerspectiveCamera(62, this.W / this.H, 0.1, 900);

    const hemi = new THREE.HemisphereLight('#fff4e0', S.grass2, 1.6);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    scene.add(sun); scene.add(sun.target);
    this.sun = sun;

    this.buildPath(S);
    this.buildRoad(S);
    this.buildTerrain(S);
    this.buildScenery(S);
    this.buildLandmarks();
    this.buildRiders();
    this.buildPickups();
  }

  buildPath(S) {
    const pts = []; let h = 0; let x = 0; let z = 0; let y = 0; let s = 0;
    let prevTurn = 0; let prevGrade = 0;
    for (const [len, turn, grade] of S.layout) {
      const n = Math.round(len / STEP);
      for (let i = 0; i < n; i++) {
        const k = Math.min(1, i / Math.min(40, n / 2));
        const tr = lerp(prevTurn, turn, k); const gr = lerp(prevGrade, grade, k);
        pts.push({ x, y, z, h, grade: gr, s });
        h += (tr * Math.PI / 180) * (STEP / 100);
        x += Math.sin(h) * STEP; z += Math.cos(h) * STEP;
        y += (gr / 100) * STEP * VIS_GRADE;
        s += STEP;
      }
      prevTurn = turn; prevGrade = grade;
    }
    this.pts = pts;
    this.length = s - STEP;
    this.minY = Math.min(...pts.map((p) => p.y)); this.maxY = Math.max(...pts.map((p) => p.y));
    // traguardo volante a metà, GPM nel punto più alto
    let top = 0; pts.forEach((p, i) => { if (p.y > pts[top].y) top = i; });
    if (top < pts.length * 0.2 || top > pts.length * 0.9) top = Math.floor(pts.length * 0.7);
    this.lines = [{ type: 'green', s: Math.round(this.length * 0.4) }, { type: 'kom', s: pts[top].s }];
  }

  // posizione sulla strada: s = metri dalla partenza, off = spostamento laterale (+ destra)
  at(s, off = 0) {
    const f = clamp(s / STEP, 0, this.pts.length - 1.001);
    const i = Math.floor(f); const k = f - i;
    const a = this.pts[i]; const b = this.pts[i + 1];
    const h = lerp(a.h, b.h, k);
    const rx = -Math.cos(h); const rz = Math.sin(h);
    return {
      x: lerp(a.x, b.x, k) + rx * off, y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) + rz * off,
      h, grade: lerp(a.grade, b.grade, k),
    };
  }

  buildRoad(S) {
    const n = this.pts.length;
    const pos = new Float32Array(n * 2 * 3); const uv = new Float32Array(n * 2 * 2); const idx = [];
    const curb = new Float32Array(n * 4 * 3); const cuv = new Float32Array(n * 4 * 2); const cidx = [];
    this.pts.forEach((p, i) => {
      const rx = -Math.cos(p.h); const rz = Math.sin(p.h); const hw = ROAD_W / 2;
      pos.set([p.x - rx * hw, p.y + 0.03, p.z - rz * hw, p.x + rx * hw, p.y + 0.03, p.z + rz * hw], i * 6);
      uv.set([0, p.s / 10, 1, p.s / 10], i * 4);
      // cordoli: 0.7 m su ciascun lato
      const c = [hw, hw + 0.7];
      curb.set([p.x - rx * c[1], p.y + 0.05, p.z - rz * c[1], p.x - rx * c[0], p.y + 0.05, p.z - rz * c[0],
        p.x + rx * c[0], p.y + 0.05, p.z + rz * c[0], p.x + rx * c[1], p.y + 0.05, p.z + rz * c[1]], i * 12);
      cuv.set([0, p.s / 3, 1, p.s / 3, 0, p.s / 3, 1, p.s / 3], i * 8);
      if (i < n - 1) {
        const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        const q = i * 4; cidx.push(q, q + 4, q + 1, q + 1, q + 4, q + 5, q + 2, q + 6, q + 3, q + 3, q + 6, q + 7);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: roadTexture(), side: THREE.DoubleSide }));
    road.receiveShadow = true;
    this.scene.add(road);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(curb, 3)); cg.setAttribute('uv', new THREE.BufferAttribute(cuv, 2));
    cg.setIndex(cidx); cg.computeVertexNormals();
    const curbs = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ map: curbTexture(), side: THREE.DoubleSide }));
    curbs.receiveShadow = true;
    this.scene.add(curbs);
  }

  // colline low-poly ai lati della strada
  terrainY(s, off) {
    const p = this.at(s);
    const d = Math.abs(off);
    if (d < ROAD_W / 2 + 1.2) return p.y - 0.05;
    const side = off > 0 ? 1 : -1;
    const n = Math.sin(s * 0.013 + side * 1.7) * 0.6 + Math.sin(s * 0.031 + d * 0.07 + side) * 0.4;
    const rise = (d - ROAD_W / 2) * (this.S.far === 'mountains' ? 0.35 : 0.16);
    return p.y - 0.2 + Math.max(-2, n * rise * 0.9 + rise * 0.25);
  }

  buildTerrain(S) {
    const cols = [-110, -70, -45, -28, -16, -9, -5.6, 5.6, 9, 16, 28, 45, 70, 110];
    const step = 4; const rows = Math.ceil(this.length / step) + 1;
    const pos = []; const col = []; const idx = [];
    const c1 = new THREE.Color(S.grass); const c2 = new THREE.Color(S.grass2);
    for (let r = 0; r < rows; r++) {
      const s = Math.min(this.length, r * step);
      for (const off of cols) {
        const p = this.at(s, off);
        pos.push(p.x, this.terrainY(s, off), p.z);
        const c = (hash(r * 31 + off) > 0.5 ? c1 : c2);
        col.push(c.r, c.g, c.b);
      }
    }
    const nc = cols.length;
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < nc - 1; c++) {
      if (c === 6) continue; // sotto la strada
      const a = r * nc + c; const b = a + nc;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const g2 = geo.toNonIndexed(); g2.computeVertexNormals();
    const mesh = new THREE.Mesh(g2, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    // sfondo lontano
    const cx = (Math.min(...this.pts.map((p) => p.x)) + Math.max(...this.pts.map((p) => p.x))) / 2;
    const cz = (Math.min(...this.pts.map((p) => p.z)) + Math.max(...this.pts.map((p) => p.z))) / 2;
    if (S.far === 'sea') {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: '#3d6fa6' }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(cx, this.minY - 2.5, cz);
      this.scene.add(sea);
    } else {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: S.grass2 }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(cx, this.minY - 6, cz);
      this.scene.add(ground);
      // montagne o colline in lontananza
      const mat = new THREE.MeshLambertMaterial({ color: S.far === 'mountains' ? '#7d8fa8' : '#b07a52', flatShading: true });
      const snow = new THREE.MeshLambertMaterial({ color: '#f4f8ff', flatShading: true });
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + hash(i) * 0.2; const dist = 520 + hash(i + 5) * 160;
        const hgt = (S.far === 'mountains' ? 120 : 45) + hash(i + 9) * (S.far === 'mountains' ? 140 : 40);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(hgt * 1.1, hgt, 6), mat);
        cone.position.set(cx + Math.cos(a) * dist, this.minY - 6 + hgt / 2, cz + Math.sin(a) * dist);
        this.scene.add(cone);
        if (S.far === 'mountains' && hgt > 170) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(hgt * 0.36, hgt * 0.33, 6), snow);
          cap.position.copy(cone.position); cap.position.y += hgt * 0.34;
          this.scene.add(cap);
        }
      }
    }
  }

  // alberi e cespugli con InstancedMesh (pochi draw call anche con centinaia di oggetti)
  buildScenery(S) {
    const weights = Object.entries(S.scenery);
    const total = weights.reduce((a, [, w]) => a + w, 0);
    const placements = {};
    for (let s = 6; s < this.length; s += 7) {
      for (const side of [-1, 1]) {
        const r = hash(s * 1.3 + side * 7);
        if (r < 0.25) continue;
        let k = hash(s * 2.1 + side) * total; let name = weights[0][0];
        for (const [n, w] of weights) { if ((k -= w) < 0) { name = n; break; } }
        const small = /flower|grass|rock_small|bush/.test(name);
        const off = side * (ROAD_W / 2 + (small ? 1.6 : 3.5) + hash(s + side * 3) * (small ? 6 : 34));
        const scale = (small ? 3 : 4.5) + hash(s * 3 + side) * (small ? 2 : 3.5);
        (placements[name] = placements[name] || []).push({ s, off, scale, rot: hash(s * 5 + side) * Math.PI * 2 });
      }
    }
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
    for (const [name, list] of Object.entries(placements)) {
      const gltf = this.models[name]; if (!gltf) continue;
      const mats = list.map((pl) => {
        const p = this.at(pl.s, pl.off);
        q.setFromAxisAngle(up, pl.rot);
        return new THREE.Matrix4().compose(new THREE.Vector3(p.x, this.terrainY(pl.s, pl.off), p.z), q, new THREE.Vector3(pl.scale, pl.scale, pl.scale));
      });
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const inst = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
        mats.forEach((mm, i) => { m.multiplyMatrices(mm, o.matrixWorld); inst.setMatrixAt(i, m); });
        inst.castShadow = false; inst.receiveShadow = true;
        this.scene.add(inst);
      });
    }
  }

  place(name, s, off, scale, rotExtra = 0) {
    const g = this.models[name]; if (!g) return null;
    const o = g.scene.clone(true);
    const p = this.at(s, off);
    o.position.set(p.x, p.y, p.z);
    o.rotation.y = p.h + rotExtra;
    o.scale.setScalar(scale);
    o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.scene.add(o);
    return o;
  }

  buildLandmarks() {
    const arch = (s, lights) => {
      this.place(lights ? 'overheadLights' : 'overhead', s, 0.3, 7.6);
    };
    arch(30, true);
    arch(this.length - 4, false);
    for (const ln of this.lines) arch(ln.s, false);
    // striscioni colorati sugli archi
    const banner = (s, text, color) => {
      const p = this.at(s);
      const tex = labelTexture(text, color);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.1), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      plane.position.set(p.x, p.y + 4.3, p.z);
      plane.rotation.y = p.h + Math.PI; // rivolto verso chi arriva
      this.scene.add(plane);
      // pali dell'arco
      const postMat = new THREE.MeshLambertMaterial({ color: '#e8e8e8' });
      for (const side of [-1, 1]) {
        const q = this.at(s, side * (ROAD_W / 2 + 0.5));
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.9, 0.35), postMat);
        post.position.set(q.x, q.y + 2.45, q.z); post.rotation.y = p.h; post.castShadow = true;
        this.scene.add(post);
      }
    };
    banner(30, t('games.racer.start'), '#1b1b1b');
    banner(this.length - 4, t('games.racer.finish'), '#d62839');
    for (const ln of this.lines) banner(ln.s, ln.type === 'kom' ? t('games.racer.komBanner') : t('games.racer.sprintBanner'), ln.type === 'kom' ? '#d62839' : '#2a9d3a');
    // tribune, tende e bandiere all'arrivo e alla partenza
    for (const s of [this.length - 30, this.length - 60, 20]) {
      this.place('grandStandCovered', s, -(ROAD_W / 2 + 2.2), 7, Math.PI / 2);
      this.place('grandStandCovered', s + 14, ROAD_W / 2 + 2.2, 7, -Math.PI / 2);
    }
    for (const s of [this.length - 90, 40]) { this.place('tent', s, -(ROAD_W / 2 + 6), 5); this.place('tent', s, ROAD_W / 2 + 6, 5); }
    for (let s = this.length - 120; s < this.length; s += 10) { this.place('barrierRed', s, -(ROAD_W / 2 + 0.8), 9, Math.PI / 2); this.place('barrierWhite', s, ROAD_W / 2 + 0.8, 9, Math.PI / 2); }
    for (const ln of this.lines) for (let k = -20; k <= 20; k += 10) { this.place('flagRed', ln.s + k, -(ROAD_W / 2 + 1.5), 3.5); this.place('flagCheckers', ln.s + k + 5, ROAD_W / 2 + 1.5, 3.5); }
    // tifosi animati vicino a GPM e arrivo
    this.fans = [];
    const spots = [...this.lines.map((l) => l.s), this.length - 20];
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    spots.forEach((s0, k) => {
      for (let i = 0; i < 7; i++) {
        const side = i % 2 ? 1 : -1;
        const s = s0 - 30 + i * 9;
        const fan = this.makeCharacter(ids[(i + k * 3) % ids.length], 1.75);
        const p = this.at(s, side * (ROAD_W / 2 + 2 + hash(i + k) * 2.5));
        fan.root.position.set(p.x, this.terrainY(s, side * 7), p.z);
        fan.root.rotation.y = p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        fan.play(i % 3 === 0 ? 'emote-yes' : i % 3 === 1 ? 'interact-right' : 'idle');
        this.fans.push(fan);
      }
    });
  }

  makeCharacter(id, height) {
    const src = this.chars[id];
    const root = src.scene.clone(true);
    root.traverse((c) => { if (c.isMesh) { c.castShadow = true; } });
    // scala alla statura desiderata
    const box = new THREE.Box3().setFromObject(root);
    const h = box.max.y - box.min.y || 1;
    root.scale.setScalar(height / h);
    const wrap = new THREE.Group(); wrap.add(root);
    this.scene.add(wrap);
    const mixer = new THREE.AnimationMixer(root);
    const nodes = {}; root.traverse((c) => { if (c.name) nodes[c.name] = c; });
    const play = (name) => {
      const clip = src.animations.find((a) => a.name === name);
      if (clip) mixer.clipAction(clip).reset().play();
    };
    return { root: wrap, inner: root, mixer, nodes, play, scale: height / h };
  }

  // bici low-poly costruita al volo
  makeBike(color) {
    const g = new THREE.Group();
    const frameMat = new THREE.MeshLambertMaterial({ color });
    const dark = new THREE.MeshLambertMaterial({ color: '#1d1d22' });
    const metal = new THREE.MeshLambertMaterial({ color: '#c9ced6' });
    const wheelGeo = new THREE.TorusGeometry(0.34, 0.04, 8, 28);
    const wheels = [];
    for (const z of [-0.52, 0.52]) {
      const w = new THREE.Group();
      const tyre = new THREE.Mesh(wheelGeo, dark); tyre.rotation.y = Math.PI / 2; w.add(tyre);
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.64, 0.012), metal); sp.rotation.x = (k * Math.PI) / 3; w.add(sp);
      }
      w.position.set(0, 0.34, z); g.add(w); wheels.push(w);
    }
    const tube = (a, b, r, mat = frameMat) => {
      const va = new THREE.Vector3(...a); const vb = new THREE.Vector3(...b);
      const len = va.distanceTo(vb);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      g.add(m);
    };
    const rear = [0, 0.34, -0.52]; const front = [0, 0.34, 0.52]; const bb = [0, 0.32, -0.02]; const seat = [0, 0.86, -0.24]; const head = [0, 0.84, 0.4];
    tube(rear, bb, 0.022); tube(rear, seat, 0.018); tube(bb, seat, 0.03); tube(bb, head, 0.032); tube(seat, head, 0.028);
    tube(head, front, 0.022, metal); tube(head, [0, 0.98, 0.38], 0.02, metal);
    tube([-0.2, 0.98, 0.4], [0.2, 0.98, 0.4], 0.016, dark);
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.26), dark); saddle.position.set(0, 0.9, -0.26); g.add(saddle);
    const crank = new THREE.Group(); crank.position.set(0, 0.32, -0.02);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), metal); arm.rotation.z = Math.PI / 2; crank.add(arm);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 16), metal); ring.rotation.y = Math.PI / 2; crank.add(ring);
    g.add(crank);
    g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
    return { group: g, wheels, crank };
  }

  makeRider(charId, color) {
    // ciclista condiviso con gli altri giochi: gambe che seguono i pedali, mani sul manubrio
    return rider(this.scene, this.chars[charId], color);
  }

  buildRiders() {
    this.playerRider = this.makeRider('a', '#d9ff3d');
    // indicatore sopra il giocatore
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 4), new THREE.MeshBasicMaterial({ color: '#d9ff3d' }));
    marker.rotation.x = Math.PI; marker.position.set(0, 2.45, -0.1);
    this.playerRider.root.add(marker); this.marker = marker;
    this.rivalRiders = RIVALS.map((r) => this.makeRider(r.model, r.color));
  }

  buildPickups() {
    this.coins = []; this.boxes = [];
    // moneta Kenney (Platformer Kit, CC0)
    const cb = new THREE.Box3().setFromObject(this.models.coin.scene); const coinScale = 0.7 / ((cb.max.y - cb.min.y) || 1);
    for (let s = 140; s < this.length - 150; s += 170) {
      const lane = Math.floor(hash(s) * 3);
      for (let k = 0; k < 5; k++) {
        const ss = s + k * 4; const p = this.at(ss, LANES[lane]);
        const m = this.models.coin.scene.clone(true); m.scale.setScalar(coinScale);
        m.position.set(p.x, p.y + 0.75, p.z); m.rotation.y = k * 0.6;
        this.scene.add(m); this.coins.push({ s: ss, lane, mesh: m, taken: false });
      }
    }
    const boxMat = new THREE.MeshLambertMaterial({ map: questionTexture(), emissive: '#332200' });
    const boxGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    for (let s = 320; s < this.length - 200; s += 520) {
      for (let lane = 0; lane < 3; lane++) {
        const p = this.at(s, LANES[lane]);
        const m = new THREE.Mesh(boxGeo, boxMat); m.position.set(p.x, p.y + 1.1, p.z); m.castShadow = true;
        this.scene.add(m); this.boxes.push({ s, lane, mesh: m, takenAt: -99 });
      }
    }
  }

  // ---------- gara ----------
  newRace() {
    this.s = 0; this.x = 0; this.lane = 1; this.speed = 0; this.raceT = 0;
    this.item = null; this.boost = 0; this.boostKind = null; this.shield = false; this.bumpT = 0;
    this.draft = 0; this.coinsTaken = 0; this.sprintHeld = 0; this.finished = false; this.lean = 0;
    this.points = { green: {}, kom: {} }; this.lineCount = {}; this.draftAcc = 0;
    this.rivals = RIVALS.map((r, i) => ({ ...r, name: t(r.name), line: t(r.line), i, s: 3 + (6 - i) * 2.2, x: LANES[i % 3], targetX: LANES[i % 3], speed: 0, finished: null, boost: 0, slow: 0, said: 0, phase: Math.random() * 6 }));
    for (const c of this.coins) { c.taken = false; c.mesh.visible = true; }
    for (const b of this.boxes) b.takenAt = -99;
    this.state = 'countdown'; this.stateT = 0; this.lastBeep = 4;
    this.sentGrade = null;
    this.audio.playSong(SONGS.race);
  }

  input(dir) {
    this.audio.ensure();
    if (this.state === 'select') {
      if (dir < 0) { this.stageIndex = (this.stageIndex + 1) % STAGES.length; this.audio.sfx('select'); this.rebuild(); }
      else if (this.selT > 0.4) { localStorage.setItem('racer3dStage', this.stageIndex); this.audio.sfx('pickup'); this.newRace(); }
      return;
    }
    if (this.state === 'results') {
      if (this.stateT < 1.5) return;
      if (dir > 0) this.newRace(); else { this.state = 'select'; this.selT = 0; this.audio.playSong(SONGS.menu); }
      return;
    }
    if (this.state !== 'race') return;
    const prev = this.lane;
    this.lane = clamp(this.lane + dir, 0, 2);
    if (prev !== this.lane) { this.audio.sfx('select'); this.lean = dir; }
  }

  async rebuild() {
    this.state = 'loading';
    await this.buildStage();
    this.state = 'select'; this.selT = 0;
  }

  prog(stat, n = 1, xp = 0) { this.hooks.progress?.event(stat, n, xp); }
  say(text, color = '#ffd34d', t = 1.6, big = false) { this.texts.push({ text, color, t, big }); }

  update(dt) {
    this.t += dt; this.selT = (this.selT || 0) + dt;
    const connected = this.hooks.connected();
    const st = this.hooks.stats();
    const demoSprint = !connected && (this.t % 18) > 14;
    this.power = connected ? st.power || 0 : demoSprint ? 300 : 170;
    this.cadence = connected ? st.cadence || 0 : 88;
    const kmh = connected ? this.hooks.speedKmh() : 30;
    this.sprinting = this.effort.update(this.power, dt, connected ? 50 : 0);
    if (this.audio.song) this.audio.setTempo(this.audio.song.bpm * clamp((this.cadence || 85) / 88, 0.85, 1.2));
    this.texts.forEach((x) => { x.t -= dt; }); this.texts = this.texts.filter((x) => x.t > 0);
    if (this.state === 'loading' || this.state === 'error' || this.state === 'select') return;
    this.stateT += dt;
    this.lean *= Math.pow(0.03, dt);
    if (this.state === 'countdown') {
      const left = 3 - Math.floor(this.stateT);
      if (left !== this.lastBeep && left > 0) { this.lastBeep = left; this.audio.sfx('beep'); }
      if (this.stateT >= 3) { this.state = 'race'; this.stateT = 0; this.audio.sfx('go'); this.say(t('games.racer.go'), '#06d6a0', 1, true); }
      return;
    }
    if (this.state === 'results') return;

    let v = (kmh / 3.6) * WORLD_SCALE;
    let mult = 1 + Math.min(10, this.coinsTaken) * 0.01;
    if (this.draft > 0.99) mult += 0.12;
    if (this.boost > 0) { this.boost -= dt; mult += this.boostKind === 'gel' ? 0.4 : 0.25; if (this.boost <= 0) this.boostKind = null; }
    if (this.bumpT > 0) { this.bumpT -= dt; mult *= 0.6; }
    v *= mult; this.speed = v;
    this.x = lerp(this.x, LANES[this.lane], Math.min(1, dt * 6));
    this.raceT += dt;
    const prevS = this.s;
    this.s = Math.min(this.length, this.s + v * dt);
    this.checkLines('TU', prevS, this.s);
    if (this.draft >= 1) { this.draftAcc += dt; if (this.draftAcc >= 1) { this.draftAcc -= 1; this.prog('draftSec', 1, 1); } }
    if (this.s >= this.length - 0.01) { this.finish(); return; }

    const p = this.at(this.s);
    this.grade = clamp(p.grade, -4, 6);
    const g = Math.round(this.grade * 2) / 2;
    if (g !== this.sentGrade) { this.sentGrade = g; this.hooks.setGrade(g); }

    if (this.sprinting) this.sprintHeld += dt; else this.sprintHeld = Math.max(0, this.sprintHeld - dt * 2);
    if (this.item && this.sprintHeld >= 1.2) { this.useItem(); this.sprintHeld = 0; }

    this.updateRivals(dt, v);
    this.pickups();
  }

  // testo che sale dal corridore: conferma subito cosa hai preso
  pop(text, color, t = 0.8) { (this.pops = this.pops || []).push({ text, color, t, t0: t, s: this.s, x: this.x }); }

  pickups() {
    for (const c of this.coins) {
      if (c.taken || Math.abs(c.s - this.s) > 0.9 || Math.abs(LANES[c.lane] - this.x) > 1) continue;
      c.taken = true; c.mesh.visible = false; this.coinsTaken++; this.pop('+1', '#ffcc33');
      this.audio.sfx('coin'); this.prog('coins', 1, 1);
      if (this.coinsTaken === 10) this.say(t('games.racer.coins10'), '#ffcc33', 2);
    }
    for (const b of this.boxes) {
      if (this.t - b.takenAt < 8 || Math.abs(b.s - this.s) > 0.9 || Math.abs(LANES[b.lane] - this.x) > 1) continue;
      b.takenAt = this.t;
      if (!this.item) {
        const place = this.place();
        const pool = place <= 2 ? ['shield', 'gel'] : place <= 5 ? ['gel', 'shield', 'wind'] : ['gel', 'wind', 'wind'];
        this.item = pick(pool); this.audio.sfx('pickup'); this.pop(t(ITEMS[this.item].name), ITEMS[this.item].color, 1.2);
        this.say(t('games.racer.useItem', { name: t(ITEMS[this.item].name) }), ITEMS[this.item].color, 2.2);
      }
    }
  }

  useItem() {
    const it = this.item; this.item = null;
    this.audio.sfx('overdrive'); this.prog('itemsUsed', 1, 10);
    if (it === 'gel') { this.boost = 4; this.boostKind = 'gel'; this.audio.sfx('boost'); }
    if (it === 'wind') { this.boost = 7; this.boostKind = 'wind'; this.audio.sfx('boost'); }
    if (it === 'shield') this.shield = true;
    this.say(`${t(ITEMS[it].name)}!`, ITEMS[it].color, 1.4, true);
  }

  bump(text) {
    if (this.shield) { this.shield = false; this.say(t('games.racer.shield'), '#4de3ff', 1); this.audio.sfx('clank'); return; }
    if (this.bumpT > 0) return;
    this.bumpT = 1; this.audio.sfx('hurt'); this.say(text, '#ff6b6b', 1);
    if (navigator.vibrate) navigator.vibrate(60);
  }

  checkLines(name, from, to) {
    for (const ln of this.lines) {
      if (!(from < ln.s && to >= ln.s)) continue;
      const n = this.lineCount[ln.type] || 0; this.lineCount[ln.type] = n + 1;
      if (n > 2) continue;
      const pts = [5, 3, 1][n];
      this.points[ln.type][name] = (this.points[ln.type][name] || 0) + pts;
      if (name === 'TU') {
        this.audio.sfx(n === 0 ? 'win' : 'coin');
        this.say(t(ln.type === 'kom' ? 'games.racer.komSay' : 'games.racer.sprintSay', { place: ordinal(n + 1), pts }), ln.type === 'kom' ? '#ff5a6a' : '#3ccf6a', 2.2, n === 0);
      }
    }
  }

  leader(type) {
    const e = Object.entries(this.points?.[type] || {}).sort((a, b) => b[1] - a[1])[0];
    return e ? { name: e[0], pts: e[1] } : null;
  }

  updateRivals(dt, playerV) {
    const avgV = Math.max(4, ((this.effort.avg || 150) / 160) * 8.3 * WORLD_SCALE);
    let drafting = false;
    for (const r of this.rivals) {
      if (r.finished != null) continue;
      const gap = r.s - this.s;
      const band = clamp(1 - gap / 220, 0.82, 1.18);
      const climb = 1 - Math.max(0, this.at(r.s).grade) * (r.name === 'Lia Leggera' ? 0.01 : 0.03);
      let target = avgV * r.skill * band * climb * (1 + Math.sin(this.t * 0.3 + r.phase) * 0.04);
      if (this.s > this.length * 0.85) target *= 1.06;
      if (r.boost > 0) { r.boost -= dt; target *= 1.3; }
      if (r.slow > 0) { r.slow -= dt; target *= 0.6; }
      r.speed = lerp(r.speed, target, Math.min(1, dt * 0.8));
      const prev = r.s;
      r.s = Math.min(this.length, r.s + r.speed * dt);
      this.checkLines(r.name, prev, r.s);
      if (r.s >= this.length) r.finished = this.raceT;
      if (Math.random() < dt * 0.22) r.targetX = pick(LANES);
      if (Math.random() < dt * 0.03) r.boost = 2.5;
      r.x = lerp(r.x, r.targetX, Math.min(1, dt * 1.6));
      const same = Math.abs(r.x - this.x) < 1.1;
      if (same && gap > 1.6 && gap < 12) drafting = true;
      if (same && gap > -0.3 && gap < 1.5 && playerV > r.speed) { this.bump(t('games.racer.crash')); r.boost = 0.6; }
      if (gap < -1 && gap > -4 && r.said < this.t - 25 && Math.random() < dt * 2) { r.said = this.t; this.say(`${r.name}: "${r.line}"`, r.color, 2.2); }
    }
    this.draft = clamp(this.draft + (drafting ? dt / 1.2 : -dt * 2), 0, 1);
    if (this.draft >= 1 && !this.draftShown) { this.draftShown = true; this.say(t('games.racer.draft'), '#4de3ff', 1); this.audio.sfx('boost'); }
    if (this.draft < 0.5) this.draftShown = false;
    this.standing = this.ranking();
  }

  ranking() {
    const list = [{ name: 'TU', me: true, d: this.s, fin: this.finished ? this.finishT : null, color: '#d9ff3d' }];
    for (const r of this.rivals || []) list.push({ name: r.name, color: r.color, d: r.s, fin: r.finished });
    list.sort((a, b) => {
      if (a.fin != null && b.fin != null) return a.fin - b.fin;
      if (a.fin != null) return -1; if (b.fin != null) return 1;
      return b.d - a.d;
    });
    return list;
  }

  place() { return (this.standing || this.ranking()).findIndex((x) => x.me) + 1; }

  finish() {
    this.finished = true; this.finishT = this.raceT;
    this.standing = this.ranking();
    const place = this.place();
    this.state = 'results'; this.stateT = 0;
    this.audio.stopSong(); this.audio.sfx(place <= 3 ? 'win' : 'lose');
    const key = `racer3dBest${this.stageIndex}`;
    const best = Number(localStorage.getItem(key)) || Infinity;
    this.newBest = this.raceT < best;
    if (this.newBest) localStorage.setItem(key, this.raceT.toFixed(1));
    this.prog('races', 1, 60 + ([100, 70, 50][place - 1] || 0));
    if (place <= 3) this.prog('podiums', 1, 0);
    if (place === 1) { this.prog('wins', 1, 0); this.hooks.progress?.addToList('tracksWon', this.stageIndex); }
    if (this.leader('green')?.name === 'TU') { this.prog('green', 1, 80); this.prog('jerseys', 1, 0); }
    if (this.leader('kom')?.name === 'TU') { this.prog('kom', 1, 80); this.prog('jerseys', 1, 0); }
    this.hooks.setGrade(0);
    for (const f of this.rivalRiders) { /* restano dove sono */ }
  }

  // ---------- disegno ----------
  poseRider(r, s, x, phaseSpeed, dt, lean = 0) {
    const p = this.at(s, x);
    r.root.position.set(p.x, p.y, p.z);
    r.root.rotation.set(0, p.h, 0);
    r.root.rotateZ(-lean * 0.12);
    r.root.rotateX(-Math.atan(p.grade / 100 * VIS_GRADE));
    r.pose(dt, (phaseSpeed * 60) / (Math.PI * 2));
    for (const w of r.bike.wheels) w.rotation.x -= (this.speed || 6) * dt / 0.34 * 0.22;
  }

  draw(dt) {
    if (!this.scene) return;
    const sel = this.state === 'select' || this.state === 'loading';
    // corridori
    const cadPhase = ((this.cadence || 80) / 60) * Math.PI * 2;
    if (!sel && this.state !== 'error') {
      this.poseRider(this.playerRider, this.s, this.x, cadPhase, dt, this.lean);
      this.rivals.forEach((r, i) => this.poseRider(this.rivalRiders[i], r.s, r.x, (r.speed / 8) * 9, dt, 0));
    } else {
      this.poseRider(this.playerRider, 2, 0, 9, dt);
      this.rivalRiders.forEach((r, i) => this.poseRider(r, 6 + i * 3, LANES[i % 3], 9, dt));
    }
    for (const f of this.fans) f.mixer.update(dt);
    for (const c of this.coins) if (c.mesh.visible) c.mesh.rotation.y += dt * 3;
    for (const b of this.boxes) { b.mesh.visible = this.t - b.takenAt > 8; b.mesh.rotation.y += dt * 1.5; b.mesh.position.y += Math.sin(this.t * 3 + b.s) * 0.003; }
    // telecamera
    const cam = this.camera;
    let focusS = this.s || 0; let off = this.x || 0;
    if (sel) { focusS = (this.t * 14) % Math.max(1, this.length - 60); off = 0; }
    const p = this.at(focusS, off * 0.6);
    if (this.marker) this.marker.position.y = 2.45 + Math.sin(this.t * 4) * 0.08;
    const back = this.at(Math.max(-10, focusS - 8.5), off * 0.6);
    const ahead = this.at(Math.min(this.length, focusS + 14), off * 0.3);
    const target = new THREE.Vector3(back.x, back.y + 3.6, back.z);
    if (!this.camInit) { cam.position.copy(target); this.camInit = true; }
    cam.position.lerp(target, Math.min(1, dt * 4));
    cam.lookAt(ahead.x, ahead.y + 1.1, ahead.z);
    cam.fov = 62 + (this.boost > 0 ? 8 : 0) + (this.draft >= 1 ? 3 : 0);
    cam.updateProjectionMatrix();
    // il sole segue il giocatore (ombre nitide vicino)
    this.sun.position.set(p.x + 25, p.y + 45, p.z - 15);
    this.sun.target.position.set(p.x, p.y, p.z);
    this.renderer.render(this.scene, cam);
  }

  drawHud(dt) {
    const ctx = this.hctx; const W = this.W; const H = this.H;
    ctx.clearRect(0, 0, W, H);
    if (this.pops?.length && this.camera) {
      const v3 = new THREE.Vector3();
      for (const q of this.pops) {
        q.t -= dt; const k = 1 - q.t / q.t0; const p = this.at(q.s, q.x);
        v3.set(p.x, p.y + 2.2 + k * 1.6, p.z).project(this.camera);
        ctx.globalAlpha = Math.max(0, Math.min(1, (q.t / q.t0) * 2));
        hudText(ctx, q.text, (v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H, { size: 18, align: 'center', color: q.color });
        ctx.globalAlpha = 1;
      }
      this.pops = this.pops.filter((q) => q.t > 0);
    }
    if (this.state === 'loading') {
      ctx.fillStyle = '#0f0e0c'; if (!this.scene) ctx.fillRect(0, 0, W, H);
      hudText(ctx, t('games.common.loading'), W / 2, H / 2, { size: 22, align: 'center', color: '#d9ff3d' });
      hudText(ctx, `${Math.round((this.loadPct || 0) * 100)}%`, W / 2, H / 2 + 28, { size: 14, align: 'center' });
      return;
    }
    if (this.state === 'error') { hudText(ctx, t('ui.error', { error: this.error }), W / 2, H / 2, { size: 14, align: 'center', color: '#ff6b6b' }); return; }
    if (this.state === 'select') return this.drawSelect(ctx, W, H);
    const top = 56; const place = this.place();
    hudText(ctx, ordinal(place), 14, top + 44, { size: 48, color: place <= 3 ? '#d9ff3d' : '#fff' });
    hudText(ctx, '/8', 14 + (place >= 10 ? 66 : 46), top + 44, { size: 18, color: '#e8e8e8' });
    const left = Math.max(0, this.length - this.s);
    hudText(ctx, `${fmtDec(left / 1000 / WORLD_SCALE, 2)} km`, W - 14, top + 22, { size: 18, align: 'right' });
    hudText(ctx, fmt(this.raceT || 0), W - 14, top + 42, { size: 14, align: 'right', color: '#e8e8e8' });
    hudText(ctx, `${Math.round((this.speed / WORLD_SCALE) * 3.6)} km/h · ${Math.round(this.power)} W · ${fmtDec(this.grade || 0, 1)}%`, W - 14, top + 60, { size: 12, align: 'right', color: '#e8e8e8' });
    hudText(ctx, `● ${this.coinsTaken || 0}`, 14, top + 66, { size: 14, color: '#ffcc33' });
    // oggetto
    const iy = top + 80;
    ctx.fillStyle = 'rgba(10,10,8,.6)'; ctx.fillRect(14, iy, 176, 46);
    if (this.item) {
      const it = ITEMS[this.item];
      hudText(ctx, t(it.name), 22, iy + 16, { size: 13, color: it.color });
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(22, iy + 22, 160, 7);
      ctx.fillStyle = this.sprinting ? '#d9ff3d' : '#888'; ctx.fillRect(22, iy + 22, 160 * clamp(this.sprintHeld / 1.2, 0, 1), 7);
      hudText(ctx, t('games.racer.sprintAbove', { w: this.effort.threshold }), 22, iy + 41, { size: 10, color: '#e8e8e8' });
    } else hudText(ctx, t('games.racer.grabCube'), 22, iy + 28, { size: 11, color: '#bbb' });
    if (this.draft > 0.05) {
      ctx.fillStyle = 'rgba(10,10,8,.6)'; ctx.fillRect(W - 134, iy, 120, 16);
      ctx.fillStyle = this.draft >= 1 ? '#4de3ff' : '#2a6f97'; ctx.fillRect(W - 134, iy, 120 * this.draft, 16);
      hudText(ctx, this.draft >= 1 ? t('games.racer.inDraft') : t('games.racer.drafting'), W - 74, iy + 12, { size: 11, align: 'center' });
    }
    const gr = this.leader('green'); const km = this.leader('kom');
    hudText(ctx, t('games.racer.jerseys', { green: gr ? `${first(gr.name)} ${gr.pts}` : '-', dots: km ? `${first(km.name)} ${km.pts}` : '-' }), W - 14, iy + 34, { size: 11, align: 'right', color: '#e8e8e8' });
    // classifica
    (this.standing || this.ranking()).forEach((r, i) => hudText(ctx, `${i + 1}. ${r.me ? you() : r.name}`, 14, H - 196 + i * 15, { size: 11, color: r.me ? '#d9ff3d' : '#f2f2f2' }));
    this.drawProfile(ctx, W, H);
    let ty = H * 0.3;
    for (const x of this.texts) {
      ctx.globalAlpha = Math.min(1, x.t * 3);
      hudText(ctx, x.text, W / 2, ty, { size: x.big ? 28 : 14, color: x.color, align: 'center' }); ty += x.big ? 34 : 20;
      ctx.globalAlpha = 1;
    }
    if (this.state === 'countdown') {
      const n = 3 - Math.floor(this.stateT);
      const cx = W / 2; const cy = H * 0.24;
      ctx.fillStyle = '#111'; ctx.fillRect(cx - 60, cy - 20, 120, 40);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < 4 - n ? '#ff3b3b' : '#330000'; ctx.beginPath(); ctx.arc(cx - 36 + i * 36, cy, 13, 0, Math.PI * 2); ctx.fill(); }
      hudText(ctx, String(n), W / 2, H * 0.42, { size: 70, align: 'center', color: '#d9ff3d' });
    }
    if (!this.hooks.connected()) hudText(ctx, t('games.common.demo'), W - 14, H - 64, { size: 11, align: 'right', color: '#ffd34d' });
    if (this.state === 'results') this.drawResults(ctx, W, H);
    this.hooks.progress?.drawToasts(ctx, W, dt);
  }

  // profilo altimetrico della tappa con le posizioni
  drawProfile(ctx, W, H) {
    const x0 = 14; const x1 = W - 14; const y1 = H - 14; const h = 38;
    ctx.fillStyle = 'rgba(10,10,8,.55)'; ctx.fillRect(x0 - 6, y1 - h - 8, x1 - x0 + 12, h + 14);
    const range = Math.max(10, this.maxY - this.minY);
    const X = (s) => x0 + (s / this.length) * (x1 - x0);
    const Y = (y) => y1 - ((y - this.minY) / range) * h;
    ctx.beginPath(); ctx.moveTo(x0, y1);
    for (let i = 0; i < this.pts.length; i += 6) ctx.lineTo(X(this.pts[i].s), Y(this.pts[i].y));
    ctx.lineTo(x1, y1); ctx.closePath();
    ctx.fillStyle = 'rgba(217,255,61,.22)'; ctx.fill();
    ctx.fillStyle = 'rgba(217,255,61,.55)'; ctx.fillRect(x0, y1 - h, X(this.s || 0) - x0, 2);
    for (const ln of this.lines) { ctx.fillStyle = ln.type === 'kom' ? '#ff5a6a' : '#3ccf6a'; ctx.fillRect(X(ln.s) - 1, y1 - h - 4, 2, h + 4); }
    for (const r of this.rivals || []) { ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(X(r.s), Y(this.at(r.s).y), 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#d9ff3d'; ctx.beginPath(); ctx.arc(X(this.s || 0), Y(this.at(this.s || 0).y), 5, 0, Math.PI * 2); ctx.fill();
  }

  drawSelect(ctx, W, H) {
    const S = STAGES[this.stageIndex];
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.45); g.addColorStop(0, 'rgba(8,8,6,.85)'); g.addColorStop(1, 'rgba(8,8,6,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.45);
    const g2 = ctx.createLinearGradient(0, H * 0.6, 0, H); g2.addColorStop(0, 'rgba(8,8,6,0)'); g2.addColorStop(1, 'rgba(8,8,6,.9)');
    ctx.fillStyle = g2; ctx.fillRect(0, H * 0.6, W, H * 0.4);
    hudText(ctx, t('games.racer.hud.title'), W / 2, 100, { size: 34, align: 'center', color: '#d9ff3d' });
    hudText(ctx, t('games.racer.hud.tagline'), W / 2, 124, { size: 12, align: 'center', color: '#f2f2f2' });
    hudText(ctx, t('games.racer.stage', { i: this.stageIndex + 1, n: STAGES.length }), W / 2, 168, { size: 13, align: 'center', color: '#d9ff3d' });
    hudText(ctx, t(S.name), W / 2, 194, { size: 22, align: 'center' });
    hudText(ctx, t(S.desc), W / 2, 216, { size: 13, align: 'center', color: '#f2f2f2' });
    hudText(ctx, t('games.racer.length', { km: fmtDec(this.length / 1000 / WORLD_SCALE, 1), m: Math.round((this.maxY - this.minY) / VIS_GRADE) }), W / 2, 236, { size: 12, align: 'center', color: '#f2f2f2' });
    const best = Number(localStorage.getItem(`racer3dBest${this.stageIndex}`));
    if (best) hudText(ctx, t('games.racer.best', { time: fmt(best) }), W / 2, 256, { size: 12, align: 'center', color: '#f2f2f2' });
    this.drawProfile(ctx, W, H - 90);
    hudText(ctx, t('games.racer.menuKeys'), W / 2, H - 40, { size: 15, align: 'center', color: '#d9ff3d' });
    this.hooks.progress?.drawToasts(ctx, W, 0.016);
  }

  drawResults(ctx, W, H) {
    ctx.fillStyle = 'rgba(8,8,6,.82)'; ctx.fillRect(0, 0, W, H);
    const place = this.place();
    hudText(ctx, place === 1 ? t('games.racer.victory') : place <= 3 ? t('games.racer.podium') : t('games.racer.finish'), W / 2, H * 0.14, { size: 36, align: 'center', color: place <= 3 ? '#d9ff3d' : '#fff' });
    hudText(ctx, `${ordinal(place)} · ${fmt(this.finishT)}${this.newBest ? t('games.common.newBest') : ''}`, W / 2, H * 0.14 + 30, { size: 15, align: 'center' });
    const base = H * 0.42; const top3 = this.standing.slice(0, 3); const order = [1, 0, 2]; const heights = [60, 84, 44];
    order.forEach((idx, k) => {
      const r = top3[idx]; if (!r) return;
      const x = W / 2 + (k - 1) * 92;
      ctx.fillStyle = ['#c0c0c0', '#d9ff3d', '#cd7f32'][idx]; ctx.fillRect(x - 40, base - heights[k] + 40, 80, heights[k]);
      hudText(ctx, String(idx + 1), x, base + 30, { size: 22, align: 'center', color: '#1b1b1b', stroke: 'transparent' });
      hudText(ctx, r.me ? you() : r.name.split(' ')[0], x, base - heights[k] + 30, { size: 13, align: 'center', color: r.me ? '#d9ff3d' : '#fff' });
    });
    const gr = this.leader('green'); const km = this.leader('kom');
    hudText(ctx, t('games.racer.jerseysEnd', { green: gr ? who(gr.name) : '-', dots: km ? who(km.name) : '-' }), W / 2, H * 0.53, { size: 12, align: 'center' });
    this.standing.forEach((r, i) => hudText(ctx, `${i + 1}. ${r.me ? you() : r.name}${r.fin != null ? '  ' + fmt(r.fin) : ''}`, W / 2, H * 0.57 + i * 19, { size: 13, align: 'center', color: r.me ? '#d9ff3d' : '#e8e8e8' }));
    if (this.stateT > 1.5) hudText(ctx, t('games.racer.endKeys'), W / 2, H * 0.92, { size: 15, align: 'center', color: '#d9ff3d' });
  }

  loop(now) {
    if (!this.active) return;
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.update(dt);
    if (this.state !== 'loading' || this.scene) this.draw(dt);
    this.drawHud(dt);
    requestAnimationFrame(this.loop);
  }
}

// ---------- texture disegnate al volo ----------
function skyTexture(colors) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, colors[2]); gr.addColorStop(0.55, colors[1]); gr.addColorStop(1, colors[0]);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function roadTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#4d4c52'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  g.fillStyle = '#f2f2f2'; g.fillRect(4, 0, 3, 128); g.fillRect(121, 0, 3, 128);
  g.fillRect(41, 0, 2, 64); g.fillRect(85, 0, 2, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function curbTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 16;
  const g = c.getContext('2d'); g.fillStyle = '#d62839'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#f4f4f4'; g.fillRect(0, 8, 8, 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelTexture(text, bg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#fff'; g.font = 'italic 800 40px "Barlow Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function questionTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#f4b41b'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#9a5a10'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58);
  g.fillStyle = '#fff'; g.font = '900 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function fmt(s) {
  if (!Number.isFinite(s)) return '--:--';
  const m = Math.floor(s / 60); const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
