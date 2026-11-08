// Punto d'ingresso dell'account facoltativo. Senza FIREBASE_CONFIG in js/config.js è tutto inerte:
// nessun elemento nella pagina, nessun modulo in più, nessuna richiesta di rete.
import { accountsAvailable } from './sdk.js';

export { accountsAvailable };

export function initAccount() {
  if (!accountsAvailable) return;
  import('./ui.js').then((m) => m.mount()).catch(() => { /* l'account non deve mai rompere l'app */ });
}

// L'app avvisa quando cambia un dato da sincronizzare (uscita salvata, allenamento salvato o eliminato).
// Se questo dispositivo non è collegato a un account non succede nulla.
export function dataChanged(col, id, opts) {
  if (!accountsAvailable) return;
  try { if (!localStorage.getItem('sync:uid')) return; } catch { return; }
  import('./sync.js').then((m) => m.dataChanged(col, id, opts)).catch(() => {});
}
