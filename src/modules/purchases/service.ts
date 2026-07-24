import { MovementType, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  cost,
  d,
  money,
  qty,
  toFixedCost,
  toFixedMoney,
  toFixedQty,
  weightedAverageCost,
} from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";
import { getIngredientStock } from "@/modules/inventory/stock";

type PurchaseLineInput = {
  ingredientId: string;
  purchaseUnitId: string;
  purchaseQuantity: number;
  unitPrice: number;
  lineTotal: number;
  expiresAt?: string | null;
};

export async function receivePurchase(input: {
  businessId: string;
  userId: string;
  supplierId: string;
  documentNumber?: string;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  purchasedAt?: Date | string;
  taxTotal?: number;
  notes?: string;
  items: PurchaseLineInput[];
}) {
  if (!input.items.length) {
    throw new AppError("Agrega al menos un ingrediente", {
      code: "EMPTY_PURCHASE",
    });
  }

  return prisma.$transaction(async (tx) => {
    const business = await tx.business.findUniqueOrThrow({
      where: { id: input.businessId },
      select: { taxRate: true },
    });
    const taxMultiplier = d(1).plus(d(Number(business.taxRate)).div(100));

    const supplier = await tx.supplier.findFirst({
      where: {
        id: input.supplierId,
        businessId: input.businessId,
        active: true,
      },
    });
    if (!supplier) {
      throw new AppError("Proveedor no encontrado", {
        code: "SUPPLIER_NOT_FOUND",
      });
    }

    let subtotal = d(0);
    let taxTotal = d(0);
    const prepared: Array<{
      ingredientId: string;
      purchaseUnitId: string;
      purchaseQuantity: string;
      baseQuantity: string;
      unitCost: string;
      unitPrice: string;
      lineTotal: string;
      expiresAt?: Date | null;
      conversionFactor: string;
    }> = [];

    for (const item of input.items) {
      if (item.purchaseQuantity <= 0 || item.lineTotal <= 0) {
        throw new AppError("Cantidades y montos deben ser válidos", {
          code: "INVALID_LINE",
        });
      }

      const conversion = await tx.ingredientPurchaseUnit.findFirst({
        where: {
          id: item.purchaseUnitId,
          ingredientId: item.ingredientId,
          active: true,
          ingredient: { businessId: input.businessId, active: true },
        },
        include: { ingredient: true },
      });
      if (!conversion) {
        throw new AppError(
          "La unidad de compra no tiene conversión válida para el ingrediente",
          { code: "NO_CONVERSION" },
        );
      }

      const baseQuantity = qty(
        d(item.purchaseQuantity).mul(d(conversion.conversionFactor)),
      );
      if (baseQuantity.lte(0)) {
        throw new AppError("La cantidad base debe ser mayor a 0", {
          code: "INVALID_BASE_QTY",
        });
      }
      const unitCostBase = d(item.lineTotal).div(taxMultiplier).div(baseQuantity);
      const lineTotalWithIva = money(item.lineTotal);
      const lineTotalWithoutIva = money(d(item.lineTotal).div(taxMultiplier));
      subtotal = subtotal.plus(lineTotalWithoutIva);
      taxTotal = taxTotal.plus(lineTotalWithIva).minus(lineTotalWithoutIva);

      prepared.push({
        ingredientId: item.ingredientId,
        purchaseUnitId: item.purchaseUnitId,
        purchaseQuantity: toFixedQty(item.purchaseQuantity),
        baseQuantity: toFixedQty(baseQuantity),
        unitCost: toFixedCost(unitCostBase),
        unitPrice: toFixedMoney(d(item.unitPrice)),
        lineTotal: toFixedMoney(lineTotalWithIva),
        expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
        conversionFactor: conversion.conversionFactor.toString(),
      });
    }

    const total = money(subtotal.plus(taxTotal));

    const purchase = await tx.purchase.create({
      data: {
        businessId: input.businessId,
        supplierId: input.supplierId,
        documentNumber: input.documentNumber || null,
        purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : undefined,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus ?? PaymentStatus.PAID,
        subtotal: toFixedMoney(subtotal),
        taxTotal: toFixedMoney(taxTotal),
        total: toFixedMoney(total),
        notes: input.notes,
        userId: input.userId,
        status: "RECEIVED",
      },
    });

    for (const line of prepared) {
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          ingredientId: line.ingredientId,
          purchaseQuantity: line.purchaseQuantity,
          purchaseUnitId: line.purchaseUnitId,
          baseQuantity: line.baseQuantity,
          unitCost: line.unitCost,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          expiresAt: line.expiresAt,
        },
      });

      const prevQty = await getIngredientStock(
        input.businessId,
        line.ingredientId,
        tx,
      );
      const ingredient = await tx.ingredient.findUniqueOrThrow({
        where: { id: line.ingredientId },
      });
      const newAvg = weightedAverageCost({
        previousQty: prevQty,
        previousAvgCost: ingredient.currentAverageCost,
        inboundQty: line.baseQuantity,
        inboundUnitCost: line.unitCost,
      });

      await tx.ingredient.update({
        where: { id: line.ingredientId },
        data: {
          currentAverageCost: toFixedCost(newAvg),
          lastPurchaseCost: line.unitCost,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          businessId: input.businessId,
          ingredientId: line.ingredientId,
          movementType: MovementType.PURCHASE,
          quantityDelta: line.baseQuantity,
          unitCost: line.unitCost,
          referenceType: "purchase",
          referenceId: purchase.id,
          reason: `Compra ${input.documentNumber || purchase.id.slice(0, 8)}`,
          userId: input.userId,
        },
      });
    }

    await writeAudit(tx, {
      businessId: input.businessId,
      userId: input.userId,
      action: "CREATE",
      entityType: "purchase",
      entityId: purchase.id,
      afterData: { total: purchase.total, supplierId: purchase.supplierId },
    });

    return purchase;
  });
}

export async function voidPurchase(input: {
  businessId: string;
  userId: string;
  purchaseId: string;
  reason?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findFirst({
      where: {
        id: input.purchaseId,
        businessId: input.businessId,
        status: "RECEIVED",
      },
      include: { items: true },
    });
    if (!purchase) {
      throw new AppError("Compra no encontrada o ya anulada", {
        code: "PURCHASE_NOT_FOUND",
      });
    }

    await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: "VOIDED", notes: input.reason || null },
    });

    for (const item of purchase.items) {
      await tx.inventoryMovement.create({
        data: {
          businessId: input.businessId,
          ingredientId: item.ingredientId,
          movementType: MovementType.PURCHASE_REVERSAL,
          quantityDelta: d(item.baseQuantity).neg().toFixed(3),
          unitCost: item.unitCost,
          referenceType: "purchase_void",
          referenceId: purchase.id,
          reason: input.reason
            ? `Anulación compra: ${input.reason}`
            : `Anulación compra ${purchase.documentNumber || purchase.id.slice(0, 8)}`,
          userId: input.userId,
        },
      });

      const remainingPurchases = await tx.inventoryMovement.findMany({
        where: {
          businessId: input.businessId,
          ingredientId: item.ingredientId,
          movementType: MovementType.PURCHASE,
          referenceId: { not: purchase.id },
        },
        orderBy: { occurredAt: "asc" },
      });

      let totalQty = d(0);
      let totalValue = d(0);
      for (const mov of remainingPurchases) {
        const q = d(mov.quantityDelta);
        const c = d(mov.unitCost);
        totalQty = totalQty.plus(q);
        totalValue = totalValue.plus(q.mul(c));
      }

      const newAvg = totalQty.gt(0) ? cost(totalValue.div(totalQty)) : cost(0);
      const lastCost = remainingPurchases.length > 0
        ? remainingPurchases[remainingPurchases.length - 1].unitCost
        : toFixedCost(0);

      await tx.ingredient.update({
        where: { id: item.ingredientId },
        data: {
          currentAverageCost: toFixedCost(newAvg),
          lastPurchaseCost: lastCost,
        },
      });
    }

    await writeAudit(tx, {
      businessId: input.businessId,
      userId: input.userId,
      action: "VOID",
      entityType: "purchase",
      entityId: purchase.id,
      beforeData: { status: "RECEIVED" },
      afterData: { status: "VOIDED", reason: input.reason },
    });

    return purchase;
  });
}
