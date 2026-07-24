import {
  CashMovementType,
  CashSessionStatus,
  PaymentMethod,
  SaleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { d, money, toFixedMoney } from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";
import {
  calculateCashDifference,
  calculateExpectedCash,
} from "@/modules/cash/expected";

export async function openCashSession(params: {
  businessId: string;
  userId: string;
  openingAmount: number;
}) {
  if (params.openingAmount < 0) {
    throw new AppError("El fondo inicial no puede ser negativo");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.cashSession.findFirst({
      where: { businessId: params.businessId, status: CashSessionStatus.OPEN },
    });
    if (existing) {
      throw new AppError("Ya hay una caja abierta", {
        code: "CASH_ALREADY_OPEN",
      });
    }

    const session = await tx.cashSession.create({
      data: {
        businessId: params.businessId,
        openingAmount: toFixedMoney(params.openingAmount),
        openedById: params.userId,
        status: CashSessionStatus.OPEN,
      },
    });

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "OPEN",
      entityType: "cash_session",
      entityId: session.id,
      afterData: { openingAmount: session.openingAmount },
    });

    return session;
  });
}

export async function addCashMovement(params: {
  businessId: string;
  userId: string;
  movementType: CashMovementType;
  amount: number;
  reason: string;
}) {
  if (params.amount <= 0) {
    throw new AppError("El monto debe ser mayor a 0");
  }
  if (!params.reason.trim()) {
    throw new AppError("El motivo es obligatorio");
  }
  if (
    params.movementType !== CashMovementType.INCOME &&
    params.movementType !== CashMovementType.WITHDRAWAL
  ) {
    throw new AppError("Tipo de movimiento no válido");
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findFirst({
      where: { businessId: params.businessId, status: CashSessionStatus.OPEN },
    });
    if (!session) {
      throw new AppError("No hay caja abierta", { code: "CASH_CLOSED" });
    }

    const movement = await tx.cashMovement.create({
      data: {
        cashSessionId: session.id,
        movementType: params.movementType,
        amount: toFixedMoney(params.amount),
        reason: params.reason.trim(),
        userId: params.userId,
      },
    });

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "CREATE",
      entityType: "cash_movement",
      entityId: movement.id,
      afterData: movement,
    });

    return movement;
  });
}

export async function getExpectedForSession(sessionId: string) {
  const session = await prisma.cashSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      movements: true,
      sales: {
        where: { paymentMethod: PaymentMethod.CASH },
      },
    },
  });

  const confirmedCashSales = session.sales
    .filter((s) => s.status === SaleStatus.CONFIRMED)
    .reduce((acc, s) => acc.plus(d(s.total)), d(0));

  const voidedCashSales = session.sales
    .filter((s) => s.status === SaleStatus.VOIDED)
    .reduce((acc, s) => acc.plus(d(s.total)), d(0));

  // Voided sales that were confirmed before void still need to be excluded.
  // expected = opening + confirmed - (we don't add voided). If a sale was voided,
  // it's not in confirmed. But if void happened after being in session, confirmed
  // filter handles it. For cash that was collected and then voided, we subtract:
  // Actually: confirmedCashSales only includes CONFIRMED. voided ones are separate.
  // Formula: opening + confirmed + incomes - withdrawals - expenses
  // Voided sales simply aren't in confirmed — correct if voided before close.
  // If we need to reverse cash that was in confirmed then voided: they're not CONFIRMED so not added. Good.

  const incomes = session.movements
    .filter((m) => m.movementType === CashMovementType.INCOME)
    .reduce((acc, m) => acc.plus(d(m.amount)), d(0));
  const withdrawals = session.movements
    .filter((m) => m.movementType === CashMovementType.WITHDRAWAL)
    .reduce((acc, m) => acc.plus(d(m.amount)), d(0));
  const cashExpenses = session.movements
    .filter((m) => m.movementType === CashMovementType.EXPENSE)
    .reduce((acc, m) => acc.plus(d(m.amount)), d(0));

  const expected = calculateExpectedCash({
    openingAmount: session.openingAmount,
    confirmedCashSales,
    voidedCashSales: 0, // already excluded via status filter
    incomes,
    withdrawals,
    cashExpenses,
  });

  return {
    session,
    breakdown: {
      openingAmount: money(session.openingAmount),
      confirmedCashSales: money(confirmedCashSales),
      voidedCashSales: money(voidedCashSales),
      incomes: money(incomes),
      withdrawals: money(withdrawals),
      cashExpenses: money(cashExpenses),
      expected,
    },
  };
}

export async function closeCashSession(params: {
  businessId: string;
  userId: string;
  countedAmount: number;
  closeNotes?: string;
}) {
  if (params.countedAmount < 0) {
    throw new AppError("El efectivo contado no puede ser negativo");
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.cashSession.findFirst({
      where: { businessId: params.businessId, status: CashSessionStatus.OPEN },
      include: {
        movements: true,
        sales: { where: { paymentMethod: PaymentMethod.CASH } },
      },
    });
    if (!session) {
      throw new AppError("No hay caja abierta", { code: "CASH_CLOSED" });
    }

    const confirmedCashSales = session.sales
      .filter((s) => s.status === SaleStatus.CONFIRMED)
      .reduce((acc, s) => acc.plus(d(s.total)), d(0));
    const incomes = session.movements
      .filter((m) => m.movementType === CashMovementType.INCOME)
      .reduce((acc, m) => acc.plus(d(m.amount)), d(0));
    const withdrawals = session.movements
      .filter((m) => m.movementType === CashMovementType.WITHDRAWAL)
      .reduce((acc, m) => acc.plus(d(m.amount)), d(0));
    const cashExpenses = session.movements
      .filter((m) => m.movementType === CashMovementType.EXPENSE)
      .reduce((acc, m) => acc.plus(d(m.amount)), d(0));

    const expected = calculateExpectedCash({
      openingAmount: session.openingAmount,
      confirmedCashSales,
      voidedCashSales: 0,
      incomes,
      withdrawals,
      cashExpenses,
    });
    const difference = calculateCashDifference(params.countedAmount, expected);

    const closed = await tx.cashSession.update({
      where: { id: session.id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedAt: new Date(),
        closedById: params.userId,
        expectedAmount: toFixedMoney(expected),
        countedAmount: toFixedMoney(params.countedAmount),
        differenceAmount: toFixedMoney(difference),
        saleCashTotal: toFixedMoney(confirmedCashSales),
        closeNotes: params.closeNotes?.trim() || null,
      },
    });

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "CLOSE",
      entityType: "cash_session",
      entityId: session.id,
      afterData: {
        expected: closed.expectedAmount,
        counted: closed.countedAmount,
        difference: closed.differenceAmount,
      },
    });

    return closed;
  });
}

export async function getOpenCashSession(businessId: string) {
  return prisma.cashSession.findFirst({
    where: { businessId, status: CashSessionStatus.OPEN },
    include: {
      movements: { orderBy: { occurredAt: "desc" } },
      openedBy: { select: { name: true } },
    },
  });
}
