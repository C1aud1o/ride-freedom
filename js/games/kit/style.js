// Stile unico dei giochi 3D (vedi docs/giochi-stile.md): palette, cielo a gradiente, luce, nebbia, materiali toon.
import * as THREE from 'three';

export const PALETTE = {
  lime: '#d9ff3d', ink: '#15141b', cream: '#fff4e0', sky: '#7fb8f0', sun: '#ffe2a8',
  grass: '#86b84f', grassDark: '#5f9440', road: '#55545c', earth: '#c08a5b', rock: '#a99a8c',
  jerseys: ['#2a9d8f', '#ff4d9d', '#7b2cbf', '#e63946', '#ffd166', '#3a86ff', '#f77f00', '#06d6a0', '#ef476f', '#118ab2'],
};

// Ore del giorno: colori del cielo (alto, orizzonte, basso), luce e nebbia.
export const TIMES = {
  morning: { top: '#5fa8e8', horizon: '#cfe7f7', bottom: '#dfeaf0', sun: '#fff1d6', sunI: 2.4, hemiSky: '#e3f1ff', hemiGround: '#6f8f4a', hemiI: 1.25, fog: '#cfe2ef', sunDir: [0.5, 0.75, -0.45], glow: '#ffffff' },
  golden: { top: '#3f7fc9', horizon: '#ffd39a', bottom: '#f2c79a', sun: '#ffd7a0', sunI: 2.6, hemiSky: '#ffe9cc', hemiGround: '#6c7a3e', hemiI: 1.15, fog: '#f0cfa6', sunDir: [0.75, 0.42, -0.5], glow: '#fff0c8' },
  dusk: { top: '#2b3f7a', horizon: '#ff9e7a', bottom: '#d98a74', sun: '#ffb38a', sunI: 2.1, hemiSky: '#ffcfb8', hemiGround: '#4f5a3a', hemiI: 1.05, fog: '#e4a48e', sunDir: [0.8, 0.25, -0.55], glow: '#ffd2a8' },
};

// Cielo: cupola con gradiente e alone del sole, segue la camera (niente bordi visibili)
export function skyDome(time) {
  const T = TIMES[time] || time;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(T.top) }, horizon: { value: new THREE.Color(T.horizon) }, bottom: { value: new THREE.Color(T.bottom) },
      glow: { value: new THREE.Color(T.glow) }, sunDir: { value: new THREE.Vector3(...T.sunDir).normalize() },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 glow; uniform vec3 sunDir; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.65, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0); c += glow * (pow(s, 64.0) * 0.9 + pow(s, 6.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), mat);
  dome.renderOrder = -10; dome.frustumCulled = false;
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  return dome;
}

// Luci dello stile: emisfera (gradiente cielo/terra) + sole con ombre che seguono il giocatore
export function styleLights(scene, time, { shadows = true, mapSize = 1024, extent = 28 } = {}) {
  const T = TIMES[time] || time;
  const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiI);
  const sun = new THREE.DirectionalLight(T.sun, T.sunI);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(mapSize, mapSize);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 160 });
  scene.add(hemi, sun, sun.target);
  const dir = new THREE.Vector3(...T.sunDir).normalize();
  return {
    hemi, sun,
    follow(x, y, z) { sun.position.set(x + dir.x * 60, y + dir.y * 60, z + dir.z * 60); sun.target.position.set(x, y, z); },
  };
}

export function styleFog(scene, time, near = 70, far = 460) {
  const T = TIMES[time] || time;
  scene.fog = new THREE.Fog(T.fog, near, far);
  return scene.fog;
}

// Rampa toon: 3 toni netti per il sole, l'emisfera aggiunge il leggero gradiente
let ramp = null;
export function toonRamp() {
  if (ramp) return ramp;
  const data = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  return ramp;
}

export function toonMaterial(params = {}) {
  return new THREE.MeshToonMaterial({ gradientMap: toonRamp(), ...params });
}

// Converte i materiali di un modello in toon (una conversione per materiale, poi riusata)
const converted = new WeakMap();
export function toonify(root, { flat = false } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const one = (m) => {
      if (!m || m.isMeshToonMaterial || m.isShaderMaterial) return m;
      const key = converted.get(m);
      if (key && key.flat === flat) return key.mat;
      const t = toonMaterial({ color: m.color, map: m.map || null, vertexColors: m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest });
      t.name = m.name;
      converted.set(m, { flat, mat: t });
      return t;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return root;
}
