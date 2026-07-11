# DayOtter — app store assets & listing

Generated brand assets and copy for the App Store and Google Play. Regenerate
the PNGs any time with:

```bash
node scripts/gen-brand-assets.mjs
```

Source of truth: [`apps/web/public/brand/dayotter-icon.svg`](../../web/public/brand/dayotter-icon.svg).

## Assets in this folder

| File | Size | Use |
|------|------|-----|
| `ios-marketing-1024.png` | 1024×1024 | App Store marketing icon (opaque, **no alpha** — App Store requirement) |
| `play-icon-512.png` | 512×512 | Google Play high-res icon |
| `play-feature-graphic-1024x500.png` | 1024×500 | Google Play feature graphic |

Expo app icons live in [`../assets`](../assets): `icon.png` (iOS/base),
`adaptive-icon.png` (Android adaptive foreground), `splash-icon.png` (splash),
`favicon.png` (web). All are wired in [`../app.json`](../app.json).

## Listing copy

**App name:** DayOtter

**Subtitle (App Store, ≤30 chars):** Calm scheduling for teams

**Short description (Google Play, ≤80 chars):** Open-source scheduling that respects every calendar you own.

**Promotional text (App Store, ≤170 chars):** One calm home for your time. Sync every calendar, share your team's availability, and let people book you — no back-and-forth.

**Keywords (App Store, ≤100 chars):** calendar,scheduling,booking,meetings,availability,team,appointments,reminders,calendly,time

**Primary category:** Productivity  •  **Secondary:** Business

### Full description

DayOtter is the open-source home for your time. Connect Google, Outlook, and
iCloud, share one booking link, and let people grab a time you're actually free
— no back-and-forth.

- **Every calendar, one place.** Sync all your calendars so DayOtter always
  knows when you're busy.
- **Share your availability.** Send a link; people pick from times you're open.
- **Team scheduling.** Find a slot your whole raft is free — collective and
  round-robin, no paywall.
- **Protect your focus.** Buffers, daily limits, and focus blocks keep your
  calendar from filling up.
- **Confirm-first AI.** Ask it to move a meeting or defend deep-work time — it
  drafts a proposal and never touches your calendar until you say so.
- **Yours to run.** Self-host the whole thing for free, or use the cloud.

## Screenshots (capture from the app — not generated here)

Stores require real device screenshots; generate them from the running app:

- **iPhone 6.7" (1290×2796)** and **6.5" (1242×2688)** — required for App Store.
- **Android phone (min 1080×1920, 16:9 or taller)** — 2–8 shots for Play.

Suggested frames: Home (booking link + upcoming), a public booking page,
Availability editor, Team shared-availability, Insights.
