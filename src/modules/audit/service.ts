import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export async function writeAudit(
  tx: Tx | typeof prisma,
  params: {
    businessId: string;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    beforeData?: unknown;
    afterData?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      businessId: params.businessId,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      beforeData: params.beforeData
        ? (params.beforeData as Prisma.InputJsonValue)
        : undefined,
      afterData: params.afterData
        ? (params.afterData as Prisma.InputJsonValue)
        : undefined,
    },
  });
}
