/**
 * Default backend the app points at. The shipped app defaults to the hosted
 * cloud; self-hosters switch it in-app (see src/server.ts → the "Server" screen).
 *
 * For local dev, override the default with EXPO_PUBLIC_API_URL, e.g.
 *   EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @dayotter/mobile start
 * (iOS simulator: http://localhost:3000; Android emulator: http://10.0.2.2:3000)
 */
export const DEFAULT_SERVER_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://dayotter.com"
).replace(/\/+$/, "");
