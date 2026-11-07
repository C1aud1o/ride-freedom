# Spindro Privacy Policy

*Last updated: [DATE]*

> **DRAFT to be reviewed** (see `docs/legal/README.md`) before publication.

Spindro is a free, open source app for smart trainers. It runs in the browser and as an Android app.

This policy explains what data Spindro processes, why, for how long, and what rights you have. It covers the app and the Spindro website.

## 1. Who is the data controller

The data controller is an individual residing in Italy:

- **Name:** [NAME]
- **Address:** [ADDRESS]
- **Contact email:** [CONTACT EMAIL]

We have no Data Protection Officer (DPO): we are not required to appoint one.

## 2. In short

| Situation | What happens to your data |
|---|---|
| You use Spindro **without an account** | It stays on your device only. We do not receive it. |
| You create an **account** (optional) | We store the account data and the data you choose to sync, in Europe. |
| You want to save your **heart rate** on the server too | This needs separate, explicit consent. Without consent, heart rate stays on your device only. |
| You connect **Strava** | The app sends the activity to Strava through our relay server, which does not keep it. |
| You watch a **YouTube** video | The official YouTube player starts. Google's privacy policy applies. |
| Errors and statistics | Technical errors without personal data. Usage statistics only if you consent. |

We do not sell data. We do not show ads. We do not profile you.

Some features (account, sync, leaderboards, error reporting, statistics) exist only in app versions that include them. The "foss" version (without Spindro's online services) does not contain them. Where a section describes one of these features, it says so.

## 3. Using the app without an account: data stays on your device

You do not need to sign up. Without an account, Spindro has no server of its own to send your data to.

### 3.1 What the app stores on your device

The app uses the local storage of the browser (`localStorage`) or of the Android WebView. This includes:

- your **weight** and **FTP**, used to compute power, resistance and the virtual gears;
- your **maximum heart rate**, if you set it;
- the **ride history** (date, duration, kilometres, average power, energy, average and maximum heart rate, data series) and the **ride in progress**, which is restored if you reload the page;
- **custom workouts** you created in the editor;
- **records** and **game progress** (best scores, experience, achievements, hero and stage choices) and **best times** on routes;
- **settings** (music, coach voice, automatic gear shifting, Click buttons, audio, weekly goal);
- the **last YouTube link** used and the video reference speed;
- the **Strava configuration**, if you enable it (see section 6).

This data is not sent to Spindro. You can delete it at any time: clear the site data in your browser, or on Android go to *Settings → Apps → Spindro → Storage → Clear data*.

About **system backup** on Android: the Android app allows the system's automatic backup. If phone backup is on, Android may copy this data to your Google account, following your Android settings. In that case Google handles it, not us.

### 3.2 Bluetooth and sensors

Spindro connects over Bluetooth to your trainer, heart rate strap, power meter and Zwift Click. It reads power, cadence, speed and heart rate. This data stays on your device.

The "watch bridge" feature (Android) sends power, cadence and speed over Bluetooth to a nearby watch that accepts them as a sensor. It does not go through the internet.

On Android, your location is never read. On Android 11 and earlier, the system asks for the location permission only because it is required to scan for Bluetooth devices. Spindro does not use your location. In virtual routes the coordinates come from the route, not from you.

### 3.3 Files

The `.FIT` file of a ride, the data backup and the share card are created on your device. They go elsewhere only if you save or share them (for example to Garmin Connect or another app). The backup you export does not contain your Strava login data.

### 3.4 What the page loads from the internet

Even without an account, the web page and the app load:

- **The Barlow fonts from Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`). Google receives your IP address and the technical data of your browser's request. See Google's privacy policy.
- **In the browser, the site itself**, from our hosting ([HOSTING]), which logs the standard technical data of a request (IP address, time, page).

## 4. Optional account

*Only in versions with an account.*

The account is optional and free. No core feature depends on it. It adds convenience: backup and sync across devices, game leaderboards and challenges.

### 4.1 What data

| Data | What it is for |
|---|---|
| Email, or the Google account used to sign in; user identifier | Signing in and recognising you |
| Display name (your choice, preferably a nickname) and, if you want, Country | Showing you on leaderboards |
| Ride history, records, custom workouts, settings | Backup and sync |
| Game scores and route times | Leaderboards and challenges |
| Challenge medals and achievements | Profile |

**Heart rate** is not in this list: it follows the rules in section 5.

Leaderboards are visible to other users. They show your display name, the score and, if you choose, your Country. They do not show your email or other profile data. Leaderboards use only data recorded by Spindro. We never use data read from Strava.

We check that scores are plausible. If a score looks suspicious we remove it, as the Terms of Use explain.

### 4.2 Legal basis

The basis is **performance of the service** you request by creating the account (Art. 6(1)(b) GDPR). For anti-abuse checks on leaderboards the basis is our **legitimate interest** in keeping them fair (Art. 6(1)(f)).

### 4.3 Where and for how long

Account data is stored on **Firebase** (Google), with the **Firestore database in the EU region** (`eur3`). Firebase Authentication, which handles sign-in, does not let us choose the region: Google may process sign-in data outside the EU too, with the safeguards the GDPR requires (standard contractual clauses or an adequacy decision).

We keep the data **until you delete the account**.

### 4.4 How to delete your account

- **In the app:** *Settings → Account → Delete account*.
- **By email**, even without the app: see the "Account deletion" page (`account-deletion`).

When you delete the account we remove your profile, your synced data (heart rate included) and your leaderboard scores. Data that exists only on your device stays on your device until you delete it. Residual technical copies in Google's systems may remain for a short time before final removal.

## 5. Heart rate: health data

Heart rate is **data concerning health** (Art. 9 GDPR). We handle it under stricter rules.

- **On the device:** the heart rate you read from the strap shows in the app and is saved in the local history. We do not send it to anyone.
- **On our server:** we store it **only if you give explicit, separate consent**, with a dedicated option ("Also save heart rate in the cloud"). The option is **off** by default. It is not tied to accepting the account or the Terms.
- **Without consent** we sync everything except heart rate.
- **Legal basis:** explicit consent (Art. 9(2)(a) GDPR).
- **Withdrawal:** you can withdraw it any time with the option. When you withdraw, we delete the heart rate already stored on the server. Withdrawal does not affect what happened before.
- Heart rate is never used in leaderboards.

Consent is not required to use Spindro.

## 6. Strava

Spindro can upload your rides to Strava. You turn this feature on yourself.

**How it works**

1. You tap "Connect with Strava" and sign in on Strava's site. You choose the permissions.
2. The app receives an access token from Strava. It keeps it **only on your device**.
3. When you finish a ride, the app uploads the activity to Strava. With the option "Upload automatically when I finish", the upload starts when you tap *Finish*. After connecting, the option is on, and you can turn it off. Otherwise you use the manual upload button.
4. With "Disconnect" the app deletes the tokens from the device and asks Strava to revoke access.

**What is sent to Strava**

The ride's `.FIT` file (time, power, cadence, speed, distance and, if a heart rate strap was connected, also the **heart rate**), a title, a short description (time, average power, kJ, km) and a ride identifier. This is your choice: you address Strava and the file reaches Strava. Heart rate follows Strava's rules, even if you did not give the consent described in section 5.

**Our relay server**

So you do not have to enter technical keys, in the public mode the app uses a small server on **Cloudflare Workers**. It holds the Strava app's secret key and forwards calls to Strava. **It stores nothing**: it has no database and does not keep files or tokens. It sees the data only while it passes through. Like any internet service, Cloudflare may log technical network data (such as the IP address).

There is also a **personal mode** for those who prefer to create their own Strava app: the app then talks directly to Strava, without our server, and the keys stay on your device.

**After the upload**

Once received, the data is handled by Strava as an independent controller, under [its privacy policy](https://www.strava.com/legal/privacy). Spindro does not read your Strava activities for other purposes and does not show them to other users.

## 7. YouTube

The "Ride along a video" feature lets you watch a video that plays at your speed. It can use the **official YouTube player**.

- The player and its script are loaded from `youtube.com` only when you paste a YouTube link and tap "Watch". They do not load earlier.
- At that point **Google/YouTube** receives the data of your visit (such as IP and identifiers) and may use **cookies** or similar technologies, as described in [its privacy policy](https://policies.google.com/privacy). We do not control them.
- We do not download or modify videos. We change the playback speed with the player's official functions.
- We remember the last link you used, **only on your device**.
- A video you pick from your device plays locally and is not uploaded anywhere.

If you do not use this feature, YouTube is not contacted.

## 8. Errors and statistics

*Only in versions that include them.*

### 8.1 Error reporting (Sentry)

When the app crashes or errors, it may send a technical report to **Sentry**, with servers in the **EU**. It contains the type of error, the part of the code involved and general technical information, such as app version, browser type and system.

We configure Sentry so that it **does not collect personal data**: no email, name or account identifier, and **the IP address is not stored**. We do not send the content of your history or your heart rate.

- **Legal basis:** legitimate interest in finding and fixing errors (Art. 6(1)(f)).
- **Retention:** [SENTRY RETENTION DAYS] days.
- You can object to this processing by writing to us (section 9).

### 8.2 Anonymous statistics

- **Website visits:** we count visits with a tool that uses no cookies and does not identify people ([GOATCOUNTER OR PLAUSIBLE]). No banner is needed for this.
- **Feature usage** (for example which games are used): we measure it with anonymous events **only if you consent**. The question appears at first launch. You can decline, and you can change your mind in the settings. If you decline, we do not collect these events.
- **Legal basis:** consent (Art. 6(1)(a)).

We do not use Google Analytics or Firebase Analytics.

## 9. Your rights

You can ask us at any time to:

- tell you what data we hold about you and give you a copy (**access**);
- correct wrong data (**rectification**);
- delete data (**erasure**);
- restrict processing;
- give you your data in a machine-readable format (**portability**);
- let you **object** to processing based on legitimate interest;
- **withdraw** a consent (it does not affect what happened before).

Write to [CONTACT EMAIL]. We reply within one month. For security we may ask you to prove the account is yours.

If you think we process your data unlawfully, you can lodge a complaint with the Italian **Garante per la protezione dei dati personali** ([garanteprivacy.it](https://www.garanteprivacy.it)) or with the authority of your own country.

## 10. Minimum age

To create an account you must be **at least 14 years old**. If you are under 14, you can use Spindro without an account (we do not collect your data). If we find that an account belongs to a person under 14, we delete it.

## 11. Who we share data with (processors)

To provide the service we rely on these providers, who process data on our behalf:

| Provider | Purpose | Data |
|---|---|---|
| **Google** (Firebase: Authentication, Firestore) | Account, sync, leaderboards | Account and synced data; Firestore in the EU |
| **Cloudflare, Inc.** | Relay server for Strava (Workers) | In transit only: tokens and ride file, not stored |
| **Functional Software, Inc.** (Sentry) | Error reporting | Technical data, no personal data; EU servers |
| [HOSTING] | Web page hosting | Technical access data |
| [GOATCOUNTER OR PLAUSIBLE] | Website visits | Anonymous counts, no cookies |

Their data processing agreements (DPAs) apply. Some are US companies: transfers take place with the safeguards required by the GDPR (standard contractual clauses or the Data Privacy Framework).

By contrast, the services you choose to use are **independent controllers**, not our providers: **Strava**, **YouTube/Google** and **Google Fonts**. Their own policies apply.

We do not sell or pass your data to anyone else.

## 12. Security

We use encrypted connections (HTTPS). The database rules let each user read and write only their own data, apart from the public leaderboards. No system is 100% secure: if a personal data breach affecting you occurs, we will notify you as the law requires.

## 13. Changes

If we change this policy, we update the date at the top. For important changes we notify you in the app or on the site. Earlier versions are in the public history of the project's repository.

## 14. Contact

[NAME] · [ADDRESS] · [CONTACT EMAIL]
