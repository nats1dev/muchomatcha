import { MovementType, Prisma, ProductionStatus } from "@prisma/client";
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
import { serializeDecimals } from "@/lib/serialize";
import { writeAudit } from "@/modules/audit/service";
import { getIngredientStock, getStockMap } from "@/modules/inventory/stock";

type CreateProductionOrderInput = {
  businessId: string;
  userId: string;
  ingredientId: string;
  quantity: number;
  notes?: string;
  /** The UI can create and start in one transaction; domain callers keep the
   * historical default of creating a draft. */
  startImmediately?: boolean;
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

    const claimed = await tx.productionOrder.updateMany({
      where: { id: order.id, businessId: input.businessId, status: ProductionStatus.DRAFT },
      data: {
        status: ProductionStatus.IN_PROGRESS,
        startedAt: new Date(),
        startedById: input.userId,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError("La orden ya fue iniciada por otro usuario", {
        code: "ORDER_ALREADY_STARTED",
      });
    }

    const updated = await tx.productionOrder.findUniqueOrThrow({
      where: { id: order.id },
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

/**
 * Replays the complete inventory ledger for one ingredient. Average cost is
 * affected by every inbound movement (including reversals and counts), while
 * outbound movements only change quantity. A manual cost adjustment changes
 * the current average without changing quantity.
 */
async function recalculateAverageCost(
  tx: Prisma.TransactionClient,
  businessId: string,
  ingredientId: string,
) {
  const movements = await tx.inventoryMovement.findMany({
    where: { businessId, ingredientId },
    select: { movementType: true, quantityDelta: true, unitCost: true },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  let stock = d(0);
  let average = d(0);
  for (const movement of movements) {
    const delta = d(movement.quantityDelta);
    if (movement.movementType === MovementType.COST_ADJUSTMENT) {
      average = cost(movement.unitCost);
      continue;
    }
    if (delta.gt(0)) {
      average = weightedAverageCost({
        previousQty: stock,
        previousAvgCost: average,
        inboundQty: delta,
        inboundUnitCost: movement.unitCost,
      });
    }
    stock = stock.plus(delta);
  }

  return { stock, average: cost(average) };
}

async function createProductionOrderOnce(input: CreateProductionOrderInput) {
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

    const startImmediately = input.startImmediately === true;
    const order = await tx.productionOrder.create({
      data: {
        businessId: input.businessId,
        orderNumber,
        ingredientId: input.ingredientId,
        recipeId: ingredient.recipe.id,
        quantity: toFixedQty(input.quantity),
        status: startImmediately ? ProductionStatus.IN_PROGRESS : ProductionStatus.DRAFT,
        ...(startImmediately
          ? { startedAt: new Date(), startedById: input.userId }
          : {}),
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

    if (startImmediately) {
      await writeAudit(tx, {
        businessId: input.businessId,
        userId: input.userId,
        action: "START",
        entityType: "production_order",
        entityId: order.id,
        beforeData: { status: ProductionStatus.DRAFT },
        afterData: { status: ProductionStatus.IN_PROGRESS },
      });
    }

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

    const updatedOrder = await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        estimatedUnitCost: toFixedCost(estimatedUnitCost),
        estimatedTotalCost: toFixedMoney(estimatedTotalCost),
      },
      include: {
        ingredient: { select: { name: true, sku: true, baseUnit: true } },
        recipe: {
          include: {
            items: {
              include: {
                ingredient: {
                  select: { name: true, sku: true, currentAverageCost: true },
                },
              },
            },
          },
        },
      },
    });

    return {
      order: updatedOrder,
      items: itemsWithCost,
      estimatedUnitCost: estimatedUnitCost.toFixed(4),
    };
  });
}

/**
 * The order number is intentionally human-friendly and scoped to a business.
 * The unique index remains the authority when two operators create at once;
 * retry the short read-then-insert window instead of surfacing a 500.
 */
export async function createProductionOrder(input: CreateProductionOrderInput) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await createProductionOrderOnce(input);
    } catch (error) {
      const isUnique =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.some((target) => String(target).includes("business_id"));
      if (!isUnique || attempt === 2) throw error;
    }
  }
  throw new AppError("No se pudo asignar un número de orden", {
    code: "ORDER_NUMBER_CONFLICT",
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

    // Claim the transition before reading stock or writing movements. The row
    // lock makes a repeated/concurrent completion fail without duplicating
    // inventory movements. The whole transaction rolls back if validation
    // below fails, restoring IN_PROGRESS.
    const claimed = await tx.productionOrder.updateMany({
      where: {
        id: order.id,
        businessId: input.businessId,
        status: ProductionStatus.IN_PROGRESS,
      },
      // COMPLETED is the only terminal state available in the schema. Claim
      // it before side effects; a validation error rolls the transaction back
      // to IN_PROGRESS, while a concurrent request observes count = 0.
      data: { status: ProductionStatus.COMPLETED, updatedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new AppError("La orden ya fue procesada por otro usuario", {
        code: "ORDER_ALREADY_PROCESSED",
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

    // Capture the stock before crediting the produced ingredient. Including
    // the inbound movement here would count the batch twice in the weighted
    // average calculation.
    const previousOutputStock = await getIngredientStock(
      input.businessId,
      order.ingredientId,
      tx,
    );

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

    const newAvg = weightedAverageCost({
      previousQty: previousOutputStock,
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
      include: {
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
    if (order.status === ProductionStatus.CANCELLED) {
      return order;
    }

    const claimed = await tx.productionOrder.updateMany({
      where: {
        id: order.id,
        businessId: input.businessId,
        status: order.status,
      },
      // Claim the terminal transition before creating reversal movements. If
      // stock validation fails, the transaction restores the original state.
      data: { status: ProductionStatus.CANCELLED, updatedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new AppError("La orden ya fue procesada por otro usuario", {
        code: "ORDER_ALREADY_PROCESSED",
      });
    }

    if (order.status === ProductionStatus.COMPLETED) {
      const originalMovements = await tx.inventoryMovement.findMany({
        where: {
          businessId: input.businessId,
          referenceType: "production",
          referenceId: order.id,
        },
      });

      const producedQuantity = originalMovements
        .filter((mov) => mov.movementType === MovementType.PRODUCTION_IN)
        .reduce((sum, mov) => sum.plus(d(mov.quantityDelta)), d(0));
      const currentStock = await getIngredientStock(
        input.businessId,
        order.ingredientId,
        tx,
      );
      if (currentStock.lt(producedQuantity)) {
        throw new AppError(
          `No se puede anular: quedan ${toFixedQty(currentStock)} ${order.ingredient.baseUnit?.code ?? "u"} y se necesitan ${toFixedQty(producedQuantity)} para retirar la producción.`,
          { code: "INSUFFICIENT_STOCK_FOR_CANCEL" },
        );
      }

      const affectedIngredientIds = new Set<string>([
        order.ingredientId,
        ...originalMovements.map((mov) => mov.ingredientId),
      ]);

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

      for (const ingredientId of affectedIngredientIds) {
        const { average } = await recalculateAverageCost(
          tx,
          input.businessId,
          ingredientId,
        );
        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { currentAverageCost: toFixedCost(average) },
        });
      }
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
  const orders = await prisma.productionOrder.findMany({
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
  return serializeDecimals(orders);
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

  const ingredientStock = await getIngredientStock(businessId, order.ingredientId);
  return serializeDecimals({ order, movements, ingredientStock });
}

export async function listManufacturedIngredients(businessId: string) {
  const ingredients = await prisma.ingredient.findMany({
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
          notes: true,
          items: {
            include: {
              ingredient: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  currentAverageCost: true,
                  baseUnit: { select: { code: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const ingredientIds = [
    ...new Set(ingredients.flatMap((item) => item.recipe?.items.map((line) => line.ingredientId) ?? [])),
  ];
  const stockMap = await getStockMap(businessId, ingredientIds);
  const withPreview = ingredients.map((ingredient) => {
    const recipe = ingredient.recipe;
    let estimatedUnitCost = d(0);
    if (recipe) {
      for (const line of recipe.items) {
        const effective = effectiveRecipeQty({
          quantity: line.quantity,
          wastePercentage: line.wastePercentage,
          yieldQuantity: recipe.yieldQuantity,
        });
        estimatedUnitCost = estimatedUnitCost.plus(
          effective.mul(line.ingredient.currentAverageCost),
        );
      }
    }
    return {
      ...ingredient,
      estimatedUnitCost: toFixedCost(estimatedUnitCost),
      recipe: recipe
        ? {
            ...recipe,
            items: recipe.items.map((line) => ({
              ...line,
              ingredient: {
                ...line.ingredient,
                stockQuantity: toFixedQty(stockMap.get(line.ingredientId) ?? d(0)),
              },
            })),
          }
        : null,
    };
  });
  return serializeDecimals(withPreview);
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
