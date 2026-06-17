// Heuristics to extract one-time passcodes (OTPs) from email bodies.
// We try several common patterns and return the first match, preferring
// the most specific ones (alphanumeric) over plain 4-8 digit numbers.

const PATTERNS = [
  // Explicit "Your code is 123456" / "verification code: ABC-123"
  /(?:code|otp|pin|kode verifikas[i]?|kode)[^\dA-Z]{0,12}([A-Z0-9]{4,8})/i,
  // Alphanumeric OTP (uppercase, mixed)
  /\b([A-Z0-9]{6})\b/,
  // 4-8 digit numeric code
  /\b(\d{4,8})\b/,
];

const SKIP_KEYWORDS = [
  'invoice',
  'order',
  'transaction',
  'receipt',
  'amount',
  'total',
  'price',
  'balance',
  'account number',
  'no. invoice',
  'no invoice',
  'nomor',
  'tanggal',
  'date',
];

/**
 * Try to extract a likely OTP/code from the email body.
 * @param {string} text
 * @returns {string|null}
 */
function extractCode(text) {
  if (!text || typeof text !== 'string') return null;

  const lower = text.toLowerCase();
  for (const kw of SKIP_KEYWORDS) {
    if (lower.includes(kw)) {
      // Still try, but bias toward short explicit codes if present.
    }
  }

  for (const pattern of PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

module.exports = { extractCode };
