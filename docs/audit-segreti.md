# Audit segreti sulla storia git (task A7)

Data: 2026-11-07 · Branch: `spindro/a7-secrets-audit` · Riferimento: `docs/PIANO-LANCIO.md`, sezione 8, task A7.

Questo audit è di sola lettura: non ha riscritto la storia, non ha cancellato file e non riporta i valori dei segreti trovati (solo file, commit e tipo).

## Esito in breve

**Non si può pubblicare "così com'è" senza una decisione su un punto.**

- **Nessun segreto di servizio nella storia.** Il Client Secret Strava non è mai stato scritto nel codice: compare solo come riferimento a una variabile d'ambiente del Worker, e il valore vive in `wrangler secret`.
- **Un punto da decidere prima di rendere il repo pubblico:** il keystore di firma Android `android/app/ridefreedom-debug.keystore` e le sue password (`storePassword` e `keyPassword`, in chiaro in `android/app/build.gradle`) sono nella storia. La password è quella predefinita di Android. La scheda più sotto spiega perché "è solo debug" non basta.

## Perimetro e metodo

| Voce | Valore |
|---|---|
| Storia analizzata | 53 commit, tutti i ref (branch locale, `origin/ccr-28a29a79-yshigo`, `spindro/a7-secrets-audit`, tag `app-android`) |
| Repo | non shallow (già storia completa); `git fetch --all --tags --prune` eseguito |
| Path distinti mai presenti nella storia | 292 |
| Oggetti git non raggiungibili (dangling) | 0 |
| Branch remoto `origin/spindro/a7-secrets-audit` | risultava già eliminato sul remoto (pruned in fetch); il push lo ricrea |

### Strumenti usati

1. **gitleaks v8.18.4** (installato con `go install`), comando `gitleaks detect --source . --log-opts="--all" --redact`: scansione di tutta la storia. Risultato: 0 segnalazioni con le regole di default.
2. **gitleaks con `.gitleaks.toml`** (regola Gradle aggiunta, vedi sotto): 2 segnalazioni, entrambe nel keystore/`build.gradle` del commit `1cb6a96`.
3. **gitleaks `--no-git`** sul working tree: 0 segnalazioni con la stessa configurazione (le 2 segnalazioni sono solo quelle della storia).
4. **Inventario dei path** (`git log --all --name-only`): ricerca per nome di `.env`, `.jks`, `.keystore`, `.p12`, `.pem`, `wrangler`, `google-services`, `credential`, `token`.
5. **Oggetti non raggiungibili** (`git fsck --unreachable`): 0.
6. **Ricerca mirata** su aggiunte (`git log -p -G`): `client_secret`, `STRAVA_*SECRET`, `access_token`, `refresh_token`, chiavi PEM, email. Le occorrenze sono state verificate a mano, con i valori letterali mascherati.
7. **Verifica del keystore** con `keytool` (alias, validità, proprietario). Password letta da file in una cartella temporanea, mai stampata.

Non è stato usato trufflehog: gitleaks ha coperto la storia completa, quindi un secondo strumento non era necessario per completare il perimetro.

## Risultati

| # | Riscontro | Dove (file · commit) | Tipo | Gravità per la pubblicazione | Azione |
|---|---|---|---|---|---|
| 1 | Keystore di firma Android con chiave privata, password di default Android in chiaro in `build.gradle` | `android/app/ridefreedom-debug.keystore` · commit `1cb6a96` (ancora nel `HEAD`); `android/app/build.gradle` righe 24 e 26 | Keystore + password | **Alta** (vedi scheda) | Decisione richiesta, vedi raccomandazione |
| 2 | Client Secret Strava | nessun valore letterale nella storia | — | Nessuna | Nessuna. Solo riferimenti `env.STRAVA_CLIENT_SECRET` in `server/strava-worker/worker.js` e istruzioni `wrangler secret put` in `docs/strava.md` |
| 3 | `server/strava-worker/wrangler.toml` | commit `6de7490`, `e226d27` | Configurazione | Nessuna | Contiene solo `name`, `main`, `compatibility_date` e `ALLOWED_ORIGINS` (domini pubblici). Nessun segreto |
| 4 | File `.env` | nessuno nella storia | — | Nessuna | — |
| 5 | Chiavi private PEM/OpenSSH | nessuna | — | Nessuna | — |
| 6 | Email o dati personali nei contenuti | nessuna email nei file aggiunti | — | Nessuna | Gli autori dei 53 commit hanno lo stesso dominio di servizio (`anthropic.com`): nessun dato personale nei metadati. Nota: un autore git è sempre visibile pubblicamente |
| 7 | Token/OAuth, `access_token`, `refresh_token` | solo nel codice JS che li gestisce (`js/strava.js`, `server/strava-worker/worker.js`), sempre come variabili | — | Nessuna | I token dell'utente restano nel browser (`localStorage`), non nel repo |
| 8 | Librerie vendorizzate (`vendor/`, 16 file) | three.js, Capacitor | Falsi positivi potenziali (JS minificato) | Nessuna | Gitleaks non le segnala con le regole di default; esclusione preventiva in `.gitleaks.toml` |

### Scheda 1: keystore Android

- **Cosa è.** Un keystore PKCS12 con una chiave privata (alias `ridefreedom`, proprietario `CN=Ride Freedom, O=Ride Freedom, C=IT`), valido fino al 2054. È stato aggiunto nel commit `1cb6a96` ("App Android con ponte verso Garmin e misuratore di potenza esterno") e non è mai stato rimosso.
- **Dove viene usato.** In `build.gradle` c'è un `signingConfig` `spindro` applicato al build `debug`. Il commento dice che la chiave è fissa "per installazioni dirette", così ogni nuovo APK aggiorna il precedente. Quindi gli APK distribuiti direttamente sono firmati con questa chiave, non con una chiave di debug generata sul momento. Il build `release` non ha firma nel repo; la chiave di release per il Play Store è prevista nei Secret, come da `docs/PIANO-LANCIO.md`.
- **Perché "debug" non basta.** Anche se il nome dice "debug", la chiave firma gli APK che gli utenti installano. Chiunque cloni il repo pubblico può firmare un APK con la stessa chiave, e Android accetta l'aggiornamento su un'installazione esistente con la stessa firma. Quindi chi ha installato un APK diretto di questa chiave potrebbe ricevere un aggiornamento malevolo da terzi.
- **Password.** La password in `build.gradle` coincide con quella predefinita del toolchain Android, quindi il keystore è di fatto non protetto (valore non riportato).
- **Non si può "revocare".** Una volta nella storia pubblica e clonata, la chiave resta compromessa. Si può solo smettere di usarla e cambiarla per il futuro, oppure riscrivere la storia per rimuoverla dal repo (ma i cloni esistenti restano).

### Scheda 2: Strava

- Nella storia non c'è nessun valore di `client_secret`. Le occorrenze riguardano codice che legge `env.STRAVA_CLIENT_SECRET` e campi di input in cui l'utente inserisce le proprie credenziali (salvate in `localStorage`, mai nel repo).
- Il Client ID Strava non è un segreto, ma non è neanche stato trovato come valore fisso.
- Il `wrangler.toml` non contiene nessun `[vars]` con credenziali (solo `ALLOWED_ORIGINS`).

## Falsi positivi e eccezioni

Il file `.gitleaks.toml` contiene:

- **Regola aggiunta `gradle-signing-password`.** Le regole di default di gitleaks non riconoscono la sintassi Gradle `storePassword 'xxx'` (senza `=` né `:`), quindi non avrebbero segnalato il punto 1. La regola è stata aggiunta e verificata: segnala solo le due righe del commit `1cb6a96`. **Non è silenziata**: resta attiva di proposito, finché la decisione sul keystore non è presa.
- **Eccezioni per percorsi, giustificate:**
  - `vendor/`: librerie di terze parti (three.js, Capacitor), JS minificato con stringhe ad alta entropia. Non è codice nostro.
  - `node_modules/`: dipendenze installate, non dovrebbero mai essere tracciate.
  - `package-lock.json`: contiene hash di integrità (sha512) che sembrano chiavi ma non sono segreti.
  - `*.keystore`, `*.jks`: binari, gitleaks non li analizza come testo. Sono trattati a parte in questo documento (scheda 1), non esclusi in silenzio.

Nessun falso positivo è stato segnalato dalle regole di default: le eccezioni sono preventive, per la pubblicazione.

## Limiti dell'audit

- Non copre: segreti in issue, PR, commenti o wiki di GitHub; impostazioni del dashboard Cloudflare; contenuti dei Secret di GitHub Actions (il repo non li espone).
- gitleaks analizza testo. I binari (keystore) sono valutati per nome, alias e uso, non per contenuto byte per byte.
- Il piano A7 chiede un audit della storia "completa": coperti tutti i ref fetchati e gli oggetti dangling. Se il repo ha Git LFS, quegli oggetti non sono stati analizzati separatamente.

## Raccomandazione

**Non pubblicare ancora "così com'è".** Il resto è pulito; il keystore è l'unico punto che serve decidere. Proposta, in ordine:

1. **Smettere di usare il keystore attuale** per gli APK distribuiti. Generarne uno nuovo fuori dal repo, con password in un password manager, e leggere password e percorso da `gradle.properties` non tracciato o da variabili d'ambiente.
2. **Rimuovere il keystore e le password dal repo e dalla storia** prima di renderlo pubblico, con `git filter-repo` (riscrittura della storia: operazione da confermare esplicitamente, cambia gli hash e richiede un force push). Chi ha già un clone o un fork conserva la vecchia storia.
3. **Conseguenza per gli utenti:** cambiando firma, Android non aggiorna le installazioni esistenti: chi ha installato un APK diretto dovrà disinstallare e reinstallare una volta. Va comunicato, e va valutato quanti utenti sono in questa situazione (oggi, con la pubblicazione non ancora fatta, il costo è basso).
4. **Se si sceglie di tenere il keystore attuale** (come da indicazione "noto e accettabile"), la scelta va scritta esplicitamente nel `SECURITY.md` del repo, con il rischio di aggiornamenti firmati da terzi per gli APK diretti.

Dopo la decisione, rilanciare `gitleaks detect --source . --log-opts="--all" --config .gitleaks.toml --redact`: deve risultare pulito.

## Come riprodurre

```bash
go install github.com/zricethezav/gitleaks/v8@v8.18.4
git fetch --all --tags --prune
gitleaks detect --source . --log-opts="--all" --config .gitleaks.toml --redact
```
