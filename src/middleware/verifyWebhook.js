// Verifies HMAC signature on the incoming email webhook from the Cloudflare Worker.
// Rejects requests that are too old (replay protection) and any unsigned/malformed ones.
const crypto = require('crypto');
const env = require('../config/env');
const { sign, safeEqual } = require('../utils/hmac');
const AppError = require('../utils/AppError');

/**
 * Worker signs `${timestamp}.${rawBody}`. We expect:
 *   - header `X-Algo-Signature: <hex>`     (HMAC of `timestamp.body`)
 *   - header `X-Algo-Timestamp: <unix-seconds>`
 */
function verifyWebhook(req, _res, next) {
  const signature = req.header('x-algo-signature');
  const timestamp = req.header('x-algo-timestamp');

  if (!signature || !timestamp) {
    return next(new AppError('Missing webhook signature', 401, 'WEBHOOK_UNAUTHORIZED'));
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return next(new AppError('Invalid webhook timestamp', 401, 'WEBHOOK_UNAUTHORIZED'));
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > env.webhook.maxAgeSeconds) {
    return next(new AppError('Webhook request expired', 401, 'WEBHOOK_EXPIRED'));
  }

  // We need the raw body to recompute the HMAC. express.raw() on the webhook route gives us a Buffer.
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const expected = sign(`${timestamp}.${raw.toString('utf8')}`, env.webhook.secret);

  if (!safeEqual(signature, expected)) {
    return next(new AppError('Invalid webhook signature', 401, 'WEBHOOK_UNAUTHORIZED'));
  }

  // Convert buffer to JSON for downstream handlers.
  try {
    req.body = raw.length > 0 ? JSON.parse(raw.toString('utf8')) : {};
  } catch {
    return next(new AppError('Invalid JSON body in webhook', 400, 'BAD_REQUEST'));
  }

  return next();
}

module.exports = verifyWebhook;

// Expose `sign` so workers can mirror the exact algorithm when generating the header.
module.exports.signWebhook = sign;
module.exports.timestampNow = () => Math.floor(Date.now() / 1000);
module.exports.randomNonce = () => crypto.randomBytes(8).toString('hex');
