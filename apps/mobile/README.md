# dayotter Mobile (Expo / React Native)

Native iOS & Android client for dayotter. Written in **TypeScript**, it lives in
this monorepo, shares code with the web via `@dayotter/core`, and talks to the
**same backend** using Better Auth **bearer tokens**.

## Status

Foundation + core screens: **auth (sign in / sign up), dashboard, event types,
teams, bookings**, all wired to the live REST API and typechecked. Next parity
milestones (added alongside their web counterparts): availability editor,
event-type create/edit, team management, calendar connect, booking manage, settings.

Type-checks in the monorepo (`pnpm --filter @dayotter/mobile typecheck`). Running
on a simulator additionally requires the Expo/RN native toolchain (below).

## Prerequisites

- Node + pnpm (already used by the monorepo)
- Xcode (iOS simulator) and/or Android Studio (emulator)
- Backend running: from the repo root, `docker compose up -d` then
  `pnpm --filter @dayotter/web dev` (API on http://localhost:3000)

## Run

```bash
# from repo root
pnpm install

# iOS simulator (localhost reaches the host machine)
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @dayotter/mobile ios

# Android emulator (10.0.2.2 reaches the host machine)
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 pnpm --filter @dayotter/mobile android
```

Native `ios/` and `android/` folders are generated on demand by Expo prebuild;
they're gitignored. Test account: `archit@example.com` / `supersecret123`.

### Optional sign-in methods

Both are hidden by default; set the flag to `1` (and configure the server side):

- `EXPO_PUBLIC_GOOGLE_AUTH=1` — shows "Continue with Google" (needs `GOOGLE_CLIENT_ID`
  on the server). Hidden on iOS builds pending Sign in with Apple.
- `EXPO_PUBLIC_PHONE_AUTH=1` — shows "Continue with phone" (SMS OTP). The server
  enables the endpoints automatically when Twilio is configured (`TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`). iOS/Android auto-fill the code from the SMS.

## Architecture

```
app/                     # expo-router routes
  _layout.tsx            # providers (AuthProvider) + Stack
  sign-in.tsx
  (tabs)/_layout.tsx     # tab navigator + auth guard
  (tabs)/index.tsx       # dashboard   events.tsx   teams.tsx   bookings.tsx
src/
  api.ts                 # fetch client: bearer token + expo-secure-store
  auth.tsx               # AuthProvider / useAuth
  models.ts              # DTOs (Slot re-exported from @dayotter/core/availability)
  hooks.ts               # useAsync
  theme.ts  format.ts    # tokens + date formatting
  components/ui.tsx       # Card, Badge, EmptyState, Loading
```

Shared with web: `@dayotter/core/availability` (the availability engine + types).
Endpoints (bearer-authed): `POST /api/auth/sign-in|sign-up/email`, `GET /api/me`,
`/api/event-types`, `/api/bookings`, `/api/teams`, `/api/schedule`.
