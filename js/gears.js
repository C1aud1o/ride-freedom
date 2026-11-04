// Cambio virtuale stile "Zwift Cog": 24 rapporti virtuali.
// La potenza richiesta al rullo è calcolata con un modello fisico:
// velocità virtuale = cadenza × rapporto × circonferenza ruota.

export const GEARS = Array.from({ length: 24 }, (_, i) => +(0.75 * Math.pow(5.5 / 0.75, i / 23)).toFixed(2));

const G = 9.81;
const RHO = 1.2;
const WHEEL = 2.105; // m (700x25c)

export function virtualSpeed(cadence, ratio) {
  return (cadence / 60) * ratio * WHEEL; // m/s
}

export function powerForSpeed(v, { grade = 0, mass = 80, cda = 0.32, crr = 0.004, efficiency = 0.97 } = {}) {
  const theta = Math.atan(grade / 100);
  const fGravity = mass * G * Math.sin(theta);
  const fRolling = mass * G * Math.cos(theta) * crr;
  const fAero = 0.5 * RHO * cda * v * v;
  return Math.max(0, ((fGravity + fRolling + fAero) * v) / efficiency);
}
