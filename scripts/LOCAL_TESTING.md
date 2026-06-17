# Local testing — without Cloudflare in the loop

The `smoke-test.js` script is the fastest way to confirm the backend, the
database, OTP extraction, and the read API all work — without needing
Cloudflare Email Routing or the Worker to be involved.

## What it does

1. Calls `/api/health` — confirms the backend is up.
2. Registers a fresh test user via `/api/auth/register`.
3. Creates a fresh test alias (e.g. `smoke1a2b3c@algonova.my.id`).
4. **Signs and POSTs 3 fake emails to the webhook** with the exact same
   HMAC-SHA256 algorithm the Worker uses, including realistic-looking
   Netflix / Shopee / GitHub content (so you can verify OTP extraction).
5. Lists the inbox via `/api/aliases/:id/emails`.
6. Marks the first email as read.

The script reads `WEBHOOK_SECRET` and `MAIL_DOMAIN` from your
`backend/.env`, so the signatures it generates are byte-for-byte
identical to what the Worker would send.

## How to run

```bash
# Terminal 1: backend must be running
cd backend
npm run dev

# Terminal 2: run the test
cd backend
node scripts/smoke-test.js
```

You should see something like:

```
=== Email Alias Manager — Local Smoke Test ===

Backend:  http://localhost:4000
Domain:   algonova.my.id
Secret:   ad15f2f6…413d1f8

[0] Health check
  ✓ backend up: {"ok":true,"service":"email-alias-manager-backend"}

[1] Register user tester-1718000000@example.com
  ✓ user created (id=clx…)

[2] Create alias smoke1a2b3c@algonova.my.id
  ✓ alias created: smoke1a2b3c@algonova.my.id

[3] Webhook: "Your Netflix verification code" …   ✓ stored (id=clx…)
[3] Webhook: "Kode Verifikasi Shopee" …            ✓ stored (id=clx…)
[3] Webhook: "Welcome to GitHub" …                 ✓ stored (id=clx…)

[4] List inbox
  ✓ 3 of 3 emails in inbox
     - [NEW] "Your Netflix verification code" — noreply@netflix.com  [OTP 847291]
     - [NEW] "Kode Verifikasi Shopee" — noreply@shopee.co.id        [OTP 593821]
     - [NEW] "Welcome to GitHub" — newsletter@github.com

[5] Mark first email as read
  ✓ email clx… marked as read

=== ✅ SMOKE TEST PASSED ===
```

## How to verify in the web UI

The script prints a test user and direct URL at the end. Two options:

1. **Open the printed link** — it'll go straight to the test inbox.
2. **Log in manually** at `http://localhost:5173/login` with the printed
   email + `TestPass123!`.

You should see 3 emails with the OTPs highlighted in amber.

## What if it fails?

| Symptom | Likely cause | Fix |
|---|---|---|
| `backend not reachable` | Backend not running, or wrong `BACKEND_URL` | `cd backend && npm run dev` |
| `register failed: EMAIL_TAKEN` | Test user already exists from a prior run | Use a different email prefix, or just log in |
| `webhook returned 401: WEBHOOK_UNAUTHORIZED` | `WEBHOOK_SECRET` mismatch | Confirm backend `.env` `WEBHOOK_SECRET` matches the one in `worker/wrangler.toml` |
| `webhook returned 401: WEBHOOK_EXPIRED` | Clock skew between test machine and backend | Both run on the same box, so this is rare — let me know |
| `webhook returned 400: BAD_REQUEST` (missing toAddress) | Local .env missing `MAIL_DOMAIN` | Add `MAIL_DOMAIN=algonova.my.id` to backend `.env` |
| `prisma` errors like "table does not exist" | Migrations not run | `cd backend && npx prisma migrate dev` |
| Empty inbox after the script says 3 stored | Frontend cache / wrong alias | Hard refresh the page (Ctrl+Shift+R) and confirm the URL ends in `/aliases/<id>` |

## When this passes, what's left to test

If `smoke-test.js` passes, you have proven that:

- ✅ Postgres + Prisma
- ✅ HMAC verification
- ✅ OTP extraction
- ✅ Read API
- ✅ Auth + alias generation

are all working.

The only remaining piece is the **Worker → backend** hop, which is just
network plumbing. Once you have a stable URL for the backend (cloudflared
with a named tunnel, or your Ubuntu box with a stable Cloudflare Tunnel
URL), the Worker will deliver the same payload the script generated
manually.
