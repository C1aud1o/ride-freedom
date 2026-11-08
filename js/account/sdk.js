// Caricamento pigro dell'SDK Firebase (modulare, da CDN gstatic con versione esatta).
// Se FIREBASE_CONFIG è vuoto questo modulo non fa NULLA: nessun import, nessuna richiesta di rete.
import { FIREBASE_CONFIG, FIREBASE_EMULATOR, FIREBASE_VERSION, FIREBASE_REGION, FIREBASE_APPCHECK_SITE_KEY } from '../config.js';

export const accountsAvailable = !!(FIREBASE_CONFIG && typeof FIREBASE_CONFIG === 'object' && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

let promise = null;
// Restituisce { auth, db, fn, authI, dbI, functions }: i moduli (auth/fs/fn) e le istanze.
export function loadSdk() {
  if (!accountsAvailable) return Promise.reject(new Error('accounts-unavailable'));
  promise ||= (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
    const [app, auth, fs, fn] = await Promise.all([
      import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore-lite.js`), import(`${base}/firebase-functions.js`),
    ]);
    const a = app.initializeApp(FIREBASE_CONFIG);
    if (FIREBASE_APPCHECK_SITE_KEY && !FIREBASE_EMULATOR) { // App Check: solo la nostra app può scrivere le classifiche
      const ac = await import(`${base}/firebase-app-check.js`);
      ac.initializeAppCheck(a, { provider: new ac.ReCaptchaV3Provider(FIREBASE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    }
    const authI = auth.getAuth(a);
    const dbI = fs.getFirestore(a);
    const functions = fn.getFunctions(a, FIREBASE_REGION);
    if (FIREBASE_EMULATOR) {
      auth.connectAuthEmulator(authI, 'http://127.0.0.1:9099', { disableWarnings: true });
      fs.connectFirestoreEmulator(dbI, '127.0.0.1', 8080);
      fn.connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    }
    return { auth, fs, fn, authI, dbI, functions };
  })().catch((e) => { promise = null; throw e; });
  return promise;
}
