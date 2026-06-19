// Alias-related business logic. Each alias has its own local-part (`address`)
// and `domain`. The full address is `${address}@${domain}`. The list of
// allowed domains is read from env.mail.domains.
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { isValidAliasLocalPart, normalize, randomAliasLocalPart } = require('../utils/alias');
const env = require('../config/env');

function fullAddress(localPart, domain = env.mail.domain) {
  return `${localPart}@${domain}`;
}

function allowedDomains() {
  return env.mail.domains;
}

function normalizeDomain(value) {
  if (typeof value !== 'string') return env.mail.domain;
  const v = value.trim().toLowerCase();
  if (!v) return env.mail.domain;
  if (!allowedDomains().includes(v)) {
    throw new AppError(
      `Domain "${value}" is not allowed. Allowed: ${allowedDomains().join(', ')}`,
      400,
      'INVALID_DOMAIN',
    );
  }
  return v;
}

function toApi(a) {
  return {
    id: a.id,
    address: a.address,
    domain: a.domain,
    fullAddress: fullAddress(a.address, a.domain),
    label: a.label,
    isActive: a.isActive,
    createdAt: a.createdAt,
    emailCount: a.emailCount,
  };
}

async function listAliases(userId, { page = 1, pageSize = 20, search = '', activeOnly = false, domain = '' } = {}) {
  const where = { userId };
  if (activeOnly) where.isActive = true;
  if (domain && allowedDomains().includes(domain)) {
    where.domain = domain;
  }
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
    items: rows.map((a) => toApi({ ...a, emailCount: a._count.emails })),
    page,
    pageSize,
    total,
    domains: allowedDomains(),
    defaultDomain: env.mail.domain,
  };
}

async function createAlias(userId, { address, label, domain }) {
  const domainChoice = domain ? normalizeDomain(domain) : env.mail.domain;
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
    const existing = await prisma.alias.findUnique({
      where: { address_domain: { address: local, domain: domainChoice } },
    });
    if (!existing) break;
    if (address) {
      throw new AppError('Alias is already taken on this domain', 409, 'ALIAS_TAKEN');
    }
    local = randomAliasLocalPart();
  }

  try {
    const created = await prisma.alias.create({
      data: {
        userId,
        address: local,
        domain: domainChoice,
        label: label || null,
        isActive: true,
      },
    });
    return toApi(created);
  } catch (err) {
    // Race condition: another request grabbed the same local part on the same domain.
    if (err.code === 'P2002') {
      throw new AppError('Alias is already taken on this domain', 409, 'ALIAS_TAKEN');
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
  return toApi(updated);
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
  return toApi({ ...alias, emailCount: alias._count.emails });
}

module.exports = {
  listAliases,
  createAlias,
  updateAlias,
  deleteAlias,
  getAliasForUser,
  fullAddress,
  allowedDomains,
  normalizeDomain,
};