// Webhook route: receives parsed email from the Cloudflare Worker.
// We use express.raw so verifyWebhook can HMAC the *exact* body bytes,
// then verifyWebhook converts it to a parsed object.
const { Router } = require('express');
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const verifyWebhook = require('../middleware/verifyWebhook');
const ctrl = require('../controllers/webhookController');

const router = Router();

// Important: this must be applied BEFORE verifyWebhook so req.body is a Buffer.
router.post(
  '/incoming-email',
  express.raw({ type: '*/*', limit: '5mb' }),
  verifyWebhook,
  asyncHandler(ctrl.incoming),
);

module.exports = router;
