// Alias local-part helpers. Keep the rules consistent on both backend and Worker.

const ALIAS_REGEX = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

function isValidAliasLocalPart(value) {
  return typeof value === 'string' && ALIAS_REGEX.test(value);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function randomAliasLocalPart(prefix = '') {
  // 12 random hex chars (48 bits of entropy) — collisions handled by DB unique index.
  const rand = require('crypto').randomBytes(6).toString('hex');
  return prefix ? `${prefix}-${rand}` : rand;
}

module.exports = { isValidAliasLocalPart, normalize, randomAliasLocalPart, ALIAS_REGEX };
