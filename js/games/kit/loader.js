// Caricamento dei modelli glTF con cache: ogni file si scarica e si decodifica una volta sola.
// I .glb ottimizzati usano EXT_meshopt_compression (decoder MIT in vendor/three/addons/libs).
import { GLTFLoader } from '../../../vendor/three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../../vendor/three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

// path relativo al documento (es. 'assets/3d/quaternius/cyclist.glb')
export function loadGLTF(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(path).catch((err) => { cache.delete(path); throw err; }));
  return cache.get(path);
}

// carica una mappa { nome: percorso } e riporta l'avanzamento (0..1)
export async function loadAll(map, onProgress) {
  const out = {}; let done = 0; const entries = Object.entries(map);
  await Promise.all(entries.map(async ([k, p]) => { out[k] = await loadGLTF(p); done++; onProgress?.(done / entries.length); }));
  return out;
}
