import { MovementType, PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
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
    const prepared: Array<{
      ingredientId: string;
      purchaseUnitId: string;
      purchaseQuantity: string;
      baseQuantity: string;
      unitCost: string;
      lineTotal: string;
      expiresAt?: Date | null;
      conversionFactor: string;
    }> = [];

    for (const item of input.items) {
      if (item.purchaseQuantity <= 0 || item.lineTotal < 0) {
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
      const lineTotal = money(item.lineTotal);
      const unitCostBase = d(lineTotal).div(baseQuantity);
      subtotal = subtotal.plus(lineTotal);

      prepared.push({
        ingredientId: item.ingredientId,
        purchaseUnitId: item.purchaseUnitId,
        purchaseQuantity: toFixedQty(item.purchaseQuantity),
        baseQuantity: toFixedQty(baseQuantity),
        unitCost: toFixedCost(unitCostBase),
        lineTotal: toFixedMoney(lineTotal),
        expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
        conversionFactor: conversion.conversionFactor.toString(),
      });
    }

    const taxTotal = money(input.taxTotal ?? 0);
    const total = money(subtotal.plus(taxTotal));

    const purchase = await tx.purchase.create({
      data: {
        businessId: input.businessId,
        supplierId: input.supplierId,
        documentNumber: input.documentNumber || null,
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
