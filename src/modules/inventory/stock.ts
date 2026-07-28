import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { d, qty, toFixedQty } from "@/lib/decimal";

type Tx = Prisma.TransactionClient | typeof prisma;

export async function getStockMap(
  businessId: string,
  ingredientIds?: string[],
  tx: Tx = prisma,
) {
  const grouped = await tx.inventoryMovement.groupBy({
    by: ["ingredientId"],
    where: {
      businessId,
      ...(ingredientIds?.length ? { ingredientId: { in: ingredientIds } } : {}),
    },
    _sum: { quantityDelta: true },
  });

  const map = new Map<string, ReturnType<typeof d>>();
  for (const row of grouped) {
    map.set(row.ingredientId, d(row._sum.quantityDelta ?? 0));
  }
  return map;
}

export async function getIngredientStock(
  businessId: string,
  ingredientId: string,
  tx: Tx = prisma,
) {
  const agg = await tx.inventoryMovement.aggregate({
    where: { businessId, ingredientId },
    _sum: { quantityDelta: true },
  });
  return qty(agg._sum.quantityDelta ?? 0);
}

export async function listCurrentInventory(businessId: string) {
  const ingredients = await prisma.ingredient.findMany({
    where: { businessId, active: true },
    include: {
      baseUnit: true,
      category: true,
      recipe: {
        where: { active: true },
        select: { id: true, version: true, yieldQuantity: true },
      },
      purchaseUnits: {
        where: { active: true },
        include: { unit: true },
      },
    },
    orderBy: { name: "asc" },
  });
  const stock = await getStockMap(
    businessId,
    ingredients.map((i) => i.id),
  );

  return ingredients.map((ing) => {
    const quantity = stock.get(ing.id) ?? d(0);
    const avg = d(ing.currentAverageCost);
    const value = quantity.mul(avg);
    const belowMin = quantity.lt(d(ing.minimumStock));
    return {
      id: ing.id,
      sku: ing.sku,
      name: ing.name,
      category: ing.category?.name ?? "Sin categoría",
      unit: ing.baseUnit.code,
      quantity: toFixedQty(quantity),
      quantityNum: quantity.toNumber(),
      minimumStock: toFixedQty(ing.minimumStock),
      averageCost: avg.toFixed(4),
      value: value.toFixed(2),
      belowMin,
      isManufactured: ing.recipeId !== null,
      recipeId: ing.recipeId,
      purchaseUnits: ing.purchaseUnits.map((pu) => ({
        unitCode: pu.unit.code,
        conversionFactor: Number(pu.conversionFactor),
      })),
    };
  });
}
