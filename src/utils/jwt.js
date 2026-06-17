// JWT helpers for issuing and verifying access/refresh tokens.
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccess(payload) {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
    issuer: 'email-alias-manager',
  });
}

function signRefresh(payload) {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
    issuer: 'email-alias-manager',
  });
}

function verifyAccess(token) {
  return jwt.verify(token, env.jwt.accessSecret, { issuer: 'email-alias-manager' });
}

function verifyRefresh(token) {
  return jwt.verify(token, env.jwt.refreshSecret, { issuer: 'email-alias-manager' });
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
