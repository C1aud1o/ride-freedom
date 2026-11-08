# Security Policy

## Supported versions

Only the latest released version of Spindro receives security fixes. This means the latest release on the
GitHub Releases page and the version currently deployed on the web app. Please update before reporting an
issue that may already be fixed.

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for a security problem.**

Report it privately, using one of these channels:

1. **GitHub private vulnerability reporting** (preferred): go to the **Security** tab of this repository and
   click **Report a vulnerability**. Only maintainers can see the report.
2. **Email**: [CONTACT EMAIL]. Use a subject starting with `[Spindro security]`.

Please include:

- a description of the problem and its impact;
- the steps to reproduce it, or a proof of concept;
- the app version, platform (web, Android) and browser or Android version;
- whether you would like to be credited in the fix.

What to expect: we aim to acknowledge a report within 7 days and to keep you informed while we investigate.
We will agree a disclosure date with you, and publish a fix and an advisory when it is ready. We are happy to
credit reporters who want it.

## Scope

In scope:

- the web app and the Android app in this repository;
- the optional Strava Worker in `server/strava-worker/`;
- anything that exposes user data (activities, location, tokens) or lets a third party act on a user's
  account.

Out of scope:

- vulnerabilities in third-party services (Strava, Garmin, Zwift, Bluetooth stacks, browsers) that do not come
  from our code; please report those to the vendor;
- problems that require a rooted or compromised device;
- social engineering and spam.

## Official builds

Official Android builds (APK) are signed only by the official CI pipeline of this project. They are published
only on the GitHub **Releases** page of this repository and on the **Google Play Store**. Any APK found
elsewhere, including from third-party mirrors, is not an official build: it may have been modified, and it
should not be installed or trusted as Spindro.

If you are unsure whether a file is official, install from the Play Store or from the Releases page of this
repository instead.
