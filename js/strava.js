// Collegamento a Strava, in due modalità:
// - PUBBLICA (consigliata): c'è un "ponte" (Cloudflare Worker in server/strava-worker) che custodisce
//   il Client Secret della app Strava ufficiale. Chiunque si collega con login + "Consenti".
// - PERSONALE (riserva, senza server): l'utente crea la propria app su strava.com/settings/api e
//   inserisce Client ID e Client Secret, che restano solo nel suo telefono.
// In entrambi i casi i token restano nel browser dell'utente e l'allenamento si carica come .FIT.

const KEY = 'stravaConfig';
const API = 'https://www.strava.com';

export class Strava {
  constructor(proxy = '') {
    this.proxy = proxy.replace(/\/+$/, '');
    try { this.cfg = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { this.cfg = {}; }
    if (this.cfg.auto === undefined) this.cfg.auto = true;
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.cfg)); } catch { /* storage pieno */ } }
  get publicMode() { return !!this.proxy; }
  get configured() { return this.publicMode || !!(this.cfg.clientId && this.cfg.clientSecret); }
  get connected() { return !!this.cfg.refreshToken; }
  get athlete() { return this.cfg.athlete || ''; }

  setCredentials(clientId, clientSecret) {
    this.cfg.clientId = String(clientId).trim();
    this.cfg.clientSecret = String(clientSecret).trim();
    this.save();
  }

  redirectUri() { return `${location.origin}${location.pathname}`; }

  // porta l'utente sulla pagina di autorizzazione di Strava
  async authorize() {
    if (!this.configured) throw new Error('Inserisci prima Client ID e Client Secret');
    let clientId = this.cfg.clientId;
    if (this.publicMode) {
      const res = await fetch(`${this.proxy}/config`);
      const conf = await res.json().catch(() => ({}));
      if (!res.ok || !conf.client_id) throw new Error(conf.message || 'Ponte Strava non raggiungibile');
      clientId = conf.client_id;
    }
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem('stravaState', state);
    const u = new URL(`${API}/oauth/authorize`);
    u.search = new URLSearchParams({
      client_id: clientId, response_type: 'code', redirect_uri: this.redirectUri(),
      approval_prompt: 'auto', scope: 'activity:write,read', state,
    });
    location.href = u.toString();
  }

  // al ritorno da Strava: scambia il codice con i token
  async handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (!q.has('state') || (!q.has('code') && !q.has('error'))) return null;
    const expected = sessionStorage.getItem('stravaState');
    history.replaceState(null, '', this.redirectUri());
    if (q.get('state') !== expected) return { ok: false, message: 'Risposta di Strava non valida (stato diverso), riprova' };
    if (q.has('error')) return { ok: false, message: 'Autorizzazione annullata' };
    if (!(q.get('scope') || '').includes('activity:write')) return { ok: false, message: 'Serve il permesso di caricare attività: riprova e lascia la spunta' };
    const data = await this.tokenRequest({ grant_type: 'authorization_code', code: q.get('code') });
    this.cfg.athlete = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ');
    this.save();
    return { ok: true, message: `Strava collegato${this.cfg.athlete ? ` come ${this.cfg.athlete}` : ''}` };
  }

  async tokenRequest(params) {
    const res = this.publicMode
      ? await fetch(`${this.proxy}/${params.grant_type === 'refresh_token' ? 'refresh' : 'token'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.grant_type === 'refresh_token' ? { refresh_token: params.refresh_token } : { code: params.code }),
      })
      : await fetch(`${API}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, ...params }),
      });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Errore Strava ${res.status}`);
    this.cfg.accessToken = data.access_token;
    this.cfg.refreshToken = data.refresh_token;
    this.cfg.expiresAt = data.expires_at;
    this.save();
    return data;
  }

  async token() {
    if (!this.connected) throw new Error('Strava non collegato');
    if (!this.cfg.accessToken || Date.now() / 1000 > (this.cfg.expiresAt || 0) - 120) {
      await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.cfg.refreshToken });
    }
    return this.cfg.accessToken;
  }

  disconnect() {
    const token = this.cfg.accessToken;
    if (token) fetch(this.publicMode ? `${this.proxy}/deauthorize` : `${API}/oauth/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    delete this.cfg.accessToken; delete this.cfg.refreshToken; delete this.cfg.expiresAt; delete this.cfg.athlete;
    this.save();
  }

  // carica il file e aspetta che Strava crei l'attività; onStatus riceve messaggi di avanzamento
  async upload(file, { name, description, externalId }, onStatus = () => {}) {
    const token = await this.token();
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('data_type', 'fit');
    form.append('name', name);
    form.append('description', description);
    form.append('trainer', '1');
    form.append('external_id', externalId);
    onStatus('Invio a Strava…');
    const base = this.publicMode ? `${this.proxy}/upload` : `${API}/api/v3/uploads`;
    const res = await fetch(base, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    let up = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(up.message || `Errore Strava ${res.status}`);
    for (let i = 0; i < 15 && !up.activity_id && !up.error; i++) {
      onStatus('Strava sta elaborando l\'attività…');
      await new Promise((r) => setTimeout(r, 2000));
      const r2 = await fetch(`${base}/${up.id_str || up.id}`, { headers: { Authorization: `Bearer ${token}` } });
      up = await r2.json().catch(() => up);
    }
    if (up.error) {
      if (/duplicate/i.test(up.error)) return { duplicate: true, message: 'Questo allenamento è già su Strava' };
      throw new Error(up.error);
    }
    if (!up.activity_id) return { pending: true, message: 'Caricato: Strava lo sta ancora elaborando, comparirà a breve' };
    return { url: `${API}/activities/${up.activity_id}`, message: 'Allenamento caricato su Strava!' };
  }
}
