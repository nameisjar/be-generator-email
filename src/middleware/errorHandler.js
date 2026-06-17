// Centralized error handler. Maps known errors to JSON responses, hides stack
// traces in production.
const AppError = require('../utils/AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const isAppError = err instanceof AppError;
  const statusCode = err.statusCode || 500;
  const code = err.code || (isAppError ? 'BAD_REQUEST' : 'INTERNAL_ERROR');

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    error: {
      code,
      message: err.message || 'Internal server error',
    },
  });
}

module.exports = errorHandler;
