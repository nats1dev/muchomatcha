import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const txTimeout = process.env.PRISMA_TX_TIMEOUT
  ? Number(process.env.PRISMA_TX_TIMEOUT)
  : undefined;
const txMaxWait = process.env.PRISMA_TX_MAX_WAIT
  ? Number(process.env.PRISMA_TX_MAX_WAIT)
  : undefined;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(txTimeout || txMaxWait
      ? {
          transactionOptions: {
            ...(txTimeout ? { timeout: txTimeout } : {}),
            ...(txMaxWait ? { maxWait: txMaxWait } : {}),
          } satisfies NonNullable<Prisma.PrismaClientOptions["transactionOptions"]>,
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
