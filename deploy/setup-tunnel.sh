#!/usr/bin/env bash
# setup-tunnel.sh — Create a stable Cloudflare named tunnel that exposes the
# backend to the Worker (and the frontend, once you deploy it).
#
# This gives you a URL like https://email.algonova.my.id that points to the
# backend running on localhost:4000 on this server. The URL is stable across
# restarts and works from behind NAT.
#
# Usage:
#   sudo ./setup-tunnel.sh
#
# Prerequisites:
#   - The algonova.my.id zone must be on Cloudflare
#   - You must be able to run `cloudflared tunnel login` in a browser

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[setup-tunnel] Please run as root: sudo ./setup-tunnel.sh"
  exit 1
fi

TUNNEL_NAME=email-alias-backend
HOSTNAME=email.algonova.my.id

echo "==> Logging in to Cloudflare"
echo "    A browser window will open. Authorize the connection."
cloudflared tunnel login

echo "==> Creating tunnel: ${TUNNEL_NAME}"
if ! cloudflared tunnel list | grep -q "${TUNNEL_NAME}"; then
  cloudflared tunnel create "${TUNNEL_NAME}"
fi

TUNNEL_ID=$(cloudflared tunnel list | awk -v t="${TUNNEL_NAME}" '$2==t {print $1}' | head -n1)
echo "    Tunnel ID: ${TUNNEL_ID}"

CRED_FILE=/root/.cloudflared/${TUNNEL_ID}.json
if [[ ! -f "$CRED_FILE" ]]; then
  echo "[setup-tunnel] Credential file not found at $CRED_FILE"
  exit 1
fi

echo "==> Writing tunnel config"
mkdir -p /etc/cloudflared
cat > /etc/cloudflared/config.yml <<YML
tunnel: ${TUNNEL_ID}
credentials-file: ${CRED_FILE}

ingress:
  - hostname: ${HOSTNAME}
    service: http://localhost:4000
  - service: http_status:404
YML

echo "==> Creating DNS record: ${HOSTNAME} -> tunnel"
cloudflared tunnel route dns "${TUNNEL_NAME}" "${HOSTNAME}"

echo "==> Installing systemd service"
cp /opt/email-alias-manager/backend/deploy/cloudflared-tunnel.service /etc/systemd/system/cloudflared-tunnel.service
systemctl daemon-reload
systemctl enable cloudflared-tunnel
systemctl restart cloudflared-tunnel

sleep 3
systemctl status cloudflared-tunnel --no-pager || true

echo
echo "==============================================================="
echo "  TUNNEL RUNNING"
echo "==============================================================="
echo "  Backend URL:  https://${HOSTNAME}"
echo
echo "  Test it:"
echo "    curl -i https://${HOSTNAME}/api/health"
echo
echo "  Logs:  sudo journalctl -u cloudflared-tunnel -f"
echo
echo "  Now update the Worker:"
echo "    1. Open worker/wrangler.toml"
echo "    2. Set [vars] BACKEND_URL = \"https://${HOSTNAME}\""
echo "    3. cd worker && npx wrangler deploy"
echo
echo "  Later, to also expose the frontend (Vercel alternative):"
echo "    Add this ingress rule to /etc/cloudflared/config.yml:"
echo "      - hostname: app.algonova.my.id"
echo "        service: http://localhost:5173    # or http://localhost:8080 if served by nginx"
echo "    Then: sudo cloudflared tunnel route dns ${TUNNEL_NAME} app.algonova.my.id"
echo "    Then: sudo systemctl restart cloudflared-tunnel"
echo "==============================================================="
