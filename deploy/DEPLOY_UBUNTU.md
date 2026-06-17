# Deploy to your own Ubuntu server (self-host)

This guide walks you through running the backend on a used Ubuntu laptop
that you own. It will be reachable from the internet via a **stable
Cloudflare Tunnel** — no port forwarding, no dynamic DNS, no exposed
ports on your home router.

## What you need

- An Ubuntu 22.04 (or 20.04) laptop with SSH access
- A user account with `sudo` privileges
- The `algonova.my.id` domain already on Cloudflare (it already is — you
  have Email Routing on it)
- Your Windows laptop with the project at `D:\Doc\mail`

The Ubuntu laptop does **not** need a static IP or open ports. The
Cloudflare Tunnel does the network plumbing for you.

## Architecture

```
Internet
   │
   ▼
Cloudflare edge (algonova.my.id)
   │
   ├──► Email Routing ──► Worker `algomail-receiver`
   │                              │
   │                              │ POST /api/webhook/incoming-email
   │                              ▼
   └──► Tunnel (email.algonova.my.id)
                                  │
                                  ▼
                  Ubuntu laptop (your "server")
                  ├── cloudflared (tunnel client)
                  ├── Express backend (port 4000)
                  └── PostgreSQL (database `mail`)
```

The same tunnel can also expose the Vue frontend later if you decide not
to use Vercel (e.g. `app.algonova.my.id` → port 5173).

---

## Step 1 — One-time Ubuntu setup (run on the Ubuntu laptop)

SSH in:

```bash
ssh you@ubuntu-laptop
```

Create the deploy folder and copy the scripts over (see Step 2 below for
how to get the files there). Then:

```bash
cd /opt/email-alias-manager/backend/deploy
chmod +x setup-ubuntu.sh setup-app.sh setup-tunnel.sh
sudo ./setup-ubuntu.sh
```

This installs:
- Node.js 20 LTS
- PostgreSQL (creates a `mailapp` role + `mail` database — **saves the
  generated password to `/root/.mailapp_db_password`**)
- `cloudflared`
- A `mailapp` system user
- UFW firewall (SSH only — the tunnel doesn't need open ports)

> ⏱ Takes about 5–10 minutes.

## Step 2 — Copy the project to the Ubuntu laptop

From your **Windows MINGW64 terminal**, in the project root:

```bash
# Replace 'you@ubuntu-laptop' with your actual user/host
rsync -avz --exclude 'node_modules' --exclude '.env' \
  /d/Doc/mail/ you@ubuntu-laptop:/opt/email-alias-manager/
```

If you don't have `rsync` in MINGW64, use `scp`:

```bash
scp -r /d/Doc/mail/ you@ubuntu-laptop:/opt/email-alias-manager/
```

Then SSH in and clean up if needed:

```bash
ssh you@ubuntu-laptop
sudo chown -R $USER:$USER /opt/email-alias-manager
cd /opt/email-alias-manager
```

## Step 3 — Install the app + start the backend service

```bash
cd /opt/email-alias-manager/backend/deploy
sudo ./setup-app.sh
```

This will:
1. `npm ci` (production deps)
2. Generate `.env` with strong random secrets
3. Run Prisma migrations
4. Install and start the systemd service `email-alias-backend`

Test it locally on the server:

```bash
curl http://localhost:4000/api/health
# {"ok":true,"service":"email-alias-manager-backend"}
```

Watch the logs:

```bash
sudo journalctl -u email-alias-backend -f
```

## Step 4 — Create the Cloudflare Tunnel

```bash
cd /opt/email-alias-manager/backend/deploy
sudo ./setup-tunnel.sh
```

This will:
1. Open a browser — log in to Cloudflare and authorize
2. Create a named tunnel `email-alias-backend`
3. Add a DNS record `email.algonova.my.id` → tunnel
4. Install and start the systemd service `cloudflared-tunnel`

After it finishes, test from anywhere:

```bash
curl -i https://email.algonova.my.id/api/health
# {"ok":true,"service":"email-alias-manager-backend"}
```

## Step 5 — Update the Worker

On your **Windows laptop**, edit `worker/wrangler.toml`:

```toml
[vars]
BACKEND_URL = "https://email.algonova.my.id"
WEBHOOK_SECRET = "<paste the WEBHOOK_SECRET from /opt/email-alias-manager/backend/.env>"
```

Then redeploy:

```bash
cd worker
npx wrangler deploy
```

## Step 6 — Test end-to-end

1. Send an email from your personal Gmail to `<anything>@algonova.my.id`
2. In **Cloudflare Dashboard → Email → Email Routing → Activity Log**:
   status should be **"Handled"**
3. In your **Worker logs** (`npx wrangler tail`):
   you should see `backend responded 200`
4. **In the web app** at `http://localhost:5173` (frontend dev server):
   open the alias you sent to — the email should appear in the inbox
5. **In the Ubuntu server logs**:
   `sudo journalctl -u email-alias-backend -f` should show a POST to
   `/api/webhook/incoming-email`

---

## Day-to-day operations

| Task | Command |
|---|---|
| Check backend status | `sudo systemctl status email-alias-backend` |
| Restart backend | `sudo systemctl restart email-alias-backend` |
| Backend logs (live) | `sudo journalctl -u email-alias-backend -f` |
| Check tunnel status | `sudo systemctl status cloudflared-tunnel` |
| Restart tunnel | `sudo systemctl restart cloudflared-tunnel` |
| Tunnel logs (live) | `sudo journalctl -u cloudflared-tunnel -f` |
| Open Prisma Studio | `cd /opt/email-alias-manager/backend && sudo -u mailapp -E npx prisma studio` |
| Update app code | `rsync` new files, then `sudo systemctl restart email-alias-backend` |

## Updating the app

After changing code on your Windows machine:

```bash
# From Windows MINGW64
rsync -avz --exclude 'node_modules' --exclude '.env' \
  /d/Doc/mail/ you@ubuntu-laptop:/opt/email-alias-manager/

# Then on the Ubuntu server
ssh you@ubuntu-laptop
cd /opt/email-alias-manager/backend
sudo npm ci --omit=dev
npx prisma migrate deploy
sudo systemctl restart email-alias-backend
```

## Auto-start on boot

Both systemd services are enabled by the setup scripts, so the backend
and tunnel start automatically when the laptop boots. No cron, no
screen, no manual restarts.

## Exposing the frontend (later)

To also serve the Vue SPA through the same tunnel, add another ingress
rule to `/etc/cloudflared/config.yml`:

```yaml
ingress:
  - hostname: email.algonova.my.id
    service: http://localhost:4000
  - hostname: app.algonova.my.id
    service: http://localhost:5173
  - service: http_status:404
```

Then add the DNS route:

```bash
sudo cloudflared tunnel route dns email-alias-backend app.algonova.my.id
sudo systemctl restart cloudflared-tunnel
```

Build the frontend once with `npm run build` in `frontend/`, then serve
the static `dist/` with `npx serve` or nginx.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `curl https://email.algonova.my.id` times out | Tunnel down | `sudo systemctl restart cloudflared-tunnel` |
| `404 Not Found` from tunnel | DNS not propagated | wait 1-2 min, then `dig email.algonova.my.id` |
| Backend health OK but Worker still 530/1016 | Worker still pointing at old URL | update `wrangler.toml` + redeploy |
| `prisma migrate deploy` fails | DB password wrong | check `/root/.mailapp_db_password`, update `.env` |
| `EADDRINUSE :4000` on restart | Zombie process | `sudo lsof -i:4000` then `kill <pid>` |
