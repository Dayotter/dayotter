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
RUN pnpm install --frozen-lockfile --filter "@dayotter/web..."

# --- Build the Next.js standalone bundle ---
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are INLINED into the client bundle at build time, so they must be
# present during `next build` (passed as build args from compose). Setting them in
# the runtime .env alone has no effect - the value is already baked. Empty = the
# feature stays hidden.
ARG NEXT_PUBLIC_GOOGLE_AUTH=""
ARG NEXT_PUBLIC_PHONE_AUTH=""
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ARG NEXT_PUBLIC_MIXPANEL_TOKEN=""
ARG NEXT_PUBLIC_GA_ID=""
ENV NEXT_PUBLIC_GOOGLE_AUTH=$NEXT_PUBLIC_GOOGLE_AUTH \
    NEXT_PUBLIC_PHONE_AUTH=$NEXT_PUBLIC_PHONE_AUTH \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_MIXPANEL_TOKEN=$NEXT_PUBLIC_MIXPANEL_TOKEN \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
RUN pnpm --filter @dayotter/web build

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
