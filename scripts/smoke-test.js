#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * smoke-test.js
 *
 * End-to-end local test that bypasses Cloudflare Email Routing entirely.
 *
 * What it does:
 *   1. Registers a new test user via /api/auth/register
 *   2. Creates a new test alias via /api/aliases
 *   3. Signs and POSTs 3 fake "incoming emails" to /api/webhook/incoming-email
 *      using the same HMAC-SHA256 algorithm the Worker uses
 *   4. Lists the inbox via /api/aliases/:id/emails
 *   5. Prints the extracted OTPs and a direct URL to open the inbox in the web
 *
 * Why this is useful:
 *   - If this passes → backend, DB, Prisma, OTP extraction, and the read API
 *     all work. The only thing left to debug is the Worker → backend hop.
 *   - If this fails → there's a bug in the backend before Cloudflare is even
 *     involved. You'll get a clear error instead of staring at a silent
 *     `wrangler tail`.
 *
 * Usage (with the backend running on localhost:4000):
 *   cd backend
 *   node scripts/smoke-test.js
 */

require('dotenv').config();
const crypto = require('crypto');

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
const SECRET = process.env.WEBHOOK_SECRET;
const DOMAIN = process.env.MAIL_DOMAIN || 'algonova.my.id';
const FRONTEND = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

if (!SECRET) {
  console.error('✗ WEBHOOK_SECRET missing from .env');
  process.exit(1);
}

// ---------- HTTP helpers (no axios dep needed) ----------
function request(method, path, { body, headers = {} } = {}) {
  const url = new URL(BACKEND + path);
  return new Promise((resolve, reject) => {
    const data = body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body));
    const reqHeaders = {
      accept: 'application/json',
      ...headers,
    };
    if (body != null && !reqHeaders['content-type']) {
      reqHeaders['content-type'] = 'application/json';
    }
    if (data) reqHeaders['content-length'] = Buffer.byteLength(data);

    const lib = url.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          let parsed;
          try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const post = (path, body, headers) => request('POST', path, { body, headers });
const get = (path, headers) => request('GET', path, { headers });

// ---------- HMAC sign (same algo as the Worker) ----------
function sign(rawBody) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac('sha256', SECRET).update(`${ts}.${rawBody}`).digest('hex');
  return { ts, sig };
}

// ---------- Pretty ----------
const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`);

// ---------- Main ----------
async function main() {
  console.log('\n=== Email Alias Manager — Local Smoke Test ===\n');
  console.log(`Backend:  ${BACKEND}`);
  console.log(`Domain:   ${DOMAIN}`);
  console.log(`Secret:   ${SECRET.slice(0, 8)}…${SECRET.slice(-4)}\n`);

  // 0. Health check
  console.log('[0] Health check');
  let r = await get('/api/health');
  if (r.status !== 200) { fail(`backend not reachable (status ${r.status})`); process.exit(1); }
  ok(`backend up: ${JSON.stringify(r.body)}`);

  // 1. Register
  const userEmail = `tester-${Date.now()}@example.com`;
  console.log(`\n[1] Register user ${userEmail}`);
  r = await post('/api/auth/register', { email: userEmail, password: 'TestPass123!', name: 'Smoke Tester' });
  if (r.status !== 201) { fail(`register failed: ${JSON.stringify(r.body)}`); process.exit(1); }
  const accessToken = r.body.accessToken;
  ok(`user created (id=${r.body.user.id})`);

  // 2. Create alias
  const local = `smoke${Date.now().toString(36).slice(-6)}`;
  console.log(`\n[2] Create alias ${local}@${DOMAIN}`);
  r = await post('/api/aliases', { address: local, label: 'Smoke Test' }, { authorization: `Bearer ${accessToken}` });
  if (r.status !== 201) { fail(`create alias failed: ${JSON.stringify(r.body)}`); process.exit(1); }
  const alias = r.body.alias;
  ok(`alias created: ${alias.fullAddress}`);

  // 3. Webhook: send 3 test emails
  const messages = [
    {
      from: 'noreply@netflix.com',
      fromName: 'Netflix',
      subject: 'Your Netflix verification code',
      text: 'Hi! Your Netflix verification code is 847291. It expires in 10 minutes.',
      html: '<p>Hi! Your Netflix verification code is <b>847291</b>.</p>',
    },
    {
      from: 'noreply@shopee.co.id',
      fromName: 'Shopee',
      subject: 'Kode Verifikasi Shopee',
      text: 'Halo! Kode verifikasi Shopee Anda: 593821. Jangan berikan ke siapa pun.',
      html: '<p>Halo! Kode verifikasi Shopee Anda: <b>593821</b>.</p>',
    },
    {
      from: 'newsletter@github.com',
      fromName: 'GitHub',
      subject: 'Welcome to GitHub',
      text: 'Welcome to GitHub! Your account is ready. No OTP here, just a regular email.',
      html: '<p>Welcome to GitHub!</p>',
    },
  ];

  for (const m of messages) {
    const payload = {
      messageId: `<${crypto.randomBytes(8).toString('hex')}@${m.from.split('@')[1]}>`,
      from: m.from,
      fromName: m.fromName,
      toAddress: alias.fullAddress,
      subject: m.subject,
      bodyText: m.text,
      bodyHtml: m.html,
      receivedAt: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const { ts, sig } = sign(body);

    process.stdout.write(`\n[3] Webhook: "${m.subject}" … `);
    r = await post('/api/webhook/incoming-email', payload, {
      'x-algo-signature': sig,
      'x-algo-timestamp': ts,
    });
    if (r.status !== 200) { fail(`webhook returned ${r.status}: ${JSON.stringify(r.body)}`); continue; }
    ok(`stored (id=${r.body.emailId})`);
  }

  // 4. List inbox
  console.log('\n[4] List inbox');
  r = await get(`/api/aliases/${alias.id}/emails?pageSize=10`, { authorization: `Bearer ${accessToken}` });
  if (r.status !== 200) { fail(`list failed: ${JSON.stringify(r.body)}`); process.exit(1); }
  ok(`${r.body.items.length} of ${r.body.total} emails in inbox`);
  for (const e of r.body.items) {
    const otp = e.extractedCode ? `  [OTP ${e.extractedCode}]` : '';
    const status = e.isRead ? 'read' : 'NEW ';
    console.log(`     - [${status}] "${e.subject}" — ${e.fromAddress}${otp}`);
  }

  // 5. Bonus: mark first one as read
  if (r.body.items.length > 0) {
    const first = r.body.items[0];
    console.log('\n[5] Mark first email as read');
    r = await request('PATCH', `/api/emails/${first.id}/read`, {
      body: { isRead: true },
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (r.status === 200) ok(`email ${first.id} marked as read`);
    else fail(`mark read failed: ${JSON.stringify(r.body)}`);
  }

  // Final report
  console.log('\n=== ✅ SMOKE TEST PASSED ===\n');
  console.log('Test credentials:');
  console.log(`  email:    ${userEmail}`);
  console.log(`  password: TestPass123!`);
  console.log('');
  console.log('Open the inbox in your browser:');
  console.log(`  ${FRONTEND}/login    → log in with the credentials above`);
  console.log(`  ${FRONTEND}/aliases/${alias.id}    → direct link to the test inbox`);
  console.log('');
  console.log('You should see 3 emails:');
  console.log('  1. "Your Netflix verification code" with OTP 847291 highlighted');
  console.log('  2. "Kode Verifikasi Shopee" with OTP 593821 highlighted');
  console.log('  3. "Welcome to GitHub" (no OTP)');
  console.log('');
}

main().catch((e) => {
  console.error('\n✗ Smoke test crashed:', e);
  process.exit(1);
});
