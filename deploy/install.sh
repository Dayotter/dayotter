#!/usr/bin/env bash
# One-command dayotter self-host installer.
#
#   curl -fsSL https://raw.githubusercontent.com/OWNER/dayotter/main/deploy/install.sh | bash
#   — or, from a checkout —
#   bash deploy/install.sh
#
# Installs Docker (if missing), generates strong secrets on first run, and brings
# up the full stack (Postgres, Redis, migrations, web, worker, Caddy/HTTPS).
# Re-running it pulls the latest changes and restarts — your data and secrets are
# kept. Configure via environment variables:
#
#   CALSYNC_DOMAIN     a domain pointing at this server → automatic HTTPS
#                      (unset → serves plain HTTP on the server's public IP)
#   CALSYNC_REPO_URL   git repo to clone when run standalone (default: this repo)
#   CALSYNC_DIR        install location (default: /opt/calsync)
set -euo pipefail

CALSYNC_DIR="${CALSYNC_DIR:-/opt/calsync}"
CALSYNC_REPO_URL="${CALSYNC_REPO_URL:-https://github.com/OWNER/dayotter.git}"
CALSYNC_DOMAIN="${CALSYNC_DOMAIN:-}"

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
err() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# Run privileged commands with sudo only when we're not already root.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then command -v sudo >/dev/null || err "run as root or install sudo"; SUDO="sudo"; fi

# --- 1. Locate the repo (a checkout next to this script, else clone it) --------
if [ -f "$(dirname "$0")/docker-compose.prod.yml" ]; then
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
else
  command -v git >/dev/null || { log "Installing git"; $SUDO apt-get update -y && $SUDO apt-get install -y git; }
  if [ ! -d "$CALSYNC_DIR/.git" ]; then
    log "Cloning $CALSYNC_REPO_URL → $CALSYNC_DIR"
    $SUDO git clone --depth 1 "$CALSYNC_REPO_URL" "$CALSYNC_DIR"
  else
    log "Updating existing checkout at $CALSYNC_DIR"
    $SUDO git -C "$CALSYNC_DIR" pull --ff-only
  fi
  REPO_ROOT="$CALSYNC_DIR"
fi
DEPLOY_DIR="$REPO_ROOT/deploy"
ENV_FILE="$DEPLOY_DIR/.env"

# --- 2. Install Docker + Compose plugin if absent -----------------------------
if ! command -v docker >/dev/null; then
  log "Installing Docker Engine + Compose"
  curl -fsSL https://get.docker.com | $SUDO sh
fi
if ! docker compose version >/dev/null 2>&1; then
  err "Docker Compose v2 plugin missing — install docker-compose-plugin and re-run"
fi
command -v openssl >/dev/null || { $SUDO apt-get update -y && $SUDO apt-get install -y openssl; }

# --- 3. Public URL + front-door address ---------------------------------------
public_ip() {
  # IMDSv2 first (works on EC2), then public echo services, then the local NIC.
  local tok ip
  tok=$(curl -s -m 2 -X PUT "http://169.254.169.254/latest/api/token" \
        -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || true)
  [ -n "$tok" ] && ip=$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $tok" \
        http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
  [ -z "${ip:-}" ] && ip=$(curl -s -m 3 https://api.ipify.org 2>/dev/null || true)
  [ -z "${ip:-}" ] && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "${ip:-}"
}

if [ -n "$CALSYNC_DOMAIN" ]; then
  SITE_ADDRESS="$CALSYNC_DOMAIN"
  APP_URL="https://$CALSYNC_DOMAIN"
else
  IP="$(public_ip)"
  [ -n "$IP" ] || err "Could not determine a public IP — set CALSYNC_DOMAIN instead"
  SITE_ADDRESS=":80"
  APP_URL="http://$IP"
  log "No CALSYNC_DOMAIN set — serving plain HTTP at $APP_URL (set a domain later for HTTPS)"
fi

# --- 4. Generate deploy/.env once (keeps secrets stable across re-runs) --------
if [ ! -f "$ENV_FILE" ]; then
  log "Generating $ENV_FILE with fresh secrets"
  $SUDO tee "$ENV_FILE" >/dev/null <<EOF
NODE_ENV=production
APP_URL=$APP_URL
BETTER_AUTH_URL=$APP_URL
CALSYNC_SITE_ADDRESS=$SITE_ADDRESS
POSTGRES_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
EMAIL_FROM="dayotter <no-reply@example.com>"
EOF
  $SUDO chmod 600 "$ENV_FILE"
  log "Wrote secrets. Add optional keys (Google, SMTP, Anthropic…) to $ENV_FILE later, then re-run."
else
  log "Reusing existing $ENV_FILE (delete it to regenerate secrets)"
fi

# --- 5. Build + start ---------------------------------------------------------
log "Building and starting the stack (first run pulls images and can take a few minutes)…"
$SUDO docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE" up -d --build

log "Done. dayotter is starting at: $APP_URL"
[ "$SITE_ADDRESS" = ":80" ] && log "Point a domain here and re-run with CALSYNC_DOMAIN=your.domain for automatic HTTPS."
log "Logs:   $SUDO docker compose -f $DEPLOY_DIR/docker-compose.prod.yml logs -f"
log "Update: cd $REPO_ROOT && git pull && bash deploy/install.sh"
