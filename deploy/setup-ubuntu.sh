#!/usr/bin/env bash
# setup-ubuntu.sh — One-shot server bootstrap for the Email Alias Manager backend.
# Run this once on a fresh Ubuntu 22.04+ (or 20.04) laptop.
#
# Usage (on the Ubuntu machine):
#   chmod +x setup-ubuntu.sh
#   ./setup-ubuntu.sh
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

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[setup-ubuntu] Please run as root: sudo ./setup-ubuntu.sh"
  exit 1
fi

echo "==> Updating apt"
apt update -y
apt upgrade -y

echo "==> Installing base tools"
apt install -y curl wget git ufw ca-certificates gnupg lsb-release

echo "==> Installing Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "v20"; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
node -v
npm -v

echo "==> Installing PostgreSQL"
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "==> Creating mailapp system user"
if ! id mailapp >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash mailapp
fi

echo "==> Creating PostgreSQL role and database"
# Generate a strong random password for the DB role.
DB_PASSWORD=$(openssl rand -hex 24)
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mailapp') THEN
    CREATE ROLE mailapp WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END\$\$;

SELECT 'CREATE DATABASE mail OWNER mailapp'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mail')\gexec

GRANT ALL PRIVILEGES ON DATABASE mail TO mailapp;
SQL

echo
echo "==============================================================="
echo "  DATABASE SETUP COMPLETE"
echo "==============================================================="
echo "  Database name: mail"
echo "  Role:          mailapp"
echo "  Password:      ${DB_PASSWORD}"
echo
echo "  Add this to backend/.env:"
echo "  DATABASE_URL=postgresql://mailapp:${DB_PASSWORD}@localhost:5432/mail?schema=public"
echo "==============================================================="
echo
# Stash it for the app setup step.
echo "${DB_PASSWORD}" > /root/.mailapp_db_password
chmod 600 /root/.mailapp_db_password

echo "==> Installing cloudflared"
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/cloudflared.list
  apt update
  apt install -y cloudflared
fi
cloudflared --version

echo "==> Creating log directories"
mkdir -p /var/log/email-alias-manager
chown mailapp:mailapp /var/log/email-alias-manager
mkdir -p /var/log/cloudflared
chown mailapp:mailapp /var/log/cloudflared 2>/dev/null || true

echo "==> Configuring firewall (SSH + nothing else, tunnel doesn't need open ports)"
ufw allow OpenSSH
ufw --force enable

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
