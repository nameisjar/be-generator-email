// Alias-related business logic. The "address" stored is the local part only
// (e.g. "netflix-9a8b7c"). The full address becomes `${local}@${MAIL_DOMAIN}`.
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { isValidAliasLocalPart, normalize, randomAliasLocalPart } = require('../utils/alias');
const env = require('../config/env');

function fullAddress(localPart) {
  return `${localPart}@${env.mail.domain}`;
}

async function listAliases(userId, { page = 1, pageSize = 20, search = '', activeOnly = false } = {}) {
  const where = { userId };
  if (activeOnly) where.isActive = true;
  if (search) {
    where.OR = [
      { address: { contains: search, mode: 'insensitive' } },
      { label: { contains: search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.alias.count({ where }),
    prisma.alias.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        _count: { select: { emails: true } },
      },
    }),
  ]);
  return {
    items: rows.map((a) => ({
      id: a.id,
      address: a.address,
      fullAddress: fullAddress(a.address),
      label: a.label,
      isActive: a.isActive,
      createdAt: a.createdAt,
      emailCount: a._count.emails,
    })),
    page,
    pageSize,
    total,
  };
}

async function createAlias(userId, { address, label }) {
  let local = address ? normalize(address) : normalize(randomAliasLocalPart());

  if (address && !isValidAliasLocalPart(local)) {
    throw new AppError(
      'Alias must be 3-30 chars, lowercase letters/digits/._- and start+end alphanumeric',
      400,
      'INVALID_ALIAS',
    );
  }

  // Try once with the user-provided value, retry up to 5 times for random.
  const maxAttempts = address ? 1 : 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const existing = await prisma.alias.findUnique({ where: { address: local } });
    if (!existing) break;
    if (address) {
      throw new AppError('Alias is already taken', 409, 'ALIAS_TAKEN');
    }
    local = randomAliasLocalPart();
  }

  try {
    const created = await prisma.alias.create({
      data: {
        userId,
        address: local,
        label: label || null,
        isActive: true,
      },
    });
    return {
      ...created,
      fullAddress: fullAddress(created.address),
    };
  } catch (err) {
    // Race condition: another request grabbed the same local part.
    if (err.code === 'P2002') {
      throw new AppError('Alias is already taken', 409, 'ALIAS_TAKEN');
    }
    throw err;
  }
}

async function updateAlias(userId, aliasId, { label, isActive }) {
  const alias = await prisma.alias.findUnique({ where: { id: aliasId } });
  if (!alias || alias.userId !== userId) {
    throw new AppError('Alias not found', 404, 'NOT_FOUND');
  }
  const updated = await prisma.alias.update({
    where: { id: aliasId },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  return { ...updated, fullAddress: fullAddress(updated.address) };
}

async function deleteAlias(userId, aliasId) {
  const alias = await prisma.alias.findUnique({ where: { id: aliasId } });
  if (!alias || alias.userId !== userId) {
    throw new AppError('Alias not found', 404, 'NOT_FOUND');
  }
  // Hard delete — cascades to emails via Prisma relation.
  await prisma.alias.delete({ where: { id: aliasId } });
  return { id: aliasId };
}

async function getAliasForUser(userId, aliasId) {
  const alias = await prisma.alias.findUnique({
    where: { id: aliasId },
    include: { _count: { select: { emails: true } } },
  });
  if (!alias || alias.userId !== userId) {
    throw new AppError('Alias not found', 404, 'NOT_FOUND');
  }
  return {
    id: alias.id,
    address: alias.address,
    fullAddress: fullAddress(alias.address),
    label: alias.label,
    isActive: alias.isActive,
    createdAt: alias.createdAt,
    emailCount: alias._count.emails,
  };
}

module.exports = { listAliases, createAlias, updateAlias, deleteAlias, getAliasForUser, fullAddress };
