// Mounts email routes (inbox per alias, detail, mark read, delete).
// Note: requireAuth is applied per-route (NOT via router.use) because this
// router is mounted at "/" in routes/index.js. With router.use(requireAuth),
// the middleware would run for ANY path entering this router, including the
// webhook path that should remain unauthenticated (HMAC-protected instead).
const { Router } = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const ctrl = require('../controllers/emailController');
const schemas = require('./schemas');

const router = Router();

// Inbox: GET /api/aliases/:aliasId/emails
router.get(
  '/aliases/:aliasId/emails',
  requireAuth,
  validate({ params: schemas.aliasIdParamSchema, query: schemas.listEmailsQuerySchema }),
  asyncHandler(ctrl.list),
);

router.get(
  '/emails/:id',
  requireAuth,
  validate({ params: schemas.emailIdParamSchema }),
  asyncHandler(ctrl.getOne),
);

router.patch(
  '/emails/:id/read',
  requireAuth,
  validate({ params: schemas.emailIdParamSchema, body: schemas.markReadSchema }),
  asyncHandler(ctrl.markRead),
);

router.delete(
  '/emails/:id',
  requireAuth,
  validate({ params: schemas.emailIdParamSchema }),
  asyncHandler(ctrl.remove),
);

module.exports = router;
