import { join } from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Self-contained server bundle for Docker / self-hosting (see docker-compose.yml).
  output: "standalone",
  // The standalone tracer must include the whole monorepo, not just apps/web.
  outputFileTracingRoot: join(import.meta.dirname, "../../"),
  // Workspace packages ship TS source; let Next transpile them.
  transpilePackages: [
    "@calsync/core",
    "@calsync/db",
    "@calsync/calendar",
    "@calsync/auth",
    "@calsync/jobs",
    "@calsync/emails",
    "@calsync/integrations",
    "@calsync/notifications",
  ],
  serverExternalPackages: [
    "pg",
    "googleapis",
    "tsdav",
    "node-ical",
    "nodemailer",
    "@anthropic-ai/sdk",
    "stripe",
  ],
};

export default config;
