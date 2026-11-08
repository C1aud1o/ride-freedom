// "Segnala il tuo rullo" (B4): costruisce l'indirizzo di una issue GitHub precompilata con il template
// .github/ISSUE_TEMPLATE/trainer_compatibility.yml. Zero server, nessun dato personale: solo il nome BLE del rullo
// (es. "Tacx Flux"), i servizi, il protocollo, le funzioni di controllo, la piattaforma e la versione dell'app.
export const REPO = 'c1aud1o/ride-freedom';
export const TEMPLATE = 'trainer_compatibility.yml';

// Le opzioni del campo "platform" nel template devono coincidere esattamente con queste.
export function platformOption({ native, android }) {
  if (native) return 'Android app';
  return android ? 'Web app (Chrome or another Chromium browser on Android)' : 'Web app (Chrome on desktop)';
}

export function buildReportUrl({ name = '', services = [], protocol = '', features = null, native = false, android = false, version = '', lang = '' } = {}) {
  const yn = (v) => (v ? 'yes' : 'no');
  const lines = [];
  lines.push(`BLE name: ${name || 'not connected'}`);
  lines.push(`BLE services: ${services.length ? services.join(', ') : 'unknown'}`);
  lines.push(`Protocol used: ${protocol || 'unknown'}`);
  if (features) lines.push(`ERG (target power) available: ${yn(features.power)}`, `Gradient (simulation) available: ${yn(features.simulation)}`, `Resistance control available: ${yn(features.resistance)}`);
  lines.push(`Platform: ${native ? 'Android app' : 'Web'}`, `App version: ${version}`);
  if (lang) lines.push(`Language: ${lang}`);
  lines.push('', 'What works and what does not:', '');
  const q = new URLSearchParams({
    template: TEMPLATE,
    title: `[Trainer] ${name || 'My trainer'}`,
    model: name,
    platform: platformOption({ native, android }),
    details: lines.join('\n'),
  });
  return `https://github.com/${REPO}/issues/new?${q.toString().replace(/\+/g, '%20')}`;
}
