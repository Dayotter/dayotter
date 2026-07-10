# syntax=docker/dockerfile:1
# Build context is the repo root: `docker build -f apps/web/Dockerfile .`
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- Install only the web app and its workspace dependencies (skips Expo/mobile) ---
FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile --filter "@calsync/web..."

# --- Build the Next.js standalone bundle ---
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @calsync/web build

# --- Minimal runtime image ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Standalone output bundles a tiny server + only the traced node_modules.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
