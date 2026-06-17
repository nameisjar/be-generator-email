// Mounts the auth routes.
const { Router } = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const requireAuth = require('../middleware/auth');
const ctrl = require('../controllers/authController');
const schemas = require('./schemas');

const router = Router();

router.post('/register', authLimiter, validate({ body: schemas.registerSchema }), asyncHandler(ctrl.register));
router.post('/login', authLimiter, validate({ body: schemas.loginSchema }), asyncHandler(ctrl.login));
router.post('/refresh', asyncHandler(ctrl.refresh));
router.post('/logout', asyncHandler(ctrl.logout));
router.get('/me', requireAuth, asyncHandler(ctrl.me));

module.exports = router;
