import {
  MovementType,
  PaymentMethod,
  SaleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  d,
  toFixedCost,
  toFixedMoney,
  toFixedQty,
} from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";
import { calculateRecipeUnitCost } from "@/modules/recipes/cost";
import { calculateSaleTotals } from "@/modules/sales/totals";
import { effectiveRecipeQty } from "@/lib/decimal";

type CreateSaleInput = {
  businessId: string;
  userId: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  globalDiscount?: number;
  items: Array<{
    productId: string;
    quantity: number;
    discount?: number;
  }>;
};

export async function createSale(input: CreateSaleInput) {
  if (!input.items.length) {
    throw new AppError("Agrega al menos un producto", { code: "EMPTY_SALE" });
  }

  return prisma.$transaction(async (tx) => {
    const business = await tx.business.findUnique({
      where: { id: input.businessId },
    });
    if (!business) {
      throw new AppError("Negocio no encontrado", {
        code: "BUSINESS_NOT_FOUND",
        status: 404,
      });
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: {
        businessId: input.businessId,
        id: { in: productIds },
        active: true,
      },
      include: {
        recipes: {
          where: { active: true },
          include: {
            items: {
              include: {
                ingredient: {
                  include: {
                    recipe: {
                      where: { active: true },
                      select: {
                        yieldQuantity: true,
                        items: {
                          include: {
                            ingredient: {
                              select: {
                                currentAverageCost: true,
                                recipe: {
                                  where: { active: true },
                                  select: {
                                    yieldQuantity: true,
                                    items: {
                                      include: {
                                        ingredient: { select: { currentAverageCost: true } },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          take: 1,
        },
      },
    });

    if (products.length !== new Set(productIds).size) {
      throw new AppError("Uno o más productos no están disponibles", {
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const lineInputs = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(product.salePrice),
        discount: item.discount ?? 0,
      };
    });

    const totals = calculateSaleTotals(
      lineInputs,
      business.taxRate,
      input.globalDiscount ?? 0,
    );

    let cashSessionId: string | null = null;
    if (input.paymentMethod === PaymentMethod.CASH) {
      const openSession = await tx.cashSession.findFirst({
        where: { businessId: input.businessId, status: "OPEN" },
      });
      if (!openSession) {
        throw new AppError("Abre la caja antes de registrar ventas en efectivo", {
          code: "CASH_CLOSED",
        });
      }
      cashSessionId = openSession.id;
    }

    const lastSale = await tx.sale.findFirst({
      where: { businessId: input.businessId },
      orderBy: { saleNumber: "desc" },
      select: { saleNumber: true },
    });
    const saleNumber = (lastSale?.saleNumber ?? 0) + 1;

    const sale = await tx.sale.create({
      data: {
        businessId: input.businessId,
        saleNumber,
        paymentMethod: input.paymentMethod,
        subtotal: toFixedMoney(totals.subtotal),
        discountTotal: toFixedMoney(totals.discountTotal),
        taxTotal: toFixedMoney(totals.taxTotal),
        total: toFixedMoney(totals.total),
        notes: input.notes,
        cashSessionId,
        userId: input.userId,
        status: SaleStatus.CONFIRMED,
      },
    });

    const warnings: string[] = [];

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const product = productMap.get(item.productId)!;
      const line = totals.lines[i];
      const recipe = product.recipes[0];

      let unitCost = d(0);
      if (recipe) {
        unitCost = calculateRecipeUnitCost(
          recipe.items.map((ri) => {
            const ingRecipe = ri.ingredient.recipe;
            return {
              quantity: ri.quantity.toString(),
              wastePercentage: ri.wastePercentage.toString(),
              averageCost: ri.ingredient.currentAverageCost.toString(),
              subRecipe: ingRecipe
                ? {
                    yieldQuantity: Number(ingRecipe.yieldQuantity),
                    items: ingRecipe.items.map((sri) => {
                      const srRecipe = sri.ingredient?.recipe;
                      return {
                        quantity: sri.quantity.toString(),
                        wastePercentage: sri.wastePercentage.toString(),
                        averageCost: sri.ingredient?.currentAverageCost?.toString() ?? "0",
                        subRecipe: srRecipe
                          ? {
                              yieldQuantity: Number(srRecipe.yieldQuantity),
                              items: srRecipe.items.map((dr) => ({
                                quantity: dr.quantity.toString(),
                                wastePercentage: dr.wastePercentage.toString(),
                                averageCost: dr.ingredient.currentAverageCost.toString(),
                              })),
                            }
                          : undefined,
                      };
                    }),
                  }
                : undefined,
            };
          }),
          recipe.yieldQuantity.toString(),
        );

        for (const ri of recipe.items) {
          if (ri.isNonInventoriable) continue;

          const delta = effectiveRecipeQty({
            quantity: ri.quantity,
            wastePercentage: ri.wastePercentage,
            yieldQuantity: recipe.yieldQuantity,
          }).mul(d(item.quantity));

          await tx.inventoryMovement.create({
            data: {
              businessId: input.businessId,
              ingredientId: ri.ingredientId,
              movementType: MovementType.SALE,
              quantityDelta: toFixedQty(delta.neg()),
              unitCost: toFixedCost(ri.ingredient.currentAverageCost),
              referenceType: "sale_item",
              referenceId: sale.id,
              reason: `Venta #${saleNumber} — ${product.name}`,
              userId: input.userId,
            },
          });
        }
      } else {
        warnings.push(`${product.name} no tiene receta activa`);
      }

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: product.id,
          quantity: toFixedQty(line.quantity),
          unitPrice: toFixedMoney(line.unitPrice),
          discount: toFixedMoney(line.discount),
          tax: toFixedMoney(line.tax),
          lineTotal: toFixedMoney(line.lineTotal),
          unitCostSnapshot: toFixedCost(unitCost),
        },
      });
    }

    await writeAudit(tx, {
      businessId: input.businessId,
      userId: input.userId,
      action: "CREATE",
      entityType: "sale",
      entityId: sale.id,
      afterData: {
        saleNumber,
        total: sale.total,
        paymentMethod: sale.paymentMethod,
      },
    });

    return { sale, warnings };
  });
}

export async function voidSale(params: {
  businessId: string;
  userId: string;
  saleId: string;
  reason: string;
}) {
  if (!params.reason.trim()) {
    throw new AppError("El motivo de anulación es obligatorio", {
      code: "VOID_REASON_REQUIRED",
    });
  }

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: params.saleId, businessId: params.businessId },
      include: { items: { include: { product: true } } },
    });
    if (!sale) {
      throw new AppError("Venta no encontrada", { code: "SALE_NOT_FOUND" });
    }
    if (sale.status === SaleStatus.VOIDED) {
      return sale;
    }

    const existingReversal = await tx.inventoryMovement.findFirst({
      where: {
        businessId: params.businessId,
        referenceType: "sale_void",
        referenceId: sale.id,
      },
    });
    if (existingReversal) {
      return sale;
    }

    const originalMovements = await tx.inventoryMovement.findMany({
      where: {
        businessId: params.businessId,
        referenceType: "sale_item",
        referenceId: sale.id,
        movementType: MovementType.SALE,
      },
    });

    for (const mov of originalMovements) {
      await tx.inventoryMovement.create({
        data: {
          businessId: params.businessId,
          ingredientId: mov.ingredientId,
          movementType: MovementType.SALE_VOID,
          quantityDelta: toFixedQty(d(mov.quantityDelta).neg()),
          unitCost: mov.unitCost,
          referenceType: "sale_void",
          referenceId: sale.id,
          reason: `Anulación venta #${sale.saleNumber}: ${params.reason}`,
          userId: params.userId,
        },
      });
    }

    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.VOIDED,
        voidedAt: new Date(),
        voidedById: params.userId,
        voidReason: params.reason.trim(),
      },
    });

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "VOID",
      entityType: "sale",
      entityId: sale.id,
      beforeData: { status: sale.status },
      afterData: { status: updated.status, reason: params.reason },
    });

    return updated;
  });
}

export async function listSales(
  businessId: string,
  opts?: {
    from?: Date;
    to?: Date;
    status?: SaleStatus;
    q?: string;
    take?: number;
  },
) {
  return prisma.sale.findMany({
    where: {
      businessId,
      ...(opts?.from || opts?.to
        ? {
            soldAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.q
        ? {
            OR: [
              { notes: { contains: opts.q, mode: "insensitive" } },
              ...(Number.isFinite(Number(opts.q))
                ? [{ saleNumber: Number(opts.q) }]
                : []),
            ],
          }
        : {}),
    },
    select: {
      id: true,
      saleNumber: true,
      soldAt: true,
      status: true,
      paymentMethod: true,
      total: true,
      user: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { soldAt: "desc" },
    take: opts?.take ?? 100,
  });
}

export async function createDraftSale(input: {
  businessId: string;
  userId: string;
  notes?: string;
  items: Array<{ productId: string; quantity: number }>;
}) {
  if (!input.items.length) {
    throw new AppError("Agrega al menos un producto", { code: "EMPTY_SALE" });
  }

  return prisma.$transaction(async (tx) => {
    const productIds = input.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: {
        businessId: input.businessId,
        id: { in: productIds },
        active: true,
      },
      select: { id: true, salePrice: true, name: true },
    });

    if (products.length !== new Set(productIds).size) {
      throw new AppError("Uno o más productos no están disponibles", {
        code: "PRODUCT_NOT_FOUND",
      });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    const last = await tx.sale.findFirst({
      where: { businessId: input.businessId },
      orderBy: { saleNumber: "desc" },
      select: { saleNumber: true },
    });
    const saleNumber = (last?.saleNumber ?? 0) + 1;

    const lineInputs = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(product.salePrice),
      };
    });

    const subtotal = lineInputs.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

    const sale = await tx.sale.create({
      data: {
        businessId: input.businessId,
        saleNumber,
        status: SaleStatus.DRAFT,
        paymentMethod: PaymentMethod.NONE,
        subtotal: toFixedMoney(subtotal),
        discountTotal: "0.00",
        taxTotal: "0.00",
        total: toFixedMoney(subtotal),
        notes: input.notes,
        userId: input.userId,
        items: {
          create: lineInputs.map((l) => ({
            productId: l.productId,
            quantity: toFixedQty(l.quantity),
            unitPrice: toFixedMoney(l.unitPrice),
            discount: "0",
            tax: "0",
            lineTotal: toFixedMoney(l.unitPrice * l.quantity),
            unitCostSnapshot: "0",
          })),
        },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    return sale;
  });
}

export async function confirmDraftSale(input: {
  businessId: string;
  userId: string;
  saleId: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
}) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: input.saleId, businessId: input.businessId },
      include: {
        items: { include: { product: true } },
        cashSession: true,
      },
    });

    if (!sale) {
      throw new AppError("Venta no encontrada", { code: "SALE_NOT_FOUND", status: 404 });
    }
    if (sale.status !== SaleStatus.DRAFT) {
      throw new AppError("Solo se pueden confirmar borradores", { code: "NOT_DRAFT" });
    }

    if (input.paymentMethod === "CASH") {
      const openSession = await tx.cashSession.findFirst({
        where: { businessId: input.businessId, status: "OPEN" },
      });
      if (!openSession) {
        throw new AppError("No hay caja abierta para pago en efectivo", { code: "CASH_CLOSED" });
      }
    }

    const products = await tx.product.findMany({
      where: {
        businessId: input.businessId,
        id: { in: sale.items.map((i) => i.productId) },
        active: true,
      },
      include: {
        recipes: {
          where: { active: true },
          include: {
            items: {
              include: {
                ingredient: {
                  include: {
                    recipe: {
                      where: { active: true },
                      select: {
                        yieldQuantity: true,
                        items: {
                          include: {
                            ingredient: {
                              select: {
                                currentAverageCost: true,
                                recipe: {
                                  where: { active: true },
                                  select: {
                                    yieldQuantity: true,
                                    items: { include: { ingredient: { select: { currentAverageCost: true } } } },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          take: 1,
        },
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const warnings: string[] = [];

    for (const item of sale.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;

      const recipe = product.recipes[0];
      if (recipe) {
        const unitCost = calculateRecipeUnitCost(
          recipe.items.map((ri) => {
            const ingRecipe = ri.ingredient.recipe;
            return {
              quantity: ri.quantity.toString(),
              wastePercentage: ri.wastePercentage.toString(),
              averageCost: ri.ingredient.currentAverageCost.toString(),
              subRecipe: ingRecipe
                ? {
                    yieldQuantity: Number(ingRecipe.yieldQuantity),
                    items: ingRecipe.items.map((sri) => {
                      const srRecipe = sri.ingredient?.recipe;
                      return {
                        quantity: sri.quantity.toString(),
                        wastePercentage: sri.wastePercentage.toString(),
                        averageCost: sri.ingredient?.currentAverageCost?.toString() ?? "0",
                        subRecipe: srRecipe
                          ? { yieldQuantity: Number(srRecipe.yieldQuantity), items: srRecipe.items.map((dr) => ({ quantity: dr.quantity.toString(), wastePercentage: dr.wastePercentage.toString(), averageCost: dr.ingredient.currentAverageCost.toString() })) }
                          : undefined,
                      };
                    }),
                  }
                : undefined,
            };
          }),
          recipe.yieldQuantity.toString(),
        );

        await tx.saleItem.update({
          where: { id: item.id },
          data: { unitCostSnapshot: toFixedCost(unitCost) },
        });

        for (const ri of recipe.items) {
          if (ri.isNonInventoriable) continue;
          const delta = effectiveRecipeQty({
            quantity: ri.quantity,
            wastePercentage: ri.wastePercentage,
            yieldQuantity: recipe.yieldQuantity,
          }).mul(d(item.quantity));

          await tx.inventoryMovement.create({
            data: {
              businessId: input.businessId,
              ingredientId: ri.ingredientId,
              movementType: MovementType.SALE,
              quantityDelta: toFixedQty(delta.neg()),
              unitCost: toFixedCost(ri.ingredient.currentAverageCost),
              referenceType: "sale_item",
              referenceId: sale.id,
              reason: `Venta #${sale.saleNumber} — ${product.name}`,
              userId: input.userId,
            },
          });
        }
      } else {
        warnings.push(`${product.name} no tiene receta activa`);
      }
    }

    const lineInputs = sale.items.map((item) => {
      return {
        productId: item.productId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: 0,
      };
    });

    const business = await tx.business.findUniqueOrThrow({
      where: { id: input.businessId },
    });

    const totals = calculateSaleTotals(lineInputs, business.taxRate, 0);

    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.CONFIRMED,
        paymentMethod: input.paymentMethod,
        subtotal: toFixedMoney(totals.subtotal),
        discountTotal: toFixedMoney(totals.discountTotal),
        taxTotal: toFixedMoney(totals.taxTotal),
        total: toFixedMoney(totals.total),
        cashSessionId: input.paymentMethod === "CASH"
          ? (await tx.cashSession.findFirst({
              where: { businessId: input.businessId, status: "OPEN" },
              select: { id: true },
            }))?.id
          : null,
      },
    });

    return { sale: updated, warnings };
  });
}
