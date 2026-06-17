#!/usr/bin/env bash
# setup-app.sh — Deploy the backend Node app + create .env + run migrations
# + start systemd service.
#
# Run on the Ubuntu server AFTER setup-ubuntu.sh, AFTER copying the project to
# /opt/email-alias-manager/.
#
# Usage:
#   sudo ./setup-app.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[setup-app] Please run as root: sudo ./setup-app.sh"
  exit 1
fi

APP_DIR=/opt/email-alias-manager/backend
PROJECT_DIR=/opt/email-alias-manager

if [[ ! -d "$APP_DIR" ]]; then
  echo "[setup-app] $APP_DIR not found."
  echo "            Did you copy the project there? (see DEPLOY_UBUNTU.md)"
  exit 1
fi

echo "==> Installing dependencies (production only)"
cd "$APP_DIR"
npm ci --omit=dev

echo "==> Generating .env"
if [[ ! -f .env ]]; then
  if [[ ! -f /root/.mailapp_db_password ]]; then
    echo "[setup-app] No saved DB password found at /root/.mailapp_db_password."
    read -r -s -p "  Enter the mailapp PostgreSQL password: " DB_PASSWORD
    echo
  else
    DB_PASSWORD=$(cat /root/.mailapp_db_password)
  fi

  JWT_ACCESS=$(openssl rand -hex 64)
  JWT_REFRESH=$(openssl rand -hex 64)
  WEBHOOK_SECRET=$(openssl rand -hex 32)

  cat > .env <<ENV
NODE_ENV=production
PORT=4000
APP_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173

DATABASE_URL=postgresql://mailapp:${DB_PASSWORD}@localhost:5432/mail?schema=public

JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=14d

MAIL_DOMAIN=algonova.my.id
WEBHOOK_SECRET=${WEBHOOK_SECRET}
WEBHOOK_MAX_AGE_SECONDS=300

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
ENV

  chown mailapp:mailapp .env
  chmod 600 .env
  echo "[setup-app] .env written to $APP_DIR/.env"
  echo "[setup-app]   WEBHOOK_SECRET = ${WEBHOOK_SECRET}"
  echo "[setup-app]   ⚠ Save this — you'll paste it into the Worker's secrets."
fi

echo "==> Generating Prisma client + running migrations"
cd "$APP_DIR"
npx prisma generate
npx prisma migrate deploy

echo "==> Installing systemd service"
cp "$APP_DIR/deploy/email-alias-backend.service" /etc/systemd/system/email-alias-backend.service
systemctl daemon-reload
systemctl enable email-alias-backend
systemctl restart email-alias-backend

sleep 2
systemctl status email-alias-backend --no-pager || true

echo
echo "==> Smoke test"
sleep 1
curl -s http://localhost:4000/api/health || echo "  (no response yet, give it a few seconds and try again)"

echo
echo "==============================================================="
echo "  BACKEND SERVICE RUNNING"
echo "==============================================================="
echo "  - URL (local):    http://localhost:4000"
echo "  - Health check:   curl http://localhost:4000/api/health"
echo "  - Logs:           sudo journalctl -u email-alias-backend -f"
echo "  - File logs:      /var/log/email-alias-manager/backend.log"
echo
echo "  Next: run setup-tunnel.sh to expose this to the internet."
echo "==============================================================="
