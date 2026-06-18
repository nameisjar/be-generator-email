# Safe SSH deployment to Ubuntu laptop

Step-by-step, **with rollback at every step**. Run via SSH (PuTTY or `ssh` from MINGW64).

## Pre-flight checklist (read first)

- [ ] You can SSH into the Ubuntu laptop
- [ ] The laptop is **not running critical services** (we'll touch PostgreSQL, Node, cloudflared)
- [ ] You have the **project folder** at `D:\Doc\mail\` on Windows
- [ ] You have the **existing Cloudflare tunnel** (from earlier) — we'll keep the URL stable

If something goes wrong at any step, jump to [ROLLBACK](#rollback) at the bottom.

---

## Step 1 — Test SSH connection

**From Windows MINGW64:**
```bash
ssh ubuntu@<IP-LAPTOP>
# Ganti <IP-LAPTOP> dengan IP Ubuntu (mis. 192.168.1.100)
```

If it asks for password, type it. If you get a shell prompt, you're in.

**Useful for PuTTY users:**
- Host: `<IP-LAPTOP>`
- Port: 22
- Connection type: SSH
- Saved session name: `ubuntu-laptop`

## Step 2 — Preflight check (read-only, safe)

**From the Ubuntu machine**, run preflight-check.sh to see what's already there.

### 2a. Copy the script over
**From Windows MINGW64:**
```bash
# Make a deploy folder on the Ubuntu laptop
ssh ubuntu@<IP-LAPTOP> "mkdir -p /tmp/deploy"

# Copy just the preflight script (small)
scp /d/Doc/mail/backend/deploy/preflight-check.sh ubuntu@<IP-LAPTOP>:/tmp/deploy/
```

### 2b. Run the check
**From Windows MINGW64 (or PuTTY):**
```bash
ssh ubuntu@<IP-LAPTOP> "chmod +x /tmp/deploy/preflight-check.sh && bash /tmp/deploy/preflight-check.sh"
```

Look at the output:
- ✅ = good
- ⚠ = warning (might need attention)
- ✗ = blocking issue (fix before continuing)

Common warnings & what to do:
| Warning | Action |
|---|---|
| Port 4000 in use | Something else is on port 4000. Edit systemd file to use port 4001. |
| `mailapp` user already exists | Safe — setup-ubuntu.sh will skip creating it |
| `mail` database already exists | Safe — setup-ubuntu.sh will skip creating it |
| /opt/email-alias-manager exists | Previous install — see [ROLLBACK](#rollback) or just continue, it'll be overwritten |
| deb.nodesource.com not reachable | Internet issue — check firewall/proxy |

If the preflight looks reasonable, **continue**.

## Step 3 — Run setup-ubuntu.sh

### 3a. Copy all deploy scripts
**From Windows MINGW64:**
```bash
scp /d/Doc/mail/backend/deploy/setup-ubuntu.sh \
    /d/Doc/mail/backend/deploy/setup-app.sh \
    /d/Doc/mail/backend/deploy/setup-tunnel.sh \
    /d/Doc/mail/backend/deploy/email-alias-backend.service \
    /d/Doc/mail/backend/deploy/cloudflared-tunnel.service \
    ubuntu@<IP-LAPTOP>:/tmp/deploy/
```

### 3b. Run the setup
**From Windows MINGW64:**
```bash
ssh ubuntu@<IP-LAPTOP> "cd /tmp/deploy && chmod +x *.sh && sudo ./setup-ubuntu.sh"
```

⏱ 5-10 minutes. Watch for:
- Lines starting with `✓` = success
- Lines starting with `↻` = skipped (already installed — fine)
- "DATABASE READY" section = PostgreSQL done
- "UBUNTU SETUP COMPLETE" at the end = done

**If anything errors mid-way, SSH in and run `bash /tmp/deploy/setup-ubuntu.sh` again** — it's idempotent.

### 3c. Verify
**From Windows MINGW64:**
```bash
ssh ubuntu@<IP-LAPTOP> "node -v && psql --version && cloudflared --version && id mailapp && sudo -u postgres psql -tAc \"SELECT datname FROM pg_database WHERE datname='mail'\""
```

Should show:
- `v20.x.x` (Node)
- `psql (PostgreSQL) 14.x` or similar
- `cloudflared version 2024.x.x` or similar
- `uid=...mailapp` (user exists)
- `mail` (database exists)

## Step 4 — Copy the project to Ubuntu

**From Windows MINGW64:**
```bash
# Create target folder
ssh ubuntu@<IP-LAPTOP> "sudo mkdir -p /opt/email-alias-manager && sudo chown \$USER:\$USER /opt/email-alias-manager"

# Sync project (exclude heavy stuff)
rsync -avz --exclude 'node_modules' --exclude '.env' --exclude 'dist' \
  /d/Doc/mail/ ubuntu@<IP-LAPTOP>:/opt/email-alias-manager/
```

⏱ 1-2 minutes. The transfer should be just the source files (no node_modules).

## Step 5 — Run setup-app.sh

**From Windows MINGW64:**
```bash
ssh ubuntu@<IP-LAPTOP> "cd /opt/email-alias-manager/backend && sudo ./deploy/setup-app.sh"
```

⏱ 3-5 minutes. Watch for:
- `npm ci --omit=dev` installing
- "Generating .env" with new WEBHOOK_SECRET
- `prisma generate` and `prisma migrate deploy` success
- "Installing systemd service"
- "Smoke test" with `{"ok":true,...}`

**⚠️ Save the WEBHOOK_SECRET** that gets printed. You'll need it for the Worker.

### Verify
**From Windows MINGW64:**
```bash
ssh ubuntu@<IP-LAPTOP> "sudo systemctl status email-alias-backend --no-pager | head -15"
```

Should show `active (running)`. If it's `failed`, run:
```bash
ssh ubuntu@<IP-LAPTOP> "sudo journalctl -u email-alias-backend -n 30 --no-pager"
```

And look at the last error. Common ones:
- DB password wrong → check `/opt/email-alias-manager/backend/.env` vs `/root/.mailapp_db_password`
- Port 4000 in use → see [TROUBLESHOOTING](#troubleshooting)

## Step 6 — Run setup-tunnel.sh

**From Windows MINGW64:**
```bash
ssh ubuntu@<IP-LAPTOP> "cd /opt/email-alias-manager/backend && sudo ./deploy/setup-tunnel.sh"
```

⏱ 2-3 minutes. A browser window will open on the Ubuntu laptop for `cloudflared tunnel login`. **If you're SSHing from Windows, this won't work directly** — see Option B below.

**Option A: If Ubuntu laptop has a desktop browser**
Just authorize in the browser window.

**Option B: If Ubuntu is headless (no display)**
You'll see a URL like `https://...trycloudflare.com/...`. Copy it, open in **Windows browser**, authorize, then go back to SSH — the script will continue.

**Option C: Use existing browser session**
If you already authorized `cloudflared` before (e.g., for the previous `trycloudflare.com` setup), you can re-use that session:
```bash
ssh ubuntu@<IP-LAPTOP> "ls -la /root/.cloudflared/cert.pem"
```
If the file exists, you can skip `cloudflared tunnel login` — the script will detect this.

### Verify
**From Windows MINGW64:**
```bash
ssh ubuntu@<IP-LAPTOP> "sudo systemctl status cloudflared-tunnel --no-pager | head -10"
```

Should show `active (running)`. Then from **anywhere**:
```bash
curl -i https://email.algonova.my.id/api/health
```

Should respond `200` with `{"ok":true,...}`. If not, wait 1-2 minutes for DNS propagation, then retry.

## Step 7 — Update Worker (back on Windows)

Edit [worker/wrangler.toml](../../worker/wrangler.toml):
```toml
[vars]
BACKEND_URL = "https://email.algonova.my.id"
WEBHOOK_SECRET = "<WEBHOOK_SECRET dari step 5>"
```

Redeploy:
```bash
cd /d/Doc/mail/worker
npx wrangler deploy
```

## Step 8 — End-to-end test

1. Send email from Gmail to `<anything>@algonova.my.id`
2. Check Worker log: `npx wrangler tail` — should show `backend responded 200`
3. Check Ubuntu backend log:
   ```bash
   ssh ubuntu@<IP-LAPTOP> "sudo journalctl -u email-alias-backend -f"
   ```
   Should show `POST /api/webhook/incoming-email 200`
4. Login ke web di `https://app.algonova.my.id` (Vercel) atau `http://localhost:5173` (dev) → buka inbox alias → email muncul

---

## Tearing it all down (rollback)

If anything goes wrong and you want to start fresh:

**From Windows MINGW64:**
```bash
# Copy rollback script
scp /d/Doc/mail/backend/deploy/rollback.sh ubuntu@<IP-LAPTOP>:/tmp/deploy/

# Run it (asks for confirmation)
ssh ubuntu@<IP-LAPTOP> "chmod +x /tmp/deploy/rollback.sh && sudo /tmp/deploy/rollback.sh"
```

It will:
1. Stop and disable both systemd services
2. Delete the systemd service files
3. Delete the Cloudflare tunnel
4. Delete `/opt/email-alias-manager/`
5. Delete log directories
6. Delete PostgreSQL role + database
7. Delete `mailapp` user
8. Delete `/root/.mailapp_db_password`

Your laptop is back to the same state as before. The DNS records in Cloudflare (api.algonova.my.id) are kept — delete manually from the dashboard if you want.

---

## TROUBLESHOOTING

### "Address already in use" on port 4000
```bash
ssh ubuntu@<IP-LAPTOP> "sudo lsof -i:4000"
# See what process is on 4000. Either stop it, or change the port:
ssh ubuntu@<IP-LAPTOP> "sudo sed -i 's/^PORT=.*/PORT=4001/' /opt/email-alias-manager/backend/.env && sudo systemctl restart email-alias-backend"
# (then update the tunnel config too)
```

### Backend service failed to start
```bash
ssh ubuntu@<IP-LAPTOP> "sudo journalctl -u email-alias-backend -n 50 --no-pager"
```
Look for the error. Most common:
- `Database connection error` → check `DATABASE_URL` in `.env`
- `Port 4000 in use` → see above
- `JWT_ACCESS_SECRET` not set → re-run setup-app.sh

### Tunnel not connecting
```bash
ssh ubuntu@<IP-LAPTOP> "sudo journalctl -u cloudflared-tunnel -n 30 --no-pager"
```
- `failed to connect to Cloudflare edge` → check internet
- `tunnel not found` → re-run `cloudflared tunnel create email-alias-backend`

### Frontend can't reach backend
- Check Vercel env var: `VITE_BACKEND_URL = https://email.algonova.my.id`
- Check backend `FRONTEND_URL` matches Vercel URL exactly
- CORS error in browser console → `FRONTEND_URL` is wrong
- 401 on refresh → cookie `SameSite` issue → set `COOKIE_SAMESITE=lax` (same parent domain) or `none` (cross-domain)
