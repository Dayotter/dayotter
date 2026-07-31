# Submitting DayOtter Android to the Play Store

A tight, per-release checklist. General build docs + listing copy live in
[`README.md`](./README.md); this is the "ship it" runbook. Everything here runs
from `apps/mobile/`.

> **Version source of truth:** [`../app.json`](../app.json) (`eas.json` uses
> `appVersionSource: local`). Current: **0.3.0 / versionCode 11**. The
> `production` profile has `autoIncrement`, so the next build bumps versionCode
> automatically — you don't edit it by hand.

## 0. One-time setup (skip if already done)

1. **Play Console app** exists for package `com.dayotter.app` (Productivity), with
   the store listing filled in (title, short + full description from
   [`README.md`](./README.md), icon `play-icon-512.png`, feature graphic
   `play-feature-graphic-1024x500.png`, ≥2 phone screenshots), **Data safety**
   form, **content rating**, target audience, and a **privacy policy URL**
   (`https://dayotter.com/privacy`). Play won't let you roll out until these are green.
2. **Play service-account key** — Play Console → *Setup → API access* → create/
   link a Google Cloud service account with the **Release Manager** role, download
   its JSON, and save it at **`apps/mobile/play-service-account.json`**. It's
   **gitignored** (`*service-account*.json`) — never commit it. `eas.json` →
   `submit.production.android.serviceAccountKeyPath` points at it.
3. `npm i -g eas-cli` (or `npx eas-cli@latest`) and `eas login`.

## 1. Build the AAB (from `main`)

> ⚠️ Build from **current `main`** — it now includes the merged AI features
> (mobile Q&A, focus-as-block, edit-booking via #195). An AAB built before that
> merge won't have them.

```bash
git checkout main && git pull
cd apps/mobile
eas build -p android --profile production
```

EAS builds a **signed .aab** in the cloud with its managed **upload key** (not the
local debug keystore — that one is only for sideloaded test APKs and Play rejects
it). `autoIncrement` bumps versionCode (11 → 12) and writes it back to `app.json`
— **commit that bump** so the next build continues cleanly.

## 2. Submit to the internal track (draft)

```bash
eas submit -p android --profile production
```

This uploads the AAB to the **internal testing** track as a **draft** (per
`eas.json` — safe defaults; nothing goes public). Pick the just-built binary when
prompted (or add `--latest`).

## 3. Finish in Play Console

1. Open the release on the **Internal testing** track → add the testers/link →
   **paste the "What's new"** text from [`whatsnew/whatsnew-en-US.txt`](./whatsnew/whatsnew-en-US.txt).
2. Install from the internal-test link on a device and smoke-test (sign in, open
   Otter, ask "how busy am I this week?", create a booking).
3. When happy, **promote** the release: Internal → (Closed/Open testing →)
   **Production**, set the rollout %, and submit for review. First-time apps take
   a few days for Google review.

## 4. Next release

Bump nothing by hand — `autoIncrement` handles versionCode; edit `version` in
`app.json` for a new user-facing number, refresh
[`whatsnew/whatsnew-en-US.txt`](./whatsnew/whatsnew-en-US.txt), then repeat from
step 1.

---

**What I (the assistant) can't run for you:** `eas login`, `eas build`,
`eas submit`, creating the service-account key, or the Play Console steps — those
need your account, credentials, and Google's terms. Everything above the line is
wired and ready; you drive the three commands.
