import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TS source; let Next transpile them.
  transpilePackages: [
    "@calsync/core",
    "@calsync/db",
    "@calsync/calendar",
    "@calsync/auth",
    "@calsync/jobs",
    "@calsync/emails",
    "@calsync/integrations",
  ],
  serverExternalPackages: ["pg", "googleapis", "tsdav", "node-ical", "nodemailer"],
};

export default config;
