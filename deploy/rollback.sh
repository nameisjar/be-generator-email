#!/usr/bin/env bash
# rollback.sh — Undo everything that setup-ubuntu.sh + setup-app.sh did.
# SAFE to run multiple times. Prompts before destructive actions.
#
# Usage: sudo ./rollback.sh
#
# What it removes:
#   - systemd services: email-alias-backend, cloudflared-tunnel
#   - Cloudflare tunnel: email-alias-backend (the tunnel itself, NOT the DNS record)
#   - Files: /opt/email-alias-manager/
#   - Log dirs: /var/log/email-alias-manager/, /var/log/cloudflared/
#   - System user: mailapp
#   - PostgreSQL: role + database
#   - apt packages: nodejs, postgresql, cloudflared (optional)
#
# What it KEEPS (because they're part of the system or shared):
#   - SSH access
#   - DNS records in Cloudflare (you delete manually from the dashboard)
#   - /root/.mailapp_db_password (cleanup of secrets)
#   - ufw rules
#   - The OS itself :)

set -euo pipefail

C='\033[1;36m'   # cyan
Y='\033[1;33m'   # yellow
R='\033[1;31m'   # red
N='\033[0m'

if [[ $EUID -ne 0 ]]; then
  echo "[rollback] Please run as root: sudo ./rollback.sh"
  exit 1
fi

echo
printf "${R}!! This will DELETE:${N}\n"
echo "  - systemd services (email-alias-backend, cloudflared-tunnel)"
echo "  - /opt/email-alias-manager/ directory"
echo "  - PostgreSQL database 'mail' and role 'mailapp'"
echo "  - System user 'mailapp'"
echo "  - Cloudflare tunnel 'email-alias-backend' (the tunnel config, NOT the DNS)"
echo
printf "${Y}Press ENTER to continue, Ctrl+C to abort${N}\n"
read -r

echo
echo "==> Stopping services"
systemctl stop email-alias-backend 2>/dev/null || true
systemctl disable email-alias-backend 2>/dev/null || true
rm -f /etc/systemd/system/email-alias-backend.service
systemctl stop cloudflared-tunnel 2>/dev/null || true
systemctl disable cloudflared-tunnel 2>/dev/null || true
rm -f /etc/systemd/system/cloudflared-tunnel.service
systemctl daemon-reload
echo "    done"

echo "==> Removing Cloudflare tunnel (if exists)"
if command -v cloudflared >/dev/null 2>&1; then
  if cloudflared tunnel list 2>/dev/null | grep -q "email-alias-backend"; then
    cloudflared tunnel delete email-alias-backend 2>/dev/null || echo "    (couldn't delete tunnel — you can do it manually from the Cloudflare dashboard)"
  else
    echo "    (no tunnel found)"
  fi
  rm -f /root/.cloudflared/*.json
  echo "    done"
fi

echo "==> Removing app files"
if [[ -d /opt/email-alias-manager ]]; then
  rm -rf /opt/email-alias-manager
  echo "    /opt/email-alias-manager removed"
else
  echo "    (not present)"
fi

echo "==> Removing log directories"
rm -rf /var/log/email-alias-manager
rm -rf /var/log/cloudflared
echo "    done"

echo "==> Removing PostgreSQL database and role"
if command -v psql >/dev/null 2>&1; then
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS mail" 2>/dev/null || true
  sudo -u postgres psql -c "DROP ROLE IF EXISTS mailapp" 2>/dev/null || true
  echo "    done"
fi

echo "==> Removing system user"
if id mailapp >/dev/null 2>&1; then
  userdel -r mailapp 2>/dev/null || userdel mailapp 2>/dev/null || true
  echo "    done"
fi

echo "==> Cleaning up saved secrets"
rm -f /root/.mailapp_db_password
echo "    done"

echo
echo "==============================================================="
echo "  ROLLBACK COMPLETE"
echo "==============================================================="
echo
echo "Optional manual cleanup:"
echo
echo "  # Delete DNS records (api.algonova.my.id) in Cloudflare dashboard:"
echo "  #   https://dash.cloudflare.com → DNS → Records"
echo
echo "  # Uninstall apt packages (if you want):"
echo "  sudo apt remove -y postgresql postgresql-contrib"
echo "  sudo apt remove -y cloudflared"
echo "  sudo apt remove -y nodejs"
echo
echo "  # Remove Cloudflare apt repo:"
echo "  sudo rm /etc/apt/sources.list.d/cloudflared.list"
echo "  sudo rm /usr/share/keyrings/cloudflare-main.gpg"
echo
echo "  # Remove NodeSource apt repo:"
echo "  sudo rm /etc/apt/sources.list.d/nodesource.list"
echo
echo "  # Remove leftover npm config (optional):"
echo "  sudo rm -rf /root/.npm"
echo
echo "Your laptop should be back to the same state as before setup-ubuntu.sh."
