// HTTP layer for emails.
const emailService = require('../services/emailService');

async function list(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const unreadOnly = req.query.unread === 'true';
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const data = await emailService.listEmails(req.user.id, req.params.aliasId, {
    page,
    pageSize,
    unreadOnly,
    search,
  });
  res.json(data);
}

async function getOne(req, res) {
  const email = await emailService.getEmail(req.user.id, req.params.id);
  res.json({ email });
}

async function markRead(req, res) {
  const updated = await emailService.markRead(req.user.id, req.params.id, Boolean(req.body.isRead));
  res.json({ email: { id: updated.id, isRead: updated.isRead } });
}

async function remove(req, res) {
  await emailService.deleteEmail(req.user.id, req.params.id);
  res.status(204).end();
}

module.exports = { list, getOne, markRead, remove };
