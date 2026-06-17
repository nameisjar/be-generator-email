// Express middleware that validates `Authorization: Bearer <accessToken>`
// and attaches the decoded user payload to `req.user`.
const { verifyAccess } = require('../utils/jwt');
const AppError = require('../utils/AppError');

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Missing or invalid Authorization header', 401, 'UNAUTHORIZED'));
  }

  try {
    const payload = verifyAccess(token);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    return next(new AppError('Invalid or expired access token', 401, 'UNAUTHORIZED'));
  }
}

module.exports = requireAuth;
