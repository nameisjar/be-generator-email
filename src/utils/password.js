// Password hashing helpers.
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function hash(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verify(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

module.exports = { hash, verify };
