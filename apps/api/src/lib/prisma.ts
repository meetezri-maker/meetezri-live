import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Accepts either the base client or an interactive-transaction client.
 *
 * Canonical home for this type: every module already imports the singleton from here, so a
 * service can take a transaction client without importing a type from a sibling module (which
 * is how the duplicate declarations in `gamification/points.service.ts` and
 * `sessions/sessions.service.ts` arose).
 */
export type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export default prisma;
