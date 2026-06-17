// Crypto helper for verifying HMAC signatures on the email webhook.
const crypto = require('crypto');

/**
 * Compute HMAC-SHA256 of a raw body using the shared secret.
 * @param {string|Buffer} body
 * @param {string} secret
 * @returns {string} hex digest
 */
function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Constant-time comparison of two hex digests.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { sign, safeEqual };
