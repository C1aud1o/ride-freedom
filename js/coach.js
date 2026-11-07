// Coach vocale in italiano: annuncia i tratti degli allenamenti, le salite dei percorsi, i traguardi.
// Nell'app Android usa la sintesi vocale del telefono (la WebView non parla), nel browser quella del sistema.
import { GarminBridge } from './native.js';

let enabled = localStorage.getItem('coachOn') === '1';
let last = { text: '', t: 0 };
export const coach = {
  get on() { return enabled; },
  set on(v) { enabled = v; localStorage.setItem('coachOn', v ? '1' : '0'); },
  say(text, { force = false } = {}) {
    if (!enabled && !force) return;
    const now = Date.now();
    if (text === last.text && now - last.t < 8000) return; // niente ripetizioni ravvicinate
    last = { text, t: now };
    if (GarminBridge) { GarminBridge.speak({ text }).catch(() => {}); return; }
    const ss = window.speechSynthesis; if (!ss) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT'; u.rate = 1.05;
    const v = ss.getVoices().find((x) => x.lang?.toLowerCase().startsWith('it')); if (v) u.voice = v;
    ss.cancel(); ss.speak(u);
  },
};
export const speakable = () => !!(GarminBridge || window.speechSynthesis);
// numeri leggibili: "4:30" → "4 minuti e 30"
export function spokenTime(sec) {
  sec = Math.round(sec); const m = Math.floor(sec / 60); const s = sec % 60;
  if (!m) return `${s} secondi`;
  return `${m === 1 ? 'un minuto' : `${m} minuti`}${s ? ` e ${s}` : ''}`;
}
