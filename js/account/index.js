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

// ---- Classifiche (E5) ----
const signedIn = () => { try { return !!localStorage.getItem('sync:uid'); } catch { return false; } };

// Fine partita: invia il punteggio solo se c'è un account collegato. Mai bloccante, mai un errore verso l'utente.
export function submitGameScore(payload) {
  if (!accountsAvailable || !signedIn()) return;
  import('./boards.js').then((m) => m.submitScore(payload)).catch(() => {});
}

// Menu giochi: classifiche con account, invito discreto senza. Senza configurazione il pannello resta nascosto e non parte nulla.
export function renderBoards(el, opts) {
  if (!el) return;
  if (!accountsAvailable) { el.hidden = true; return; }
  el.hidden = false;
  import('./boards.js').then((m) => m.render(el, { ...opts, signedIn: signedIn() })).catch(() => { el.hidden = true; });
}
