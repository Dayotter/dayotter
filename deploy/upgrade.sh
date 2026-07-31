#!/usr/bin/env bash
#
# Upgrade a self-hosted DayOtter to the latest (or a specific) version - safely.
#
# The pattern most self-hostable projects use (Ghost, Gitea, Plausible): one
# command that backs up, pulls, migrates, restarts, and health-checks - and tells
# you how to roll back if anything goes wrong. This does exactly that, in order:
#
#   1. Fetch upstream and show what's changed (link to the diff).
#   2. Back up the Postgres database (gzipped, under deploy/backups/).
#   3. Fast-forward the code (or check out --ref <tag>).
#   4. Rebuild images, run pending migrations, restart the stack
#      (delegates to deploy.sh so migration ordering lives in one place).
#   5. Wait for /api/health to report "ok".
# If a step fails it stops and prints how to roll back.
#
# Usage (from anywhere in the repo):
#   ./deploy/upgrade.sh                # upgrade to the latest on the current branch
#   ./deploy/upgrade.sh --check        # only report whether an update is available
#   ./deploy/upgrade.sh --ref v0.3.0   # upgrade to a specific tag / branch / commit
#   ./deploy/upgrade.sh --no-backup    # skip the DB backup (not recommended)
#
set -euo pipefail
cd "$(dirname "$0")" # deploy/ - git still resolves the repo from here

REF="" CHECK=0 BACKUP=1
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1 ;;
    --ref) REF="${2:-}"; shift ;;
    --no-backup) BACKUP=0 ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "unknown option: $1 (see --help)" >&2; exit 1 ;;
  esac
  shift
done

command -v git >/dev/null || { echo "error: git is required." >&2; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  { echo "error: not a git checkout - upgrade only works for source installs." >&2; exit 1; }
[ -f .env ] || { echo "error: deploy/.env not found - is this a self-host install?" >&2; exit 1; }

REPO_URL="https://github.com/Dayotter/dayotter"
CURRENT=$(git rev-parse --short HEAD)

echo "==> Fetching updates"
git fetch --tags --quiet origin

TARGET_REF="${REF:-@{u}}" # default: the upstream of the current branch
if ! TARGET=$(git rev-parse --short "$TARGET_REF" 2>/dev/null); then
  echo "error: can't resolve '$TARGET_REF'. Pass a valid --ref, or set an upstream." >&2
  exit 1
fi

if [ "$CURRENT" = "$TARGET" ]; then
  echo "==> Already up to date ($CURRENT)."
  exit 0
fi

COUNT=$(git rev-list --count "$CURRENT..$TARGET" 2>/dev/null || echo "?")
echo "==> Update available: $CURRENT -> $TARGET  ($COUNT new commit(s))"
echo "    What changed: $REPO_URL/compare/$CURRENT...$TARGET"
[ "$CHECK" = 1 ] && exit 0

# Refuse to clobber local edits - self-host installs should track upstream cleanly.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: you have uncommitted local changes. Commit or 'git stash' them first." >&2
  exit 1
fi

FILES=(-f docker-compose.prod.yml)
[ -f docker-compose.nginx.yml ] && FILES+=(-f docker-compose.nginx.yml)
DC=(docker compose "${FILES[@]}" --env-file .env)

# --- 1. Back up the database BEFORE migrating ---
if [ "$BACKUP" = 1 ]; then
  if "${DC[@]}" ps --status running postgres 2>/dev/null | grep -q postgres; then
    mkdir -p backups
    BACKUP_FILE="backups/dayotter-db-${CURRENT}-$(date +%Y%m%d-%H%M%S).sql.gz"
    echo "==> Backing up database -> $BACKUP_FILE"
    "${DC[@]}" exec -T postgres pg_dump -U dayotter dayotter | gzip > "$BACKUP_FILE"
  else
    echo "==> Postgres isn't running yet - skipping backup."
    BACKUP_FILE=""
  fi
else
  echo "==> Skipping database backup (--no-backup)."
  BACKUP_FILE=""
fi

# --- 2. Update the code ---
echo "==> Updating code to $TARGET"
if [ -n "$REF" ]; then
  git checkout --quiet "$REF"
else
  git merge --ff-only --quiet "$TARGET_REF"
fi

# --- 3. Rebuild + migrate + restart (deploy.sh runs migrations first) ---
echo "==> Rebuilding and restarting the stack"
if ! ./deploy.sh; then
  echo "" >&2
  echo "!! Deploy failed. Roll back with:" >&2
  echo "     git checkout $CURRENT && ./deploy/deploy.sh" >&2
  [ -n "$BACKUP_FILE" ] &&
    echo "     gunzip -c deploy/$BACKUP_FILE | docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec -T postgres psql -U dayotter dayotter" >&2
  exit 1
fi

# --- 4. Wait for the app to report healthy ---
echo "==> Waiting for the app to become healthy"
healthy=0
for _ in $(seq 1 24); do
  if "${DC[@]}" exec -T web node -e "fetch('http://localhost:3000/api/health').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    healthy=1; break
  fi
  sleep 5
done

if [ "$healthy" != 1 ]; then
  echo "" >&2
  echo "!! The app didn't report healthy at /api/health within ~2 minutes." >&2
  echo "   Check logs:  docker compose -f deploy/docker-compose.prod.yml logs web worker" >&2
  echo "   Roll back:   git checkout $CURRENT && ./deploy/deploy.sh" >&2
  [ -n "$BACKUP_FILE" ] &&
    echo "   Restore DB:  gunzip -c deploy/$BACKUP_FILE | docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec -T postgres psql -U dayotter dayotter" >&2
  exit 1
fi

echo ""
echo "==> Upgraded: $CURRENT -> $(git rev-parse --short HEAD)  ✓  (healthy)"
[ -n "$BACKUP_FILE" ] && echo "    Pre-upgrade DB backup: deploy/$BACKUP_FILE"
