// Mounts alias CRUD routes. All require authentication.
const { Router } = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const { aliasLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/aliasController');
const schemas = require('./schemas');

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: schemas.listAliasesQuerySchema }), asyncHandler(ctrl.list));
router.get('/domains', asyncHandler(ctrl.domains));
router.post(
  '/',
  aliasLimiter,
  validate({ body: schemas.createAliasSchema }),
  asyncHandler(ctrl.create),
);
router.get(
  '/:id',
  validate({ params: schemas.idParamSchema }),
  asyncHandler(ctrl.getOne),
);
router.patch(
  '/:id',
  validate({ params: schemas.idParamSchema, body: schemas.updateAliasSchema }),
  asyncHandler(ctrl.update),
);
router.delete(
  '/:id',
  validate({ params: schemas.idParamSchema }),
  asyncHandler(ctrl.remove),
);

module.exports = router;
