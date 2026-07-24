import {
  CashMovementType,
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { money, toFixedMoney } from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";

export async function createExpense(input: {
  businessId: string;
  userId: string;
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  supplierId?: string | null;
  beneficiary?: string;
  subtotal: number;
  taxTotal?: number;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
}) {
  if (!input.description.trim()) {
    throw new AppError("La descripción es obligatoria");
  }
  if (input.subtotal < 0 || (input.taxTotal ?? 0) < 0) {
    throw new AppError("Los montos no pueden ser negativos");
  }

  const subtotal = money(input.subtotal);
  const taxTotal = money(input.taxTotal ?? 0);
  const total = money(subtotal.plus(taxTotal));
  const paymentStatus = input.paymentStatus ?? PaymentStatus.PAID;

  return prisma.$transaction(async (tx) => {
    let cashSessionId: string | null = null;
    let cashMovementId: string | null = null;

    if (
      input.paymentMethod === PaymentMethod.CASH &&
      paymentStatus === PaymentStatus.PAID
    ) {
      const session = await tx.cashSession.findFirst({
        where: { businessId: input.businessId, status: "OPEN" },
      });
      if (!session) {
        throw new AppError(
          "Abre la caja antes de registrar un gasto en efectivo",
          { code: "CASH_CLOSED" },
        );
      }
      cashSessionId = session.id;
      const movement = await tx.cashMovement.create({
        data: {
          cashSessionId: session.id,
          movementType: CashMovementType.EXPENSE,
          amount: toFixedMoney(total),
          reason: `Gasto: ${input.description.trim()}`,
          userId: input.userId,
        },
      });
      cashMovementId = movement.id;
    }

    const expense = await tx.expense.create({
      data: {
        businessId: input.businessId,
        expenseDate: new Date(input.expenseDate),
        category: input.category,
        description: input.description.trim(),
        supplierId: input.supplierId || null,
        beneficiary: input.beneficiary || null,
        subtotal: toFixedMoney(subtotal),
        taxTotal: toFixedMoney(taxTotal),
        total: toFixedMoney(total),
        paymentMethod: input.paymentMethod,
        paymentStatus,
        cashSessionId,
        cashMovementId,
        userId: input.userId,
      },
    });

    await writeAudit(tx, {
      businessId: input.businessId,
      userId: input.userId,
      action: "CREATE",
      entityType: "expense",
      entityId: expense.id,
      afterData: { total: expense.total, category: expense.category },
    });

    return expense;
  });
}

export async function listExpenses(
  businessId: string,
  opts?: { from?: Date; to?: Date; take?: number },
) {
  return prisma.expense.findMany({
    where: {
      businessId,
      ...(opts?.from || opts?.to
        ? {
            expenseDate: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    },
    include: {
      supplier: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { expenseDate: "desc" },
    take: opts?.take ?? 100,
  });
}
