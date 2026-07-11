# syntax=docker/dockerfile:1
# Build context is the repo root: `docker build -f apps/worker/Dockerfile .`
# The worker runs TypeScript directly via tsx, so there is no separate build step.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY . .
# Install the worker and its workspace deps (includes tsx from devDependencies).
RUN pnpm install --frozen-lockfile --filter "@dayotter/worker..."

FROM deps AS runner
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@dayotter/worker", "start"]
