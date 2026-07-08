// Expo inlines EXPO_PUBLIC_* env vars into process.env at build time. Declare the
// minimal shape so TypeScript is happy without pulling in all of @types/node.
declare const process: { env: Record<string, string | undefined> };
