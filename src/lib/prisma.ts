import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // In Prisma v7, connection URL is configured via prisma.config.ts
    // For development logging:
    ...(process.env.NODE_ENV === 'development'
      ? {
          log: ['query', 'error', 'warn'],
        }
      : {
          log: ['error'],
        }),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
