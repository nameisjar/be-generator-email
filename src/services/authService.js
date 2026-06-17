// Auth-related business logic: register, login, refresh, logout.
const crypto = require('crypto');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const password = require('../utils/password');
const jwtUtil = require('../utils/jwt');
const env = require('../config/env');

const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14d

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function expiresAtFromNow() {
  return new Date(Date.now() + REFRESH_TTL_MS);
}

async function register({ email, password: plain, name }) {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
  }

  const passwordHash = await password.hash(plain);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      provider: 'local',
    },
  });

  return issueTokensForUser(user);
}

async function login({ email, password: plain }) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  const ok = await password.verify(plain, user.passwordHash);
  if (!ok) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  return issueTokensForUser(user);
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new AppError('Missing refresh token', 401, 'UNAUTHORIZED');
  }
  let payload;
  try {
    payload = jwtUtil.verifyRefresh(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401, 'UNAUTHORIZED');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!stored || stored.revoked || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
    throw new AppError('Invalid refresh token', 401, 'UNAUTHORIZED');
  }

  // Rotate: revoke the used token, issue a fresh pair.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  return issueTokensForUser(stored.user);
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken
    .update({ where: { tokenHash }, data: { revoked: true } })
    .catch(() => null);
}

async function issueTokensForUser(user) {
  const accessToken = jwtUtil.signAccess({ sub: user.id, email: user.email });
  const refreshToken = jwtUtil.signRefresh({ sub: user.id });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: expiresAtFromNow(),
    },
  });

  return {
    accessToken,
    refreshToken,
    refreshExpiresAt: expiresAtFromNow(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  };
}

module.exports = { register, login, refresh, logout };
