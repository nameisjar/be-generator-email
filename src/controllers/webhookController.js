// Webhook controller: receives email events from the Cloudflare Worker.
const emailService = require('../services/emailService');
const AppError = require('../utils/AppError');

async function incoming(req, res) {
  const payload = req.body || {};
  if (!payload.toAddress) {
    throw new AppError('Missing toAddress in payload', 400, 'BAD_REQUEST');
  }

  const result = await emailService.ingestIncomingEmail({
    messageId: payload.messageId,
    fromAddress: payload.from,
    fromName: payload.fromName,
    toAddress: payload.toAddress,
    subject: payload.subject,
    bodyText: payload.bodyText,
    bodyHtml: payload.bodyHtml,
    receivedAt: payload.receivedAt,
  });

  // Always 200 — we don't want Cloudflare to retry on "expected" outcomes (drop/duplicate).
  res.json({ ok: true, ...result });
}

module.exports = { incoming };
