// Lightweight request body validator using Zod schemas. Returns 400 on failure.
const AppError = require('../utils/AppError');

function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      const message = err.errors
        ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
        : err.message;
      next(new AppError(message || 'Invalid request', 400, 'VALIDATION_ERROR'));
    }
  };
}

module.exports = validate;
