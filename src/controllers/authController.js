// Thin HTTP layer for auth. Delegates everything to authService.
const authService = require('../services/authService');
const env = require('../config/env');

const REFRESH_COOKIE = 'rt';

// SameSite cookie policy:
//  - 'lax'   → same-site or top-level navigation. Default for localhost dev
//              and same-domain prod (e.g. app.algonova.my.id + api.algonova.my.id).
//  - 'none'  → cross-origin SPA + API (e.g. myapp.vercel.app + api.algonova.my.id).
//              Requires `Secure`, so the backend MUST be served over HTTPS.
const SAME_SITE = (env.cookieSameSite || 'lax').toLowerCase();

function setRefreshCookie(res, token, expiresAt) {
    const isCrossOrigin = SAME_SITE === 'none';
    res.cookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        // When cross-origin, the cookie must be Secure. We force it on whenever
        // sameSite=none even in dev so the config is consistent.
        secure: env.nodeEnv === 'production' || isCrossOrigin,
        sameSite: SAME_SITE,
        expires: expiresAt,
        path: '/api/auth',
    });
}

function clearRefreshCookie(res) {
    const isCrossOrigin = SAME_SITE === 'none';
    res.clearCookie(REFRESH_COOKIE, {
        path: '/api/auth',
        sameSite: SAME_SITE,
        secure: env.nodeEnv === 'production' || isCrossOrigin,
    });
}

async function register(req, res) {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
    });
}

async function login(req, res) {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res.json({
        user: result.user,
        accessToken: result.accessToken,
    });
}

async function refresh(req, res) {
    const token = req.cookies?.[REFRESH_COOKIE];
    const result = await authService.refresh(token);
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res.json({
        user: result.user,
        accessToken: result.accessToken,
    });
}

async function logout(req, res) {
    const token = req.cookies?.[REFRESH_COOKIE];
    await authService.logout(token);
    clearRefreshCookie(res);
    res.status(204).end();
}

async function me(req, res) {
    // req.user comes from requireAuth middleware
    res.json({ user: req.user });
}

module.exports = { register, login, refresh, logout, me };
