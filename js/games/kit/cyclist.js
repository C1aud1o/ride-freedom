// Ciclista vero: personaggio Quaternius (CC0) con scheletro, pose calcolate sulle ossa a ogni fotogramma.
// - gambe: IK a due ossa (anca → ginocchio → caviglia) sui pedali, ginocchio in avanti;
// - busto inclinato, testa che guarda la strada, braccia IK sulle leve del manubrio;
// - fuori sella quando si spinge forte (bici che ondeggia), braccia alzate sul podio.
// Tutto il personaggio è un'unica mesh (colori per vertice) + casco cucito sull'osso della testa:
// 1 draw call per il corpo, 4 per la bici (telaio, 2 ruote, pedivelle).
import * as THREE from 'three';
import { mergeGeometries } from '../../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { loadGLTF } from './loader.js';
import { toonMaterial } from './style.js';

export const CYCLIST_URL = 'assets/3d/quaternius/cyclist.glb';
export const FAN_URL = 'assets/3d/quaternius/fan.glb';

// parti del corpo (per colorare la maglia di ognuno)
const PART = { skin: 0, jersey: 1, accent: 2, shorts: 3, shoes: 4, hair: 5, dark: 6, helmet: 7, lens: 8 };
const MAT_PART = { Skin: PART.skin, Skin_Darker: PART.skin, White: PART.accent, Red_Dark: PART.shoes, LightBlue: PART.shorts, LightBrown: PART.jersey, Hair: PART.hair, Eyebrows: PART.dark, Eye: PART.dark };

// misure della bici (m), avanti = +Z
export const BIKE = { wheelR: 0.35, wheelbase: 1.0, bb: new THREE.Vector3(0, 0.29, 0), crank: 0.17, saddle: new THREE.Vector3(0, 0.93, -0.2), hood: new THREE.Vector3(0.2, 0.98, 0.47) };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- modello base (una volta per file) ----------
const templates = new Map();
export function loadCyclistTemplate(url = CYCLIST_URL) {
  if (!templates.has(url)) templates.set(url, loadGLTF(url).then((g) => buildTemplate(g)));
  return templates.get(url);
}

function buildTemplate(gltf) {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const meshes = []; scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  // ossa condivise, nella posa del file (a T): da qui le matrici inverse "vere" (in metri), uguali per tutte le parti.
  // Ogni parte quantizzata ha matrici inverse proprie: si cuociono i vertici nel mondo con lo skinning di three.
  scene.updateMatrixWorld(true);
  const bones = meshes[0].skeleton.bones;
  const boneIndex = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  const skeleton = new THREE.Skeleton(bones, bones.map((b) => b.matrixWorld.clone().invert()));
  const geos = [];
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const src = m.geometry; const n0 = src.attributes.position.count;
    const pos = new Float32Array(n0 * 3);
    for (let i = 0; i < n0; i++) { v.fromBufferAttribute(src.attributes.position, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld); v.toArray(pos, i * 3); }
    const g = new THREE.BufferGeometry();
    const toArr = (a, Type) => { const o = new Type(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) o[i * a.itemSize + c] = a.getComponent(i, c); return o; };
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const si = toArr(src.attributes.skinIndex, Uint16Array);
    const map = m.skeleton.bones.map((b) => boneIndex[b.name] ?? 0); // ordine delle ossa della parte → comune
    for (let i = 0; i < si.length; i++) si[i] = map[si[i]];
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(toArr(src.attributes.skinWeight, Float32Array), 4));
    if (src.index) g.setIndex(src.index.clone());
    const n = n0; const part = new Float32Array(n);
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.index ? src.index.count : n, materialIndex: 0 }];
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const gr of groups) {
      const p = MAT_PART[mats[gr.materialIndex]?.name] ?? PART.skin;
      for (let i = gr.start; i < gr.start + gr.count; i++) part[src.index ? src.index.getX(i) : i] = p;
    }
    g.setAttribute('part', new THREE.BufferAttribute(part, 1));
    geos.push(g);
  }
  // casco e occhiali, cuciti all'osso della testa
  const head = bones[boneIndex.Head];
  const headPos = head.getWorldPosition(new THREE.Vector3());
  const box = new THREE.Box3(); for (const g of geos) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const top = box.max.y; const hs = (top - headPos.y);
  geos.push(rigid(helmetGeo(hs), headPos.clone().add(V(0, hs * 0.52, -hs * 0.02)), boneIndex.Head, PART.helmet));
  geos.push(rigid(glassesGeo(hs), headPos.clone().add(V(0, hs * 0.3, hs * 0.03)), boneIndex.Head, PART.lens));
  const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  merged.computeVertexNormals(); // non indicizzata: normali per faccia, aspetto low-poly
  merged.computeBoundingSphere();
  const bindPos = {}; for (const b of bones) bindPos[b.name] = b.getWorldPosition(new THREE.Vector3());
  return { gltf, scene, skeleton, boneIndex, geo: merged, bindPos, height: top - box.min.y, minY: box.min.y };
}

function rigid(geo, pos, bone, part) {
  geo.translate(pos.x, pos.y, pos.z);
  for (const k of Object.keys(geo.attributes)) if (k !== 'position') geo.deleteAttribute(k);
  const n = geo.attributes.position.count;
  const si = new Uint16Array(n * 4); const sw = new Float32Array(n * 4); const pa = new Float32Array(n).fill(part);
  for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setAttribute('part', new THREE.BufferAttribute(pa, 1));
  return geo.index ? geo.toNonIndexed() : geo;
}
function helmetGeo(hs) {
  const g = new THREE.SphereGeometry(hs * 0.62, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  g.scale(0.95, 0.8, 1.22);
  return g;
}
function glassesGeo(hs) { const g = new THREE.CylinderGeometry(hs * 0.62, hs * 0.62, hs * 0.13, 12, 1, true, -0.9, 1.8); g.scale(0.82, 1, 0.95); return g; }

// colori per vertice di un ciclista (le altre informazioni restano condivise)
function kitColors(tpl, kit) {
  const part = tpl.geo.attributes.part.array; const out = new Float32Array(part.length * 3);
  const cols = [kit.skin, kit.jersey, kit.accent, kit.shorts, kit.shoes, kit.hair, '#1b1714', kit.helmet, '#1d2430'].map((c) => new THREE.Color(c));
  for (let i = 0; i < part.length; i++) cols[part[i]].toArray(out, i * 3);
  return new THREE.BufferAttribute(out, 3);
}

const SKINS = ['#e0ac7e', '#c68e5f', '#8d5a3a', '#f0c8a0', '#b07850'];
const HAIR = ['#2a1a10', '#5a3a1e', '#141010', '#a0662a', '#d8b878'];
export function makeKit(jersey, i = 0, extra = {}) {
  const c = new THREE.Color(jersey); const hsl = {}; c.getHSL(hsl);
  const accent = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s), hsl.l > 0.55 ? 0.22 : 0.92);
  return { jersey, accent: '#' + accent.getHexString(), shorts: '#17161c', shoes: '#f2f2f2', helmet: jersey, skin: SKINS[i % SKINS.length], hair: HAIR[(i * 3) % HAIR.length], frame: jersey, ...extra };
}

// ---------- bici low-poly dettagliata (geometrie unite, colori per vertice) ----------
function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const c = new THREE.Color(color); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function tube(a, b, r, color, sides = 6, r2 = r) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r2, r, len, sides, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
  return colored(g, color);
}
const FRAME_SLOT = '#ff00ff'; // segnaposto: diventa il colore del telaio di ciascuno

function bikeParts() {
  const B = BIKE; const rear = V(0, B.wheelR, -B.wheelbase * 0.42); const front = V(0, B.wheelR, B.wheelbase * 0.58);
  const bb = B.bb; const seatTop = V(0, 0.8, -0.13); const head = V(0, 0.78, 0.42); const headLow = V(0, 0.64, 0.46);
  const dark = '#1c1c22'; const metal = '#b9bec8'; const bar = '#202026';
  const frame = [];
  frame.push(tube(bb, seatTop, 0.026, FRAME_SLOT, 7), tube(bb, headLow, 0.032, FRAME_SLOT, 7, 0.028), tube(seatTop, head, 0.024, FRAME_SLOT, 7));
  frame.push(tube(headLow, head.clone().add(V(0, 0.06, -0.015)), 0.034, FRAME_SLOT, 8));
  for (const sx of [-1, 1]) {
    const r = rear.clone().add(V(sx * 0.06, 0, 0));
    frame.push(tube(bb.clone().add(V(sx * 0.03, 0, 0)), r, 0.014, FRAME_SLOT), tube(seatTop.clone().add(V(sx * 0.02, -0.03, 0)), r, 0.012, FRAME_SLOT));
    const f = front.clone().add(V(sx * 0.055, 0, 0));
    frame.push(tube(headLow.clone().add(V(sx * 0.02, 0, 0)), f, 0.016, FRAME_SLOT, 6, 0.012));
  }
  // reggisella, sella, attacco e piega manubrio
  const seatPost = V(0, B.saddle.y - 0.04, B.saddle.z + 0.01);
  frame.push(tube(seatTop, seatPost, 0.014, dark));
  const saddle = new THREE.CylinderGeometry(0.075, 0.03, 0.27, 6); saddle.rotateX(Math.PI / 2); saddle.scale(1, 0.32, 1); saddle.translate(0, B.saddle.y - 0.02, B.saddle.z + 0.02);
  frame.push(colored(saddle, dark));
  const stemEnd = V(0, 0.86, 0.53);
  frame.push(tube(head.clone().add(V(0, 0.06, -0.015)), stemEnd, 0.016, dark));
  frame.push(tube(V(-0.21, 0.86, 0.53), V(0.21, 0.86, 0.53), 0.013, bar));
  for (const sx of [-1, 1]) {
    // la "goccia": avanti alle leve, giù e indietro
    const p0 = V(sx * 0.2, 0.86, 0.53); const p1 = V(sx * 0.2, 0.87, 0.6); const p2 = V(sx * 0.2, 0.8, 0.64); const p3 = V(sx * 0.2, 0.72, 0.6); const p4 = V(sx * 0.2, 0.72, 0.52);
    frame.push(tube(p0, p1, 0.013, bar), tube(p1, p2, 0.013, bar), tube(p2, p3, 0.013, bar), tube(p3, p4, 0.013, bar));
    frame.push(tube(p1, p1.clone().add(V(0, 0.06, 0.025)), 0.02, dark, 6, 0.015)); // leve
  }
  // borraccia, guarnitura, catena e deragliatore
  frame.push(tube(V(0, 0.42, 0.13), V(0, 0.62, 0.22), 0.034, '#f4f4f0', 8), tube(V(0, 0.62, 0.22), V(0, 0.65, 0.235), 0.015, dark));
  const ring = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16); ring.rotateZ(Math.PI / 2); ring.translate(0.055, bb.y, bb.z);
  frame.push(colored(ring, metal));
  frame.push(tube(V(0.055, bb.y + 0.1, bb.z), V(0.055, rear.y + 0.045, rear.z), 0.006, '#3a3a40', 4), tube(V(0.055, bb.y - 0.1, bb.z), V(0.055, rear.y - 0.07, rear.z + 0.02), 0.006, '#3a3a40', 4));
  const cass = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10); cass.rotateZ(Math.PI / 2); cass.translate(0.05, rear.y, rear.z); frame.push(colored(cass, metal));
  const der = new THREE.BoxGeometry(0.02, 0.08, 0.04); der.translate(0.07, rear.y - 0.06, rear.z + 0.01); frame.push(colored(der, dark));
  const frameGeo = mergeGeometries(frame, false); frameGeo.computeVertexNormals();
  // ruota: copertone, cerchio alto in carbonio con striscia, mozzo e raggi
  const wheel = [];
  const tyre = new THREE.TorusGeometry(B.wheelR - 0.015, 0.015, 5, 28); tyre.rotateY(Math.PI / 2); wheel.push(colored(tyre, '#151518'));
  const rim = new THREE.RingGeometry(B.wheelR - 0.085, B.wheelR - 0.028, 28, 1); rim.rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) { const r = rim.clone(); r.translate(sx * 0.011, 0, 0); if (sx < 0) r.rotateY(Math.PI); wheel.push(colored(r, '#26262c')); }
  const stripe = new THREE.RingGeometry(B.wheelR - 0.06, B.wheelR - 0.048, 28, 1); stripe.rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) { const r = stripe.clone(); r.translate(sx * 0.0125, 0, 0); if (sx < 0) r.rotateY(Math.PI); wheel.push(colored(r, FRAME_SLOT)); }
  const hub = new THREE.CylinderGeometry(0.02, 0.02, 0.09, 8); hub.rotateZ(Math.PI / 2); wheel.push(colored(hub, metal));
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2; const sx = k % 2 ? 1 : -1;
    wheel.push(tube(V(sx * 0.03, 0, 0), V(0, Math.cos(a) * (B.wheelR - 0.085), Math.sin(a) * (B.wheelR - 0.085)), 0.0025, metal, 3));
  }
  const wheelGeo = mergeGeometries(wheel, false); wheelGeo.computeVertexNormals();
  // pedivelle e pedali (girano attorno all'asse X del movimento centrale)
  const crank = [];
  for (const sx of [-1, 1]) {
    const up = sx > 0 ? 1 : -1;
    crank.push(tube(V(sx * 0.075, 0, 0), V(sx * 0.085, up * B.crank, 0), 0.012, metal, 5));
    const pedal = new THREE.BoxGeometry(0.09, 0.02, 0.07); pedal.translate(sx * 0.13, up * B.crank, 0); crank.push(colored(pedal, dark));
  }
  const crankGeo = mergeGeometries(crank, false); crankGeo.computeVertexNormals();
  return { frameGeo, wheelGeo, crankGeo, rear, front };
}
let parts = null;
function recolor(geo, color) {
  const src = geo.attributes.color.array; const out = new Float32Array(src.length); const c = new THREE.Color(color); const slot = new THREE.Color(FRAME_SLOT);
  for (let i = 0; i < src.length; i += 3) {
    const isSlot = Math.abs(src[i] - slot.r) < 0.01 && Math.abs(src[i + 1] - slot.g) < 0.01 && Math.abs(src[i + 2] - slot.b) < 0.01;
    out[i] = isSlot ? c.r : src[i]; out[i + 1] = isSlot ? c.g : src[i + 1]; out[i + 2] = isSlot ? c.b : src[i + 2];
  }
  const g = new THREE.BufferGeometry();
  for (const k of Object.keys(geo.attributes)) if (k !== 'color') g.setAttribute(k, geo.attributes[k]);
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  g.boundingSphere = geo.boundingSphere; g.boundingBox = geo.boundingBox;
  return g;
}

let sharedMat = null; let bikeMat = null;
export function cyclistMaterial() { return sharedMat || (sharedMat = toonMaterial({ vertexColors: true })); }
function bikeMaterial() { return bikeMat || (bikeMat = toonMaterial({ vertexColors: true })); }

// ---------- un ciclista ----------
const _v = new THREE.Vector3(); const _v2 = new THREE.Vector3(); const _q = new THREE.Quaternion(); const _q2 = new THREE.Quaternion(); const _m = new THREE.Matrix4();

export class Cyclist {
  constructor(tpl, kit, { shadows = true, name = '' } = {}) {
    this.tpl = tpl; this.kit = kit; this.name = name;
    this.root = new THREE.Group(); // posizione sulla strada
    this.lean = new THREE.Group(); // piega e ondeggio della bici
    this.root.add(this.lean);
    // bici
    if (!parts) { parts = bikeParts(); parts.frameGeo.computeBoundingSphere(); parts.wheelGeo.computeBoundingSphere(); }
    const bm = bikeMaterial();
    this.frame = new THREE.Mesh(recolor(parts.frameGeo, kit.frame), bm);
    const wheelGeo = recolor(parts.wheelGeo, kit.frame);
    this.wheels = [parts.rear, parts.front].map((p) => { const w = new THREE.Mesh(wheelGeo, bm); w.position.copy(p); return w; });
    this.crank = new THREE.Mesh(parts.crankGeo, bm); this.crank.position.copy(BIKE.bb);
    this.bike = new THREE.Group(); this.bike.add(this.frame, ...this.wheels, this.crank);
    this.lean.add(this.bike);
    // corpo: scheletro clonato + mesh unita
    const arm = tpl.scene.children[0].clone(true); // l'armatura (le mesh clonate si tolgono)
    const drop = []; arm.traverse((o) => { if (o.isMesh) drop.push(o); }); drop.forEach((o) => o.parent.remove(o));
    const byName = {}; arm.traverse((o) => { if (o.isBone) byName[o.name] = o; });
    const bones = tpl.skeleton.bones.map((b) => byName[b.name]);
    const geo = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'skinIndex', 'skinWeight']) geo.setAttribute(k, tpl.geo.attributes[k]);
    geo.setAttribute('color', kitColors(tpl, kit)); geo.boundingSphere = tpl.geo.boundingSphere;
    this.body = new THREE.SkinnedMesh(geo, cyclistMaterial());
    this.rig = new THREE.Group(); this.rig.add(arm); this.rig.add(this.body);
    this.body.bind(new THREE.Skeleton(bones, tpl.skeleton.boneInverses), new THREE.Matrix4()); // bindMatrix già applicata alla geometria
    this.body.frustumCulled = false; // la sfera di contorno della posa di legame non segue la posa in bici
    this.lean.add(this.rig);
    this.bones = byName;
    this.setShadows(shadows);
    this.calibrate();
    this.phase = Math.random() * Math.PI * 2; this.stand = 0; this.mode = 'ride'; this.t = Math.random() * 10; this.wave = 0;
    this.pose(0, 0, 0);
  }

  setShadows(on) { for (const m of [this.frame, this.body, ...this.wheels]) m.castShadow = on; }

  // misure dalla posa di legame, scala per far arrivare le gambe ai pedali, riferimenti delle ossa
  calibrate() {
    const P = this.tpl.bindPos; const B = this.bones;
    this.body.skeleton.pose();
    const thigh = P['UpperLegL'].distanceTo(P['LowerLegL']); const shin = P['LowerLegL'].distanceTo(P['FootL']);
    const hipMid = P['UpperLegL'].clone().add(P['UpperLegR']).multiplyScalar(0.5);
    // distanza massima anca → caviglia sul giro di pedale, con la caviglia 7 cm sopra il pedale
    const hip = BIKE.saddle.clone().add(V(0, 0.07, -0.02));
    let maxD = 0; for (let a = 0; a < Math.PI * 2; a += 0.2) maxD = Math.max(maxD, Math.hypot(BIKE.bb.y - BIKE.crank * Math.cos(a) + 0.07 - hip.y, BIKE.bb.z + BIKE.crank * Math.sin(a) - 0.02 - hip.z));
    const s = maxD / (0.96 * (thigh + shin));
    this.scale = s;
    this.rig.scale.setScalar(s);
    this.rig.position.set(-hipMid.x * s, hip.y - hipMid.y * s, hip.z - hipMid.z * s);
    this.rig.updateMatrixWorld(true);
    this.len = { thigh: thigh * s, shin: shin * s, upper: P['UpperArmL'].distanceTo(P['LowerArmL']) * s, fore: P['LowerArmL'].distanceTo(P['WristL']) * s };
    this.hip0 = hip;
    // per ogni osso: quaternione di riferimento (spazio del ciclista) e asse verso il figlio
    const names = ['Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Head', 'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'WristL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'WristR'];
    const child = { Hips: 'Abdomen', Abdomen: 'Torso', Torso: 'Chest', Chest: 'Neck', Neck: 'Head', 'UpperLegL': 'LowerLegL', 'LowerLegL': 'FootL', 'UpperLegR': 'LowerLegR', 'LowerLegR': 'FootR', 'ShoulderL': 'UpperArmL', 'UpperArmL': 'LowerArmL', 'LowerArmL': 'WristL', 'ShoulderR': 'UpperArmR', 'UpperArmR': 'LowerArmR', 'LowerArmR': 'WristR' };
    this.ref = {};
    const rootInv = this.lean.matrixWorld.clone().invert(); const rq = new THREE.Quaternion(); new THREE.Matrix4().extractRotation(rootInv).decompose(new THREE.Vector3(), rq, new THREE.Vector3());
    this.lean.updateMatrixWorld(true);
    const leanQinv = this.lean.getWorldQuaternion(new THREE.Quaternion()).invert();
    for (const n of names) {
      const b = B[n]; if (!b) continue;
      const q = leanQinv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
      let axis;
      if (child[n] && B[child[n]]) axis = B[child[n]].position.clone().normalize();
      else axis = V(0, 1, 0);
      // asse "di lato" per controllare la torsione (x locale)
      this.ref[n] = { q, axis, rest: b.quaternion.clone() };
    }
    // nel file il bacino è girato (~26°) e il busto lo compensa: si raddrizzano bacino e gambe nei riferimenti
    const d = P['UpperLegL'].clone().sub(P['UpperLegR']);
    this.yawFix = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -Math.atan2(-d.z, d.x));
    for (const n of ['Hips', 'Abdomen', 'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR']) if (this.ref[n]) this.ref[n].q.premultiply(this.yawFix);
  }

  // orienta un osso perché il suo asse punti verso dir (spazio "lean"), partendo sempre dal riferimento: niente deriva
  aim(name, dir, twist = 0) {
    const r = this.ref[name]; const b = this.bones[name]; if (!r || !b) return;
    _v.copy(r.axis).applyQuaternion(r.q).normalize();
    _q.setFromUnitVectors(_v, _v2.copy(dir).normalize()).multiply(r.q);
    if (twist) _q.premultiply(_q2.setFromAxisAngle(_v2, twist));
    // quaternione locale = (quaternione del padre nello spazio lean)^-1 · desiderato
    const pq = this.leanQinv.clone().multiply(b.parent.getWorldQuaternion(_q2));
    b.quaternion.copy(pq.invert().multiply(_q));
    b.updateMatrixWorld(true);
  }
  // imposta l'orientamento di un osso (spazio lean) = rot · riferimento
  orient(name, rot) {
    const r = this.ref[name]; const b = this.bones[name]; if (!r || !b) return;
    _q.copy(rot).multiply(r.q);
    const pq = this.leanQinv.clone().multiply(b.parent.getWorldQuaternion(_q2));
    b.quaternion.copy(pq.invert().multiply(_q));
    b.updateMatrixWorld(true);
  }
  posL(name) { return this.lean.worldToLocal(this.bones[name].getWorldPosition(new THREE.Vector3())); }

  // IK a due ossa: radice → target, ginocchio/gomito verso pole
  ik2(a, b, target, pole, la, lb) {
    const H = this.posL(a);
    const d = target.clone().sub(H); let dist = d.length();
    dist = Math.min(Math.max(dist, Math.abs(la - lb) + 0.01), la + lb - 0.002);
    const u = d.normalize();
    const cosA = (la * la + dist * dist - lb * lb) / (2 * la * dist);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const v = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
    const K = H.clone().add(u.clone().multiplyScalar(cosA * la)).add(v.multiplyScalar(sinA * la));
    this.aim(a, K.clone().sub(H));
    const K2 = this.posL(b);
    this.aim(b, target.clone().sub(K2));
  }

  // dt: s; cadence: rpm; speed: m/s della ruota; opts: { stand 0..1, steer }
  pose(dt, cadence = 85, speed = 8, opts = {}) {
    this.t += dt;
    this.lean.updateWorldMatrix(true, false);
    this.leanQinv = this.lean.getWorldQuaternion(new THREE.Quaternion()).invert();
    const B = BIKE;
    for (const w of this.wheels) w.rotation.x += (speed * dt) / B.wheelR;
    if (this.mode === 'stand' || this.mode === 'cheer') return this.poseStanding(dt, opts);
    this.phase += (cadence / 60) * Math.PI * 2 * dt;
    const f = this.phase;
    this.crank.rotation.x = -f;
    const standT = opts.stand ?? 0; this.stand += (standT - this.stand) * Math.min(1, dt * 5);
    const st = this.stand;
    // ondeggio della bici fuori sella, a tempo con la pedalata
    this.bike.rotation.z = Math.sin(f) * 0.13 * st;
    this.rig.rotation.z = -Math.sin(f) * 0.04 * st;
    // anca: in sella, o sollevata e in avanti fuori sella
    const hipOff = V(0, 0.13 * st + Math.sin(f * 2) * 0.004, 0.17 * st);
    this.rig.position.y = this.baseY ?? (this.baseY = this.rig.position.y); this.rig.position.z = this.baseZ ?? (this.baseZ = this.rig.position.z);
    this.rig.position.y = this.baseY + hipOff.y; this.rig.position.z = this.baseZ + hipOff.z;
    this.rig.updateMatrixWorld(true);
    this.orient('Hips', _q.setFromAxisAngle(V(1, 0, 0), 0.3 - 0.15 * st).clone());
    // busto: 55° in avanti in sella, più dritto in piedi; testa che guarda avanti
    const leanA = 1.2 - 0.3 * st + Math.sin(f * 2) * 0.01;
    this.aim('Abdomen', V(0, Math.cos(leanA * 0.7), Math.sin(leanA * 0.7)));
    this.aim('Torso', V(0, Math.cos(leanA), Math.sin(leanA)));
    this.aim('Chest', V(0, Math.cos(leanA * 1.1), Math.sin(leanA * 1.1)));
    this.aim('Neck', V(0, Math.cos(0.75), Math.sin(0.75)));
    this.aim('Head', V(0, Math.cos(0.3), Math.sin(0.3)));
    // gambe sui pedali
    ['L', 'R'].forEach((side, i) => {
      const a = f + (i ? Math.PI : 0); const sx = side === 'L' ? 1 : -1;
      const pedal = V(sx * 0.13, B.bb.y + B.crank * Math.cos(a), B.bb.z - B.crank * Math.sin(a));
      const ankle = pedal.clone().add(V(-sx * 0.01, 0.07, -0.03));
      this.ik2(`UpperLeg${side}`, `LowerLeg${side}`, ankle, V(sx * 0.12, 0.2, 1), this.len.thigh, this.len.shin);
      // caviglia: punta in avanti e un po' in giù, si abbassa nella spinta
      const ank = 0.32 + 0.18 * Math.sin(a);
      this.aim(`Foot${side}`, V(0, -Math.sin(ank), Math.cos(ank)));
    });
    // braccia sulle leve, gomiti piegati verso l'esterno
    ['L', 'R'].forEach((side) => {
      const sx = side === 'L' ? 1 : -1;
      const hand = V(sx * B.hood.x, B.hood.y + 0.02, B.hood.z + 0.02).add(V(0, Math.sin(f) * 0.012 * st, 0));
      // la mano va un po' più in qua se il braccio non arriva
      const sh = this.posL(`UpperArm${side}`); const L = this.len.upper + this.len.fore;
      const dv = hand.clone().sub(sh); if (dv.length() > L * 0.97) hand.copy(sh).add(dv.setLength(L * 0.97));
      this.ik2(`UpperArm${side}`, `LowerArm${side}`, hand, V(sx * 1, -0.6, -0.4), this.len.upper, this.len.fore);
      this.aim(`Wrist${side}`, V(sx * 0.15, -0.2, 1));
    });
  }

  // in piedi accanto/senza bici: sul podio, a braccia alzate o salutando
  poseStanding(dt, opts) {
    this.rig.position.set(this.standX ?? 0, this.standY ?? 0, 0);
    this.rig.updateMatrixWorld(true);
    const bob = Math.sin(this.t * 3) * 0.03;
    this.orient('Hips', new THREE.Quaternion()); this.aim('Abdomen', V(0, 1, 0.02)); this.aim('Torso', V(0, 1, 0.03 + bob)); this.aim('Chest', V(0, 1, 0.02));
    this.aim('Neck', V(0, 1, 0.05)); this.aim('Head', V(0, 1, 0.12));
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      this.aim(`UpperLeg${side}`, V(sx * 0.06, -1, 0)); this.aim(`LowerLeg${side}`, V(0, -1, -0.02)); this.aim(`Foot${side}`, V(0, -0.35, 1));
      if (this.mode === 'cheer' || (side === 'R' && opts.wave)) {
        const w = Math.sin(this.t * (this.mode === 'cheer' ? 7 : 9) + (sx > 0 ? 0 : 1.3));
        this.aim(`UpperArm${side}`, V(sx * 0.45, 1, 0.1 + w * 0.08)); this.aim(`LowerArm${side}`, V(sx * (0.15 + w * 0.25), 1, 0.05));
      } else {
        this.aim(`UpperArm${side}`, V(sx * 0.25, -1, 0.05)); this.aim(`LowerArm${side}`, V(sx * 0.1, -1, 0.25));
      }
    }
  }

  // posa da tifoso/podio senza bici
  standUp(cheer = false) {
    this.mode = cheer ? 'cheer' : 'stand';
    this.bike.visible = false;
    // i piedi a terra: la caviglia del legame è a minY sopra il suolo
    this.standY = -this.tpl.minY * this.scale; this.standX = 0;
    this.rig.rotation.set(0, 0, 0);
  }
  sitDown() { this.mode = 'ride'; this.bike.visible = true; }

  dispose() { this.body.geometry.dispose(); this.frame.geometry.dispose(); this.wheels[0].geometry.dispose(); }
}

// Pubblico: personaggi semplificati "congelati" in una posa, disegnati con un solo draw call.
// Maglie di colori diversi (colore per istanza solo sulla maglia) e salti d'esultanza nel vertex shader.
export async function makeCrowdGeometry(url = FAN_URL) {
  const tpl = await loadCyclistTemplate(url);
  // posa da tifoso: braccia alzate, sul pezzo di scheletro del modello base
  const dummy = new Cyclist(tpl, makeKit('#ffffff', 0, { shorts: '#3a4a6a', helmet: '#3a2a1a', shoes: '#4a3a2a' }), { shadows: false });
  dummy.standUp(true); dummy.t = 0.3; dummy.lean.updateMatrixWorld(true); dummy.pose(0, 0, 0);
  dummy.rig.updateMatrixWorld(true);
  const body = dummy.body; const pos = body.geometry.attributes.position; const n = pos.count;
  const out = new Float32Array(n * 3); const v = new THREE.Vector3();
  const toLean = dummy.lean.matrixWorld.clone().invert();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i); body.applyBoneTransform(i, v); v.applyMatrix4(body.matrixWorld).applyMatrix4(toLean); v.toArray(out, i * 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  // la maglia (e il casco, qui berretto) prende il colore dell'istanza
  const part = tpl.geo.attributes.part.array; const tint = new Float32Array(n);
  for (let i = 0; i < n; i++) tint[i] = part[i] === 1 || part[i] === 2 ? 1 : 0;
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 1));
  geo.setAttribute('color', body.geometry.attributes.color);
  // il pubblico non porta casco né occhiali: si tolgono quei triangoli (meno lavoro per la GPU)
  const keep = []; for (let i = 0; i < n; i += 3) if (part[i] !== 7 && part[i] !== 8) keep.push(i);
  const out2 = new THREE.BufferGeometry();
  for (const k of ['position', 'tint', 'color']) {
    const a = geo.attributes[k]; const sz = a.itemSize; const arr = new Float32Array(keep.length * 3 * sz);
    keep.forEach((v, j) => arr.set(a.array.subarray(v * sz, (v + 3) * sz), j * 3 * sz));
    out2.setAttribute(k, new THREE.BufferAttribute(arr, sz));
  }
  out2.computeVertexNormals(); out2.computeBoundingSphere();
  dummy.dispose();
  return out2;
}

export function crowdMaterial() {
  const mat = toonMaterial({ vertexColors: true });
  mat.userData.time = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float tint; uniform float uTime;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(color.rgb, color.rgb * instanceColor.rgb, tint);
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.53;
          float j = max(0.0, sin(uTime * (5.0 + fract(ph) * 3.0) + ph * 6.28));
          transformed.y += j * j * 0.22;
          transformed.x += sin(uTime * 3.0 + ph) * 0.03 * transformed.y;
        #endif`);
  };
  mat.customProgramCacheKey = () => 'crowd-v1';
  return mat;
}
