// Sezione "Account" nelle Impostazioni (E3). Esiste solo se FIREBASE_CONFIG è impostato (vedi account/index.js).
// L'SDK Firebase si carica solo quando serve: all'apertura se questo dispositivo era già entrato, altrimenti al primo tocco su "Accedi".
import { t, fmtDate, getLang } from '../i18n.js';
import { isNative } from '../native.js';
import { TERMS_URL, PRIVACY_URL, TERMS_VERSION, PRIVACY_VERSION, HR_CONSENT_VERSION } from '../config.js';
import { loadSdk } from './sdk.js';

const COUNTRIES = 'AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KR KW KZ LA LB LI LK LR LS LT LU LV LY MA MC MD ME MG MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PT PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SV SY SZ TD TG TH TJ TM TN TO TR TT TW TZ UA UG US UY UZ VA VE VN VU WS YE ZA ZM ZW'.split(' ');
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,23}$/u;
// Google blocca il login Google nelle WebView: nell'app Android si entra solo con email (Google nativo: compito futuro, vedi docs/account-architettura.md §10)
const inNativeApp = () => isNative || !!window.Capacitor?.isNativePlatform?.();
const SESSION_FLAG = 'account:session';

const st = { view: 'out', user: null, profile: null, busy: false, err: '', info: '', sdk: null, sync: null, email: '', needTerms: false, form: {} };
let root = null;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (sel) => root.querySelector(sel);
const hrOkNow = () => st.profile?.consents?.hrCloud?.granted === true;
const legalUrl = (u) => (getLang() === 'it' ? u.replace(/^(https?:\/\/[^/]+)/, '$1/it') : u);

// ---------- montaggio ----------
export function mount() {
  const anchor = document.getElementById('analyticsOn')?.closest('section');
  if (!anchor) return;
  root = document.createElement('section');
  root.className = 'group'; root.id = 'accountGroup';
  anchor.before(root);
  window.addEventListener('langchange', render);
  window.addEventListener('account:sync', (e) => { st.sync = e.detail; refreshSync(); });
  render();
  if (localStorage.getItem(SESSION_FLAG) === '1') connect(); // già entrato su questo dispositivo: si ripristina la sessione
}

async function ensureSdk() { return (st.sdk ||= await loadSdk()); }
async function connect() {
  try {
    connectOnce(await ensureSdk());
  } catch { st.err = t('account.err.network'); render(); }
}

// ---------- stato utente ----------
async function onUser(user) {
  st.user = user; st.err = '';
  if (!user) { st.profile = null; st.view = 'out'; localStorage.removeItem(SESSION_FLAG); stopSync(); return render(); }
  localStorage.setItem(SESSION_FLAG, '1');
  const verified = user.emailVerified || user.providerData.some((p) => p.providerId === 'google.com');
  if (!verified) { st.view = 'verify'; return render(); }
  st.view = 'loading'; render();
  try {
    await user.getIdToken(true); // il token deve contenere email_verified aggiornato
    const { fs, dbI } = st.sdk;
    const snap = await fs.getDoc(fs.doc(dbI, `users/${user.uid}`));
    if (!snap.exists()) { st.profile = null; st.view = 'onboard'; return render(); }
    st.profile = snap.data();
    const c = st.profile.consents || {};
    st.needTerms = c.terms?.v !== TERMS_VERSION || c.privacy?.v !== PRIVACY_VERSION;
    if (st.needTerms) { st.view = 'reconsent'; return render(); }
    await beginSync();
  } catch (e) { st.err = errText(e); st.view = 'in'; render(); }
}

async function beginSync() {
  const sync = await import('./sync.js');
  const prev = sync.syncedUid();
  if (prev && prev !== st.user.uid) {
    if (!confirm(t('account.mergeAsk'))) { await signOut(true); return; }
    sync.resetSyncState();
  }
  st.view = 'in'; render();
  sync.startSync({ sdk: st.sdk, uid: st.user.uid, hrOk: hrOkNow() });
}
async function stopSync() { if (localStorage.getItem('sync:uid') != null || st.sync) (await import('./sync.js')).stopSync(); }

// ---------- azioni ----------
function errText(e) {
  const c = String(e?.code || '').replace(/^(auth|functions|firestore)\//, '');
  const map = { 'invalid-credential': 'credentials', 'wrong-password': 'credentials', 'user-not-found': 'credentials', 'email-already-in-use': 'exists', 'weak-password': 'weak',
    'invalid-email': 'email', 'too-many-requests': 'tooMany', 'network-request-failed': 'network', unavailable: 'network', 'requires-recent-login': 'recent', 'failed-precondition': 'recent', 'permission-denied': 'denied' };
  return t(`account.err.${map[c] || 'generic'}`);
}
async function act(fn) {
  if (st.busy) return; st.busy = true; st.err = ''; st.info = ''; renderBusy();
  try { await fn(); } catch (e) {
    if (!['popup-closed-by-user', 'cancelled-popup-request', 'popup-blocked'].includes(String(e?.code).replace('auth/', ''))) st.err = errText(e);
    else if (String(e.code).endsWith('popup-blocked')) st.err = t('account.err.popup');
  } finally { st.busy = false; render(); }
}
const creds = () => ({ email: $('#accEmail').value.trim(), password: $('#accPass').value });

const actions = {
  google: () => act(async () => { const sdk = await ensureSdk(); connectOnce(sdk); await sdk.auth.signInWithPopup(sdk.authI, new sdk.auth.GoogleAuthProvider()); }),
  signin: () => act(async () => { const sdk = await ensureSdk(); const { email, password } = creds(); connectOnce(sdk); await sdk.auth.signInWithEmailAndPassword(sdk.authI, email, password); }),
  signup: () => act(async () => {
    const sdk = await ensureSdk(); const { email, password } = creds(); connectOnce(sdk);
    const cred = await sdk.auth.createUserWithEmailAndPassword(sdk.authI, email, password);
    await sdk.auth.sendEmailVerification(cred.user); st.info = t('account.verify.sent');
  }),
  reset: () => act(async () => {
    const sdk = await ensureSdk(); const { email } = creds();
    if (!email) { st.err = t('account.err.email'); return; }
    await sdk.auth.sendPasswordResetEmail(sdk.authI, email); st.info = t('account.reset.sent');
  }),
  resend: () => act(async () => { await st.sdk.auth.sendEmailVerification(st.user); st.info = t('account.verify.sent'); }),
  verified: () => act(async () => { await st.user.reload(); await onUser(st.sdk.authI.currentUser); }),
  signout: () => signOut(false),
  create: () => act(createProfile),
  accept: () => act(acceptTerms),
  saveProfile: () => act(saveProfile),
  syncNow: async () => { (await import('./sync.js')).syncNow(); },
  askDelete: () => { st.view = 'delete'; st.err = ''; render(); },
  cancelDelete: () => { st.view = 'in'; st.err = ''; render(); },
  doDelete: () => act(deleteAccount),
};
let connected = false;
function connectOnce(sdk) { if (connected) return; connected = true; sdk.auth.onAuthStateChanged(sdk.authI, onUser); }

async function signOut(silent) {
  try { (await import('./sync.js')).stopSync(); } catch { /* niente */ }
  if (st.sdk) await st.sdk.auth.signOut(st.sdk.authI);
  localStorage.removeItem(SESSION_FLAG);
  st.user = null; st.profile = null; st.view = 'out'; st.err = ''; render();
  if (!silent) { /* i dati locali restano: uscire non li cancella */ }
}

function readForm() {
  return {
    name: $('#accName').value.trim(), country: $('#accCountry').value || null,
    age: $('#accAge')?.checked, terms: $('#accTerms')?.checked, privacy: $('#accPrivacy')?.checked, hr: $('#accHr')?.checked,
  };
}
async function createProfile() {
  const f = readForm();
  if (!NAME_RE.test(f.name)) { st.err = t('account.err.name'); return; }
  if (!f.age || !f.terms || !f.privacy) { st.err = t('account.err.consent'); return; }
  const { fs, dbI } = st.sdk; const now = fs.serverTimestamp();
  const consents = { terms: { v: TERMS_VERSION, at: now }, privacy: { v: PRIVACY_VERSION, at: now } };
  if (f.hr) consents.hrCloud = { v: HR_CONSENT_VERSION, at: now, granted: true };
  await fs.setDoc(fs.doc(dbI, `users/${st.user.uid}`), {
    displayName: f.name, country: f.country, locale: getLang(), ageOk: true, consents, createdAt: now, updatedAt: now, schema: 1,
  });
  await onUser(st.user);
}
async function acceptTerms() {
  const f = readForm(); if (!f.terms || !f.privacy) { st.err = t('account.err.consent'); return; }
  const { fs, dbI } = st.sdk; const now = fs.serverTimestamp();
  await fs.updateDoc(fs.doc(dbI, `users/${st.user.uid}`), { 'consents.terms': { v: TERMS_VERSION, at: now }, 'consents.privacy': { v: PRIVACY_VERSION, at: now }, updatedAt: now });
  const snap = await fs.getDoc(fs.doc(dbI, `users/${st.user.uid}`)); st.profile = snap.data(); st.needTerms = false;
  await beginSync();
}
async function saveProfile() {
  const f = readForm();
  if (!NAME_RE.test(f.name)) { st.err = t('account.err.name'); return; }
  const { fs, dbI } = st.sdk; const now = fs.serverTimestamp();
  await fs.updateDoc(fs.doc(dbI, `users/${st.user.uid}`), { displayName: f.name, country: f.country, locale: getLang(), updatedAt: now });
  st.profile = { ...st.profile, displayName: f.name, country: f.country }; st.info = t('account.saved');
}
async function toggleHr(on) {
  const { fs, dbI } = st.sdk; const now = fs.serverTimestamp();
  await fs.updateDoc(fs.doc(dbI, `users/${st.user.uid}`), { 'consents.hrCloud': { v: HR_CONSENT_VERSION, at: now, granted: on }, updatedAt: now });
  st.profile = { ...st.profile, consents: { ...st.profile.consents, hrCloud: { v: HR_CONSENT_VERSION, granted: on } } };
  (await import('./sync.js')).setHrOk(on);
  st.info = t(on ? 'account.hr.on' : 'account.hr.off');
}
async function deleteAccount() {
  if (!confirm(t('account.delete.confirm'))) return;
  const sdk = st.sdk; const user = sdk.authI.currentUser; const { auth } = sdk;
  // la funzione vuole un accesso recente: si conferma l'identità di nuovo
  if (user.providerData.some((p) => p.providerId === 'google.com')) await auth.reauthenticateWithPopup(user, new auth.GoogleAuthProvider());
  else {
    const pw = $('#accDelPass')?.value; if (!pw) { st.err = t('account.err.credentials'); return; }
    await auth.reauthenticateWithCredential(user, auth.EmailAuthProvider.credential(user.email, pw));
  }
  await user.getIdToken(true);
  await sdk.fn.httpsCallable(sdk.functions, 'deleteAccount')();
  try { (await import('./sync.js')).stopSync(); (await import('./sync.js')).resetSyncState(); } catch { /* niente */ }
  try { await auth.signOut(sdk.authI); } catch { /* l'utente non esiste più */ }
  localStorage.removeItem(SESSION_FLAG);
  st.user = null; st.profile = null; st.view = 'out'; st.info = t('account.delete.done'); render();
  if (confirm(t('account.delete.local'))) {
    const keep = localStorage.getItem('lang'); localStorage.clear(); if (keep) localStorage.setItem('lang', keep);
    location.reload();
  }
}

// ---------- disegno ----------
function syncLabel() {
  const s = st.sync || { status: 'idle', pending: 0 };
  if (s.status === 'syncing') return [t('account.sync.syncing'), ''];
  if (s.status === 'error') return [navigator.onLine ? t('account.sync.error') : t('account.sync.offline'), 'warn'];
  if (s.status === 'synced') return [t('account.sync.synced'), 'ok'];
  if (s.status === 'pending' || s.pending) return [t('account.sync.pending', { count: s.pending || 0 }), 'warn'];
  return [t('account.sync.synced'), 'ok'];
}
function refreshSync() {
  const el = root?.querySelector('#accSync'); if (!el) return;
  const [txt, cls] = syncLabel(); el.textContent = txt; el.className = `pill ${cls}`;
  const when = root.querySelector('#accWhen'); if (when) when.textContent = st.sync?.at ? t('account.sync.last', { time: fmtDate(new Date(st.sync.at), { hour: '2-digit', minute: '2-digit' }) }) : '';
}
function renderBusy() { root?.querySelectorAll('button').forEach((b) => { b.disabled = true; }); }
function countryOptions(sel) {
  let names; try { names = new Intl.DisplayNames(getLang(), { type: 'region' }); } catch { names = null; }
  const list = COUNTRIES.map((c) => [c, names?.of(c) || c]).sort((a, b) => a[1].localeCompare(b[1], getLang()));
  return `<option value="">${esc(t('account.country.none'))}</option>` + list.map(([c, n]) => `<option value="${c}"${c === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');
}
const msg = () => `${st.err ? `<p class="fine acc-err" role="alert">${esc(st.err)}</p>` : ''}${st.info ? `<p class="fine" role="status">${esc(st.info)}</p>` : ''}`;
const legalLinks = () => t('account.legalLinks', { terms: `<a href="${legalUrl(TERMS_URL)}" target="_blank" rel="noopener">${esc(t('account.terms'))}</a>`, privacy: `<a href="${legalUrl(PRIVACY_URL)}" target="_blank" rel="noopener">${esc(t('account.privacy'))}</a>` });

const VIEWS = {
  loading: () => `<p class="fine">${esc(t('account.loading'))}</p>`,
  out: () => `
    <p class="fine">${esc(t('account.intro'))}</p>
    ${inNativeApp() ? `<p class="fine" data-testid="google-later">${esc(t('account.googleLater'))}</p>` : `<button class="ghost" data-act="google">${esc(t('account.google'))}</button>`}
    <div class="fields acc-fields">
      <label>${esc(t('account.email'))}<input id="accEmail" type="email" autocomplete="email" value="${esc(st.email)}"></label>
      <label>${esc(t('account.password'))}<input id="accPass" type="password" autocomplete="current-password" minlength="8"></label>
    </div>
    <div class="row2"><button class="ghost" data-act="signin">${esc(t('account.signIn'))}</button><button class="ghost" data-act="signup">${esc(t('account.signUp'))}</button></div>
    <button class="link" data-act="reset">${esc(t('account.forgot'))}</button>
    <p class="fine">${legalLinks()}</p>`,
  verify: () => `
    <p>${esc(t('account.verify.text', { email: st.user?.email || '' }))}</p>
    <div class="row2"><button class="ghost" data-act="verified">${esc(t('account.verify.done'))}</button><button class="ghost" data-act="resend">${esc(t('account.verify.resend'))}</button></div>
    <button class="link" data-act="signout">${esc(t('account.signOut'))}</button>`,
  onboard: () => `
    <p class="fine">${esc(t('account.onboard.intro'))}</p>
    <div class="fields acc-fields">
      <label>${esc(t('account.nickname'))}<input id="accName" type="text" maxlength="24" autocomplete="nickname" value="${esc(st.form.name ?? (st.user?.displayName || '').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 24))}"></label>
      <label>${esc(t('account.country'))}<select id="accCountry">${countryOptions(st.form.country || '')}</select></label>
    </div>
    <p class="fine">${esc(t('account.nicknameHint'))}</p>
    <label class="switch"><input type="checkbox" id="accAge"${chk('age')}><span>${esc(t('account.age'))}</span></label>
    <label class="switch"><input type="checkbox" id="accTerms"${chk('terms')}><span>${t('account.acceptTerms', { link: `<a href="${legalUrl(TERMS_URL)}" target="_blank" rel="noopener">${esc(t('account.terms'))}</a>` })}</span></label>
    <label class="switch"><input type="checkbox" id="accPrivacy"${chk('privacy')}><span>${t('account.acceptPrivacy', { link: `<a href="${legalUrl(PRIVACY_URL)}" target="_blank" rel="noopener">${esc(t('account.privacy'))}</a>` })}</span></label>
    <hr class="acc-sep">
    <label class="switch"><input type="checkbox" id="accHr"${chk('hr')}><span>${esc(t('account.hr.label'))}</span></label>
    <p class="fine">${esc(t('account.hr.hint'))}</p>
    <button class="ghost" data-act="create">${esc(t('account.create'))}</button>
    <button class="link" data-act="signout">${esc(t('account.signOut'))}</button>`,
  reconsent: () => `
    <p>${esc(t('account.reconsent'))}</p>
    <label class="switch"><input type="checkbox" id="accTerms"${chk('terms')}><span>${t('account.acceptTerms', { link: `<a href="${legalUrl(TERMS_URL)}" target="_blank" rel="noopener">${esc(t('account.terms'))}</a>` })}</span></label>
    <label class="switch"><input type="checkbox" id="accPrivacy"${chk('privacy')}><span>${t('account.acceptPrivacy', { link: `<a href="${legalUrl(PRIVACY_URL)}" target="_blank" rel="noopener">${esc(t('account.privacy'))}</a>` })}</span></label>
    <button class="ghost" data-act="accept">${esc(t('account.accept'))}</button>
    <button class="link" data-act="signout">${esc(t('account.signOut'))}</button>`,
  in: () => {
    const p = st.profile || {};
    return `
    <p>${esc(t('account.signedIn', { name: p.displayName || '' }))} <small class="fine">${esc(st.user?.email || '')}</small></p>
    <div class="fields acc-fields">
      <label>${esc(t('account.nickname'))}<input id="accName" type="text" maxlength="24" value="${esc(p.displayName || '')}"></label>
      <label>${esc(t('account.country'))}<select id="accCountry">${countryOptions(p.country || '')}</select></label>
    </div>
    <button class="ghost" data-act="saveProfile">${esc(t('account.save'))}</button>
    <label class="switch"><input type="checkbox" id="accHr"${hrOkNow() ? ' checked' : ''}><span>${esc(t('account.hr.label'))}</span></label>
    <p class="fine">${esc(t('account.hr.hint'))}</p>
    <p class="fine"><span id="accWhen"></span></p>
    <div class="row2"><button class="ghost" data-act="syncNow">${esc(t('account.syncNow'))}</button><button class="ghost" data-act="signout">${esc(t('account.signOut'))}</button></div>
    <p class="fine">${esc(t('account.signOutHint'))}</p>
    <button class="ghost danger" data-act="askDelete">${esc(t('account.delete'))}</button>`;
  },
  delete: () => `
    <p><b>${esc(t('account.delete.title'))}</b></p>
    <p class="fine">${esc(t('account.delete.text'))}</p>
    ${st.user?.providerData.some((p) => p.providerId === 'google.com') ? '' : `<label class="fields acc-fields"><span class="fine">${esc(t('account.delete.password'))}</span><input id="accDelPass" type="password" autocomplete="current-password"></label>`}
    <div class="row2"><button class="ghost" data-act="cancelDelete">${esc(t('account.cancel'))}</button><button class="ghost danger" data-act="doDelete">${esc(t('account.delete.go'))}</button></div>`,
};

// i campi già compilati sopravvivono a un errore (render ricrea l'HTML)
function keepForm() {
  const g = (id) => root.querySelector(id);
  if (g('#accName')) st.form = { name: g('#accName').value, country: g('#accCountry')?.value || '', age: !!g('#accAge')?.checked, terms: !!g('#accTerms')?.checked, privacy: !!g('#accPrivacy')?.checked, hr: !!g('#accHr')?.checked };
}
const chk = (k) => (st.form[k] ? ' checked' : '');
function render() {
  if (!root) return;
  if (st.view === st.formView) keepForm(); else st.form = {};
  st.formView = st.view;
  const [txt, cls] = syncLabel();
  const showPill = st.view === 'in';
  root.innerHTML = `<h3><span>${esc(t('account.title'))}</span>${showPill ? ` <span id="accSync" class="pill ${cls}">${esc(txt)}</span>` : ''}</h3>${(VIEWS[st.view] || VIEWS.out)()}${msg()}`;
  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]?.()));
  const hr = root.querySelector('#accHr');
  if (hr && st.view === 'in') hr.addEventListener('change', () => act(() => toggleHr(hr.checked)));
  root.querySelector('#accPass')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') actions.signin(); });
  root.querySelector('#accEmail')?.addEventListener('input', (e) => { st.email = e.target.value; });
  refreshSync();
}
