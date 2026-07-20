const fs = require("node:fs");
const path = require("node:path");
const base = require("./app.json");

/**
 * Dynamic Expo config. Everything static lives in app.json; this file only adds
 * the pieces that depend on the deployment's own credentials.
 *
 * Android push: Expo's push service delivers to Android through Firebase Cloud
 * Messaging, which needs THIS deployment's `google-services.json` (each operator
 * brings their own Firebase project - we can't ship one). Supply it either by
 * dropping the file at apps/mobile/google-services.json, or by pointing
 * GOOGLE_SERVICES_JSON at it (that's what an EAS file secret sets).
 *
 * When it's absent the app still builds and runs - iOS push and everything else
 * work; only Android push stays off. So a contributor without a Firebase project
 * is never blocked. See docs/INTEGRATIONS.md -> "Mobile push (Android / FCM)".
 */
function googleServicesFile() {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const local = path.join(__dirname, "google-services.json");
  return fs.existsSync(local) ? "./google-services.json" : undefined;
}

module.exports = () => {
  const services = googleServicesFile();
  return {
    ...base.expo,
    android: {
      ...base.expo.android,
      ...(services ? { googleServicesFile: services } : {}),
    },
  };
};
