// Illustrazione originale (nessun marchio) di un orologio sportivo con i 3 passi per
// scollegare il telefono dal menu controlli: tieni premuto LUCE → Telefono → disattivato.
import { t } from './i18n.js';
export function watchGuide(name = t('watch.defaultName')) {
  return `
  <div class="watch-guide">
    <svg class="watch-svg" viewBox="0 0 220 220" role="img" aria-label="${t('watch.aria')}">
      <defs><radialGradient id="wgScreen" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#1f2426"/><stop offset="1" stop-color="#0b0d0e"/></radialGradient></defs>
      <rect x="82" y="4" width="56" height="30" rx="8" fill="#2a2a2a"/><rect x="82" y="186" width="56" height="30" rx="8" fill="#2a2a2a"/>
      <!-- tasti: luce (alto sx), su, giù, start (alto dx), indietro (basso dx) -->
      <rect class="wg-btn wg-light" x="22" y="58" width="16" height="22" rx="5"/>
      <rect class="wg-btn" x="14" y="100" width="16" height="22" rx="5"/>
      <rect class="wg-btn" x="22" y="142" width="16" height="22" rx="5"/>
      <rect class="wg-btn" x="182" y="58" width="16" height="22" rx="5"/>
      <rect class="wg-btn" x="182" y="142" width="16" height="22" rx="5"/>
      <circle cx="110" cy="110" r="84" fill="#3a3d40"/><circle cx="110" cy="110" r="76" fill="#1a1c1e"/>
      <circle cx="110" cy="110" r="68" fill="url(#wgScreen)"/>
      <circle class="wg-ring" cx="30" cy="69" r="16"/>
      <!-- passo 1: quadrante -->
      <g class="wg-f1"><text x="110" y="104" text-anchor="middle" class="wg-time">10:08</text><text x="110" y="128" text-anchor="middle" class="wg-small">${t('watch.holdLight')}</text></g>
      <!-- passo 2: menu controlli con icona telefono -->
      <g class="wg-f2">
        <circle cx="80" cy="96" r="14" class="wg-ico"/><circle cx="140" cy="96" r="14" class="wg-ico"/><circle cx="80" cy="132" r="14" class="wg-ico"/>
        <circle cx="140" cy="132" r="16" class="wg-ico wg-phone-bg"/>
        <rect x="134" y="121" width="12" height="21" rx="3" class="wg-phone"/>
        <text x="110" y="168" text-anchor="middle" class="wg-small">${t('watch.phone')}</text>
      </g>
      <!-- passo 3: telefono scollegato -->
      <g class="wg-f3">
        <rect x="102" y="86" width="16" height="28" rx="4" class="wg-phone-off"/><path d="M94 82l32 36" class="wg-cross"/>
        <text x="110" y="140" text-anchor="middle" class="wg-small">${t('watch.phone')}</text><text x="110" y="156" text-anchor="middle" class="wg-small wg-off">${t('watch.phoneOff')}</text>
      </g>
      <text x="8" y="50" class="wg-label">${t('watch.light')}</text>
    </svg>
    <ol class="wg-steps">
      <li>${t('watch.step1', { name })}</li>
      <li>${t('watch.step2')}</li>
      <li>${t('watch.step3', { name })}</li>
    </ol>
    <p class="fine">${t('watch.missing')}</p>
  </div>`;
}

export const GARMIN_RE = /fenix|f[eē]nix|epix|forerunner|venu|vivoactive|instinct|enduro|edge|approach|descent|marq|tactix|quatix|bounty|garmin/i;

// ---- Guide per le altre marche (B6) ----
// Spindro si presenta come sensore Bluetooth di potenza/cadenza/velocità chiamato "Spindro" (solo app Android).
// Fonti consultate (sintesi, non copia). Nessuna guida è stata provata su un orologio vero: i testi dicono
// "dovrebbe funzionare, segnalacelo" e non vanno cambiati in "verificato" senza una prova.
//  - COROS (ufficiale): https://support.coros.com/hc/en-us/articles/32969980964372-Connect-the-Bike-Speed-and-Cadence-Sensors-to-Other-Devices
//    e le pagine "Indoor Bike Trainer Optimizations" / "Accessories": Sistema > Accessori > aggiungi, attività Bici indoor,
//    aspettare l'icona fissa dell'accessorio prima di avviare. (Menu esatto varia per modello: Bluetooth o ANT+.)
//  - Polar (ufficiale): https://support.polar.com/en/support/troubleshooting_cadence_sensor_bluetooth_smart e
//    https://support.polar.com/sg-en/node/96728 (sensori di potenza di terzi Bluetooth per Grit X/Pacer/Vantage):
//    Impostazioni generali > Accoppia e sincronizza > Accoppia nuovo dispositivo; sensori solo Bluetooth o Dual, non solo ANT+.
//  - Wahoo ELEMNT: menu con "Add Sensor" (Aggiungi sensore), sensore vicino e attivo; fonte secondaria
//    (guida di terzi/forum), NON la documentazione Wahoo: da verificare su https://support.wahoofitness.com/
//  - Suunto: i rulli/sensori si accoppiano come "Power POD" e l'attività è Ciclismo indoor; fonte: moderatore del forum Suunto
//    (https://forum.suunto.com/post/138050), NON la documentazione ufficiale: da verificare su https://www.suunto.com/support/
//  - Apple Watch: dal watchOS 10 si accoppiano direttamente sensori Bluetooth di potenza, cadenza e velocità
//    (fonti giornalistiche, es. https://the5krunner.com/2023/06/09/watchos-10-how-to-pair-bike-sensors-cadence-speed-power/);
//    il percorso esatto nelle impostazioni NON è confermato da Apple: il testo resta generico.
export const WATCH_BRANDS = ['garmin', 'wahoo', 'coros', 'suunto', 'polar', 'apple'];

export function brandGuide(brand) {
  if (!WATCH_BRANDS.includes(brand)) brand = 'garmin';
  if (brand === 'garmin') return watchGuide();
  return `<div class="watch-guide">
    <ol class="wg-steps">
      <li>${t(`watch.${brand}.step1`)}</li>
      <li>${t(`watch.${brand}.step2`)}</li>
      <li>${t(`watch.${brand}.step3`)}</li>
    </ol>
    <p class="fine">${t('watch.brand.untested')}</p>
  </div>`;
}
