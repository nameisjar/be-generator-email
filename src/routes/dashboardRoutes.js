// Mounts dashboard route.
const { Router } = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const requireAuth = require('../middleware/auth');
const ctrl = require('../controllers/dashboardController');

const router = Router();

router.use(requireAuth);

router.get('/overview', asyncHandler(ctrl.overview));

module.exports = router;
