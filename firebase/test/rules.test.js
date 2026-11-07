// Test delle regole Firestore (firebase/firestore.rules) con l'emulatore.
// Esecuzione: cd firebase && npm test   (serve Java 11+ per l'emulatore Firestore)
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc,
  deleteField, Timestamp, setLogLevel,
} from 'firebase/firestore';

setLogLevel('silent'); // i PERMISSION_DENIED attesi non sporcano l'output

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
let env;

const ALICE = 'alice';
const BOB = 'bob';
const authed = (uid, extra = {}) => env.authenticatedContext(uid, {
  email: `${uid}@example.com`, email_verified: true, firebase: { sign_in_provider: 'password' }, ...extra,
}).firestore();

function profile(over = {}) {
  return {
    displayName: 'Alice Ciclista',
    country: 'IT',
    ageOk: true,
    schema: 1,
    consents: {
      terms: { v: '2026-11', at: serverTimestamp() },
      privacy: { v: '2026-11', at: serverTimestamp() },
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...over,
  };
}

const T = 1762500000000; // 7 nov 2025, in ms
function ride(over = {}) {
  return {
    t: T, dur: 3600, km: 30.5, avgW: 180, kj: 650, np: 195, maxW: 520,
    best: { 5: 500, 60: 320, 300: 250, 1200: 210 },
    series: 'AAEC', seriesV: 1, src: 'app',
    updatedAt: serverTimestamp(),
    ...over,
  };
}

// scrive dati di partenza senza passare dalle regole
async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

// profilo di Alice già creato, con o senza consenso al battito
async function seedProfile(uid, hr) {
  await seed((db) => setDoc(doc(db, 'users', uid), {
    displayName: uid, ageOk: true, schema: 1,
    consents: {
      terms: { v: '2026-11', at: Timestamp.now() },
      privacy: { v: '2026-11', at: Timestamp.now() },
      ...(hr === undefined ? {} : { hrCloud: { v: '2026-11', at: Timestamp.now(), granted: hr } }),
    },
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  }));
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-spindro',
    firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); });

describe('profilo', () => {
  test('creo il mio profilo con i consensi', async () => {
    await assertSucceeds(setDoc(doc(authed(ALICE), 'users', ALICE), profile()));
  });

  test('senza login non si legge né si scrive nulla', async () => {
    await seedProfile(ALICE);
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users', ALICE)));
    await assertFails(setDoc(doc(anon, 'users', 'x'), profile()));
  });

  test('email non verificata: niente profilo', async () => {
    const db = authed(ALICE, { email_verified: false });
    await assertFails(setDoc(doc(db, 'users', ALICE), profile()));
  });

  test('accesso negato al profilo altrui', async () => {
    await seedProfile(ALICE);
    await assertFails(getDoc(doc(authed(BOB), 'users', ALICE)));
    await assertFails(setDoc(doc(authed(BOB), 'users', ALICE), profile()));
  });

  test('campi non validi rifiutati', async () => {
    const db = authed(ALICE);
    const ref = doc(db, 'users', ALICE);
    await assertFails(setDoc(ref, profile({ displayName: 'x' })));                 // troppo corto
    await assertFails(setDoc(ref, profile({ displayName: '<script>' })));          // caratteri vietati
    await assertFails(setDoc(ref, profile({ country: 'Italia' })));
    await assertFails(setDoc(ref, profile({ ageOk: false })));
    await assertFails(setDoc(ref, profile({ email: 'a@b.c' })));                   // campo extra
    await assertFails(setDoc(ref, profile({ consents: { terms: { v: '1', at: serverTimestamp() } } })));
    await assertSucceeds(setDoc(ref, profile({ displayName: 'Élodie_92' })));
  });

  test('consenso retrodatato rifiutato', async () => {
    const old = Timestamp.fromMillis(Date.now() - 864e5 * 30);
    const p = profile();
    p.consents.terms.at = old;
    await assertFails(setDoc(doc(authed(ALICE), 'users', ALICE), p));
  });

  test('aggiungo il consenso al battito solo con data attuale; createdAt non si cambia', async () => {
    await seedProfile(ALICE);
    const ref = doc(authed(ALICE), 'users', ALICE);
    await assertFails(updateDoc(ref, { 'consents.hrCloud': { v: '2026-11', at: Timestamp.fromMillis(1), granted: true }, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { 'consents.hrCloud': { v: '2026-11', at: serverTimestamp(), granted: true }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
});

describe('uscite e battito', () => {
  test('salvo una mia uscita senza battito', async () => {
    await seedProfile(ALICE);
    await assertSucceeds(setDoc(doc(authed(ALICE), 'users', ALICE, 'rides', String(T)), ride()));
  });

  test('accesso negato alle uscite altrui', async () => {
    await seedProfile(ALICE);
    await seed((db) => setDoc(doc(db, 'users', ALICE, 'rides', String(T)), { ...ride(), updatedAt: Timestamp.now() }));
    const bob = authed(BOB);
    await assertFails(getDoc(doc(bob, 'users', ALICE, 'rides', String(T))));
    await assertFails(getDocs(collection(bob, 'users', ALICE, 'rides')));
    await assertFails(setDoc(doc(bob, 'users', ALICE, 'rides', String(T + 1)), ride({ t: T + 1 })));
    await assertFails(deleteDoc(doc(bob, 'users', ALICE, 'rides', String(T))));
  });

  test('battito rifiutato senza consenso', async () => {
    await seedProfile(ALICE); // nessun consenso hrCloud
    const ref = doc(authed(ALICE), 'users', ALICE, 'rides', String(T));
    await assertFails(setDoc(ref, ride({ hr: { avgHr: 140, maxHr: 175 } })));
  });

  test('battito rifiutato con consenso revocato', async () => {
    await seedProfile(ALICE, false);
    const ref = doc(authed(ALICE), 'users', ALICE, 'rides', String(T));
    await assertFails(setDoc(ref, ride({ hr: { avgHr: 140, maxHr: 175 } })));
  });

  test('battito fuori dal campo hr sempre rifiutato', async () => {
    await seedProfile(ALICE, true);
    const ref = doc(authed(ALICE), 'users', ALICE, 'rides', String(T));
    await assertFails(setDoc(ref, ride({ avgHr: 140 })));
    await assertFails(setDoc(ref, ride({ maxHr: 175 })));
  });

  test('battito accettato con consenso esplicito', async () => {
    await seedProfile(ALICE, true);
    const ref = doc(authed(ALICE), 'users', ALICE, 'rides', String(T));
    await assertSucceeds(setDoc(ref, ride({ hr: { avgHr: 140, maxHr: 175, series: 'AAEC', seriesV: 1 } })));
  });

  test('frequenza massima (settings/hr) solo con consenso', async () => {
    await seedProfile(ALICE);
    const ref = doc(authed(ALICE), 'users', ALICE, 'settings', 'hr');
    const hrDoc = { values: { hrMax: '188' }, updatedAt: serverTimestamp() };
    await assertFails(setDoc(ref, hrDoc));
    await seedProfile(ALICE, true);
    await assertSucceeds(setDoc(ref, hrDoc));
  });

  test('uscite non plausibili rifiutate', async () => {
    await seedProfile(ALICE);
    const db = authed(ALICE);
    const put = (r) => setDoc(doc(db, 'users', ALICE, 'rides', String(r.t)), r);
    await assertFails(put(ride({ dur: 30 })));                        // meno di un minuto
    await assertFails(put(ride({ km: 200, dur: 3600 })));             // 200 km/h
    await assertFails(put(ride({ avgW: 1800 })));
    await assertFails(put(ride({ best: { 1200: 1400 } })));           // 1400 W per 20 minuti
    await assertFails(put(ride({ t: Date.now() + 3 * 864e5 })));      // nel futuro
    await assertFails(put(ride({ series: 'A'.repeat(5000) })));       // serie troppo lunga
    await assertFails(put(ride({ updatedAt: Timestamp.fromMillis(1) }))); // data inventata
    await assertFails(setDoc(doc(db, 'users', ALICE, 'rides', '123'), ride())); // id ≠ t
  });
});

describe('impostazioni e allenamenti', () => {
  test('prefs: solo chiavi note', async () => {
    await seedProfile(ALICE);
    const ref = doc(authed(ALICE), 'users', ALICE, 'settings', 'prefs');
    await assertSucceeds(setDoc(ref, { values: { ftp: '250', mass: '72' }, stamps: { ftp: 1, mass: 2 }, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(ref, { values: { ftp: '250', hrMax: '190' }, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(ref, { values: { stravaConfig: '{}' }, updatedAt: serverTimestamp() }));
  });

  test('allenamento personalizzato mio sì, di altri no', async () => {
    await seedProfile(ALICE);
    const w = { name: 'Soglia', tag: 'Mio', steps: [{ d: 600, p: 0.9 }], custom: true, updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(authed(ALICE), 'users', ALICE, 'workouts', 'my-1'), w));
    await assertFails(setDoc(doc(authed(BOB), 'users', ALICE, 'workouts', 'my-2'), w));
    await assertFails(setDoc(doc(authed(ALICE), 'users', ALICE, 'workouts', 'my-3'), { ...w, steps: new Array(500).fill({ d: 1, p: 1 }) }));
  });

  test('documenti del server: leggibili dal proprietario, mai scrivibili', async () => {
    await seed((db) => setDoc(doc(db, 'users', ALICE, 'server', 'state'), { flags: 0 }));
    const db = authed(ALICE);
    await assertSucceeds(getDoc(doc(db, 'users', ALICE, 'server', 'state')));
    await assertFails(setDoc(doc(db, 'users', ALICE, 'server', 'state'), { flags: 0, banned: false }));
    await assertFails(setDoc(doc(db, 'users', ALICE, 'medals', '2026-11-km300'), { at: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'users', ALICE, 'challenges', '2026-11'), { km: 9999 }));
    await assertFails(getDoc(doc(authed(BOB), 'users', ALICE, 'server', 'state')));
  });
});

describe('classifiche', () => {
  const entryPath = ['boards', 'mattoni', 'periods', 'all', 'entries'];
  const validEntry = { uid: ALICE, name: 'Alice', country: 'IT', score: 1200, sortKey: 1200, at: serverTimestamp() };

  test('lettura pubblica, anche senza login, a pagine', async () => {
    await seed((db) => setDoc(doc(db, ...entryPath, ALICE), { ...validEntry, at: Timestamp.now() }));
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, ...entryPath, ALICE)));
    await assertSucceeds(getDocs(query(collection(anon, ...entryPath), limit(50))));
    await assertFails(getDocs(query(collection(anon, ...entryPath), limit(500))));
    await assertFails(getDocs(collection(anon, ...entryPath))); // senza limite
  });

  test('nessuna scrittura dal client, nemmeno della propria riga valida', async () => {
    await seedProfile(ALICE);
    const db = authed(ALICE);
    await assertFails(setDoc(doc(db, ...entryPath, ALICE), validEntry));
    await assertFails(setDoc(doc(db, ...entryPath, ALICE), { ...validEntry, score: 99999999 }));
    await assertFails(setDoc(doc(db, ...entryPath, BOB), { ...validEntry, uid: BOB }));
    await assertFails(setDoc(doc(db, 'boards', 'mattoni'), { title: 'x' }));
    await assertFails(setDoc(doc(db, 'challenges', '2026-11'), { items: [] }));
  });

  test('non si cancella la riga in classifica dal client (lo fa deleteAccount)', async () => {
    await seed((db) => setDoc(doc(db, ...entryPath, ALICE), { ...validEntry, at: Timestamp.now() }));
    await assertFails(deleteDoc(doc(authed(ALICE), ...entryPath, ALICE)));
  });
});

describe('cancellazione', () => {
  test('cancello i miei dati, non quelli altrui', async () => {
    await seedProfile(ALICE);
    await seedProfile(BOB);
    await seed(async (db) => {
      await setDoc(doc(db, 'users', ALICE, 'rides', String(T)), { ...ride(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'users', BOB, 'rides', String(T)), { ...ride(), updatedAt: Timestamp.now() });
      await setDoc(doc(db, 'users', ALICE, 'settings', 'prefs'), { values: { ftp: '200' }, updatedAt: Timestamp.now() });
    });
    const alice = authed(ALICE);
    await assertSucceeds(deleteDoc(doc(alice, 'users', ALICE, 'rides', String(T))));
    await assertSucceeds(deleteDoc(doc(alice, 'users', ALICE, 'settings', 'prefs')));
    await assertSucceeds(deleteDoc(doc(alice, 'users', ALICE)));
    await assertFails(deleteDoc(doc(alice, 'users', BOB, 'rides', String(T))));
    await assertFails(deleteDoc(doc(alice, 'users', BOB)));
  });

  test('i documenti del server non si cancellano dal client', async () => {
    await seed((db) => setDoc(doc(db, 'users', ALICE, 'server', 'state'), { flags: 0 }));
    await assertFails(deleteDoc(doc(authed(ALICE), 'users', ALICE, 'server', 'state')));
  });

  test('revoca del battito: posso togliere hr dalle mie uscite', async () => {
    await seedProfile(ALICE, false);
    await seed((db) => setDoc(doc(db, 'users', ALICE, 'rides', String(T)), { ...ride(), hr: { avgHr: 140 }, updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(authed(ALICE), 'users', ALICE, 'rides', String(T)), { hr: deleteField(), updatedAt: serverTimestamp() }));
  });
});
