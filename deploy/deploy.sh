#!/usr/bin/env bash
#
# Build → migrate → (re)start the DayOtter stack, in that order.
#
# Why this exists: `docker compose up -d` REUSES the already-completed one-shot
# `migrate` container instead of re-running it, so a plain redeploy can start new
# app code against an un-migrated database - 500s everywhere. This script always
# runs `run --rm migrate` (a fresh one-shot) before starting the app, so pending
# migrations are guaranteed to apply. If a migration fails, the script stops
# before touching the running app.
#
# Usage (from the repo root or the deploy/ dir):
#   ./deploy/deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "error: deploy/.env not found. Copy .env.example and fill it in." >&2
  exit 1
fi

FILES=(-f docker-compose.prod.yml)
# Host-nginx deploys add the overlay (disables the bundled Caddy). Auto-detect it.
if [ -f docker-compose.nginx.yml ]; then
  FILES+=(-f docker-compose.nginx.yml)
fi
DC=(docker compose "${FILES[@]}" --env-file .env)

echo "==> Building images"
"${DC[@]}" build web worker

echo "==> Applying database migrations (fresh one-shot)"
"${DC[@]}" run --rm migrate

echo "==> Starting / updating services"
"${DC[@]}" up -d

echo "==> Status"
"${DC[@]}" ps

echo "==> Done. Sanity-check the app:"
echo "    curl -I http://127.0.0.1:3000"
