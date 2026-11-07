# Pubblicità a pagamento: 60 € Google Ads Ricerca + 40 € Reddit Ads (G7)

> **Solo preparazione: nessuna campagna creata.** Il piano (sez. 10) dice di spendere solo **dopo 2–4 settimane di lancio organico**, solo su ricerche a intenzione altissima, e di non usare App Campaign. Questo file prepara parole chiave, annunci e regole; l'avvio è a cura del proprietario.

## Prerequisiti (senza questi non spendere un euro)

1. **Pagine d'arrivo nella lingua dell'annuncio.** Oggi l'app è **solo in italiano** e non esiste un sito vetrina multilingua (fasi C e D4). Quindi: gli annunci **IT** possono partire; **EN e FR vanno accesi solo quando c'è almeno una pagina in quella lingua** (altrimenti Google penalizza la pertinenza e gli utenti rimbalzano). Se mancano, sposta quel budget sull'italiano.
2. **Come si misura.** Non c'è Google Analytics (scelta del piano, sez. 6) e il contatore GoatCounter non è ancora nel codice **[DA VERIFICARE]**. Quindi la conversione "installazione" **non è misurabile**: usiamo come sostituto il **clic su "Scarica" / "Apri l'app"** per `?ref=` (evento GoatCounter da aggiungere) e, per Play, il parametro `referrer` nel link allo store. Senza questa misura, la regola di stop sotto non è applicabile.
3. **Dominio definitivo** (A1) e `LICENSE` nel repo. Se il dominio cambia dopo, i link degli annunci vanno aggiornati.
4. **Nessun marchio altrui nel testo degli annunci.** "Zwift", "Garmin" ecc. compaiono **solo nelle parole chiave**, non in titoli e descrizioni: evita rifiuti e reclami per uso di marchi. Gli annunci qui sotto rispettano questa regola. [DA VERIFICARE nella policy sui marchi di Google Ads per ciascun paese.]
5. **Nessun punto esclamativo nei titoli** (non ammesso dalle policy di Google Ads sul testo degli annunci [DA VERIFICARE]); nessuna promessa non vera ("migliore", "n. 1", "garantito", "funziona con tutti i rulli").

---

# A. Google Ads, Ricerca: 60 €

## Impostazioni della campagna

| Impostazione | Valore | Perché |
|---|---|---|
| Tipo | **Ricerca** (non App campaign, non Performance Max) | Piano: chi cerca queste frasi è esattamente l'utente |
| Reti | Solo rete di ricerca; **togliere** Search Partners e Display | Evitare clic di bassa qualità |
| Strategia | **Massimizza i clic** con **CPC max 0,60 €** (inizio) | Senza conversioni misurabili non si può usare una strategia a obiettivo |
| Budget giornaliero | **3 €/giorno per ~20 giorni = 60 €** | Un budget pari al totale si esaurisce in poche ore |
| Ripartizione | IT 30 € · EN 20 € · FR 10 € (ogni lingua in una campagna separata, per non farle "rubare" budget a vicenda) | Se EN/FR non sono pronte (prerequisito 1): tutto su IT |
| Località | IT: Italia · FR: Francia (+ Belgio, Svizzera francofona) · EN: Regno Unito, Irlanda [DA VERIFICARE i CPC prima: gli USA costano molto di più] | Mercati del piano (Decathlon/Van Rysel) |
| Lingua | Italiano · Inglese · Francese | |
| Orario | Tutti i giorni; aumentare dopo le 18:00 locali (ore di allenamento) | |
| Corrispondenza | **A frase** (phrase match) per tutte le parole chiave, come richiesto | Evita le corrispondenze generiche |
| URL finale | `https://mta-world.com/?ref=gads-it` (analogo `gads-en`, `gads-fr`) | [DA VERIFICARE dominio] |

## Gruppo di annunci IT (9 parole chiave, corrispondenza a frase)

```
"app gratis per rullo smart"
"alternativa gratis a zwift"
"app per rullo van rysel d100"
"app rullo d100"
"zwift click senza zwift"
"app gratuita per rulli ftms"
"allenamento sul rullo senza abbonamento"
"app rullo bici gratis android"
"cambio virtuale rullo app"
```

### Parole chiave negative IT (corrispondenza a frase o esatta)
```
zwift login · zwift accedi · zwift download · zwift account · zwift prezzo · zwift abbonamento prezzo
rouvy accedi · trainerroad login · torrent · crack · mod · hack
iphone · ios · ipad · apple tv
tapis roulant · cyclette · spinning · peloton · spin bike
prezzo rullo · offerta rullo · acquistare rullo · migliori rulli · recensione rullo · amazon · decathlon prezzo
lavoro · offerte di lavoro · corso · bambini
```
(Esclusi gli acquirenti di rulli: noi serviamo chi **ha già** il rullo. Escluso iOS perché non c'è un'app per iPhone: oggi solo browser Bluefy.)

### Annunci RSA IT (3). Titoli ≤ 30 caratteri, descrizioni ≤ 90

**RSA IT-1 (gratis / open source)**
- Titoli: `App gratis per rulli smart` · `Open source e senza account` · `Cambio virtuale a 24 marce` · `Allenamenti ERG e test FTP` · `Nessun abbonamento mensile` · `Per rulli con Bluetooth FTMS` · `Provala subito dal browser` · `Giochi 3D a pedali` · `Registra file FIT per Garmin`
- Descrizioni:
  1. `App gratuita e open source per rulli smart. Niente account, niente abbonamento.`
  2. `Cambio virtuale, ERG, percorsi GPX e file FIT. Android o Chrome/Edge sul computer.`
  3. `Provata soprattutto con il Van Rysel D100. Dicci che rullo hai e se si collega.`

**RSA IT-2 (compatibilità)**
- Titoli: `App per rullo Van Rysel D100` · `Collega il rullo via Bluetooth` · `Funziona con rulli FTMS` · `Potenza, cadenza, cardio live` · `Pendenza e resistenza` · `Segnala il tuo rullo` · `Android e web, senza install` · `Gratis e open source` · `Codice pubblico su GitHub`
- Descrizioni:
  1. `Collega il rullo smart e pedala: potenza, cadenza e cardio in tempo reale.`
  2. `Controllo ERG, pendenza e resistenza. Il tuo rullo non va? C'è il tasto Segnala.`
  3. `Tacx e Wahoo vecchi sono sperimentali. Cerchiamo tester: aiutaci a provarli.`

**RSA IT-3 (orologio e Click)**
- Titoli: `Il Garmin registra l'uscita` · `Il telefono è un sensore BLE` · `Cambia con il Click Bluetooth` · `Allenati senza abbonamento` · `Allenamenti sul rullo gratis` · `Storico, record e FTP` · `App Android per il rullo` · `Giochi a pedali in 3D` · `Provala gratis oggi`
- Descrizioni:
  1. `Su Android il telefono trasmette potenza e cadenza: l'orologio registra l'uscita.`
  2. `Cambia marcia con i tasti del Click Bluetooth (sperimentale) o dallo schermo.`
  3. `Interfaccia in italiano. Gratis, open source, senza pubblicità e senza account.`

---

## Gruppo di annunci EN (9 parole chiave)

```
"free zwift alternative"
"zwift click without zwift"
"free smart trainer app"
"smart trainer app no subscription"
"open source zwift alternative"
"van rysel d100 app free"
"ftms trainer app android"
"erg mode app free"
"virtual gears trainer app"
```

### Negative EN
```
zwift login · zwift download · zwift account · zwift price · zwift subscription cost · zwift companion
rouvy login · trainerroad login · torrent · crack · mod apk · hack · cheat
iphone · ios · ipad · apple tv
treadmill · exercise bike · spin bike · peloton · running
best smart trainer · trainer deals · buy trainer · trainer price · trainer review · amazon
jobs · course · kids
```

### Annunci RSA EN (3)

**RSA EN-1**
- Headlines: `Free Smart Trainer App` · `Open Source, No Account` · `24 Virtual Gears` · `ERG Workouts and FTP Test` · `No Monthly Subscription` · `Works With FTMS Trainers` · `Try It In Your Browser` · `Pedal-Powered 3D Games` · `Records FIT Files`
- Descriptions:
  1. `Free open-source app for smart trainers. No account, no subscription.`
  2. `Virtual gears, ERG, GPX routes, FIT export. Android or Chrome/Edge on a computer.`
  3. `Tested mostly on the Van Rysel D100. Tell us which trainer you have and if it connects.`

**RSA EN-2**
- Headlines: `Smart Trainer App, Free` · `Connect Over Bluetooth` · `Power, Cadence, Heart Rate` · `ERG, Slope and Resistance` · `Android and Web App` · `Report Your Trainer` · `Open Source on GitHub` · `No Ads, No Account` · `Structured Workouts`
- Descriptions:
  1. `Connect your trainer and ride with real-time power, cadence and heart rate.`
  2. `ERG, slope and resistance control. Trainer not working? Use the built-in report button.`
  3. `Tacx and old Wahoo support is experimental. We are looking for testers.`

**RSA EN-3**
- Headlines: `Watch Records Your Ride` · `Phone As A Bluetooth Sensor` · `Shift With A Bluetooth Click` · `Train Without A Subscription` · `Free Indoor Workouts` · `History, Records, FTP` · `Android Trainer App` · `3D Games On Pedal Power` · `Try It Free Today`
- Descriptions:
  1. `On Android the phone broadcasts power and cadence so your watch records the ride.`
  2. `Shift with a Bluetooth remote (experimental) or the screen. Free and open source.`
  3. `The interface is currently Italian only; more languages are planned.`

> Nota: la riga "interface Italian only" è nella descrizione 3 di EN-3 perché finché le pagine EN non esistono è onesto dirlo prima del clic. Se l'app avrà l'interfaccia in inglese, sostituire con la descrizione "No ads, no tracking, data stays on your device."

---

## Gruppo di annunci FR (8 parole chiave)

```
"application gratuite home trainer"
"alternative gratuite à zwift"
"application home trainer connecté gratuite"
"app home trainer van rysel d100"
"zwift click sans zwift"
"application home trainer sans abonnement"
"application ftms home trainer android"
"home trainer application open source"
```

### Negative FR
```
zwift connexion · zwift télécharger · zwift compte · zwift prix · zwift abonnement prix
rouvy connexion · trainerroad connexion · torrent · crack · mod · triche
iphone · ios · ipad · apple tv
tapis de course · vélo d'appartement · vélo spinning · peloton
prix home trainer · promo home trainer · acheter home trainer · meilleur home trainer · test home trainer · amazon · decathlon prix
emploi · cours · enfants
```

### Annunci RSA FR (3)

**RSA FR-1**
- Titres: `App gratuite home trainer` · `Open source, sans compte` · `24 vitesses virtuelles` · `Séances ERG et test FTP` · `Sans abonnement mensuel` · `Home trainers FTMS` · `Essayez dans le navigateur` · `Jeux 3D au pédalier` · `Enregistre des fichiers FIT`
- Descriptions:
  1. `Application gratuite et open source pour home trainer. Sans compte ni abonnement.`
  2. `Vitesses virtuelles, ERG, parcours GPX, export FIT. Android ou Chrome/Edge sur PC.`
  3. `Surtout testée avec le Van Rysel D100. Dites-nous quel home trainer vous avez.`

**RSA FR-2**
- Titres: `App pour Van Rysel D100` · `Connexion Bluetooth directe` · `Puissance, cadence, pouls` · `ERG, pente et résistance` · `Android et application web` · `Signalez votre home trainer` · `Code source sur GitHub` · `Sans publicité, sans compte` · `Séances structurées`
- Descriptions:
  1. `Connectez votre home trainer et suivez puissance, cadence et pouls en direct.`
  2. `Commande ERG, pente et résistance. Un souci ? Le bouton Signaler est intégré.`
  3. `Tacx et anciens Wahoo : support expérimental. Nous cherchons des testeurs.`

**RSA FR-3**
- Titres: `La montre enregistre la sortie` · `Téléphone en capteur Bluetooth` · `Changez avec un Click` · `Entraînement sans abonnement` · `Séances d'intérieur gratuites` · `Historique, records, FTP` · `App Android pour home trainer` · `Jeux 3D à pédales` · `Essayez gratuitement`
- Descriptions:
  1. `Sur Android, le téléphone diffuse puissance et cadence : la montre enregistre la sortie.`
  2. `Changez de vitesse avec une télécommande Bluetooth (expérimental) ou à l'écran.`
  3. `Interface actuellement en italien uniquement. D'autres langues sont prévues.`

---

## Come si crea (ordine pratico)

1. Un account Google Ads **senza** attivare le campagne "smart" automatiche: modalità Esperto.
2. Tre campagne Ricerca (IT, EN, FR), ciascuna con un gruppo di annunci e i suoi 3 RSA; incollare le parole chiave con le virgolette (frase) e le negative a livello di campagna.
3. Impostare il **CPC massimo a 0,60 €** e il budget a 3 €/giorno (IT 1,50 + EN 1 + FR 0,50 se si accendono tutte).
4. Controllare il **termine di ricerca** dopo 3–4 giorni (rapporto "Termini di ricerca") e aggiungere ciò che non vuoi come negativa. È la parte che fa risparmiare più denaro.

## Regola di stop (uguale per tutto)

Dal piano (sez. 10): *se dopo 20 € un canale non porta installazioni a meno di 1 € l'una, si sposta tutto sull'altro.* Resa operativa, perché le installazioni web non si misurano:

| Condizione | Azione |
|---|---|
| Dopo **20 €** spesi su un canale, **costo per "clic su Scarica/Apri l'app" > 1 €** (o 0 clic) | Fermare il canale e spostare il resto del budget sull'altro |
| CTR < 2% dopo ~300 impressioni su un gruppo | Cambiare titoli/descrizioni, non il budget |
| Un'unica parola chiave spende > 30% del budget senza risultati | Metterla in pausa |
| Annuncio rifiutato per marchio/policy | Riscrivere senza il termine, non ritentare lo stesso testo |
| Più di 2 commenti/segnalazioni negative per promesse non vere | Fermare tutto e correggere il testo |
| **Budget esaurito (60 € + 40 €)** | Non aggiungere altro: valutare l'organico (vedi `calendario.md`) |

---

# B. Reddit Ads: 40 €

> Fonti sul prodotto (blog di terzi, non la documentazione di Reddit): minimo **5 $/giorno** e **20 $** di budget totale; targeting per **community** consigliato con 5–10 subreddit pertinenti; il formato principale è il **post promosso**; i CPC variano molto. **[DA VERIFICARE nell'Ads Manager di Reddit: minimi, valuta (EUR?), formati disponibili]**: [guida omneky](https://www.omneky.com/blog/how-much-do-reddit-ads-cost), [guida stackmatix](https://www.stackmatix.com/blog/reddit-advertising-guide).

## Quale post promuovere

Il piano è chiaro: **si promuove il post organico che è andato meglio, non un annuncio nuovo.** Procedura:
1. Dopo le prime 3–4 settimane, scegliere tra i post di `reddit.md` quello con (a) più commenti utili che upvote, (b) più visite per `?ref=`, (c) nessun problema con i moderatori. Candidato più probabile: **r/indoorcycling**.
2. Un post promosso è ancora un post pubblico: i commenti restano e vanno **letti e risposti** nelle ore di diffusione. Se il post è stato rimosso dai moderatori, non è promuovibile.
3. Non promuovere post che dipendono da un thread o un giorno speciale (Showoff Saturday di r/webdev) né post di r/opensource: non è il pubblico per cui si paga.
4. Non cambiare il testo del post per l'annuncio: se serve una versione "annuncio", usa lo stesso tono onesto e i limiti dichiarati.

## Targeting per community

Targetizzare **solo** per community e **nessun** interesse generico:

| Community | Motivo | Note |
|---|---|---|
| r/indoorcycling | Pubblico principale (piano) | — |
| r/Zwift | Chi ha già un rullo e conosce il Click | Tono: non attaccare Zwift |
| r/Garmin | Chi vuole l'attività sull'orologio | Solo se il messaggio parla dell'orologio |
| r/cycling | Grande, ampia: costa e disperde | Aggiungere solo se il resto non consuma il budget |
| r/bikecommuting | Piano: "inverno = rullo" | [DA VERIFICARE che esista/sia attiva] |
| r/Velo, r/ZwiftIT… | [DA VERIFICARE: esistenza, regole e dimensione prima di usarle] | Non includere se non verificati |

Altre impostazioni: dispositivi **mobile e desktop**, lingua inglese (e italiano solo se esiste un post/annuncio italiano), località: Europa occidentale + paesi anglofoni. **Escludere** i sub off-topic (peloton, spinning, runners).

## Budget e bidding

- **40 € in ~8 giorni** (5 €/giorno, il minimo): più corto concentra i dati.
- Obiettivo **Traffico/Clic**, offerta **CPC con tetto 0,30–0,40 €** [DA VERIFICARE i valori nel prodotto]. L'URL di destinazione è il link `?ref=radsr-<community>`.
- Un solo annuncio (il post promosso) per 2 gruppi di community: "core" (indoorcycling + Zwift + Garmin) e "ampio" (cycling + bikecommuting). Dopo 3 giorni, spegnere il gruppo con CPC più alto.

## Regola di stop (Reddit)

Stessa tabella di Google. In più:
- Dopo **20 €**, se i clic costano > 1 € per "Scarica/Apri l'app" o se i commenti sotto il post promosso sono ostili o mostrano un problema di fiducia → fermarsi e spostare il resto (20 €) su Google, o non spenderlo.
- Se il post promosso riceve **molte** richieste "il mio rullo non va" per lo stesso modello → fermare la promozione e correggere.
- Alla fine: scrivere in `calendario.md` (diario) costo totale, clic per `ref`, bug emersi e **se lo rifaresti**.
