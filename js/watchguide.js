// Illustrazione originale (nessun marchio) di un orologio sportivo con i 3 passi per
// scollegare il telefono dal menu controlli: tieni premuto LUCE → Telefono → disattivato.
export function watchGuide(name = 'il tuo Garmin') {
  return `
  <div class="watch-guide">
    <svg class="watch-svg" viewBox="0 0 220 220" role="img" aria-label="Orologio: tieni premuto il tasto in alto a sinistra, poi scegli Telefono">
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
      <g class="wg-f1"><text x="110" y="104" text-anchor="middle" class="wg-time">10:08</text><text x="110" y="128" text-anchor="middle" class="wg-small">tieni premuto LUCE</text></g>
      <!-- passo 2: menu controlli con icona telefono -->
      <g class="wg-f2">
        <circle cx="80" cy="96" r="14" class="wg-ico"/><circle cx="140" cy="96" r="14" class="wg-ico"/><circle cx="80" cy="132" r="14" class="wg-ico"/>
        <circle cx="140" cy="132" r="16" class="wg-ico wg-phone-bg"/>
        <rect x="134" y="121" width="12" height="21" rx="3" class="wg-phone"/>
        <text x="110" y="168" text-anchor="middle" class="wg-small">Telefono</text>
      </g>
      <!-- passo 3: telefono scollegato -->
      <g class="wg-f3">
        <rect x="102" y="86" width="16" height="28" rx="4" class="wg-phone-off"/><path d="M94 82l32 36" class="wg-cross"/>
        <text x="110" y="140" text-anchor="middle" class="wg-small">Telefono</text><text x="110" y="156" text-anchor="middle" class="wg-small wg-off">disattivato</text>
      </g>
      <text x="8" y="50" class="wg-label">LUCE</text>
    </svg>
    <ol class="wg-steps">
      <li>Su ${name} <b>tieni premuto il tasto LUCE</b> (in alto a sinistra) per aprire i controlli.</li>
      <li>Tocca l'icona <b>Telefono</b>.</li>
      <li>Il telefono risulta <b>scollegato</b>: ora ${name} si aggancia a "Spindro". A fine allenamento rifai lo stesso gesto per ricollegarlo e sincronizzare.</li>
    </ol>
    <p class="fine">Non vedi l'icona Telefono? Aggiungila in Impostazioni → Controlli sull'orologio.</p>
  </div>`;
}

export const GARMIN_RE = /fenix|f[eē]nix|epix|forerunner|venu|vivoactive|instinct|enduro|edge|approach|descent|marq|tactix|quatix|bounty|garmin/i;
