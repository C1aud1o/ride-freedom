// Ambienti: tanti oggetti uguali (alberi, rocce, case, transenne, pubblico) con InstancedMesh.
// - un solo draw call per modello: le istanze vicine vengono riscritte nel buffer quando ci si sposta;
// - LOD semplice: oltre lodDist il modello diventa una sagoma low-poly dello stesso colore;
// - densità regolabile (qualità): si tiene una frazione stabile delle istanze.
import * as THREE from 'three';
import { mergeGeometries } from '../../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from './style.js';
import { crowdMaterial } from './cyclist.js';

// Un modello glTF in una geometria sola: colori dei materiali → colori per vertice (se non ci sono texture)
const prepared = new WeakMap();
export function prepareModel(gltf) {
  if (prepared.has(gltf)) return prepared.get(gltf);
  const root = gltf.scene; root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const plain = []; const textured = []; let colSum = new THREE.Color(0, 0, 0); let colW = 0; let trunkCol = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const src = o.geometry;
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.index ? src.index.count : src.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = mats[gr.materialIndex] || mats[0];
      let g = src.index ? subIndexed(src, gr) : src.clone();
      g = g.index ? g.toNonIndexed() : g;
      // attributi quantizzati → float, nello spazio del modello
      const out = new THREE.BufferGeometry();
      for (const k of ['position', 'normal', 'uv']) {
        const a = g.attributes[k]; if (!a) continue;
        const arr = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
        out.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
      }
      out.applyMatrix4(o.matrixWorld);
      if (!out.attributes.normal) out.computeVertexNormals();
      if (m.map) { textured.push({ geo: out, map: m.map }); continue; }
      out.deleteAttribute('uv');
      const c = m.color.clone(); const n = out.attributes.position.count; const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
      out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      plain.push(out);
      // colore medio per la sagoma lontana (le foglie pesano più del tronco)
      out.computeBoundingBox(); const bb = out.boundingBox; const vol = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y) * (bb.max.z - bb.min.z) + 1e-6;
      colSum = colSum.add(c.clone().multiplyScalar(vol)); colW += vol;
      if (/tree|trunk|wood/i.test(m.name || '') || c.r > c.g * 1.4) trunkCol = trunkCol || c.clone();
    }
  });
  const parts = [];
  if (plain.length) parts.push({ geo: mergeGeometries(plain, false), mat: 'vc' });
  for (const t of textured) parts.push({ geo: t.geo, mat: t.map });
  const avg = colW ? colSum.multiplyScalar(1 / colW) : new THREE.Color('#888');
  const info = { parts, box, height: box.max.y - box.min.y, avg, trunkCol };
  prepared.set(gltf, info);
  return info;
}
function subIndexed(src, gr) {
  const g = new THREE.BufferGeometry();
  for (const k of Object.keys(src.attributes)) g.setAttribute(k, src.attributes[k]);
  g.setIndex(Array.from(src.index.array.slice(gr.start, gr.start + gr.count)));
  return g;
}

// sagoma lontana: chioma (icosaedro) + tronco per gli alberi, blocco per il resto
function proxyGeometry(info, kind) {
  const b = info.box; const w = b.max.x - b.min.x; const d = b.max.z - b.min.z; const h = info.height;
  const cx = (b.max.x + b.min.x) / 2; const cz = (b.max.z + b.min.z) / 2;
  const geos = [];
  const paint = (g, c) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  if (kind === 'tree') {
    const crown = new THREE.IcosahedronGeometry(0.5, 0); crown.scale(w * 0.9, h * 0.55, d * 0.9); crown.translate(cx, b.min.y + h * 0.66, cz);
    const trunk = new THREE.CylinderGeometry(w * 0.05, w * 0.07, h * 0.5, 5); trunk.translate(cx, b.min.y + h * 0.25, cz);
    geos.push(paint(crown, info.avg), paint(trunk, info.trunkCol || new THREE.Color('#6b4a2b')));
  } else {
    const box = new THREE.BoxGeometry(w * 0.9, h * 0.85, d * 0.9); box.translate(cx, b.min.y + h * 0.425, cz);
    geos.push(paint(box, info.avg));
  }
  const g = mergeGeometries(geos, false); g.computeVertexNormals(); return g;
}

let vcMat = null; const texMats = new Map();
function matFor(m) {
  if (m === 'vc') return vcMat || (vcMat = toonMaterial({ vertexColors: true }));
  if (!texMats.has(m)) texMats.set(m, toonMaterial({ map: m }));
  return texMats.get(m);
}

// Istanze con finestra: placements = [{ x, y, z, rot, scale, d }] dove d è la distanza lungo il percorso
export class Instanced {
  constructor(scene, parts, placements, { shadows = false, receive = true, lodGeo = null, lodDist = 220, window = [-40, 520], colors = null, material = null } = {}) {
    this.list = placements.map((p, i) => ({ ...p, keep: hash01(i * 7.13 + (p.d || 0)) }));
    this.window = window; this.lodDist = lodDist; this.density = 1; this.colors = colors;
    const cap = this.list.length;
    this.meshes = parts.map((pt) => {
      const m = new THREE.InstancedMesh(pt.geo, material || matFor(pt.mat), cap);
      m.castShadow = shadows; m.receiveShadow = receive; m.count = 0; m.frustumCulled = false;
      scene.add(m); return m;
    });
    if (lodGeo) { this.lod = new THREE.InstancedMesh(lodGeo, material || matFor('vc'), cap); this.lod.count = 0; this.lod.frustumCulled = false; this.lod.receiveShadow = receive; scene.add(this.lod); }
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const v = new THREE.Vector3(); const s = new THREE.Vector3();
    this.mats = this.list.map((p) => m4.compose(v.set(p.x, p.y, p.z), q.setFromAxisAngle(up, p.rot || 0), s.setScalar(p.scale || 1)).clone());
    if (colors) { const c = new THREE.Color(); this.cols = this.list.map((p) => c.set(p.color || '#ffffff').clone()); }
    this.lastD = -1e9;
  }
  setDensity(k) { this.density = k; this.lastD = -1e9; }
  setShadows(on) { for (const m of this.meshes) m.castShadow = on; }
  // d: distanza del giocatore lungo il percorso
  update(d, force = false) {
    if (!force && Math.abs(d - this.lastD) < 6) return;
    this.lastD = d;
    let n = 0; let nl = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p.keep > this.density && !p.always) continue;
      const rel = (p.d ?? 0) - d;
      if (rel < this.window[0] || rel > this.window[1]) continue;
      if (this.lod && rel > this.lodDist) { this.lod.setMatrixAt(nl++, this.mats[i]); continue; }
      for (const m of this.meshes) { m.setMatrixAt(n, this.mats[i]); if (this.cols) m.setColorAt(n, this.cols[i]); }
      n++;
    }
    for (const m of this.meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    if (this.lod) { this.lod.count = nl; this.lod.instanceMatrix.needsUpdate = true; }
  }
}
function hash01(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// Comodità: istanze di un modello glTF (altezza in metri)
export function scatterModel(scene, gltf, placements, { kind = 'tree', heightOf = null, ...opts } = {}) {
  const info = prepareModel(gltf);
  const pl = placements.map((p) => ({ ...p, scale: (p.h ?? info.height) / info.height }));
  return new Instanced(scene, info.parts, pl, { lodGeo: opts.lod === false ? null : proxyGeometry(info, kind), ...opts });
}

// Pubblico: un tifoso "congelato" in posa, maglie colorate per istanza e salti nel vertex shader
export function crowdInstances(scene, geo, placements, opts = {}) {
  const mat = crowdMaterial();
  const inst = new Instanced(scene, [{ geo, mat: 'crowd' }], placements, { colors: true, material: mat, lodDist: 1e9, window: [-30, 180], ...opts });
  inst.material = mat;
  inst.tick = (t) => { mat.userData.time.value = t; };
  return inst;
}
