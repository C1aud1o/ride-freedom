// "Juice": scossa della camera, micro-pausa (hit-stop), rallentatore, linee di vento e coriandoli.
import * as THREE from 'three';

// Scossa a "trauma": cresce con gli eventi, si smorza da sola, ampiezza ∝ trauma²
export class Shake {
  constructor() { this.trauma = 0; this.t = 0; this.offset = new THREE.Vector3(); this.roll = 0; }
  add(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  update(dt) {
    this.t += dt; this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const k = this.trauma * this.trauma; const t = this.t * 31;
    this.offset.set(Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5, Math.sin(t * 1.7 + 1) + Math.sin(t * 2.9) * 0.4, 0).multiplyScalar(0.18 * k);
    this.roll = Math.sin(t * 1.3 + 2) * 0.035 * k;
  }
  apply(camera) { camera.position.add(this.offset); camera.rotateZ(this.roll); }
}

// Tempo di gioco: hit-stop (pausa breve) e rallentatore con ritorno morbido
export class TimeScale {
  constructor() { this.stop = 0; this.slow = 0; this.slowDur = 1; this.slowTo = 1; this.scale = 1; }
  hitStop(sec = 0.06) { this.stop = Math.max(this.stop, sec); }
  slowmo(scale = 0.3, sec = 1.2) { this.slowTo = scale; this.slow = sec; this.slowDur = sec; }
  get slowing() { return this.slow > 0; }
  step(realDt) {
    if (this.stop > 0) { this.stop -= realDt; this.scale = 0; return 0; }
    if (this.slow > 0) {
      this.slow -= realDt;
      const k = this.slow / this.slowDur; // 1 → 0
      this.scale = k > 0.25 ? this.slowTo : this.slowTo + (1 - this.slowTo) * (1 - k / 0.25);
    } else this.scale = 1;
    return realDt * this.scale;
  }
}

// Linee di vento: strisce chiare che scorrono vicino a chi è in scia (si vedono, non si leggono come HUD)
export class WindLines {
  constructor(scene, count = 40) {
    const geo = new THREE.PlaneGeometry(0.035, 1.6); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.items = Array.from({ length: count }, () => ({ z: Math.random() * 10, x: (Math.random() - 0.5) * 2.2, y: 0.3 + Math.random() * 1.6, v: 14 + Math.random() * 10 }));
    this.m = new THREE.Matrix4(); this.p = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1);
    this.strength = 0;
  }
  // anchor: Object3D davanti al quale stanno le linee (il giocatore); strength 0..1
  update(dt, anchor, strength) {
    this.strength += (strength - this.strength) * Math.min(1, dt * 4);
    this.mesh.material.opacity = 0.32 * this.strength;
    this.mesh.visible = this.strength > 0.02;
    if (!this.mesh.visible) return;
    anchor.updateMatrixWorld();
    this.items.forEach((it, i) => {
      it.z -= it.v * dt; if (it.z < -3) { it.z = 9; it.x = (Math.random() - 0.5) * 2.4; it.y = 0.3 + Math.random() * 1.6; }
      this.p.set(it.x * (1 + Math.max(0, it.z) * 0.08), it.y, it.z);
      this.m.compose(this.p, this.q, this.s.set(1, 1, 0.6 + this.strength));
      this.m.premultiply(anchor.matrixWorld);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Coriandoli: quadratini colorati che cadono girando (un solo draw call)
export class Confetti {
  constructor(scene, count = 220) {
    const geo = new THREE.PlaneGeometry(0.12, 0.07);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    const cols = ['#d9ff3d', '#ff4d9d', '#4de3ff', '#ffd166', '#ffffff', '#06d6a0'];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, c.set(cols[i % cols.length]));
    scene.add(this.mesh);
    this.items = []; this.cap = count;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3(1, 1, 1); this.p = new THREE.Vector3();
  }
  burst(x, y, z, n = 120, spread = 4) {
    for (let i = 0; i < n && this.items.length < this.cap; i++) {
      this.items.push({ x, y, z, vx: (Math.random() - 0.5) * spread * 2, vy: 4 + Math.random() * 6, vz: (Math.random() - 0.5) * spread * 2, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, t: 0, life: 3 + Math.random() * 2 });
    }
  }
  update(dt) {
    let n = 0;
    for (const it of this.items) {
      it.t += dt; it.vy -= 6 * dt; it.vx *= 0.985; it.vz *= 0.985; if (it.vy < -1.6) it.vy = -1.6;
      it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.r += it.vr * dt;
      this.e.set(it.r, it.r * 0.7, it.r * 0.3); this.q.setFromEuler(this.e);
      this.mesh.setMatrixAt(n++, this.m.compose(this.p.set(it.x, it.y, it.z), this.q, this.s));
    }
    this.items = this.items.filter((it) => it.t < it.life);
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
