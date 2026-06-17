// Email-related business logic: store, list, fetch, mark read, delete.
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const aliasService = require('./aliasService');
const { extractCode } = require('../utils/otpExtractor');

function buildSnippet(text, max = 180) {
  if (!text) return '';
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/**
 * Called by the webhook. The toAddress is something like "netflix-xyz@algonova.my.id".
 * We strip the domain to find the local part, look it up, and persist the email.
 */
async function ingestIncomingEmail({
  messageId,
  fromAddress,
  fromName,
  toAddress,
  subject,
  bodyText,
  bodyHtml,
  receivedAt,
}) {
  if (!toAddress) {
    throw new AppError('Missing toAddress', 400, 'BAD_REQUEST');
  }

  const localPart = String(toAddress).split('@')[0].toLowerCase();
  const alias = await prisma.alias.findUnique({ where: { address: localPart } });
  if (!alias || !alias.isActive) {
    // Silently drop — domain may receive catch-all, but the alias may be inactive/unknown.
    return { dropped: true, reason: 'alias not found or inactive' };
  }

  // De-dupe by RFC 5322 Message-ID if present.
  let email;
  if (messageId) {
    const existing = await prisma.email.findUnique({ where: { messageId } });
    if (existing) return { dropped: true, reason: 'duplicate', emailId: existing.id };
  }

  const code = extractCode(bodyText || bodyHtml || '');

  try {
    email = await prisma.email.create({
      data: {
        aliasId: alias.id,
        messageId: messageId || null,
        fromAddress: fromAddress || 'unknown@unknown',
        fromName: fromName || null,
        toAddress,
        subject: subject || '(no subject)',
        bodyText: bodyText || null,
        bodyHtml: bodyHtml || null,
        snippet: buildSnippet(bodyText || ''),
        extractedCode: code,
        isRead: false,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
      },
    });
  } catch (err) {
    if (err.code === 'P2002' && messageId) {
      // race on unique messageId
      return { dropped: true, reason: 'duplicate' };
    }
    throw err;
  }

  return { dropped: false, emailId: email.id, aliasId: alias.id };
}

async function listEmails(userId, aliasId, { page = 1, pageSize = 20, unreadOnly = false, search = '' }) {
  const alias = await prisma.alias.findUnique({ where: { id: aliasId } });
  if (!alias || alias.userId !== userId) {
    throw new AppError('Alias not found', 404, 'NOT_FOUND');
  }

  const where = { aliasId, ...(unreadOnly ? { isRead: false } : {}) };
  if (search) {
    // Postgres full-text-like: case-insensitive contains across a few columns.
    // (For very large inboxes a tsvector index would be better, but for
    // personal-use volumes this is plenty fast.)
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { fromAddress: { contains: search, mode: 'insensitive' } },
      { fromName: { contains: search, mode: 'insensitive' } },
      { snippet: { contains: search, mode: 'insensitive' } },
      { bodyText: { contains: search, mode: 'insensitive' } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: {
        id: true,
        fromAddress: true,
        fromName: true,
        toAddress: true,
        subject: true,
        snippet: true,
        isRead: true,
        extractedCode: true,
        receivedAt: true,
      },
    }),
  ]);

  return {
    items: items.map((e) => ({
      ...e,
      aliasAddress: alias.address,
    })),
    page,
    pageSize,
    total,
  };
}

async function getEmail(userId, emailId) {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { alias: true },
  });
  if (!email || email.alias.userId !== userId) {
    throw new AppError('Email not found', 404, 'NOT_FOUND');
  }
  return {
    id: email.id,
    fromAddress: email.fromAddress,
    fromName: email.fromName,
    toAddress: email.toAddress,
    subject: email.subject,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
    snippet: email.snippet,
    extractedCode: email.extractedCode,
    isRead: email.isRead,
    receivedAt: email.receivedAt,
    alias: {
      id: email.alias.id,
      address: email.alias.address,
      fullAddress: aliasService.fullAddress(email.alias.address),
      label: email.alias.label,
    },
  };
}

async function markRead(userId, emailId, isRead) {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { alias: true },
  });
  if (!email || email.alias.userId !== userId) {
    throw new AppError('Email not found', 404, 'NOT_FOUND');
  }
  return prisma.email.update({ where: { id: emailId }, data: { isRead } });
}

async function deleteEmail(userId, emailId) {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { alias: true },
  });
  if (!email || email.alias.userId !== userId) {
    throw new AppError('Email not found', 404, 'NOT_FOUND');
  }
  await prisma.email.delete({ where: { id: emailId } });
  return { id: emailId };
}

module.exports = {
  ingestIncomingEmail,
  listEmails,
  getEmail,
  markRead,
  deleteEmail,
};
