# Strava per tutti gli utenti

Obiettivo: chiunque usi Spindro tocca **Connetti con Strava → login → Consenti** e, con
🏁 *Termina*, l'allenamento arriva su Strava. Serve una sola app Strava (la tua) e un piccolo
"ponte" che custodisce il Client Secret: `server/strava-worker/worker.js` (Cloudflare Worker,
piano gratuito, nessun database: i token restano nel telefono di ciascun utente).

## 1. Crea l'app Strava (una volta)
1. Vai su <https://www.strava.com/settings/api> e crea l'applicazione:
   - **Application Name**: Spindro
   - **Category**: Training
   - **Website**: `https://mta-world.com`
   - **Authorization Callback Domain**: `mta-world.com`
   - carica un'icona.
2. Annota **Client ID** e **Client Secret** (il secret non va mai messo nel codice del sito).

## 2. Metti online il ponte su Cloudflare (una volta)
Da browser, senza installare nulla:
1. Crea un account gratuito su <https://dash.cloudflare.com>.
2. *Workers & Pages* → *Create* → *Create Worker* → nome `spindro-strava` → *Deploy*.
3. *Edit code*: sostituisci tutto con il contenuto di `server/strava-worker/worker.js` → *Deploy*.
4. *Settings* → *Variables and Secrets*:
   - `ALLOWED_ORIGINS` (testo) = `https://mta-world.com,https://www.mta-world.com`
   - `STRAVA_CLIENT_ID` (secret) = il Client ID
   - `STRAVA_CLIENT_SECRET` (secret) = il Client Secret
5. Copia l'indirizzo del worker, tipo `https://spindro-strava.<tuo-account>.workers.dev`.

In alternativa da terminale: `cd server/strava-worker && npx wrangler deploy` e
`npx wrangler secret put STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`.

## 3. Collega il sito al ponte
Metti l'indirizzo del worker in `js/config.js` (`STRAVA_PROXY`). Da quel momento la sezione
Strava mostra solo il pulsante **Connetti con Strava**.

## 4. Aprire l'app a tutti
Le app Strava nuove accettano **un solo atleta** (te). Per gli altri utenti bisogna chiedere a
Strava di aumentare il limite (modulo di revisione dal pannello dell'app/Developer Program). Di solito
chiedono:
- rispetto delle linee guida del marchio: pulsante ufficiale "Connect with Strava" e logo
  "Compatible with Strava" (sostituire il pulsante attuale con le immagini ufficiali);
- una pagina di **privacy policy** e contatti;
- screenshot del flusso.

Limiti di uso predefiniti dell'API (per tutta l'app): circa 200 richieste ogni 15 minuti e 2000 al
giorno. Ogni allenamento caricato usa 2–5 richieste: bastano per centinaia di utenti al giorno; se
servirà, si chiede un aumento.
