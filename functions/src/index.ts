// Cloud Functions di Spindro (regione europe-west1, dentro la multiregione Firestore eur3).
// Modello dati e motivazioni: docs/account-architettura.md
// Nessun segreto qui dentro: l'Admin SDK usa l'account di servizio del progetto.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as functionsV1 from 'firebase-functions/v1';
import { logger } from 'firebase-functions';
import { isoWeek, monthKey, sortKeyOf, validateScore } from './validate';

initializeApp();
const db = getFirestore();

const REGION = 'europe-west1';
// tetto alle istanze: protegge il budget anche in caso di abuso
setGlobalOptions({ region: REGION, maxInstances: 5, memory: '256MiB' });

const RATE = {
  minGapMs: 20_000, // al massimo un punteggio ogni 20 s
  perDay: 100, // e 100 al giorno per utente
};

// ---------------------------------------------------------------------------
// submitScore: unica via per scrivere nelle classifiche
// ---------------------------------------------------------------------------
export const submitScore = onCall({ enforceAppCheck: true, cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Serve l\'accesso');
  const tok = req.auth!.token;
  if (tok.firebase?.sign_in_provider !== 'google.com' && tok.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Email non verificata');
  }

  const check = validateScore(req.data);
  if (!check.ok) {
    logger.warn('punteggio rifiutato', { uid, reason: check.reason });
    await db.doc(`users/${uid}/server/state`).set({ rejected: FieldValue.increment(1) }, { merge: true });
    throw new HttpsError('invalid-argument', `Punteggio non valido (${check.reason})`);
  }
  const { value, rule, boardId } = check;

  const now = new Date();
  const week = isoWeek(now);
  const today = now.toISOString().slice(0, 10);
  const stateRef = db.doc(`users/${uid}/server/state`);
  const profileRef = db.doc(`users/${uid}`);
  const runRef = db.doc(`users/${uid}/server/runs`); // runId già visti oggi
  const refs = {
    all: db.doc(`boards/${boardId}/periods/all/entries/${uid}`),
    week: db.doc(`boards/${boardId}/periods/${week}/entries/${uid}`),
  };

  return db.runTransaction(async (tx) => {
    const [state, profile, runs, all, wk] = await Promise.all([
      tx.get(stateRef), tx.get(profileRef), tx.get(runRef), tx.get(refs.all), tx.get(refs.week),
    ]);
    if (!profile.exists) throw new HttpsError('failed-precondition', 'Crea prima il profilo');
    const s = state.data() ?? {};
    if (s.banned === true) throw new HttpsError('permission-denied', 'Classifiche non disponibili per questo account');
    // stessa partita inviata due volte (la rete ha ripetuto la chiamata): risposta idempotente
    const seenToday = runs.get('day') === today;
    if (seenToday && runs.get(`ids.${value.runId}`)) return { ok: true, duplicate: true, week };
    const lastMs = (s.lastSubmitAt as Timestamp | undefined)?.toMillis() ?? 0;
    if (now.getTime() - lastMs < RATE.minGapMs) throw new HttpsError('resource-exhausted', 'Troppo veloce, riprova tra poco');
    const dayCount = s.day === today ? (s.dayCount as number) || 0 : 0;
    if (dayCount >= RATE.perDay) throw new HttpsError('resource-exhausted', 'Limite giornaliero raggiunto');

    const p = profile.data()!;
    const key = sortKeyOf(rule, value.score);
    const entry = {
      uid,
      name: p.displayName,
      country: p.country ?? null,
      score: value.score,
      sortKey: key,
      ...(value.stage !== undefined ? { stage: value.stage } : {}),
      at: FieldValue.serverTimestamp(),
    };
    const improved = { all: false, week: false };
    for (const [k, snap] of [['all', all], ['week', wk]] as const) {
      const prev = snap.get('sortKey') as number | undefined;
      if (prev === undefined || key > prev) { tx.set(refs[k], entry); improved[k] = true; }
    }
    tx.set(stateRef, { lastSubmitAt: Timestamp.fromDate(now), day: today, dayCount: dayCount + 1 }, { merge: true });
    // runId di oggi per riconoscere i doppioni (mappa piccola: al massimo RATE.perDay voci, si azzera ogni giorno)
    tx.set(runRef, { day: today, ids: { [value.runId]: true } }, { merge: seenToday });
    return { ok: true, improved, week };
  });
});

// ---------------------------------------------------------------------------
// Cancellazione: dati Firestore dell'utente + righe in classifica + account Auth
// ---------------------------------------------------------------------------
async function purgeUserData(uid: string): Promise<void> {
  // tutto ciò che sta sotto users/{uid}: uscite, allenamenti, impostazioni, sfide, medaglie, stato server
  await db.recursiveDelete(db.doc(`users/${uid}`));
  // righe di classifica (tutte le classifiche, tutti i periodi)
  const writer = db.bulkWriter();
  for (;;) {
    const page = await db.collectionGroup('entries').where('uid', '==', uid).limit(400).get();
    if (page.empty) break;
    page.docs.forEach((d) => writer.delete(d.ref));
    await writer.flush();
    if (page.size < 400) break;
  }
  await writer.close();
  logger.info('dati utente cancellati', { uid });
}

// chiamata dall'app (Impostazioni → Account → Elimina account), dopo una nuova autenticazione.
// Niente enforceAppCheck: cancellare il proprio account deve funzionare sempre (GDPR, Play).
export const deleteAccount = onCall({ cors: true }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Serve l\'accesso');
  // accesso recente (10 min): evita che un telefono lasciato aperto cancelli l'account per sbaglio
  const authTime = Number(req.auth!.token.auth_time) * 1000;
  if (!authTime || Date.now() - authTime > 10 * 60_000) {
    throw new HttpsError('failed-precondition', 'Accedi di nuovo per confermare');
  }
  await purgeUserData(uid);
  await getAuth().deleteUser(uid); // fa scattare anche onAuthUserDeleted, che trova già tutto pulito
  return { ok: true };
});

// account cancellato da console (richiesta via email) o da deleteAccount: pulizia idempotente.
// Gli eventi Auth esistono solo nella prima generazione delle funzioni.
export const onAuthUserDeleted = functionsV1.region(REGION).auth.user().onDelete(async (user) => {
  await purgeUserData(user.uid);
});

// ---------------------------------------------------------------------------
// onUserCreate (facoltativa): crea lo stato anti-abuso, scrivibile solo dal server
// ---------------------------------------------------------------------------
export const onUserCreate = functionsV1.region(REGION).auth.user().onCreate(async (user) => {
  await db.doc(`users/${user.uid}/server/state`).set({
    createdAt: FieldValue.serverTimestamp(), banned: false, flags: 0, rejected: 0, dayCount: 0,
  }, { merge: true });
});

// ---------------------------------------------------------------------------
// Revoca del consenso al battito: cancella il battito già salvato (privacy, sez. 5)
// ---------------------------------------------------------------------------
export const onProfileUpdated = onDocumentUpdated('users/{uid}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const had = before?.consents?.hrCloud?.granted === true;
  const has = after?.consents?.hrCloud?.granted === true;
  if (!had || has) return;
  const uid = event.params.uid;
  const writer = db.bulkWriter();
  // revoca rara: si leggono tutte le uscite (solo il campo hr, che non è indicizzato)
  const rides = (await db.collection(`users/${uid}/rides`).select('hr').get()).docs.filter((d) => d.get('hr') !== undefined);
  rides.forEach((d) => writer.update(d.ref, { hr: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }));
  writer.delete(db.doc(`users/${uid}/settings/hr`));
  await writer.close();
  logger.info('battito cancellato dopo la revoca', { uid, rides: rides.length });
});

// ---------------------------------------------------------------------------
// Sfide del mese: avanzamento calcolato dal server a ogni nuova uscita
// ---------------------------------------------------------------------------
interface ChallengeDef { id: string; metric: 'km' | 'minutes' | 'rides' | 'kj'; target: number; }

export const onRideCreated = onDocumentCreated('users/{uid}/rides/{rideId}', async (event) => {
  const r = event.data?.data();
  if (!r || r.deleted) return;
  const created = new Date(event.time);
  const month = monthKey(created);
  // conta solo uscite del mese corrente, salvate entro 2 giorni dalla fine (niente storici importati)
  const end = Number(r.t) + Number(r.dur) * 1000;
  if (monthKey(new Date(Number(r.t))) !== month || created.getTime() - end > 2 * 864e5 || r.src === 'import') return;
  const uid = event.params.uid;
  const defs = ((await db.doc(`challenges/${month}`).get()).get('items') ?? []) as ChallengeDef[];
  const progRef = db.doc(`users/${uid}/challenges/${month}`);
  await db.runTransaction(async (tx) => {
    const prog = (await tx.get(progRef)).data() ?? {};
    // idempotenza: un evento può arrivare più di una volta
    if (prog.counted?.[event.params.rideId]) return;
    const next = {
      km: (prog.km ?? 0) + Number(r.km || 0),
      minutes: (prog.minutes ?? 0) + Math.round(Number(r.dur || 0) / 60),
      rides: (prog.rides ?? 0) + 1,
      kj: (prog.kj ?? 0) + Number(r.kj || 0),
    };
    tx.set(progRef, { ...next, counted: { [event.params.rideId]: true }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    for (const c of defs) {
      if (next[c.metric] >= c.target && (prog[c.metric] ?? 0) < c.target) {
        tx.set(db.doc(`users/${uid}/medals/${month}-${c.id}`), { month, challenge: c.id, at: FieldValue.serverTimestamp() });
      }
    }
  });
});
