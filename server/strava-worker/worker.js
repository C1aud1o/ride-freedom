// Cloudflare Worker: ponte tra Spindro e Strava per TUTTI gli utenti.
// Custodisce il Client Secret dell'app Strava (mai esposto nel browser) e inoltra le chiamate.
// Non salva nulla: i token restano nel browser di ciascun utente.
//
// Variabili (wrangler secret / dashboard Cloudflare):
//   STRAVA_CLIENT_ID      id numerico dell'app Strava
//   STRAVA_CLIENT_SECRET  segreto dell'app Strava
//   ALLOWED_ORIGINS       origini ammesse, separate da virgola (es. https://mta-world.com)

const STRAVA = 'https://www.strava.com';
const MAX_UPLOAD = 25 * 1024 * 1024; // limite di Strava per i file

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : allowed[0] || '',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!okOrigin) return json({ message: 'Origine non ammessa' }, 403);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    try {
      // configurazione pubblica per il browser
      if (path === '/config' && request.method === 'GET') return json({ client_id: env.STRAVA_CLIENT_ID });

      // codice di autorizzazione -> token
      if (path === '/token' && request.method === 'POST') {
        const { code } = await request.json();
        if (!code || typeof code !== 'string') return json({ message: 'Codice mancante' }, 400);
        return relay(await tokenCall(env, { grant_type: 'authorization_code', code }), cors, (d) => ({
          access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at,
          athlete: d.athlete ? { firstname: d.athlete.firstname, lastname: d.athlete.lastname } : null,
        }));
      }

      // rinnovo del token
      if (path === '/refresh' && request.method === 'POST') {
        const { refresh_token: rt } = await request.json();
        if (!rt || typeof rt !== 'string') return json({ message: 'Refresh token mancante' }, 400);
        return relay(await tokenCall(env, { grant_type: 'refresh_token', refresh_token: rt }), cors, (d) => ({
          access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at,
        }));
      }

      const auth = request.headers.get('Authorization') || '';
      if (!/^Bearer [\w.-]+$/.test(auth)) return json({ message: 'Token mancante' }, 401);

      // caricamento del file .FIT
      if (path === '/upload' && request.method === 'POST') {
        const len = Number(request.headers.get('Content-Length') || 0);
        if (len > MAX_UPLOAD) return json({ message: 'File troppo grande' }, 413);
        const res = await fetch(`${STRAVA}/api/v3/uploads`, {
          method: 'POST', headers: { Authorization: auth, 'Content-Type': request.headers.get('Content-Type') }, body: request.body,
        });
        return relay(res, cors);
      }

      // stato del caricamento
      const m = path.match(/^\/upload\/(\d+)$/);
      if (m && request.method === 'GET') return relay(await fetch(`${STRAVA}/api/v3/uploads/${m[1]}`, { headers: { Authorization: auth } }), cors);

      // scollegamento
      if (path === '/deauthorize' && request.method === 'POST') {
        return relay(await fetch(`${STRAVA}/oauth/deauthorize`, { method: 'POST', headers: { Authorization: auth } }), cors);
      }

      return json({ message: 'Non trovato' }, 404);
    } catch (err) {
      return json({ message: `Errore del ponte Strava: ${err.message}` }, 502);
    }
  },
};

function tokenCall(env, params) {
  return fetch(`${STRAVA}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, ...params }),
  });
}

async function relay(res, cors, pickFn) {
  const data = await res.json().catch(() => ({}));
  const body = res.ok && pickFn ? pickFn(data) : data;
  return new Response(JSON.stringify(body), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
