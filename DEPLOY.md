# Email Alias Manager — Backend

Express + Prisma API for managing email aliases on `algonova.my.id` and storing
emails forwarded by the Cloudflare Worker.

## Local development

```bash
cp .env.example .env
# edit .env: DATABASE_URL, JWT secrets, WEBHOOK_SECRET
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Runs on http://localhost:4000.

## Deploy to Railway (recommended for the email webhook)

`cloudflared` tunnels are great for dev but unstable for production (the
URL changes every restart, and the tunnel can drop). The Cloudflare Worker
needs a stable, always-on URL to forward emails to.

1. Install the Railway CLI and login:
   ```bash
   npm install -g @railway/cli
   railway login
   ```
2. From this folder:
   ```bash
   railway init
   railway up
   ```
3. Add a managed Postgres database in the Railway dashboard and copy its
   `DATABASE_URL` into the service's environment variables.
4. Set the other env vars in the Railway dashboard:
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — long random hex
   - `WEBHOOK_SECRET` — must match the Worker's secret
   - `MAIL_DOMAIN=algonova.my.id`
   - `FRONTEND_URL=https://your-spa.example.com` (or your Vercel/Netlify URL)
   - `NODE_ENV=production`
5. Run the Prisma migration against the Railway database:
   ```bash
   railway run npx prisma migrate deploy
   ```
6. Railway will give you a public URL like
   `https://email-alias-manager-backend.up.railway.app`.

## Update the Worker to use the new URL

```toml
# worker/wrangler.toml
[vars]
BACKEND_URL = "https://email-alias-manager-backend.up.railway.app"
```

```bash
cd ../worker
npx wrangler deploy
```

From now on every email Cloudflare receives will be POSTed to your
production backend, 24/7 — no tunnel required.

## Self-host on your own Ubuntu server

If you have a spare laptop or VPS, see
[deploy/DEPLOY_UBUNTU.md](deploy/DEPLOY_UBUNTU.md). It sets up Node 20,
PostgreSQL, the backend as a systemd service, and a stable Cloudflare
Tunnel — so the Worker has a permanent public URL that doesn't depend
on your laptop being awake.

## API reference

See `README.md` (root) for the full endpoint table.
