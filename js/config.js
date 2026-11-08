// Configurazione pubblica dell'app.
// Indirizzo del ponte Strava (Cloudflare Worker in server/strava-worker).
// Se è vuoto, l'app usa la modalità "personale" (ognuno inserisce la propria app Strava).
export const STRAVA_PROXY = '';

// ---- Monitoraggio (D1). Vuoti = spento: i fork e le build locali non inviano nulla. ----
// Sentry (errori JavaScript), regione UE: il DSN termina con ".de.sentry.io". Esempio: 'https://chiave@o123.ingest.de.sentry.io/456'
// Il DSN è pubblico per natura (compare in ogni app che usa Sentry), non è un segreto.
export const SENTRY_DSN = '';
// GoatCounter (statistiche anonime, senza cookie, solo con consenso). Esempio: 'https://spindro.goatcounter.com/count'
export const GOATCOUNTER_URL = '';
