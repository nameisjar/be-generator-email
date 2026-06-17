// Loads and validates environment variables. Fail fast on missing required values.
const dotenv = require('dotenv');
dotenv.config();

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'WEBHOOK_SECRET', 'MAIL_DOMAIN'];
const missing = required.filter((k) => !process.env[k]);

if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`[env] Missing required environment variables: ${missing.join(', ')}`);
  // Don't crash here so the process can start in dev; individual modules will re-check.
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  appUrl: process.env.APP_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '14d',
  },

  mail: {
    domain: process.env.MAIL_DOMAIN || 'algonova.my.id',
  },

  webhook: {
    secret: process.env.WEBHOOK_SECRET,
    maxAgeSeconds: Number(process.env.WEBHOOK_MAX_AGE_SECONDS || 300),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 100),
  },

  // 'lax' for same-site (e.g. app.algonova.my.id + api.algonova.my.id, or localhost dev)
  // 'none' for cross-origin (e.g. myapp.vercel.app + api.algonova.my.id)
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
};
