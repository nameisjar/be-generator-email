// Prisma client singleton. Reuse across hot-reloads in dev.
const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma__ || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}

module.exports = prisma;
