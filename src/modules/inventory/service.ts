import { MovementType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { d, qty, toFixedCost, toFixedQty } from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";
import { getIngredientStock, getStockMap } from "@/modules/inventory/stock";

export async function createAdjustment(params: {
  businessId: string;
  userId: string;
  ingredientId: string;
  quantityDelta: number;
  reason: string;
  type: "WASTE" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
}) {
  if (!params.reason.trim()) {
    throw new AppError("El motivo es obligatorio", {
      code: "REASON_REQUIRED",
    });
  }
  if (params.quantityDelta === 0) {
    throw new AppError("La cantidad no puede ser 0");
  }

  const movementType =
    params.type === "WASTE"
      ? MovementType.WASTE
      : params.type === "ADJUSTMENT_IN"
        ? MovementType.ADJUSTMENT_IN
        : MovementType.ADJUSTMENT_OUT;

  let delta = d(params.quantityDelta);
  if (movementType === MovementType.WASTE || movementType === MovementType.ADJUSTMENT_OUT) {
    delta = delta.abs().neg();
  } else {
    delta = delta.abs();
  }

  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: params.ingredientId,
        businessId: params.businessId,
        active: true,
      },
    });
    if (!ingredient) {
      throw new AppError("Ingrediente no encontrado");
    }

    const movement = await tx.inventoryMovement.create({
      data: {
        businessId: params.businessId,
        ingredientId: params.ingredientId,
        movementType,
        quantityDelta: toFixedQty(delta),
        unitCost: toFixedCost(ingredient.currentAverageCost),
        referenceType: "adjustment",
        reason: params.reason.trim(),
        userId: params.userId,
      },
    });

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "CREATE",
      entityType: "inventory_adjustment",
      entityId: movement.id,
      afterData: {
        ingredientId: params.ingredientId,
        delta: toFixedQty(delta),
        reason: params.reason,
        type: params.type,
      },
    });

    return movement;
  });
}

export async function confirmInventoryCount(params: {
  businessId: string;
  userId: string;
  notes?: string;
  items: Array<{ ingredientId: string; physicalQuantity: number }>;
}) {
  if (!params.items.length) {
    throw new AppError("Agrega al menos un ingrediente al conteo");
  }

  return prisma.$transaction(async (tx) => {
    const ids = params.items.map((i) => i.ingredientId);
    const ingredients = await tx.ingredient.findMany({
      where: { businessId: params.businessId, id: { in: ids }, active: true },
    });
    if (ingredients.length !== ids.length) {
      throw new AppError("Uno o más ingredientes no son válidos");
    }
    const stock = await getStockMap(params.businessId, ids, tx);
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));

    const count = await tx.inventoryCount.create({
      data: {
        businessId: params.businessId,
        userId: params.userId,
        notes: params.notes,
        status: "CONFIRMED",
        countedAt: new Date(),
      },
    });

    for (const item of params.items) {
      const ingredient = ingMap.get(item.ingredientId)!;
      const theoretical = stock.get(item.ingredientId) ?? d(0);
      const physical = qty(item.physicalQuantity);
      const difference = qty(physical.minus(theoretical));

      await tx.inventoryCountItem.create({
        data: {
          countId: count.id,
          ingredientId: item.ingredientId,
          theoreticalQuantity: toFixedQty(theoretical),
          physicalQuantity: toFixedQty(physical),
          differenceQuantity: toFixedQty(difference),
          unitCost: toFixedCost(ingredient.currentAverageCost),
        },
      });

      if (!difference.eq(0)) {
        await tx.inventoryMovement.create({
          data: {
            businessId: params.businessId,
            ingredientId: item.ingredientId,
            movementType: MovementType.COUNT_ADJUSTMENT,
            quantityDelta: toFixedQty(difference),
            unitCost: toFixedCost(ingredient.currentAverageCost),
            referenceType: "inventory_count",
            referenceId: count.id,
            reason: `Conteo físico ${count.id.slice(0, 8)}`,
            userId: params.userId,
          },
        });
      }
    }

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "CONFIRM",
      entityType: "inventory_count",
      entityId: count.id,
      afterData: { items: params.items.length },
    });

    return count;
  });
}

export async function listMovements(
  businessId: string,
  opts?: { ingredientId?: string; take?: number },
) {
  return prisma.inventoryMovement.findMany({
    where: {
      businessId,
      ...(opts?.ingredientId ? { ingredientId: opts.ingredientId } : {}),
    },
    include: {
      ingredient: { select: { name: true, sku: true } },
      user: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: opts?.take ?? 100,
  });
}

export { getIngredientStock };
