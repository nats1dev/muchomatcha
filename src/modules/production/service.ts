import { MovementType, ProductionStatus } from "@prisma/client";
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
  effectiveRecipeQty,
} from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";
import { getIngredientStock } from "@/modules/inventory/stock";

type CreateProductionOrderInput = {
  businessId: string;
  userId: string;
  ingredientId: string;
  quantity: number;
  notes?: string;
};

type StartProductionOrderInput = {
  businessId: string;
  userId: string;
  orderId: string;
};

export async function startProductionOrder(input: StartProductionOrderInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: input.orderId, businessId: input.businessId },
    });
    if (!order) {
      throw new AppError("Orden de producción no encontrada", {
        code: "ORDER_NOT_FOUND",
        status: 404,
      });
    }
    if (order.status !== ProductionStatus.DRAFT) {
      throw new AppError("Solo se pueden iniciar órdenes en borrador", {
        code: "ORDER_NOT_DRAFT",
      });
    }

    const updated = await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        status: ProductionStatus.IN_PROGRESS,
        startedAt: new Date(),
        startedById: input.userId,
      },
    });

    await writeAudit(tx, {
      businessId: input.businessId,
      userId: input.userId,
      action: "START",
      entityType: "production_order",
      entityId: order.id,
      beforeData: { status: ProductionStatus.DRAFT },
      afterData: { status: ProductionStatus.IN_PROGRESS },
    });

    return updated;
  });
}

type CompleteProductionOrderInput = {
  businessId: string;
  userId: string;
  orderId: string;
  actualQuantity?: number;
};

type CancelProductionOrderInput = {
  businessId: string;
  userId: string;
  orderId: string;
  reason: string;
};

export async function createProductionOrder(input: CreateProductionOrderInput) {
  if (input.quantity <= 0) {
    throw new AppError("La cantidad debe ser mayor a 0", {
      code: "INVALID_QTY",
    });
  }

  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.findFirst({
      where: {
        id: input.ingredientId,
        businessId: input.businessId,
        active: true,
        recipeId: { not: null },
      },
      include: {
        recipe: {
          where: { active: true },
          include: {
            items: {
              include: { ingredient: true },
            },
          },
        },
      },
    });
    if (!ingredient) {
      throw new AppError("El ingrediente no tiene una receta activa o no es un subproducto", {
        code: "INGREDIENT_NOT_MANUFACTURED",
      });
    }
    if (!ingredient.recipe || !ingredient.recipe.items.length) {
      throw new AppError("La receta del subproducto no tiene ingredientes", {
        code: "RECIPE_EMPTY",
      });
    }

    const last = await tx.productionOrder.findFirst({
      where: { businessId: input.businessId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (last?.orderNumber ?? 0) + 1;

    const order = await tx.productionOrder.create({
      data: {
        businessId: input.businessId,
        orderNumber,
        ingredientId: input.ingredientId,
        recipeId: ingredient.recipe.id,
        quantity: toFixedQty(input.quantity),
        status: ProductionStatus.DRAFT,
        notes: input.notes,
        userId: input.userId,
      },
      include: {
        ingredient: { select: { name: true, sku: true, baseUnit: true } },
        recipe: {
          include: {
            items: {
              include: { ingredient: { select: { name: true, sku: true, currentAverageCost: true } } },
            },
          },
        },
      },
    });

    await writeAudit(tx, {
      businessId: input.businessId,
      userId: input.userId,
      action: "CREATE",
      entityType: "production_order",
      entityId: order.id,
      afterData: {
        orderNumber,
        ingredientId: input.ingredientId,
        quantity: input.quantity,
      },
    });

    const itemsWithCost = order.recipe.items.map((ri) => {
      const effective = effectiveRecipeQty({
        quantity: ri.quantity,
        wastePercentage: ri.wastePercentage,
        yieldQuantity: order.recipe.yieldQuantity,
      });
      return {
        ...ri,
        effectivePerUnit: effective,
        totalNeeded: effective.mul(d(input.quantity)),
      };
    });

    let totalCost = d(0);
    for (const item of itemsWithCost) {
      totalCost = totalCost.plus(
        item.totalNeeded.mul(d(item.ingredient.currentAverageCost)),
      );
    }
    const estimatedUnitCost = qty(input.quantity).gt(0)
      ? cost(totalCost.div(d(input.quantity)))
      : d(0);
    const estimatedTotalCost = money(estimatedUnitCost.mul(d(input.quantity)));

    await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        estimatedUnitCost: toFixedCost(estimatedUnitCost),
        estimatedTotalCost: toFixedMoney(estimatedTotalCost),
      },
    });

    return { order, items: itemsWithCost, estimatedUnitCost: estimatedUnitCost.toFixed(4) };
  });
}

export async function completeProductionOrder(input: CompleteProductionOrderInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: input.orderId, businessId: input.businessId },
      include: {
        recipe: {
          include: {
            items: {
              include: {
                ingredient: {
                  include: { baseUnit: { select: { code: true } } },
                },
              },
            },
          },
        },
        ingredient: {
          include: { baseUnit: { select: { code: true } } },
        },
      },
    });
    if (!order) {
      throw new AppError("Orden de producción no encontrada", {
        code: "ORDER_NOT_FOUND",
        status: 404,
      });
    }
    if (order.status === ProductionStatus.COMPLETED) {
      throw new AppError("La orden ya fue completada", { code: "ORDER_ALREADY_COMPLETED" });
    }
    if (order.status === ProductionStatus.CANCELLED) {
      throw new AppError("La orden está cancelada", { code: "ORDER_CANCELLED" });
    }
    if (order.status !== ProductionStatus.IN_PROGRESS) {
      throw new AppError("La orden debe estar en progreso. Inicia la producción primero.", {
        code: "ORDER_NOT_IN_PROGRESS",
      });
    }

    if (input.actualQuantity != null && input.actualQuantity <= 0) {
      throw new AppError("El rendimiento real debe ser mayor a 0", {
        code: "INVALID_QTY",
      });
    }

    const actualQty = input.actualQuantity != null ? d(input.actualQuantity) : d(order.quantity);

    const insufficient: string[] = [];
    const movementsOut: Array<{
      ingredientId: string;
      quantityDelta: string;
      unitCost: string;
      reason: string;
    }> = [];

    let totalInputCost = d(0);

    for (const ri of order.recipe.items) {
      const effective = effectiveRecipeQty({
        quantity: ri.quantity,
        wastePercentage: ri.wastePercentage,
        yieldQuantity: order.recipe.yieldQuantity,
      });
      const totalNeeded = effective.mul(d(order.quantity));

      if (!ri.isNonInventoriable) {
        const currentStock = await getIngredientStock(input.businessId, ri.ingredientId, tx);
        if (currentStock.lt(totalNeeded)) {
          insufficient.push(
            `${ri.ingredient.name}: necesitas ${toFixedQty(totalNeeded)} ${ri.ingredient.baseUnit?.code ?? "u"}, tienes ${toFixedQty(currentStock)}`,
          );
        }
      }

      const lineCost = totalNeeded.mul(d(ri.ingredient.currentAverageCost));
      totalInputCost = totalInputCost.plus(lineCost);

      if (!ri.isNonInventoriable) {
        movementsOut.push({
          ingredientId: ri.ingredientId,
          quantityDelta: toFixedQty(totalNeeded.neg()),
          unitCost: toFixedCost(ri.ingredient.currentAverageCost),
          reason: `Producción #${order.orderNumber} — ${order.ingredient.name}`,
        });
      }
    }

    if (insufficient.length > 0) {
      throw new AppError(`Stock insuficiente:\n${insufficient.join("\n")}`, {
        code: "INSUFFICIENT_STOCK",
      });
    }

    const unitCost = actualQty.gt(0) ? cost(totalInputCost.div(actualQty)) : d(0);
    const totalCostMovements = money(unitCost.mul(actualQty));

    for (const mov of movementsOut) {
      await tx.inventoryMovement.create({
        data: {
          businessId: input.businessId,
          ingredientId: mov.ingredientId,
          movementType: MovementType.PRODUCTION_OUT,
          quantityDelta: mov.quantityDelta,
          unitCost: mov.unitCost,
          referenceType: "production",
          referenceId: order.id,
          reason: mov.reason,
          userId: input.userId,
        },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        businessId: input.businessId,
        ingredientId: order.ingredientId,
        movementType: MovementType.PRODUCTION_IN,
        quantityDelta: toFixedQty(actualQty),
        unitCost: toFixedCost(unitCost),
        referenceType: "production",
        referenceId: order.id,
        reason: `Producción #${order.orderNumber} — ${order.ingredient.name}`,
        userId: input.userId,
      },
    });

    const prevStock = await getIngredientStock(input.businessId, order.ingredientId, tx);
    const newAvg = weightedAverageCost({
      previousQty: prevStock,
      previousAvgCost: order.ingredient.currentAverageCost,
      inboundQty: actualQty,
      inboundUnitCost: unitCost,
    });

    await tx.ingredient.update({
      where: { id: order.ingredientId },
      data: {
        currentAverageCost: toFixedCost(newAvg),
      },
    });

    const updated = await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        status: ProductionStatus.COMPLETED,
        actualQuantity: actualQty.eq(d(order.quantity)) ? null : toFixedQty(actualQty),
        unitCost: toFixedCost(unitCost),
        totalCost: toFixedMoney(totalCostMovements),
        completedAt: new Date(),
        completedById: input.userId,
      },
      include: {
        ingredient: { select: { name: true, sku: true } },
        recipe: { include: { items: { include: { ingredient: { select: { name: true } } } } } },
      },
    });

    await writeAudit(tx, {
      businessId: input.businessId,
      userId: input.userId,
      action: "COMPLETE",
      entityType: "production_order",
      entityId: order.id,
      beforeData: { status: ProductionStatus.IN_PROGRESS },
      afterData: { status: ProductionStatus.COMPLETED, unitCost: unitCost.toFixed(4) },
    });

    return updated;
  });
}

export async function cancelProductionOrder(input: CancelProductionOrderInput) {
  if (!input.reason.trim()) {
    throw new AppError("El motivo de cancelación es obligatorio", {
      code: "CANCEL_REASON_REQUIRED",
    });
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: input.orderId, businessId: input.businessId },
      include: { ingredient: true },
    });
    if (!order) {
      throw new AppError("Orden de producción no encontrada", {
        code: "ORDER_NOT_FOUND",
        status: 404,
      });
    }
    if (order.status === ProductionStatus.CANCELLED) {
      return order;
    }

    if (order.status === ProductionStatus.COMPLETED) {
      const originalMovements = await tx.inventoryMovement.findMany({
        where: {
          businessId: input.businessId,
          referenceType: "production",
          referenceId: order.id,
        },
      });

      for (const mov of originalMovements) {
        await tx.inventoryMovement.create({
          data: {
            businessId: input.businessId,
            ingredientId: mov.ingredientId,
            movementType: mov.movementType === MovementType.PRODUCTION_IN
              ? MovementType.PRODUCTION_OUT
              : MovementType.PRODUCTION_IN,
            quantityDelta: toFixedQty(d(mov.quantityDelta).neg()),
            unitCost: mov.unitCost,
            referenceType: "production_cancel",
            referenceId: order.id,
            reason: `Cancelación producción #${order.orderNumber}: ${input.reason}`,
            userId: input.userId,
          },
        });
      }

      const remainingProduction = await tx.inventoryMovement.findMany({
        where: {
          businessId: input.businessId,
          ingredientId: order.ingredientId,
          movementType: MovementType.PRODUCTION_IN,
          referenceId: { not: order.id },
        },
        orderBy: { occurredAt: "asc" },
      });

      let totalQty = d(0);
      let totalValue = d(0);
      for (const mov of remainingProduction) {
        const q = d(mov.quantityDelta);
        const c = d(mov.unitCost);
        totalQty = totalQty.plus(q);
        totalValue = totalValue.plus(q.mul(c));
      }

      const purchasedMovements = await tx.inventoryMovement.findMany({
        where: {
          businessId: input.businessId,
          ingredientId: order.ingredientId,
          movementType: MovementType.PURCHASE,
        },
        orderBy: { occurredAt: "asc" },
      });
      for (const mov of purchasedMovements) {
        const q = d(mov.quantityDelta);
        const c = d(mov.unitCost);
        totalQty = totalQty.plus(q);
        totalValue = totalValue.plus(q.mul(c));
      }

      const newAvg = totalQty.gt(0) ? cost(totalValue.div(totalQty)) : cost(0);

      await tx.ingredient.update({
        where: { id: order.ingredientId },
        data: { currentAverageCost: toFixedCost(newAvg) },
      });
    }

    const updated = await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        status: ProductionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: input.reason.trim(),
      },
    });

    await writeAudit(tx, {
      businessId: input.businessId,
      userId: input.userId,
      action: "CANCEL",
      entityType: "production_order",
      entityId: order.id,
      beforeData: { status: order.status },
      afterData: { status: ProductionStatus.CANCELLED, reason: input.reason },
    });

    return updated;
  });
}

export async function listProductionOrders(
  businessId: string,
  opts?: {
    ingredientId?: string;
    status?: ProductionStatus;
    from?: Date;
    to?: Date;
    take?: number;
    skip?: number;
  },
) {
  return prisma.productionOrder.findMany({
    where: {
      businessId,
      ...(opts?.ingredientId ? { ingredientId: opts.ingredientId } : {}),
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.from || opts?.to
        ? {
            occurredAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    },
    include: {
      ingredient: { select: { id: true, name: true, sku: true, baseUnit: { select: { code: true } } } },
      user: { select: { name: true } },
      startedBy: { select: { name: true } },
      completedBy: { select: { name: true } },
      recipe: { select: { id: true, version: true, yieldQuantity: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: opts?.take ?? 50,
    skip: opts?.skip ?? 0,
  });
}

export async function getProductionOrderDetail(businessId: string, orderId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId, businessId },
    include: {
      ingredient: {
        select: {
          id: true, name: true, sku: true,
          baseUnit: { select: { code: true, name: true } },
          currentAverageCost: true,
        },
      },
      recipe: {
        include: {
          items: {
            include: {
              ingredient: {
                select: {
                  id: true, name: true, sku: true,
                  currentAverageCost: true,
                  baseUnit: { select: { code: true } },
                },
              },
            },
          },
        },
      },
      user: { select: { id: true, name: true } },
      startedBy: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
    },
  });
  if (!order) {
    throw new AppError("Orden de producción no encontrada", {
      code: "ORDER_NOT_FOUND",
      status: 404,
    });
  }

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      businessId,
      referenceType: { in: ["production", "production_cancel"] },
      referenceId: order.id,
    },
    include: {
      ingredient: { select: { name: true, sku: true } },
      user: { select: { name: true } },
    },
    orderBy: { occurredAt: "asc" },
  });

  return { order, movements };
}

export async function listManufacturedIngredients(businessId: string) {
  return prisma.ingredient.findMany({
    where: {
      businessId,
      active: true,
      recipeId: { not: null },
    },
    include: {
      baseUnit: { select: { code: true, name: true } },
      recipe: {
        where: { active: true },
        select: {
          id: true,
          version: true,
          yieldQuantity: true,
          items: {
            include: {
              ingredient: {
                select: { id: true, name: true, sku: true, baseUnit: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getSubproductRecipe(businessId: string, ingredientId: string) {
  const ingredient = await prisma.ingredient.findFirst({
    where: {
      id: ingredientId,
      businessId,
      active: true,
      recipeId: { not: null },
    },
    include: {
      baseUnit: { select: { code: true, name: true } },
      recipe: {
        where: { active: true },
        include: {
          items: {
            include: {
              ingredient: {
                select: {
                  id: true, name: true, sku: true,
                  currentAverageCost: true,
                  baseUnit: { select: { code: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!ingredient || !ingredient.recipe) {
    throw new AppError("Subproducto o receta no encontrada", {
      code: "SUBPRODUCT_NOT_FOUND",
      status: 404,
    });
  }
  return ingredient;
}

export async function getRecipesWithYieldIssues(
  businessId: string,
  opts?: { minOrders?: number },
) {
  const minOrders = opts?.minOrders ?? 3;

  const orders = await prisma.productionOrder.findMany({
    where: {
      businessId,
      status: ProductionStatus.COMPLETED,
    },
    include: {
      recipe: {
        select: {
          id: true,
          yieldQuantity: true,
          product: { select: { id: true, name: true } },
          producedIngredients: {
            where: { active: true },
            select: { id: true, name: true, baseUnit: { select: { code: true } } },
            take: 1,
          },
        },
      },
      ingredient: { select: { name: true, baseUnit: { select: { code: true } } } },
    },
    orderBy: { completedAt: "desc" },
  });

  const byRecipe = new Map<
    string,
    {
      recipeId: string;
      yieldQuantity: number;
      productName: string | null;
      ingredientName: string;
      ingredientId: string;
      unit: string;
      variances: number[];
      orderCount: number;
    }
  >();

  for (const po of orders) {
    const recipe = po.recipe;
    const key = recipe.id;
    const entry = byRecipe.get(key) ?? {
      recipeId: recipe.id,
      yieldQuantity: Number(recipe.yieldQuantity),
      productName: recipe.product?.name ?? recipe.producedIngredients[0]?.name ?? po.ingredient.name,
      ingredientName: po.ingredient.name,
      ingredientId: po.ingredientId ?? recipe.producedIngredients[0]?.id ?? "",
      unit: po.ingredient.baseUnit?.code ?? "",
      variances: [],
      orderCount: 0,
    };

    const planned = Number(po.quantity);
    const actual = Number(po.actualQuantity ?? po.quantity);
    if (planned > 0) {
      entry.variances.push((actual - planned) / planned);
    }
    entry.orderCount++;
    byRecipe.set(key, entry);
  }

  const results: Array<{
    recipeId: string;
    ingredientName: string;
    ingredientId: string;
    productName: string | null;
    unit: string;
    yieldQuantity: number;
    avgActual: number;
    avgYieldVariance: number;
    orderCount: number;
    suggestion: string;
  }> = [];

  for (const entry of byRecipe.values()) {
    if (entry.orderCount < minOrders) continue;
    const avg = entry.variances.reduce((sum, v) => sum + v, 0) / entry.variances.length;
    if (avg >= -0.005) continue;

    const avgActual = Number((entry.yieldQuantity * (1 + avg)).toFixed(3));
    const avgPct = Number((avg * 100).toFixed(1));
    results.push({
      recipeId: entry.recipeId,
      ingredientName: entry.ingredientName,
      ingredientId: entry.ingredientId,
      productName: entry.productName,
      unit: entry.unit,
      yieldQuantity: entry.yieldQuantity,
      avgActual,
      avgYieldVariance: avgPct,
      orderCount: entry.orderCount,
      suggestion: `Ajustar rendimiento de ${entry.yieldQuantity}${entry.unit} a ${avgActual}${entry.unit} (${avgPct}% menor al plan en ${entry.orderCount} órdenes)`,
    });
  }

  results.sort((a, b) => a.avgYieldVariance - b.avgYieldVariance);
  return results.slice(0, 5);
}
