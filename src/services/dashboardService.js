// Dashboard aggregations: counts, recent emails, unread badges.
const prisma = require('../config/prisma');

async function getOverview(userId) {
  const [activeAliases, totalAliases, totalEmails, unreadEmails, recent] = await Promise.all([
    prisma.alias.count({ where: { userId, isActive: true } }),
    prisma.alias.count({ where: { userId } }),
    prisma.email.count({ where: { alias: { userId } } }),
    prisma.email.count({ where: { alias: { userId }, isRead: false } }),
    prisma.email.findMany({
      where: { alias: { userId } },
      orderBy: { receivedAt: 'desc' },
      take: 5,
      include: { alias: true },
    }),
  ]);

  return {
    counts: {
      activeAliases,
      totalAliases,
      totalEmails,
      unreadEmails,
    },
    recent: recent.map((e) => ({
      id: e.id,
      subject: e.subject,
      fromAddress: e.fromAddress,
      fromName: e.fromName,
      isRead: e.isRead,
      extractedCode: e.extractedCode,
      receivedAt: e.receivedAt,
      alias: {
        id: e.alias.id,
        address: e.alias.address,
        label: e.alias.label,
      },
    })),
  };
}

module.exports = { getOverview };
