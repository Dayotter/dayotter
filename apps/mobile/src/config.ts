/**
 * Backend base URL. Override at build/run time via EXPO_PUBLIC_API_URL, e.g.
 *   EXPO_PUBLIC_API_URL=http://<mac-LAN-ip>:3000 pnpm --filter @dayotter/mobile start
 * iOS simulator can use http://localhost:3000; Android emulator uses
 * http://10.0.2.2:3000 to reach the host machine.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
