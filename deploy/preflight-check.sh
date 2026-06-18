#!/usr/bin/env bash
# preflight-check.sh — Read-only inspection. Doesn't change anything.
# Run this BEFORE setup-ubuntu.sh to see what's already on the machine.
#
# Usage: bash preflight-check.sh

set -uo pipefail

C='\033[1;36m'   # cyan
G='\033[1;32m'   # green
Y='\033[1;33m'   # yellow
R='\033[1;31m'   # red
N='\033[0m'      # reset

ok()    { printf "${G}✓${N} %s\n" "$1"; }
warn()  { printf "${Y}!${N} %s\n" "$1"; }
fail()  { printf "${R}✗${N} %s\n" "$1"; }
head()  { printf "\n${C}── %s ──${N}\n" "$1"; }

echo
printf "${C}Email Alias Manager — preflight check${N}\n"
printf "Running on: %s (%s)\n" "$(uname -srm)" "$(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | head -1)"
echo

# 1. User permissions
head "User"
if [[ $EUID -eq 0 ]]; then
  warn "Running as root. Setup scripts need sudo/root, so this is fine."
else
  ok "Running as $(whoami). You'll be prompted for sudo password when needed."
fi

# 2. Existing services
head "Existing services"
for svc in postgresql cloudflared email-alias-backend cloudflared-tunnel; do
  if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
    state=$(systemctl is-active "${svc}" 2>/dev/null || echo "unknown")
    if [[ "$state" == "active" ]]; then
      warn "${svc} is INSTALLED and ACTIVE"
    else
      ok "${svc} is installed but ${state}"
    fi
  else
    ok "${svc} not installed"
  fi
done

# 3. Installed binaries
head "Installed binaries"
for bin in node npm psql cloudflared git curl; do
  if command -v "$bin" >/dev/null 2>&1; then
    ver=$("$bin" --version 2>&1 | head -1)
    ok "$bin → $ver"
  else
    warn "$bin not installed"
  fi
done

# 4. Listening ports we care about
head "Listening ports"
for port in 4000 5432; do
  if ss -tln 2>/dev/null | grep -q ":${port} "; then
    pid=$(ss -tlnp 2>/dev/null | grep ":${port} " | grep -oP 'pid=\K[0-9]+' | head -1)
    if [[ "$port" == "4000" ]]; then
      warn "Port ${port} in use (pid=${pid:-?}) — something else is on 4000, will conflict"
    elif [[ "$port" == "5432" ]]; then
      ok "Port ${port} in use (pid=${pid:-?}) — probably local PostgreSQL, fine"
    fi
  else
    ok "Port ${port} free"
  fi
done

# 5. Disk / memory
head "Resources"
df_avail=$(df -BG /opt 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'G')
mem_total=$(free -g 2>/dev/null | awk '/^Mem:/ {print $2}')
if [[ "${df_avail:-0}" -lt 2 ]]; then
  warn "Only ${df_avail}G free on /. Need ~2G."
else
  ok "${df_avail}G free on /"
fi
if [[ "${mem_total:-0}" -lt 1 ]]; then
  warn "Only ${mem_total}G RAM. Postgres + Node need ~1G minimum."
else
  ok "${mem_total}G RAM"
fi

# 6. Existing mailapp / mail database
head "Existing app state"
if id mailapp >/dev/null 2>&1; then
  warn "User 'mailapp' already exists"
else
  ok "User 'mailapp' does not exist yet"
fi

if command -v psql >/dev/null 2>&1; then
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='mail'" 2>/dev/null | grep -q 1; then
    warn "Database 'mail' already exists"
    count=$(sudo -u postgres psql -d mail -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "?")
    ok "  → $count tables in 'mail' database"
  else
    ok "Database 'mail' does not exist yet"
  fi
fi

if [[ -d /opt/email-alias-manager ]]; then
  warn "/opt/email-alias-manager already exists:"
  ls -la /opt/email-alias-manager 2>/dev/null | head -10
else
  ok "/opt/email-alias-manager does not exist"
fi

# 7. Connectivity
head "Connectivity"
if curl -s -m 5 -o /dev/null -w "%{http_code}" https://deb.nodesource.com/ >/dev/null 2>&1; then
  ok "deb.nodesource.com reachable"
else
  warn "deb.nodesource.com NOT reachable — Node.js install will fail"
fi
if curl -s -m 5 -o /dev/null -w "%{http_code}" https://pkg.cloudflare.com/ >/dev/null 2>&1; then
  ok "pkg.cloudflare.com reachable"
else
  warn "pkg.cloudflare.com NOT reachable — cloudflared install will fail"
fi

# 8. Final summary
head "Summary"
echo "If everything above shows ✓ or 'fine', you can safely run setup-ubuntu.sh."
echo "If you see ✗ on connectivity, fix your network first."
echo "If 'mail' DB or 'mailapp' user exists, setup-ubuntu.sh will skip creating them."
