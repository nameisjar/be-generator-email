// Mounts all route groups under /api.
const { Router } = require('express');
const authRoutes = require('./authRoutes');
const aliasRoutes = require('./aliasRoutes');
const emailRoutes = require('./emailRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const webhookRoutes = require('./webhookRoutes');

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true, service: 'email-alias-manager-backend' }));

router.use('/auth', authRoutes);
router.use('/aliases', aliasRoutes);
router.use('/', emailRoutes); // exposes /api/aliases/:aliasId/emails and /api/emails/:id/...
router.use('/dashboard', dashboardRoutes);
router.use('/webhook', webhookRoutes);

module.exports = router;
