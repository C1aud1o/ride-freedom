// TURBO PEDALI 3D — tappa in linea, gioco di riferimento per lo stile dei giochi 3D (docs/giochi-stile.md).
// La velocità viene dalla tua potenza/cadenza reale (marce virtuali dell'app); + / − cambiano marcia.
// La traiettoria è automatica: cerca la scia del corridore davanti e le monete. Le salite arrivano al rullo.
// Grafica: modelli Quaternius e Kenney (CC0), three.js (MIT).

import * as THREE from 'three';
import { Stage, Effects } from './kit3d.js';
import { loadAll } from './kit/loader.js';
import { skyDome, styleLights, styleFog, toonMaterial, TIMES } from './kit/style.js';
import { Cyclist, loadCyclistTemplate, makeKit, makeCrowdGeometry, CYCLIST_URL, FAN_URL } from './kit/cyclist.js';
import { scatterModel, crowdInstances, prepareModel } from './kit/env.js';
import { Shake, TimeScale, WindLines, Confetti } from './kit/juice.js';
import { Quality } from './kit/quality.js';
import { txt, panel, uiScale, powerColor, gradeColor, HUD } from './kit/hud.js';
import { Effort, clamp, lerp, pick, hash } from './engine.js';
import { SONGS } from './audio.js';
import { t, fmtDec, ordinal } from '../i18n.js';

const you = () => t('games.racer.you'); // il giocatore è riconosciuto dal nome interno 'TU'
// nome corto: la prima parola, saltando gli articoli ("Il Conte Catena" → "Conte")
const first = (n) => { if (n === 'TU') return you(); const w = n.split(' '); return (w[0].length <= 2 && w[1] ? w[1] : w[0]); };
const who = (n) => (n === 'TU' ? you() : n);

const STEP = 2;            // campionamento della strada (m)
const ROAD_W = 8.4;
const LANES = [-2.4, 0, 2.4];
const WORLD_SCALE = 1.25;  // il mondo scorre un po' più veloce della bici
const VIS_GRADE = 1.6;     // le salite si vedono un po' più ripide
const RUNOUT = 140;        // strada dopo l'arrivo (podio)
const START = 14;          // griglia di partenza: il giocatore parte qui, la camera ha spazio dietro
const Q = 'assets/3d/quaternius';
const K = 'assets/3d';

const MODELS = {
  qTree1: `${Q}/nature/tree1.glb`, qTree2: `${Q}/nature/tree2.glb`, qTree3: `${Q}/nature/tree3.glb`, qTree4: `${Q}/nature/tree4.glb`,
  qBush1: `${Q}/nature/bush1.glb`, qBush2: `${Q}/nature/bush2.glb`, qBush3: `${Q}/nature/bush3.glb`,
  qRock1: `${Q}/nature/rock1.glb`, qRock2: `${Q}/nature/rock2.glb`, qRock3: `${Q}/nature/rock3.glb`, qGrass: `${Q}/nature/grass2.glb`,
  house1: `${Q}/town/house.glb`, house2: `${Q}/town/house2.glb`, house3: `${Q}/town/house3.glb`, house4: `${Q}/town/house4.glb`, house5: `${Q}/town/house5.glb`, shop: `${Q}/town/shop.glb`,
  barn: `${Q}/farm/barn.glb`, smallBarn: `${Q}/farm/smallbarn.glb`, silo: `${Q}/farm/silo.glb`, windmill: `${Q}/farm/windmill.glb`, fence: `${Q}/farm/fence.glb`, waterTower: `${Q}/farm/watertower.glb`,
  palmTall: `${K}/nature/tree_palmTall.glb`, palmBend: `${K}/nature/tree_palmBend.glb`, palmShort: `${K}/nature/tree_palmShort.glb`,
  pineA: `${K}/nature/tree_pineTallA.glb`, pineB: `${K}/nature/tree_pineTallB.glb`, pineRound: `${K}/nature/tree_pineRoundA.glb`,
  oakFall: `${K}/nature/tree_oak_fall.glb`, defFall: `${K}/nature/tree_default_fall.glb`, tallFall: `${K}/nature/tree_tall_fall.glb`,
  overhead: `${K}/racing/overhead.gltf`, overheadLights: `${K}/racing/overheadLights.gltf`, grandStand: `${K}/racing/grandStandCovered.gltf`, tent: `${K}/racing/tent.gltf`,
  barrierRed: `${K}/racing/barrierRed.gltf`, barrierWhite: `${K}/racing/barrierWhite.gltf`, flagRed: `${K}/racing/flagRed.gltf`, flagCheckers: `${K}/racing/flagCheckers.gltf`,
  coin: `${K}/pickups/coin-gold.glb`,
};

// scenari: [modello, peso, tipo, altezza min, altezza max]
const STAGES = [
  {
    name: 'games.racer.stage1.name', desc: 'games.racer.stage1.desc', time: 'dusk',
    grass: '#9fb55a', grass2: '#86a04a', verge: '#d8c08a', far: 'sea', farCol: '#b0745a',
    scenery: [['palmTall', 5, 'tree', 7, 10], ['palmBend', 4, 'tree', 6, 9], ['palmShort', 3, 'tree', 3, 5], ['qBush1', 3, 'bush', 1, 1.8], ['qBush3', 3, 'bush', 1, 1.6], ['qRock1', 2, 'rock', 1, 2.4], ['qRock3', 2, 'rock', 0.8, 1.6], ['qGrass', 3, 'bush', 0.5, 0.9]],
    villages: [0.03, 0.4, 0.95], farms: [],
    layout: [[200, 0, 0], [250, 14, 1], [200, 0, 3], [300, -18, 0], [250, 8, -2], [200, 0, 4], [300, 20, 0], [250, -10, -2], [300, 0, 2], [250, -16, 0], [200, 0, 0]],
  },
  {
    name: 'games.racer.stage2.name', desc: 'games.racer.stage2.desc', time: 'morning',
    grass: '#6fa64e', grass2: '#5b9143', verge: '#9a8f78', far: 'mountains', farCol: '#7d8fa8',
    scenery: [['pineA', 6, 'tree', 8, 14], ['pineB', 5, 'tree', 7, 12], ['pineRound', 3, 'tree', 5, 8], ['qTree3', 2, 'tree', 6, 9], ['qRock1', 3, 'rock', 1.5, 4], ['qRock2', 3, 'rock', 1, 3], ['qBush2', 2, 'bush', 1, 1.6], ['qGrass', 3, 'bush', 0.5, 0.9]],
    villages: [0.03, 0.95], farms: [0.22, 0.6],
    layout: [[200, 0, 0], [300, 10, 4], [250, -16, 5], [300, 14, 6], [200, 0, 3], [250, -12, 5], [300, 18, 6], [200, 0, 2], [300, -14, -4], [250, 10, -3], [200, 0, 0]],
  },
  {
    name: 'games.racer.stage3.name', desc: 'games.racer.stage3.desc', time: 'golden',
    grass: '#a9b25e', grass2: '#94a050', verge: '#c9a77a', far: 'hills', farCol: '#b98a5c',
    scenery: [['oakFall', 4, 'tree', 6, 10], ['defFall', 4, 'tree', 5, 8], ['tallFall', 3, 'tree', 8, 12], ['qTree1', 3, 'tree', 6, 9], ['qTree2', 2, 'tree', 6, 10], ['qBush1', 3, 'bush', 1, 1.8], ['qBush2', 2, 'bush', 1, 1.8], ['qRock2', 1, 'rock', 1, 2], ['qGrass', 3, 'bush', 0.5, 0.9]],
    villages: [0.03, 0.55, 0.95], farms: [0.25, 0.75],
    layout: [[200, 0, 0], [250, -12, 3], [250, 16, -3], [200, 0, 4], [300, -20, -2], [250, 12, 3], [250, 0, -3], [300, 16, 5], [250, -14, -4], [250, 8, 2], [200, 0, 0]],
  },
];

const RIVALS = [
  { name: 'games.racer.rival1.name', color: '#2a9d8f', skill: 1.02, line: 'games.racer.rival1.line' },
  { name: 'games.racer.rival2.name', color: '#ff4d9d', skill: 1.05, line: 'games.racer.rival2.line' },
  { name: 'games.racer.rival3.name', color: '#7b2cbf', skill: 1.04, line: 'games.racer.rival3.line' },
  { name: 'games.racer.rival4.name', color: '#e63946', skill: 0.98, line: 'games.racer.rival4.line' },
  { name: 'games.racer.rival5.name', color: '#ffd166', skill: 1.0, line: 'games.racer.rival5.line', climber: true },
  { name: 'games.racer.rival6.name', color: '#3a86ff', skill: 0.95, line: 'games.racer.rival6.line' },
  { name: 'games.racer.rival7.name', color: '#f77f00', skill: 0.97, line: 'games.racer.rival7.line' },
];
const PLAYER_COLOR = '#d9ff3d';

const ITEMS = {
  gel: { name: 'games.racer.item.gel', color: '#ffd166' },
  wind: { name: 'games.racer.item.wind', color: '#06d6a0' },
  shield: { name: 'games.racer.item.shield', color: '#4de3ff' },
};

export class Racer3D {
  constructor(hudCanvas, hooks, audio) {
    this.hud = hudCanvas; this.hooks = hooks; this.audio = audio;
    this.active = false;
    this.stageIndex = Number(localStorage.getItem('racer3dStage')) || 0;
    this.loop = this.loop.bind(this);
  }

  // ---------- ciclo di vita ----------
  async start() {
    this.active = true;
    this.quality = new Quality();
    this.stage = new Stage(this.hud, { quality: this.quality });
    this.stage.onQuality = (cfg) => this.applyDensity(cfg);
    this.effort = new Effort();
    this.shake = new Shake(); this.time = new TimeScale();
    this.texts = []; this.pops = []; this.t = 0; this.state = 'loading'; this.power = 0; this.cadence = 0;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    this.audio.playSong(SONGS.menu);
    try {
      this.models = await loadAll(MODELS, (p) => { this.loadPct = p * 0.85; });
      this.tpl = await loadCyclistTemplate(CYCLIST_URL);
      this.crowdGeo = await makeCrowdGeometry(FAN_URL);
      this.loadPct = 1;
      if (!this.active) return;
      this.buildStage();
      this.state = 'select'; this.selT = 0;
    } catch (err) {
      console.error(err);
      this.state = 'error'; this.error = err.message;
    }
  }

  stop() {
    this.active = false;
    this.audio.stopSong();
    this.hooks.setGrade(null);
    this.disposeStage();
    this.stage?.dispose();
  }

  disposeStage() {
    if (!this.scene) return;
    this.scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  }

  get W() { return this.stage.W; }
  get H() { return this.stage.H; }

  // ---------- costruzione della tappa ----------
  buildStage() {
    this.disposeStage();
    const S = STAGES[this.stageIndex]; this.S = S;
    const scene = new THREE.Scene(); this.scene = scene; this.stage.scene = scene;
    // il passo di render del bagliore guarda la scena vecchia: si ricrea
    if (this.stage.composer) { this.stage.composer.passes[0].scene = scene; }
    this.camera = this.stage.camera; this.camera.fov = 60; this.camera.far = 900; this.camera.updateProjectionMatrix();
    this.camInit = false;
    const T = TIMES[S.time];
    scene.add(skyDome(S.time));
    styleFog(scene, S.time, 80, 520);
    this.light = styleLights(scene, S.time, { shadows: true, mapSize: this.quality.cfg.shadowMap, extent: 26 });
    this.effects = new Effects(scene, 60);
    this.wind = new WindLines(scene, 36);
    this.confetti = new Confetti(scene, 260);
    this.buildPath(S);
    this.buildRoad(S);
    this.buildTerrain(S, T);
    this.inst = [];
    this.buildScenery(S);
    this.buildTowns(S);
    this.buildLandmarks();
    this.buildCrowd();
    this.buildRiders();
    this.buildPickups();
    this.buildDraftZone();
    this.buildPodium();
    this.applyDensity(this.quality.cfg);
    this.positionIdle();
  }

  applyDensity(cfg) {
    // bagliore misurato: brillano luci e coriandoli, non le maglie chiare
    if (this.stage.bloom) { this.stage.bloom.threshold = 0.93; this.stage.bloom.strength = 0.45; this.stage.bloom.radius = 0.35; }
    if (this.stage.composer && this.scene) this.stage.composer.passes[0].scene = this.scene;
    if (!this.inst) return;
    for (const i of this.inst) { i.setDensity(i.isCrowd ? cfg.crowd : cfg.density); if (!i.isCrowd) i.setShadows?.(false); }
    this.light?.sun && (this.light.sun.castShadow = cfg.shadows);
    for (const r of this.riders || []) r.cy.setShadows(cfg.shadows);
  }

  buildPath(S) {
    const pts = []; let h = 0; let x = 0; let z = 0; let y = 0; let s = 0;
    let prevTurn = 0; let prevGrade = 0;
    const layout = [...S.layout, [RUNOUT + 40, 0, 0]];
    for (const [len, turn, grade] of layout) {
      const n = Math.round(len / STEP);
      for (let i = 0; i < n; i++) {
        const k = Math.min(1, i / Math.min(40, n / 2));
        const tr = lerp(prevTurn, turn, k); const gr = lerp(prevGrade, grade, k);
        pts.push({ x, y, z, h, grade: gr, s, turn: tr });
        h += (tr * Math.PI / 180) * (STEP / 100);
        x += Math.sin(h) * STEP; z += Math.cos(h) * STEP;
        y += (gr / 100) * STEP * VIS_GRADE;
        s += STEP;
      }
      prevTurn = turn; prevGrade = grade;
    }
    this.pts = pts;
    this.length = s - STEP - RUNOUT - 40; // l'arrivo; dopo c'è la strada del podio
    const race = pts.filter((p) => p.s <= this.length);
    this.minY = Math.min(...race.map((p) => p.y)); this.maxY = Math.max(...race.map((p) => p.y));
    let top = 0; race.forEach((p, i) => { if (p.y > race[top].y) top = i; });
    if (top < race.length * 0.2 || top > race.length * 0.9) top = Math.floor(race.length * 0.7);
    this.lines = [{ type: 'green', s: Math.round(this.length * 0.4) }, { type: 'kom', s: race[top].s }];
  }

  // posizione sulla strada: s = metri dalla partenza, off = spostamento laterale (+ destra)
  at(s, off = 0) {
    const f = clamp(s / STEP, 0, this.pts.length - 1.001);
    const i = Math.floor(f); const k = f - i;
    const a = this.pts[i]; const b = this.pts[i + 1];
    const h = lerp(a.h, b.h, k);
    const rx = -Math.cos(h); const rz = Math.sin(h);
    return { x: lerp(a.x, b.x, k) + rx * off, y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) + rz * off, h, grade: lerp(a.grade, b.grade, k), turn: lerp(a.turn, b.turn, k) };
  }

  buildRoad(S) {
    const n = this.pts.length;
    const pos = new Float32Array(n * 2 * 3); const uv = new Float32Array(n * 2 * 2); const idx = [];
    const curb = new Float32Array(n * 4 * 3); const cuv = new Float32Array(n * 4 * 2); const cidx = [];
    this.pts.forEach((p, i) => {
      const rx = -Math.cos(p.h); const rz = Math.sin(p.h); const hw = ROAD_W / 2;
      pos.set([p.x - rx * hw, p.y + 0.03, p.z - rz * hw, p.x + rx * hw, p.y + 0.03, p.z + rz * hw], i * 6);
      uv.set([0, p.s / 12, 1, p.s / 12], i * 4);
      const c = [hw, hw + 0.45];
      curb.set([p.x - rx * c[1], p.y + 0.06, p.z - rz * c[1], p.x - rx * c[0], p.y + 0.06, p.z - rz * c[0],
        p.x + rx * c[0], p.y + 0.06, p.z + rz * c[0], p.x + rx * c[1], p.y + 0.06, p.z + rz * c[1]], i * 12);
      cuv.set([0, p.s / 3, 1, p.s / 3, 0, p.s / 3, 1, p.s / 3], i * 8);
      if (i < n - 1) {
        const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        const q = i * 4; cidx.push(q, q + 4, q + 1, q + 1, q + 4, q + 5, q + 2, q + 6, q + 3, q + 3, q + 6, q + 7);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, toonMaterial({ map: roadTexture(), side: THREE.DoubleSide }));
    road.receiveShadow = true;
    this.scene.add(road);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(curb, 3)); cg.setAttribute('uv', new THREE.BufferAttribute(cuv, 2));
    cg.setIndex(cidx); cg.computeVertexNormals();
    const curbs = new THREE.Mesh(cg, toonMaterial({ map: curbTexture(), side: THREE.DoubleSide }));
    curbs.receiveShadow = true;
    this.scene.add(curbs);
    // scritte sull'asfalto: linea d'arrivo a scacchi
    const fin = this.at(this.length);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 1.4), toonMaterial({ map: checkerTexture() }));
    line.rotation.set(-Math.PI / 2, 0, fin.h + Math.PI); line.position.set(fin.x, fin.y + 0.05, fin.z); line.receiveShadow = true;
    this.scene.add(line);
  }

  // colline low-poly ai lati della strada
  terrainY(s, off) {
    const p = this.at(s);
    const d = Math.abs(off);
    if (d < ROAD_W / 2 + 1.4) return p.y - 0.05;
    const side = off > 0 ? 1 : -1;
    const n = Math.sin(s * 0.013 + side * 1.7) * 0.6 + Math.sin(s * 0.031 + d * 0.07 + side) * 0.4;
    const rise = (d - ROAD_W / 2) * (this.S.far === 'mountains' ? 0.35 : 0.16);
    return p.y - 0.2 + Math.max(-2, n * rise * 0.9 + rise * 0.25);
  }

  buildTerrain(S, T) {
    const cols = [-140, -90, -60, -40, -26, -16, -9.5, -6.2, 6.2, 9.5, 16, 26, 40, 60, 90, 140];
    const step = 4; const rows = Math.ceil(this.pts.at(-1).s / step) + 1;
    const pos = []; const col = []; const idx = [];
    const c1 = new THREE.Color(S.grass); const c2 = new THREE.Color(S.grass2); const cv = new THREE.Color(S.verge);
    for (let r = 0; r < rows; r++) {
      const s = r * step;
      for (const off of cols) {
        const p = this.at(s, off);
        pos.push(p.x, this.terrainY(s, off), p.z);
        const c = Math.abs(off) < 7 ? cv : (hash(r * 31 + off) > 0.5 ? c1 : c2);
        col.push(c.r, c.g, c.b);
      }
    }
    const nc = cols.length; const mid = cols.findIndex((c) => c > 0) - 1;
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < nc - 1; c++) {
      if (c === mid) continue; // sotto la strada
      const a = r * nc + c; const b = a + nc;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const g2 = geo.toNonIndexed(); g2.computeVertexNormals();
    const mesh = new THREE.Mesh(g2, toonMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    // sfondo lontano: mare o pianura + montagne/colline in un'unica mesh
    const xs = this.pts.map((p) => p.x); const zs = this.pts.map((p) => p.z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2; const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), toonMaterial({ color: S.far === 'sea' ? '#3f78ad' : S.grass2 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, this.minY - (S.far === 'sea' ? 3 : 7), cz);
    this.scene.add(ground);
    const peaks = []; const cMain = new THREE.Color(S.farCol); const cSnow = new THREE.Color('#f4f8ff');
    const paint = (g, c) => { g = g.toNonIndexed(); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
    const big = S.far === 'mountains'; const n = S.far === 'sea' ? 14 : 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + hash(i) * 0.2; const dist = 560 + hash(i + 5) * 180;
      if (S.far === 'sea' && Math.sin(a) > -0.2) continue; // mare da un lato, promontori dall'altro
      const hgt = (big ? 130 : 50) + hash(i + 9) * (big ? 150 : 45);
      const cone = new THREE.ConeGeometry(hgt * 1.15, hgt, 7); cone.translate(cx + Math.cos(a) * dist, this.minY - 7 + hgt / 2, cz + Math.sin(a) * dist);
      peaks.push(paint(cone, cMain.clone().offsetHSL(0, 0, (hash(i + 2) - 0.5) * 0.08)));
      if (big && hgt > 180) {
        const cap = new THREE.ConeGeometry(hgt * 0.4, hgt * 0.36, 7); cap.translate(cx + Math.cos(a) * dist, this.minY - 7 + hgt * 0.83, cz + Math.sin(a) * dist);
        peaks.push(paint(cap, cSnow));
      }
    }
    if (peaks.length) {
      const g = mergeGeometriesSafe(peaks); g.computeVertexNormals();
      this.scene.add(new THREE.Mesh(g, toonMaterial({ vertexColors: true, fog: true })));
    }
  }

  // vegetazione con istanze e LOD
  buildScenery(S) {
    const total = S.scenery.reduce((a, x) => a + x[1], 0);
    const per = {};
    const near = (s) => S.villages.some((v) => Math.abs(s - v * this.length) < 110) || S.farms.some((v) => Math.abs(s - v * this.length) < 70);
    for (let s = 6; s < this.pts.at(-1).s; s += 6) {
      for (const side of [-1, 1]) {
        const r = hash(s * 1.3 + side * 7);
        if (r < 0.2) continue;
        let k = hash(s * 2.1 + side) * total; let pickE = S.scenery[0];
        for (const e of S.scenery) { if ((k -= e[1]) < 0) { pickE = e; break; } }
        const [name, , kind, h0, h1] = pickE;
        const small = kind !== 'tree';
        if (!small && near(s)) continue;
        const off = side * (ROAD_W / 2 + (small ? 1.8 : 4.5) + hash(s + side * 3) * (small ? 8 : 44));
        const p = this.at(s, off);
        (per[name] = per[name] || { kind, list: [] }).list.push({ x: p.x, y: this.terrainY(s, off) - 0.1, z: p.z, rot: hash(s * 5 + side) * Math.PI * 2, h: h0 + hash(s * 3 + side) * (h1 - h0), d: s });
      }
    }
    for (const [name, { kind, list }] of Object.entries(per)) {
      const gl = this.models[name]; if (!gl) continue;
      this.inst.push(scatterModel(this.scene, gl, list, { kind, lod: kind === 'tree', lodDist: 200, window: [-30, 560] }));
    }
  }

  // paesi (case ai lati) e fattorie
  buildTowns(S) {
    const houses = ['house1', 'house2', 'house3', 'house4', 'house5', 'shop'];
    const per = {};
    const put = (name, s, off, h, face = 0) => {
      const p = this.at(s, off);
      (per[name] = per[name] || []).push({ x: p.x, y: this.terrainY(s, off) - 0.15, z: p.z, rot: p.h + (off > 0 ? -Math.PI / 2 : Math.PI / 2) + face, h, d: s, always: true });
    };
    for (const v of S.villages) {
      const c = v * this.length;
      for (let s = c - 100; s < c + 100; s += 15) for (const side of [-1, 1]) {
        if (hash(s * 0.7 + side) < 0.18) continue;
        const name = houses[Math.floor(hash(s + side * 11) * houses.length)];
        put(name, s, side * (ROAD_W / 2 + 9 + hash(s * 3 + side) * 4), name === 'shop' ? 6 : 7 + hash(s) * 3);
        if (hash(s * 1.9 + side) > 0.5) put(houses[Math.floor(hash(s * 4 + side) * 5)], s + 6, side * (ROAD_W / 2 + 25 + hash(s * 5) * 10), 8);
      }
    }
    for (const f of S.farms) {
      const c = f * this.length; const side = hash(c) > 0.5 ? 1 : -1;
      put('barn', c, side * 34, 9, 0); put('silo', c + 16, side * 42, 15, 0); put('smallBarn', c - 18, side * 30, 6, 0);
      put(hash(c * 2) > 0.5 ? 'windmill' : 'waterTower', c + 40, -side * 46, 16, 0);
      // staccionata lungo la strada
      for (let s = c - 70; s < c + 70; s += 4.2) put('fence', s, side * (ROAD_W / 2 + 4), 1.1, Math.PI / 2);
    }
    for (const [name, list] of Object.entries(per)) {
      const gl = this.models[name]; if (!gl) continue;
      this.inst.push(scatterModel(this.scene, gl, list, { kind: 'house', lod: false, window: [-40, 600] }));
    }
  }

  place(name, s, off, scale, rotExtra = 0) {
    const g = this.models[name]; if (!g) return null;
    const o = g.scene.clone(true);
    const p = this.at(s, off);
    o.position.set(p.x, p.y, p.z);
    o.rotation.y = p.h + rotExtra;
    o.scale.setScalar(scale);
    o.traverse((c) => { if (c.isMesh) { c.castShadow = false; c.receiveShadow = true; } });
    this.scene.add(o);
    return o;
  }

  buildLandmarks() {
    const banner = (s, text, color, fg = '#fff') => {
      const p = this.at(s);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 1.2, 1.3), toonMaterial({ map: labelTexture(text, color, fg), side: THREE.DoubleSide, emissive: '#222222' }));
      plane.position.set(p.x, p.y + 4.6, p.z); plane.rotation.y = p.h + Math.PI;
      plane.material.side = THREE.FrontSide;
      // retro: la stessa scritta leggibile anche da dopo la linea
      const backP = plane.clone(); backP.rotation.y = p.h; backP.position.set(p.x + Math.sin(p.h) * 0.02, p.y + 4.6, p.z + Math.cos(p.h) * 0.02);
      this.scene.add(plane, backP);
      for (const side of [-1, 1]) {
        const q = this.at(s, side * (ROAD_W / 2 + 0.7));
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.3, 0.4), toonMaterial({ color }));
        post.position.set(q.x, q.y + 2.65, q.z); post.rotation.y = p.h;
        this.scene.add(post);
      }
    };
    this.place('overheadLights', START + 16, 0.3, 7.6);
    banner(START + 16, t('games.racer.start'), '#1b1b1b');
    banner(this.length, t('games.racer.finish'), '#d62839');
    for (const ln of this.lines) banner(ln.s, ln.type === 'kom' ? t('games.racer.komBanner') : t('games.racer.sprintBanner'), ln.type === 'kom' ? '#d62839' : '#2a9d3a');
    // ultimi 500 m: striscione rosso ("triangolo rosso") e cartello dei 200 m
    this.lastK = this.length - 500;
    banner(this.lastK, t('games.racer.last500'), '#c81d25');
    // tribune, tende, bandiere
    for (const s of [this.length - 40, this.length + 30]) {
      this.place('grandStand', s, -(ROAD_W / 2 + 6), 7, Math.PI / 2);
      this.place('grandStand', s + 12, ROAD_W / 2 + 6, 7, -Math.PI / 2);
    }
    this.place('tent', 50, -(ROAD_W / 2 + 7), 5); this.place('tent', 50, ROAD_W / 2 + 7, 5);
    // transenne (istanze): ultimi 250 m, partenza e intorno ai traguardi
    const bars = { barrierRed: [], barrierWhite: [], flagRed: [], flagCheckers: [] };
    const bar = (s, side) => { const p = this.at(s, side * (ROAD_W / 2 + 1.2)); bars[side < 0 ? 'barrierRed' : 'barrierWhite'].push({ x: p.x, y: p.y, z: p.z, rot: p.h + Math.PI / 2, h: 1.05, d: s, always: true }); };
    for (let s = this.length - 260; s < this.length + 90; s += 2.6) { bar(s, -1); bar(s, 1); }
    for (let s = 0; s < 70; s += 2.6) { bar(s, -1); bar(s, 1); }
    for (const ln of this.lines) for (let k = -24; k <= 24; k += 8) {
      const a = this.at(ln.s + k, -(ROAD_W / 2 + 1.6)); const b = this.at(ln.s + k + 4, ROAD_W / 2 + 1.6);
      bars.flagRed.push({ x: a.x, y: a.y, z: a.z, rot: a.h, h: 3.2, d: ln.s + k, always: true });
      bars.flagCheckers.push({ x: b.x, y: b.y, z: b.z, rot: b.h, h: 3.2, d: ln.s + k, always: true });
    }
    for (const [name, list] of Object.entries(bars)) this.inst.push(scatterModel(this.scene, this.models[name], list, { kind: 'prop', lod: false, window: [-30, 420] }));
    // cartelli della pendenza all'inizio delle salite
    let prev = 0;
    for (const p of this.pts) {
      if (p.s > this.length) break;
      if (p.grade >= 3 && prev < 3 && p.s > 60) this.sign(p.s, `${Math.round(p.grade * 2) / 2}%`.replace('.', ','), '#ffd34d', '#1b1b1b');
      prev = p.grade;
    }
  }

  sign(s, text, bg, fg) {
    const p = this.at(s, ROAD_W / 2 + 1.6);
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ map: labelTexture(text, bg, fg, 256, 154, '900 96px "Roboto Condensed", "Arial Narrow", sans-serif'), side: THREE.DoubleSide }));
    board.position.y = 2.1; g.add(board);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), toonMaterial({ color: '#cfd3da' })); post.position.y = 0.9; g.add(post);
    g.position.set(p.x, p.y, p.z); g.rotation.y = p.h + Math.PI - 0.35;
    this.scene.add(g);
  }

  // pubblico: in salita (pendenza ≥ 3%) vicino alla strada, folto all'arrivo e ai traguardi
  buildCrowd() {
    const list = []; const cols = ['#e63946', '#ffd166', '#3a86ff', '#06d6a0', '#ff4d9d', '#f77f00', '#ffffff', '#7b2cbf', '#d9ff3d', '#118ab2'];
    const add = (s, off) => {
      const p = this.at(s, off);
      list.push({ x: p.x, y: this.terrainY(s, off) - 0.05, z: p.z, rot: p.h + (off > 0 ? -Math.PI / 2 : Math.PI / 2) + (hash(s * 9 + off) - 0.5) * 0.6, scale: 0.92 + hash(s + off) * 0.16, d: s, color: cols[Math.floor(hash(s * 3.3 + off) * cols.length)] });
    };
    this.climbs = [];
    for (const p of this.pts) {
      if (p.s > this.length) break;
      if (p.grade < 3) continue;
      this.climbs.push(p.s);
      for (const side of [-1, 1]) {
        if (hash(p.s * 0.37 + side) < 0.25) continue;
        add(p.s + hash(p.s + side) * 1.5, side * (ROAD_W / 2 + 0.9 + hash(p.s * 7 + side) * 1.4));
        if (hash(p.s * 0.91 + side) > 0.55) add(p.s + 1, side * (ROAD_W / 2 + 2.6 + hash(p.s * 5 + side) * 1.6));
      }
    }
    const busy = [...this.lines.map((l) => l.s), this.length];
    for (const c of busy) for (let s = c - 70; s < c + 25; s += 1.3) for (const side of [-1, 1]) {
      if (hash(s * 1.7 + side) < 0.2) continue;
      add(s, side * (ROAD_W / 2 + 2.1 + hash(s * 2 + side) * 1.3));
    }
    for (let s = 2; s < 60; s += 1.6) for (const side of [-1, 1]) add(s, side * (ROAD_W / 2 + 2.1 + hash(s + side) * 1.2));
    this.crowd = crowdInstances(this.scene, this.crowdGeo, list, { shadows: false });
    this.crowd.isCrowd = true;
    this.inst.push(this.crowd);
  }

  buildRiders() {
    const mk = (color, i, name) => new Cyclist(this.tpl, makeKit(color, i), { shadows: this.quality.cfg.shadows, name });
    this.player = mk(PLAYER_COLOR, 0, 'TU');
    this.scene.add(this.player.root);
    // freccia sopra il giocatore
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), new THREE.MeshBasicMaterial({ color: PLAYER_COLOR }));
    marker.rotation.x = Math.PI; marker.position.set(0, 2.15, -0.1); this.player.root.add(marker); this.marker = marker;
    this.rivalRiders = RIVALS.map((r, i) => { const c = mk(r.color, i + 1, t(r.name)); this.scene.add(c.root); return c; });
    this.riders = [{ cy: this.player }, ...this.rivalRiders.map((cy) => ({ cy }))];
  }

  buildPickups() {
    this.coins = []; this.boxes = [];
    for (let s = 140; s < this.length - 150; s += 170) {
      const lane = Math.floor(hash(s) * 3);
      for (let k = 0; k < 5; k++) this.coins.push({ s: s + k * 4, lane, taken: false });
    }
    const info = prepareModel(this.models.coin);
    const cs = 0.7 / info.height;
    this.coinMeshes = info.parts.map((pt) => { const m = new THREE.InstancedMesh(pt.geo, toonMaterial(pt.mat === 'vc' ? { vertexColors: true, emissive: '#3a2a00' } : { map: pt.mat, emissive: '#3a2a00' }), this.coins.length); m.count = 0; m.frustumCulled = false; m.castShadow = false; this.scene.add(m); return m; });
    this.coinScale = cs;
    for (let s = 320; s < this.length - 200; s += 520) for (let lane = 0; lane < 3; lane++) this.boxes.push({ s, lane, takenAt: -99 });
    this.boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), toonMaterial({ map: questionTexture(), emissive: '#3a2600' }), this.boxes.length);
    this.boxMesh.count = 0; this.boxMesh.frustumCulled = false; this.scene.add(this.boxMesh);
  }

  // la "scia" visibile: un cuneo chiaro sull'asfalto dietro al corridore che ti precede
  buildDraftZone() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(14, 0); g.lineTo(50, 0); g.lineTo(64, 256); g.lineTo(0, 256); g.closePath(); g.fill();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1.6, 11); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -5.9);
    this.draftZone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: '#4de3ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.draftZone.renderOrder = 3;
    this.scene.add(this.draftZone);
  }

  // podio dopo l'arrivo, sulla strada
  buildPodium() {
    const s = this.length + 70; const p = this.at(s);
    const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.rotation.y = p.h + Math.PI; // rivolto verso chi arriva
    const blocks = [[0, 1.2, '#d9ff3d', '1'], [-1.5, 0.85, '#d6dae2', '2'], [1.5, 0.6, '#d9a066', '3']];
    this.podiumSpots = blocks.map(([x, h, col, n]) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.45, h, 1.3), toonMaterial({ color: col }));
      box.position.set(x, h / 2, 0); box.castShadow = true; box.receiveShadow = true; g.add(box);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: labelTexture(n, null, '#15141b', 128, 128, '900 110px "Roboto Condensed", Arial, sans-serif'), transparent: true }));
      num.position.set(x, h * 0.5, 0.66); g.add(num);
      return { x, h };
    });
    // pannello di sfondo con lo striscione
    const back = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.4), toonMaterial({ map: podiumBackTexture(t('games.racer.hud.title')), side: THREE.DoubleSide }));
    back.position.set(0, 2.2, -1.4); g.add(back);
    // luce frontale per la premiazione (si accende solo sul podio)
    const key = new THREE.DirectionalLight('#fff3dc', 1.6); key.position.set(1.5, 4, 8); key.target.position.set(0, 1.2, 0); g.add(key, key.target); key.visible = false;
    this.podiumLight = key;
    this.scene.add(g);
    this.podium = g;
  }

  positionIdle() {
    // anteprima in menu: gruppo fermo alla partenza
    this.s = 0; this.x = 0;
    this.poseAll(0);
  }

  // ---------- gara ----------
  newRace() {
    this.s = START; this.x = 0; this.lane = 1; this.speed = 0; this.raceT = 0;
    this.item = null; this.boost = 0; this.boostKind = null; this.shield = false; this.bumpT = 0;
    this.draft = 0; this.coinsTaken = 0; this.sprintHeld = 0; this.finished = false; this.lean = 0;
    this.points = { green: {}, kom: {} }; this.lineCount = {}; this.draftAcc = 0; this.passed = 0; this.prevPlace = 8;
    this.rivals = RIVALS.map((r, i) => ({ ...r, name: t(r.name), line: t(r.line), i, s: START - 3 + (6 - i) * 1.7, x: LANES[i % 3], targetX: LANES[i % 3], speed: 0, finished: null, boost: 0, slow: 0, said: 0, phase: Math.random() * 6 }));
    for (const c of this.coins) c.taken = false;
    for (const b of this.boxes) b.takenAt = -99;
    for (const r of this.riders) { r.cy.sitDown(); r.cy.root.visible = true; }
    this.marker.visible = true; this.podiumLight.visible = false;
    this.state = 'countdown'; this.stateT = 0; this.lastBeep = 4; this.hooks.runStart?.();
    this.sentGrade = null; this.cheerT = 0; this.lastKSaid = false; this.camMode = 'chase'; this.camInit = false;
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
      if (this.stateT < 2) return;
      if (dir > 0) this.newRace(); else { this.state = 'select'; this.selT = 0; this.audio.playSong(SONGS.menu); this.positionIdle(); }
      return;
    }
    if (this.state !== 'race' && this.state !== 'countdown') return;
    // + / − restano il cambio: marce virtuali dell'app
    this.hooks.shift?.(dir);
    this.audio.sfx(dir > 0 ? 'shiftUp' : 'shiftDown');
    this.gearFlash = 1.2;
  }

  hold() {}

  rebuild() {
    this.state = 'loading';
    this.buildStage();
    this.state = 'select'; this.selT = 0;
  }

  prog(stat, n = 1, xp = 0) { this.hooks.progress?.event(stat, n, xp); }
  say(text, color = '#ffd34d', dur = 1.6, big = false) { this.texts.push({ text, color, t: dur, t0: dur, big }); }
  pop(text, color, dur = 0.9) { this.pops.push({ text, color, t: dur, t0: dur, s: this.s, x: this.x }); }

  sense(dt) {
    const connected = this.hooks.connected();
    const st = this.hooks.stats();
    const demoSprint = !connected && (this.t % 18) > 14;
    this.connected = connected;
    this.power = connected ? st.power || 0 : demoSprint ? 320 : 175 + Math.sin(this.t * 0.7) * 15;
    this.cadence = connected ? st.cadence || 0 : demoSprint ? 104 : 88;
    this.gear = st.gear;
    this.kmh = connected ? this.hooks.speedKmh() : (demoSprint ? 40 : 31) - Math.max(0, this.grade || 0) * 2.2;
    this.sprinting = this.effort.update(this.power, dt, connected ? 50 : 0);
    if (this.audio.song) this.audio.setTempo(this.audio.song.bpm * clamp((this.cadence || 85) / 88, 0.85, 1.2));
  }

  update(dt, realDt) {
    this.t += realDt; this.selT = (this.selT || 0) + realDt;
    this.sense(realDt);
    this.texts.forEach((x) => { x.t -= realDt; }); this.texts = this.texts.filter((x) => x.t > 0);
    this.gearFlash = Math.max(0, (this.gearFlash || 0) - realDt);
    if (this.state === 'loading' || this.state === 'error' || this.state === 'select') return;
    this.stateT += realDt;
    if (this.state === 'countdown') {
      const left = 3 - Math.floor(this.stateT);
      if (left !== this.lastBeep && left > 0) { this.lastBeep = left; this.audio.sfx('beep'); }
      if (this.stateT >= 3) { this.state = 'race'; this.stateT = 0; this.audio.sfx('go'); this.say(t('games.racer.go'), '#06d6a0', 1, true); this.shake.add(0.3); }
      return;
    }
    if (this.state === 'results') { this.updateRivals(dt, 0, true); return; }
    if (this.state === 'finishCam') {
      // il giocatore rallenta dopo la linea, gli altri arrivano al rallentatore
      this.speed = Math.max(3, this.speed - dt * 4); this.s = Math.min(this.length + RUNOUT * 0.4, this.s + this.speed * dt);
      this.updateRivals(dt, 0, true);
      if (this.stateT > 3.4) this.toPodium();
      return;
    }

    let v = (this.kmh / 3.6) * WORLD_SCALE;
    let mult = 1 + Math.min(10, this.coinsTaken) * 0.01;
    if (this.draft > 0.99) mult += 0.12;
    if (this.boost > 0) { this.boost -= dt; mult += this.boostKind === 'gel' ? 0.4 : 0.25; if (this.boost <= 0) this.boostKind = null; }
    if (this.bumpT > 0) { this.bumpT -= dt; mult *= 0.6; }
    v *= mult; this.speed = v;
    this.chooseLine(dt);
    this.x = lerp(this.x, LANES[this.lane], Math.min(1, dt * 2.2));
    this.raceT += dt;
    const prevS = this.s;
    this.s = Math.min(this.length, this.s + v * dt);
    this.checkLines('TU', prevS, this.s);
    if (prevS < this.lastK && this.s >= this.lastK) { this.say(t('games.racer.last500say'), '#ff5a6a', 2.2, true); this.audio.sfx('bell'); this.shake.add(0.2); }
    if (this.draft >= 1) { this.draftAcc += dt; if (this.draftAcc >= 1) { this.draftAcc -= 1; this.prog('draftSec', 1, 1); } }
    if (this.s >= this.length - 0.01) { this.finish(); return; }

    const p = this.at(this.s);
    this.grade = clamp(p.grade, -4, 6);
    const g = Math.round(this.grade * 2) / 2;
    if (g !== this.sentGrade) { this.sentGrade = g; this.hooks.setGrade(g); }

    if (this.sprinting) this.sprintHeld += dt; else this.sprintHeld = Math.max(0, this.sprintHeld - dt * 2);
    if (this.item && this.sprintHeld >= 1.2) { this.useItem(); this.sprintHeld = 0; }

    // tifo: quando passi fra il pubblico
    this.cheerT -= dt;
    if (this.cheerT <= 0 && this.climbs.some((c) => Math.abs(c - this.s) < 6)) { this.audio.sfx('cheer'); this.cheerT = 3.5; }

    this.updateRivals(dt, v);
    this.pickups();
    // sorpassi: suono, testo e, nel finale, un attimo di rallentatore
    const place = this.place();
    if (place < this.prevPlace) {
      this.audio.sfx('pass'); if (!this.texts.some((x) => x.big)) this.pop(t('games.racer.passed'), '#4de3ff', 0.9); // non sopra un messaggio grande (VIA!, ultimi 500 m)
      if (this.s > this.length - 400) { this.time.slowmo(0.45, 0.7); this.shake.add(0.15); }
    }
    this.prevPlace = place;
  }

  // traiettoria automatica: scia del corridore davanti, altrimenti le monete, altrimenti si resta
  chooseLine(dt) {
    this.lineT = (this.lineT || 0) - dt;
    if (this.lineT > 0) return;
    this.lineT = 0.6;
    let best = null;
    for (const r of this.rivals) { const gap = r.s - this.s; if (gap > 1.8 && gap < 22 && (!best || gap < best.gap)) best = { gap, x: r.x }; }
    let target = this.lane;
    if (best) target = LANES.reduce((bi, lx, i) => (Math.abs(lx - best.x) < Math.abs(LANES[bi] - best.x) ? i : bi), 0);
    else { const c = this.coins.find((c) => !c.taken && c.s > this.s + 4 && c.s < this.s + 45); if (c) target = c.lane; }
    if (target !== this.lane) { this.lean = Math.sign(target - this.lane); this.lane = target; }
  }

  pickups() {
    for (const c of this.coins) {
      if (c.taken || Math.abs(c.s - this.s) > 0.9 || Math.abs(LANES[c.lane] - this.x) > 1.1) continue;
      c.taken = true; this.coinsTaken++; this.pop('+1', '#ffcc33');
      const p = this.at(c.s, LANES[c.lane]); this.effects.spawn(p.x, p.y + 1, p.z, { tex: 'spark', size: 0.9, life: 0.35, grow: 1.5, color: '#ffd34d' });
      this.audio.sfx('coin'); this.prog('coins', 1, 1);
      if (this.coinsTaken === 10) this.say(t('games.racer.coins10'), '#ffcc33', 2);
    }
    for (const b of this.boxes) {
      if (this.t - b.takenAt < 8 || Math.abs(b.s - this.s) > 0.9 || Math.abs(LANES[b.lane] - this.x) > 1.1) continue;
      b.takenAt = this.t;
      if (!this.item) {
        const place = this.place();
        const pool = place <= 2 ? ['shield', 'gel'] : place <= 5 ? ['gel', 'shield', 'wind'] : ['gel', 'wind', 'wind'];
        this.item = pick(pool); this.audio.sfx('pickup'); this.pop(t(ITEMS[this.item].name), ITEMS[this.item].color, 1.2);
        const p = this.at(b.s, LANES[b.lane]); this.effects.explode(p.x, p.y + 1.1, p.z, 0.5);
        this.say(t('games.racer.useItem', { name: t(ITEMS[this.item].name) }), ITEMS[this.item].color, 2.2);
      }
    }
  }

  useItem() {
    const it = this.item; this.item = null;
    this.audio.sfx('overdrive'); this.prog('itemsUsed', 1, 10);
    if (it === 'gel') { this.boost = 4; this.boostKind = 'gel'; this.audio.sfx('boost'); }
    if (it === 'wind') { this.boost = 7; this.boostKind = 'wind'; this.audio.sfx('whoosh'); }
    if (it === 'shield') this.shield = true;
    this.time.hitStop(0.05); this.shake.add(0.35);
    this.say(`${t(ITEMS[it].name)}!`, ITEMS[it].color, 1.4, true);
  }

  bump(text) {
    if (this.shield) { this.shield = false; this.say(t('games.racer.shield'), '#4de3ff', 1); this.audio.sfx('clank'); this.shake.add(0.2); return; }
    if (this.bumpT > 0) return;
    this.bumpT = 1; this.audio.sfx('hurt'); this.say(text, '#ff6b6b', 1);
    this.time.hitStop(0.08); this.shake.add(0.55);
    const p = this.at(this.s + 0.6, this.x); this.effects.spawn(p.x, p.y + 0.8, p.z, { tex: 'spark', size: 0.8, life: 0.3, grow: 1 });
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
        if (n === 0) { const p = this.at(ln.s); this.confetti.burst(p.x, p.y + 4, p.z, 60, 3); }
        this.say(t(ln.type === 'kom' ? 'games.racer.komSay' : 'games.racer.sprintSay', { place: ordinal(n + 1), pts }), ln.type === 'kom' ? '#ff5a6a' : '#3ccf6a', 2.2, n === 0);
      }
    }
  }

  leader(type) {
    const e = Object.entries(this.points?.[type] || {}).sort((a, b) => b[1] - a[1])[0];
    return e ? { name: e[0], pts: e[1] } : null;
  }

  updateRivals(dt, playerV, after = false) {
    const avgV = Math.max(4, ((this.effort.avg || 150) / 160) * 8.3 * WORLD_SCALE);
    let drafting = false; let draftOf = null;
    for (const r of this.rivals) {
      if (r.finished != null && !after) continue;
      const gap = r.s - this.s;
      const band = after ? 1 : clamp(1 - gap / 220, 0.82, 1.18);
      const climb = 1 - Math.max(0, this.at(r.s).grade) * (r.climber ? 0.01 : 0.03);
      let target = avgV * r.skill * band * climb * (1 + Math.sin(this.t * 0.3 + r.phase) * 0.04);
      if (r.s > this.length * 0.85) target *= 1.06;
      if (r.s > this.length + 10) target = Math.max(2, (this.length + RUNOUT * 0.55 - r.s) * 0.4); // dopo l'arrivo si rallenta
      if (r.boost > 0) { r.boost -= dt; target *= 1.3; }
      if (r.slow > 0) { r.slow -= dt; target *= 0.6; }
      r.speed = lerp(r.speed, target, Math.min(1, dt * 0.8));
      const prev = r.s;
      r.s = Math.min(this.length + RUNOUT * 0.6, r.s + r.speed * dt);
      if (!after) this.checkLines(r.name, prev, r.s);
      if (r.finished == null && r.s >= this.length) r.finished = this.raceT + (after ? this.stateT : 0);
      if (after) continue;
      if (Math.random() < dt * 0.22) r.targetX = pick(LANES);
      if (Math.random() < dt * 0.03) r.boost = 2.5;
      r.x = lerp(r.x, r.targetX, Math.min(1, dt * 1.6));
      const same = Math.abs(r.x - this.x) < 1.1;
      if (same && gap > 1.6 && gap < 12) { drafting = true; if (!draftOf || gap < draftOf.gap) draftOf = { r, gap }; }
      if (same && gap > -0.3 && gap < 1.5 && playerV > r.speed) { this.bump(t('games.racer.crash')); r.boost = 0.6; }
      if (gap < -1 && gap > -4 && r.said < this.t - 25 && Math.random() < dt * 2) { r.said = this.t; this.say(`${r.name}: "${r.line}"`, r.color, 2.2); }
    }
    if (after) return;
    this.draftOf = draftOf?.r || null;
    // la scia si vede (cuneo) anche mentre si sta entrando
    if (!this.draftOf) { let near = null; for (const r of this.rivals) { const gap = r.s - this.s; if (gap > 1.6 && gap < 16 && (!near || gap < near.gap)) near = { r, gap }; } this.draftNear = near?.r || null; } else this.draftNear = this.draftOf;
    this.draft = clamp(this.draft + (drafting ? dt / 1.2 : -dt * 2), 0, 1);
    if (this.draft >= 1 && !this.draftShown) { this.draftShown = true; this.say(t('games.racer.draft'), '#4de3ff', 1); this.audio.sfx('whoosh'); }
    if (this.draft < 0.5) this.draftShown = false;
    this.standing = this.ranking();
  }

  ranking() {
    const list = [{ name: 'TU', me: true, d: this.s, fin: this.finished ? this.finishT : null, color: PLAYER_COLOR }];
    for (const r of this.rivals || []) list.push({ name: r.name, color: r.color, d: r.s, fin: r.finished, r });
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
    this.state = 'finishCam'; this.stateT = 0; this.camMode = 'finish'; this.camInit = false;
    this.time.slowmo(0.22, 2.4); this.shake.add(0.35);
    this.audio.stopSong(); this.audio.sfx(place <= 3 ? 'win' : 'lose'); this.audio.sfx('cheer');
    const p = this.at(this.length); this.confetti.burst(p.x, p.y + 5, p.z, 160, 5);
    const key = `racer3dBest${this.stageIndex}`;
    const best = Number(localStorage.getItem(key)) || Infinity;
    this.newBest = this.raceT < best;
    if (this.newBest) localStorage.setItem(key, this.raceT.toFixed(1));
    this.hooks.runEnd?.({ game: 'racer', stage: this.stageIndex, score: Math.round(this.raceT * 10) / 10 });
    this.prog('races', 1, 60 + ([100, 70, 50][place - 1] || 0));
    if (place <= 3) this.prog('podiums', 1, 0);
    if (place === 1) { this.prog('wins', 1, 0); this.hooks.progress?.addToList('tracksWon', this.stageIndex); }
    if (this.leader('green')?.name === 'TU') { this.prog('green', 1, 80); this.prog('jerseys', 1, 0); }
    if (this.leader('kom')?.name === 'TU') { this.prog('kom', 1, 80); this.prog('jerseys', 1, 0); }
    this.hooks.setGrade(0);
  }

  toPodium() {
    this.state = 'results'; this.stateT = 0; this.camMode = 'podium'; this.camInit = false;
    // chi non è ancora arrivato prende il tempo stimato
    for (const r of this.rivals) if (r.finished == null) r.finished = this.raceT + (this.length - r.s) / Math.max(3, r.speed);
    this.standing = this.ranking();
    const top = this.standing.slice(0, 3);
    for (const r of this.riders) r.cy.root.visible = false;
    this.marker.visible = false;
    top.forEach((e, i) => {
      const cy = e.me ? this.player : this.rivalRiders[e.r.i];
      const spot = this.podiumSpots[i];
      cy.standUp(i === 0); cy.root.visible = true;
      this.podium.updateMatrixWorld(true);
      const wp = this.podium.localToWorld(new THREE.Vector3(spot.x, spot.h, 0));
      cy.root.position.copy(wp); cy.root.rotation.set(0, this.podium.rotation.y, 0);
      cy.lean.rotation.set(0, 0, 0);
    });
    this.podiumTop = top; this.podiumLight.visible = true;
    const wp = this.podium.localToWorld(new THREE.Vector3(0, 3, 0)); this.confetti.burst(wp.x, wp.y + 2, wp.z, 200, 3);
    this.audio.sfx('cheer');
  }

  // ---------- disegno ----------
  poseRider(cy, s, x, cadence, speed, dt, opts = {}) {
    const p = this.at(s, x);
    cy.root.position.set(p.x, p.y, p.z);
    cy.root.rotation.set(0, p.h, 0);
    cy.root.rotateX(-Math.atan(p.grade / 100 * VIS_GRADE));
    // piega in curva (dalla curvatura e dalla velocità) e nei cambi di linea
    cy.lean.rotation.z = clamp(-(p.turn / 100) * speed * 0.9, -0.35, 0.35) - (opts.lean || 0) * 0.12;
    cy.pose(dt, cadence, speed / WORLD_SCALE, opts);
  }

  poseAll(dt) {
    const pre = this.state === 'select' || this.state === 'loading' || !this.rivals;
    if (pre) {
      this.poseRider(this.player, START, 0, 0, 0, dt);
      this.rivalRiders.forEach((r, i) => this.poseRider(r, START - 3 + (6 - i) * 1.7, LANES[i % 3], 0, 0, dt));
      return;
    }
    if (this.state === 'results') { for (const r of this.riders) if (r.cy.root.visible) r.cy.pose(dt); return; }
    const cad = this.state === 'countdown' ? 0 : (this.cadence || 0);
    this.poseRider(this.player, this.s, this.x, cad, this.state === 'countdown' ? 0 : this.speed, dt, { stand: this.sprinting && this.state === 'race' ? 1 : (this.grade > 4.5 ? 0.6 : 0), lean: this.lean });
    this.rivals.forEach((r, i) => {
      const cy = this.rivalRiders[i];
      const far = Math.abs(r.s - this.s) > 120; cy.root.visible = !far;
      if (far) return;
      const rc = this.state === 'countdown' ? 0 : 80 + (r.speed / 8) * 12;
      // lontani (> 35 m): la posa si aggiorna a fotogrammi alterni
      const mid = Math.abs(r.s - this.s) > 35;
      if (mid && (this.frame + i) % 2) { const p = this.at(r.s, r.x); cy.root.position.set(p.x, p.y, p.z); return; }
      this.poseRider(cy, r.s, r.x, rc, this.state === 'countdown' ? 0 : r.speed, mid ? dt * 2 : dt, { stand: r.boost > 0 || this.at(r.s).grade > 5 ? 1 : 0 });
    });
  }

  draw(dt, realDt) {
    if (!this.scene) return;
    const sel = this.state === 'select' || this.state === 'loading';
    this.poseAll(dt);
    this.lean = (this.lean || 0) * Math.pow(0.05, dt);
    const focusS = sel ? START : this.s;
    for (const i of this.inst) i.update(focusS);
    this.crowd.tick(this.t);
    this.updatePickupMeshes(focusS);
    // scia visibile
    const dn = !sel && this.state === 'race' ? this.draftNear : null;
    this.draftZone.visible = !!dn;
    if (dn) {
      const p = this.at(dn.s, dn.x);
      this.draftZone.position.set(p.x, p.y + 0.07, p.z); this.draftZone.rotation.set(0, p.h, 0);
      this.draftZone.material.opacity += ((this.draft >= 1 ? 0.55 : 0.22) - this.draftZone.material.opacity) * Math.min(1, dt * 5);
    }
    this.wind.update(realDt, this.player.root, !sel && this.state === 'race' ? Math.max(this.draft >= 1 ? 1 : 0, this.boost > 0 ? 1 : 0) : 0);
    this.effects.update(dt); this.confetti.update(dt);
    if (this.marker) this.marker.position.y = 2.15 + Math.sin(this.t * 4) * 0.06;
    this.shake.update(realDt);
    this.updateCamera(dt, realDt, sel, focusS);
    const fp = this.at(focusS);
    this.light.follow(fp.x, fp.y, fp.z);
    this.stage.render();
  }

  updateCamera(dt, realDt, sel, focusS) {
    const cam = this.camera;
    let pos; let look; let fov = 60;
    if (this.camMode === 'finish' && this.state === 'finishCam') {
      // di lato alla linea d'arrivo, segue il giocatore al rallentatore
      // dopo la linea, di tre quarti: i corridori arrivano verso la camera
      const side = this.at(this.length + 10, ROAD_W / 2 - 0.6);
      pos = new THREE.Vector3(side.x, side.y + 1.3, side.z);
      const p = this.at(Math.min(this.s, this.length + 4) - 3, this.x * 0.5); look = new THREE.Vector3(p.x, p.y + 1.25, p.z); fov = 42;
    } else if (sel) {
      // menu: il gruppo fermo alla partenza, inquadrato da davanti
      const sw = Math.sin(this.t * 0.25);
      const c = this.at(START + 13.5, sw * 2.6); pos = new THREE.Vector3(c.x, c.y + 1.9 + Math.cos(this.t * 0.3) * 0.2, c.z);
      const l = this.at(START + 3, 0); look = new THREE.Vector3(l.x, l.y + 0.9, l.z); fov = 50;
    } else if (this.state === 'results') {
      const a = this.stateT * 0.12;
      const port = this.H > this.W;
      const c = this.podium.localToWorld(new THREE.Vector3(Math.sin(a) * 1.0 + (port ? 0 : 2.4), port ? 3.2 : 2.3, (port ? 13 : 8.2) + Math.cos(a) * 0.3));
      pos = c; look = this.podium.localToWorld(new THREE.Vector3(port ? 0 : 2.6, port ? -0.6 : 1.6, 0)); fov = port ? 44 : 40;
    } else {
      const off = sel ? 0 : (this.x || 0) * 0.6;
      const speedK = clamp((this.speed || 0) / 14, 0, 1);
      const back = this.at(Math.max(-10, focusS - 5.4 - speedK * 1.1), off);
      const ahead = this.at(Math.min(this.pts.at(-1).s, focusS + 20), off * 0.3);
      pos = new THREE.Vector3(back.x, back.y + 2.05, back.z);
      look = new THREE.Vector3(ahead.x, ahead.y + 1.25, ahead.z);
      fov = 60 + speedK * 6 + (this.boost > 0 ? 8 : 0) + (this.draft >= 1 ? 3 : 0) + (this.sprinting ? 3 : 0);
      if (this.state === 'countdown') fov = 56;
    }
    if (!this.camInit) { cam.position.copy(pos); this.camLook = look.clone(); this.camInit = true; }
    const k = Math.min(1, realDt * (this.state === 'results' ? 2 : 4.5));
    cam.position.lerp(pos, k); this.camLook.lerp(look, Math.min(1, realDt * 6));
    cam.lookAt(this.camLook);
    cam.fov += (fov - cam.fov) * Math.min(1, realDt * 3); cam.updateProjectionMatrix();
    this.shake.apply(cam);
  }

  updatePickupMeshes(s0) {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const v = new THREE.Vector3(); const sc = new THREE.Vector3();
    let n = 0;
    for (const c of this.coins) {
      if (c.taken || c.s < s0 - 10 || c.s > s0 + 160) continue;
      const p = this.at(c.s, LANES[c.lane]);
      e.set(0, this.t * 3 + c.s, 0); q.setFromEuler(e);
      m.compose(v.set(p.x, p.y + 0.6, p.z), q, sc.setScalar(this.coinScale));
      for (const cm of this.coinMeshes) cm.setMatrixAt(n, m);
      n++;
    }
    for (const cm of this.coinMeshes) { cm.count = n; cm.instanceMatrix.needsUpdate = true; }
    n = 0;
    for (const b of this.boxes) {
      if (this.t - b.takenAt < 8 || b.s < s0 - 10 || b.s > s0 + 220) continue;
      const p = this.at(b.s, LANES[b.lane]);
      e.set(0.3, this.t * 1.5 + b.lane, 0); q.setFromEuler(e);
      this.boxMesh.setMatrixAt(n++, m.compose(v.set(p.x, p.y + 1.1 + Math.sin(this.t * 3 + b.lane) * 0.12, p.z), q, sc.setScalar(1)));
    }
    this.boxMesh.count = n; this.boxMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- interfaccia ----------
  drawHud(dt) {
    const ctx = this.stage.ctx; const W = this.W; const H = this.H;
    ctx.clearRect(0, 0, W, H);
    if (this.state === 'loading') {
      ctx.fillStyle = '#0f0e0c'; if (!this.scene) ctx.fillRect(0, 0, W, H);
      txt(ctx, t('games.common.loading'), W / 2, H / 2, { size: 26, align: 'center', color: HUD.lime });
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(W / 2 - 90, H / 2 + 18, 180, 8);
      ctx.fillStyle = HUD.lime; ctx.fillRect(W / 2 - 90, H / 2 + 18, 180 * (this.loadPct || 0), 8);
      return;
    }
    if (this.state === 'error') { txt(ctx, t('ui.error', { error: this.error }), W / 2, H / 2, { size: 15, align: 'center', color: '#ff6b6b' }); return; }
    if (this.state === 'select') return this.drawSelect(ctx, W, H);
    if (this.state === 'results') return this.drawResults(ctx, W, H, dt);
    const u = uiScale(W, H); const top = 56;
    if (this.state === 'finishCam') return this.drawFinish(ctx, W, H, u, dt);
    this.drawTags(ctx, W, H, u);
    // posizione (in alto a sinistra)
    const place = this.place();
    const pw = txt(ctx, ordinal(place), 14, top + 52 * u, { size: 58 * u, color: place <= 3 ? HUD.lime : HUD.white, italic: true });
    txt(ctx, '/8', 18 + pw, top + 52 * u, { size: 22 * u, color: HUD.dim });
    // potenza (in alto a destra): il numero più grande
    const pc = powerColor(this.power, this.effort.threshold);
    const ww = txt(ctx, 'W', W - 14, top + 52 * u, { size: 22 * u, align: 'right', color: HUD.dim });
    txt(ctx, String(Math.round(this.power)), W - 18 - ww, top + 52 * u, { size: 58 * u, align: 'right', color: pc });
    const kmh = Math.round((this.speed / WORLD_SCALE) * 3.6);
    txt(ctx, `${kmh} km/h`, W - 14, top + 82 * u, { size: 24 * u, align: 'right' });
    // pendenza
    const gr = this.grade || 0;
    const gtxt = `${gr > 0.05 ? '+' : ''}${fmtDec(gr, 1)}%`;
    ctx.font = `800 ${24 * u}px sans-serif`;
    panel(ctx, W - 14 - 92 * u, top + 92 * u, 92 * u, 34 * u, { fill: 'rgba(12,12,18,.55)', border: gradeColor(gr) });
    txt(ctx, gtxt, W - 14 - 46 * u, top + 117 * u, { size: 24 * u, align: 'center', color: gradeColor(gr) });
    // distanza all'arrivo (al centro)
    const left = Math.max(0, this.length - this.s) / WORLD_SCALE;
    txt(ctx, left >= 1000 ? `${fmtDec(left / 1000, 1)} km` : `${Math.round(left / 10) * 10} m`, W / 2, top + 26 * u, { size: 28 * u, align: 'center', color: left < 500 ? HUD.red : HUD.white });
    txt(ctx, fmt(this.raceT || 0), W / 2, top + 48 * u, { size: 16 * u, align: 'center', color: HUD.dim });
    // marcia e cadenza (sotto la posizione)
    const gy = top + 64 * u;
    if (this.gear != null) {
      panel(ctx, 14, gy, 104 * u, 34 * u, { fill: this.gearFlash > 0 ? 'rgba(217,255,61,.85)' : 'rgba(12,12,18,.55)' });
      txt(ctx, t('games.racer.gear', { n: this.gear }), 14 + 52 * u, gy + 24 * u, { size: 20 * u, align: 'center', color: this.gearFlash > 0 ? '#15141b' : HUD.white, stroke: this.gearFlash > 0 ? null : undefined });
    }
    txt(ctx, `${Math.round(this.cadence || 0)} rpm`, 14, gy + 58 * u, { size: 18 * u, color: HUD.dim });
    // scia
    if (this.draft > 0.05) {
      const bw = 150 * u; const bx = W / 2 - bw / 2; const by = top + 60 * u;
      panel(ctx, bx, by, bw, 28 * u, { fill: 'rgba(12,12,18,.55)' });
      ctx.fillStyle = this.draft >= 1 ? HUD.cyan : '#2a6f97'; ctx.fillRect(bx + 3, by + 3, (bw - 6) * this.draft, 22 * u);
      txt(ctx, this.draft >= 1 ? t('games.racer.inDraft') : t('games.racer.drafting'), W / 2, by + 20 * u, { size: 16 * u, align: 'center' });
    }
    // oggetto
    const iy = H - 150 * u;
    if (this.item) {
      const it = ITEMS[this.item];
      panel(ctx, 14, iy, 200 * u, 56 * u, { border: it.color });
      txt(ctx, t(it.name), 24, iy + 22 * u, { size: 18 * u, color: it.color });
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(24, iy + 30 * u, 180 * u, 8 * u);
      ctx.fillStyle = this.sprinting ? HUD.lime : '#888'; ctx.fillRect(24, iy + 30 * u, 180 * u * clamp(this.sprintHeld / 1.2, 0, 1), 8 * u);
      txt(ctx, t('games.racer.sprintAbove', { w: this.effort.threshold }), 24, iy + 52 * u, { size: 13 * u, color: HUD.dim });
    }
    // classifica corta: davanti e dietro di te, con i distacchi
    this.drawStandings(ctx, W, H, u);
    this.drawProfile(ctx, W, H, u);
    // testi a comparsa (in alto, sopra la strada)
    let ty = H * 0.3;
    for (const x of this.texts) {
      ctx.globalAlpha = Math.min(1, x.t * 3);
      const pop = x.big ? 1 + Math.max(0, (x.t - x.t0 + 0.25) / 0.25) * 0.4 : 1;
      txt(ctx, x.text, W / 2, ty, { size: (x.big ? 34 : 18) * u * pop, color: x.color, align: 'center', italic: x.big }); ty += (x.big ? 40 : 24) * u;
      ctx.globalAlpha = 1;
    }
    // testi che salgono dal corridore
    const v3 = new THREE.Vector3();
    for (const q of this.pops) {
      q.t -= dt; const k = 1 - q.t / q.t0; const p = this.at(q.s, q.x);
      v3.set(p.x, p.y + 2.2 + k * 1.4, p.z).project(this.camera);
      ctx.globalAlpha = clamp((q.t / q.t0) * 2, 0, 1);
      txt(ctx, q.text, (v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H, { size: 22 * u, align: 'center', color: q.color });
      ctx.globalAlpha = 1;
    }
    this.pops = this.pops.filter((q) => q.t > 0);
    if (this.state === 'countdown') {
      const n = 3 - Math.floor(this.stateT); const f = this.stateT % 1;
      txt(ctx, String(n), W / 2, H * 0.42, { size: (110 - f * 30) * u, align: 'center', color: HUD.lime, italic: true });
    }
    if (!this.connected) txt(ctx, t('games.common.demo'), W / 2, H - 70 * u, { size: 13 * u, align: 'center', color: HUD.gold });
    this.hooks.progress?.drawToasts(ctx, W, dt);
  }

  // dopo la linea: il risultato grande, al rallentatore
  drawFinish(ctx, W, H, u, dt) {
    const place = this.place(); const k = clamp(this.stateT * 2.5, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.4); g.addColorStop(0, 'rgba(8,8,12,.7)'); g.addColorStop(1, 'rgba(8,8,12,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.4);
    ctx.globalAlpha = k;
    txt(ctx, place === 1 ? t('games.racer.victory') : place <= 3 ? t('games.racer.podium') : t('games.racer.finish'), W / 2, 120 * u, { size: (64 - (1 - k) * 30) * u, align: 'center', color: place <= 3 ? HUD.lime : HUD.white, italic: true });
    txt(ctx, `${ordinal(place)} · ${fmt(this.finishT)}`, W / 2, 158 * u, { size: 30 * u, align: 'center' });
    ctx.globalAlpha = 1;
    this.hooks.progress?.drawToasts(ctx, W, dt);
  }

  // nomi sopra i rivali vicini (al massimo 4, senza sovrapposizioni)
  drawTags(ctx, W, H, u) {
    const v = new THREE.Vector3(); const boxes = [];
    const near = (this.rivals || []).map((r) => ({ r, gap: r.s - this.s })).filter((e) => e.gap > -2 && e.gap < 36).sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap)).slice(0, 4);
    for (const { r, gap } of near) {
      const p = this.at(r.s, r.x); v.set(p.x, p.y + 2.0, p.z).project(this.camera);
      if (v.z > 1) continue;
      const x = (v.x + 1) / 2 * W; let y = (1 - v.y) / 2 * H;
      const name = first(r.name); const sz = clamp(17 - gap * 0.12, 13, 17) * u;
      ctx.font = `800 ${sz}px sans-serif`;
      const w = ctx.measureText(name).width + 20; const h = sz + 8;
      for (const b of boxes) if (Math.abs(b.x - x) < (b.w + w) / 2 && Math.abs(b.y - y) < h) y = b.y - h - 2;
      boxes.push({ x, y, w });
      ctx.globalAlpha = clamp(1 - (gap - 26) / 10, 0, 1);
      panel(ctx, x - w / 2, y - h, w, h, { r: 6, fill: 'rgba(12,12,18,.62)' });
      ctx.fillStyle = r.color; ctx.fillRect(x - w / 2 + 5, y - h + 4, 4, h - 8);
      txt(ctx, name, x + 3, y - 5, { size: sz, align: 'center', stroke: null });
      ctx.globalAlpha = 1;
    }
  }

  drawStandings(ctx, W, H, u) {
    const list = this.standing || this.ranking(); const me = list.findIndex((x) => x.me);
    const rows = [...new Set([0, me - 1, me, me + 1].filter((i) => i >= 0 && i < list.length))];
    const lh = 21 * u; const y0 = H - 92 * u - rows.length * lh; const x0 = W - 14;
    rows.forEach((i, k) => {
      const r = list[i]; const y = y0 + k * lh;
      const gap = i === me ? '' : `${r.d - this.s > 0 ? '+' : '−'}${Math.round(Math.abs(r.d - this.s) / WORLD_SCALE)} m`;
      txt(ctx, `${i + 1}. ${r.me ? you() : first(r.name)}  ${gap}`, x0, y, { size: 16 * u, align: 'right', color: r.me ? HUD.lime : HUD.white });
      ctx.fillStyle = r.color; ctx.fillRect(x0 + 2, y - 12 * u, 4, 13 * u);
    });
  }

  // profilo altimetrico della tappa con le posizioni
  drawProfile(ctx, W, H, u = 1, yBottom = H - 14) {
    const x0 = 16; const x1 = W - 16; const y1 = yBottom; const h = 44 * u;
    panel(ctx, x0 - 8, y1 - h - 10, x1 - x0 + 16, h + 16, { fill: 'rgba(12,12,18,.55)' });
    const range = Math.max(10, this.maxY - this.minY);
    const X = (s) => x0 + (Math.min(s, this.length) / this.length) * (x1 - x0);
    const Y = (y) => y1 - ((y - this.minY) / range) * h;
    ctx.beginPath(); ctx.moveTo(x0, y1);
    for (const p of this.pts) { if (p.s > this.length) break; if (p.s % 12 === 0) ctx.lineTo(X(p.s), Y(p.y)); }
    ctx.lineTo(x1, y1); ctx.closePath();
    ctx.fillStyle = 'rgba(217,255,61,.22)'; ctx.fill();
    // parte già fatta
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y1 - h - 4, X(this.s || 0) - x0, h + 4); ctx.clip();
    ctx.beginPath(); ctx.moveTo(x0, y1); for (const p of this.pts) { if (p.s > this.length) break; if (p.s % 12 === 0) ctx.lineTo(X(p.s), Y(p.y)); } ctx.lineTo(x1, y1); ctx.closePath();
    ctx.fillStyle = 'rgba(217,255,61,.55)'; ctx.fill(); ctx.restore();
    for (const ln of this.lines) { ctx.fillStyle = ln.type === 'kom' ? '#ff5a6a' : '#3ccf6a'; ctx.fillRect(X(ln.s) - 1.5, y1 - h - 4, 3, h + 4); }
    for (const r of this.rivals || []) { ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(X(r.s), Y(this.at(r.s).y), 3.5 * u, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = HUD.lime; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(this.s || 0), Y(this.at(this.s || 0).y), 6 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  drawSelect(ctx, W, H) {
    const S = STAGES[this.stageIndex]; const u = uiScale(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.5); g.addColorStop(0, 'rgba(8,8,12,.88)'); g.addColorStop(1, 'rgba(8,8,12,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.5);
    const g2 = ctx.createLinearGradient(0, H * 0.55, 0, H); g2.addColorStop(0, 'rgba(8,8,12,0)'); g2.addColorStop(1, 'rgba(8,8,12,.92)');
    ctx.fillStyle = g2; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    txt(ctx, t('games.racer.hud.title'), W / 2, 104 * u, { size: 48 * u, align: 'center', color: HUD.lime, italic: true });
    txt(ctx, t('games.racer.hud.tagline'), W / 2, 130 * u, { size: 16 * u, align: 'center', color: HUD.dim });
    txt(ctx, t('games.racer.stage', { i: this.stageIndex + 1, n: STAGES.length }), W / 2, 172 * u, { size: 16 * u, align: 'center', color: HUD.lime });
    txt(ctx, t(S.name), W / 2, 202 * u, { size: 30 * u, align: 'center' });
    txt(ctx, t(S.desc), W / 2, 226 * u, { size: 16 * u, align: 'center', color: HUD.dim });
    txt(ctx, t('games.racer.length', { km: fmtDec(this.length / 1000 / WORLD_SCALE, 1), m: Math.round((this.maxY - this.minY) / VIS_GRADE) }), W / 2, 248 * u, { size: 15 * u, align: 'center', color: HUD.dim });
    const best = Number(localStorage.getItem(`racer3dBest${this.stageIndex}`));
    if (best) txt(ctx, t('games.racer.best', { time: fmt(best) }), W / 2, 270 * u, { size: 15 * u, align: 'center', color: HUD.dim });
    this.drawProfile(ctx, W, H, u, H - 96 * u);
    txt(ctx, t('games.racer.menuKeys'), W / 2, H - 44 * u, { size: 20 * u, align: 'center', color: HUD.lime });
    this.hooks.progress?.drawToasts(ctx, W, 0.016);
  }

  drawResults(ctx, W, H, dt) {
    const u = uiScale(W, H); const place = this.place();
    if (H >= W * 0.83) {
      const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(8,8,12,0)'); g.addColorStop(0.25, 'rgba(8,8,12,.85)'); g.addColorStop(1, 'rgba(8,8,12,.95)');
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55);
    }
    const g2 = ctx.createLinearGradient(0, 0, 0, 150 * u); g2.addColorStop(0, 'rgba(8,8,12,.75)'); g2.addColorStop(1, 'rgba(8,8,12,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, 150 * u);
    txt(ctx, place === 1 ? t('games.racer.victory') : place <= 3 ? t('games.racer.podium') : t('games.racer.finish'), W / 2, 100 * u, { size: 44 * u, align: 'center', color: place <= 3 ? HUD.lime : HUD.white, italic: true });
    txt(ctx, `${ordinal(place)} · ${fmt(this.finishT)}${this.newBest ? t('games.common.newBest') : ''}`, W / 2, 128 * u, { size: 20 * u, align: 'center' });
    // nomi sopra le teste sul podio
    const v = new THREE.Vector3();
    (this.podiumTop || []).forEach((e, i) => {
      const cy = e.me ? this.player : this.rivalRiders[e.r.i];
      v.copy(cy.root.position); v.y += 2.15; v.project(this.camera);
      txt(ctx, `${i + 1}. ${e.me ? you() : first(e.name)}`, (v.x + 1) / 2 * W, (1 - v.y) / 2 * H, { size: 18 * u, align: 'center', color: e.me ? HUD.lime : HUD.white });
    });
    const land = W > H * 1.2;
    const cx = land ? W * 0.74 : W / 2; const y0 = land ? H * 0.3 : H * 0.6;
    if (land) { panel(ctx, cx - 190 * u * 0.85, y0 - 30 * u, 380 * u * 0.85, (60 + this.standing.length * 22) * u, { fill: 'rgba(8,8,12,.72)' }); }
    const gr = this.leader('green'); const km = this.leader('kom');
    if (gr || km) txt(ctx, t('games.racer.jerseysEnd', { green: gr ? who(gr.name) : '-', dots: km ? who(km.name) : '-' }), cx, y0, { size: 15 * u, align: 'center', color: HUD.dim }); // niente riga vuota se nessuno ha preso punti
    const lh = 22 * u; const cw = land ? 0.85 : 1;
    this.standing.forEach((r, i) => {
      const y = y0 + 30 * u + i * lh;
      txt(ctx, `${i + 1}.`, cx - 130 * u * cw, y, { size: 17 * u, align: 'right', color: r.me ? HUD.lime : HUD.dim });
      txt(ctx, r.me ? you() : r.name, cx - 120 * u * cw, y, { size: 17 * u, color: r.me ? HUD.lime : HUD.white });
      txt(ctx, r.fin != null ? fmt(r.fin) : '', cx + 140 * u * cw, y, { size: 17 * u, align: 'right', color: r.me ? HUD.lime : HUD.dim });
    });
    if (this.stateT > 2) txt(ctx, t('games.racer.endKeys'), W / 2, H - 30 * u, { size: 20 * u, align: 'center', color: HUD.lime });
    this.hooks.progress?.drawToasts(ctx, W, dt);
  }

  loop(now) {
    if (!this.active) return;
    const realDt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    const dt = this.time.step(realDt);
    this.update(dt, realDt);
    this.frame = (this.frame || 0) + 1;
    if (this.scene && this.state !== 'error') this.draw(dt, realDt);
    // l'HUD (canvas 2D, testo con contorno) si ridisegna a 30 Hz: basta per i numeri e costa la metà
    this.hudDt = (this.hudDt || 0) + realDt;
    if (this.frame % 2 === 0 || this.state === 'loading') { this.drawHud(this.hudDt); this.hudDt = 0; }
    requestAnimationFrame(this.loop);
  }
}

// ---------- texture disegnate al volo ----------
function mergeGeometriesSafe(list) {
  // unione semplice di geometrie non indicizzate con gli stessi attributi
  const total = list.reduce((a, g) => a + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const k of Object.keys(list[0].attributes)) {
    const size = list[0].attributes[k].itemSize; const arr = new Float32Array(total * size); let o = 0;
    for (const g of list) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
function roadTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5a5960'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  g.fillStyle = '#f2f2f2'; g.fillRect(3, 0, 3, 128); g.fillRect(122, 0, 3, 128);
  g.fillRect(63, 0, 2, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function curbTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 16;
  const g = c.getContext('2d'); g.fillStyle = '#d62839'; g.fillRect(0, 0, 8, 8); g.fillStyle = '#f4f4f4'; g.fillRect(0, 8, 8, 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function checkerTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 8, y * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelTexture(text, bg, fg = '#fff', w = 512, h = 64, font = 'italic 900 44px "Roboto Condensed", "Arial Narrow", sans-serif') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3, w - 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function podiumBackTexture(title) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1b1a24'); gr.addColorStop(1, '#2c2a3a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#d9ff3d' : '#4de3ff'; g.globalAlpha = 0.18; g.fillRect(i * 64 - 30, 0, 26, 256); }
  g.globalAlpha = 1; g.fillStyle = '#b8dc2c'; g.font = 'italic 900 64px "Roboto Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.fillText(title, 256, 92, 480);
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
