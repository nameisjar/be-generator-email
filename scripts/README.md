# Local testing helper scripts

## `smoke-test.js`

End-to-end test of the backend, database, OTP extraction, and read API
without involving Cloudflare Email Routing or the Worker.

```bash
cd backend
node scripts/smoke-test.js
```

See [LOCAL_TESTING.md](LOCAL_TESTING.md) for the full guide and
troubleshooting table.
