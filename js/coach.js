// Coach vocale (nella lingua scelta nell'app): annuncia i tratti degli allenamenti, le salite dei percorsi, i traguardi.
// Nell'app Android usa la sintesi vocale del telefono (la WebView non parla), nel browser quella del sistema.
import { GarminBridge } from './native.js';
import { t, speechLang } from './i18n.js';

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
    if (GarminBridge) { GarminBridge.speak({ text, lang: speechLang() }).catch(() => {}); return; }
    const ss = window.speechSynthesis; if (!ss) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = speechLang(); u.rate = 1.05;
    const base = speechLang().slice(0, 2).toLowerCase();
    const v = ss.getVoices().find((x) => x.lang?.toLowerCase().replace('_', '-') === speechLang().toLowerCase()) || ss.getVoices().find((x) => x.lang?.toLowerCase().startsWith(base)); if (v) u.voice = v;
    ss.cancel(); ss.speak(u);
  },
};
export const speakable = () => !!(GarminBridge || window.speechSynthesis);
// numeri leggibili: "4:30" → "4 minuti e 30" / "4 minutes and 30"
export function spokenTime(sec) {
  sec = Math.round(sec); const m = Math.floor(sec / 60); const s = sec % 60;
  if (!m) return t('coach.seconds', { count: s });
  const minutes = t('coach.minutesOnly', { count: m });
  return s ? t('coach.minutesAnd', { minutes, seconds: s }) : minutes;
}
