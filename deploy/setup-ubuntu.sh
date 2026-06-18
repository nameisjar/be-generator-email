#!/usr/bin/env bash
# setup-ubuntu.sh — One-shot server bootstrap for the Email Alias Manager backend.
# Run this once on a fresh Ubuntu 22.04+ (or 20.04) laptop.
#
# Usage (on the Ubuntu machine):
#   chmod +x setup-ubuntu.sh
#   sudo ./setup-ubuntu.sh
#
# This will:
#   1. Update apt
#   2. Install Node.js 20 LTS
#   3. Install PostgreSQL
#   4. Create the `mailapp` system user
#   5. Create the `mail` database + user
#   6. Install cloudflared
#   7. Create log directories
#
# After this finishes, copy the project files and run `setup-app.sh`.
#
# This script is IDEMPOTENT — safe to re-run. Existing installations and
# accounts are detected and skipped.

set -euo pipefail

C='\033[1;36m'   # cyan
G='\033[1;32m'   # green
Y='\033[1;33m'   # yellow
N='\033[0m'      # reset

ok()    { printf "${G}✓${N} %s\n" "$1"; }
info()  { printf "${C}==>${N} %s\n" "$1"; }
skip()  { printf "${Y}↻${N} %s (already done, skipping)\n" "$1"; }

if [[ $EUID -ne 0 ]]; then
  echo "[setup-ubuntu] Please run as root: sudo ./setup-ubuntu.sh"
  exit 1
fi

info "Updating apt"
apt update -y
# Don't auto-upgrade — could break other things on the laptop
# apt upgrade -y

info "Installing base tools"
apt install -y curl wget git ufw ca-certificates gnupg lsb-release openssl

info "Installing Node.js 20 LTS"
if command -v node >/dev/null 2>&1 && node -v | grep -q "v20"; then
  skip "Node.js $(node -v)"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  ok "Node.js installed"
fi
node -v
npm -v

info "Installing PostgreSQL"
if command -v psql >/dev/null 2>&1; then
  skip "PostgreSQL $(psql --version | head -1)"
else
  apt install -y postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
  ok "PostgreSQL installed"
fi

info "Creating mailapp system user"
if id mailapp >/dev/null 2>&1; then
  skip "User 'mailapp'"
else
  useradd --system --create-home --shell /bin/bash mailapp
  ok "User 'mailapp' created"
fi

info "Creating PostgreSQL role and database"
# Generate a strong random password for the DB role ONLY if the role doesn't exist.
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='mailapp'" 2>/dev/null | grep -q 1; then
  skip "PostgreSQL role 'mailapp' (existing — password not changed)"
  # Try to read the existing password from the saved file, otherwise re-randomize
  if [[ -f /root/.mailapp_db_password ]]; then
    DB_PASSWORD=$(cat /root/.mailapp_db_password)
  else
    DB_PASSWORD=$(openssl rand -hex 24)
    echo "${DB_PASSWORD}" > /root/.mailapp_db_password
    chmod 600 /root/.mailapp_db_password
    echo "  ⚠ Existing role 'mailapp' found, but no saved password. New password generated."
    echo "  Update backend/.env DATABASE_URL to use this password."
  fi
else
  DB_PASSWORD=$(openssl rand -hex 24)
  sudo -u postgres psql <<SQL
CREATE ROLE mailapp WITH LOGIN PASSWORD '${DB_PASSWORD}';
SQL
  ok "PostgreSQL role 'mailapp' created"
  # Save it for the app setup step.
  echo "${DB_PASSWORD}" > /root/.mailapp_db_password
  chmod 600 /root/.mailapp_db_password
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='mail'" 2>/dev/null | grep -q 1; then
  skip "Database 'mail'"
else
  sudo -u postgres psql -c "CREATE DATABASE mail OWNER mailapp"
  ok "Database 'mail' created"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mail TO mailapp" >/dev/null 2>&1 || true

echo
echo "==============================================================="
echo "  DATABASE READY"
echo "==============================================================="
echo "  Database: mail"
echo "  Role:     mailapp"
echo "  Password: (saved to /root/.mailapp_db_password)"
echo
echo "  This DATABASE_URL will be auto-written to backend/.env by setup-app.sh:"
echo "  postgresql://mailapp:***@localhost:5432/mail?schema=public"
echo "==============================================================="

info "Installing cloudflared"
if command -v cloudflared >/dev/null 2>&1; then
  skip "cloudflared $(cloudflared --version 2>&1 | head -1)"
else
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/cloudflared.list
  apt update
  apt install -y cloudflared
  ok "cloudflared installed"
fi
cloudflared --version

info "Creating log directories"
mkdir -p /var/log/email-alias-manager
chown -R mailapp:mailapp /var/log/email-alias-manager 2>/dev/null || true
mkdir -p /var/log/cloudflared
chown -R mailapp:mailapp /var/log/cloudflared 2>/dev/null || true

info "Configuring firewall (SSH only — tunnel doesn't need open ports)"
if ufw status 2>/dev/null | grep -q "Status: active"; then
  skip "ufw already configured"
  ufw allow OpenSSH 2>/dev/null || true
else
  ufw allow OpenSSH
  ufw --force enable
  ok "ufw enabled (SSH only)"
fi

echo
echo "==============================================================="
echo "  UBUNTU SETUP COMPLETE"
echo "==============================================================="
echo "  Next steps:"
echo "  1. Copy the project to /opt/email-alias-manager/"
echo "     (use scp from your Windows machine, see DEPLOY_UBUNTU.md)"
echo "  2. Run setup-app.sh to install deps + start the backend service"
echo "  3. Run setup-tunnel.sh to create the Cloudflare tunnel"
echo "==============================================================="
