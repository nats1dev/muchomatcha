import { effectiveRecipeQty, d, cost, money } from "@/lib/decimal";

export type RecipeCostItem = {
  quantity: string | number;
  wastePercentage: string | number;
  averageCost: string | number;
  subRecipe?: {
    items: RecipeCostItem[];
    yieldQuantity: number;
  };
};

export type RecipeLineCostInput = {
  quantity: string | number;
  wastePercentage: string | number;
  averageCost: string | number;
  yieldQuantity?: string | number;
};

export type RecipeLineCost = {
  /** Costo del lote para esta línea: cantidad × (1 + merma/100) × costo promedio. */
  batchCost: ReturnType<typeof cost>;
  /** Aporte al costo de una unidad producida: batchCost / rendimiento. */
  unitContribution: ReturnType<typeof cost>;
};

/**
 * Costo de una línea de receta con Decimal (REQ-03).
 * Incluye merma y rendimiento. No redondea pasos intermedios:
 * cada salida se redondea una sola vez con `cost` (4 decimales).
 */
export function calculateRecipeLineCost({
  quantity,
  wastePercentage,
  averageCost,
  yieldQuantity = 1,
}: RecipeLineCostInput): RecipeLineCost {
  const yieldQty = d(yieldQuantity);
  if (yieldQty.lte(0)) {
    throw new Error("El rendimiento de la receta debe ser mayor a 0");
  }
  const wasteFactor = d(1).plus(d(wastePercentage).div(100));
  const batchCost = d(quantity).mul(wasteFactor).mul(d(averageCost));
  const unitContribution = batchCost.div(yieldQty);
  return {
    batchCost: cost(batchCost),
    unitContribution: cost(unitContribution),
  };
}

export function calculateRecipeUnitCost(
  items: RecipeCostItem[],
  yieldQuantity: string | number = 1,
  maxDepth: number = 3,
) {
  let total = d(0);
  for (const item of items) {
    let avgCost = d(item.averageCost);

    if (item.subRecipe && maxDepth > 0) {
      const subUnitCost = calculateRecipeUnitCost(
        item.subRecipe.items,
        item.subRecipe.yieldQuantity,
        maxDepth - 1,
      );
      avgCost = subUnitCost;
    }

    // Fuente autoritativa del total (REQ-03): misma fórmula que
    // calculateRecipeLineCost —cantidad × (1 + merma/100) × costo / rendimiento—,
    // sumada en exacto y redondeada una sola vez con `cost`.
    // La suma de los `unitContribution` redondeados por línea coincide con
    // este total salvo ±0.00005 por línea (redondeo de 4 decimales).
    const effective = effectiveRecipeQty({
      quantity: item.quantity,
      wastePercentage: item.wastePercentage,
      yieldQuantity,
    });
    total = total.plus(effective.mul(avgCost));
  }
  return cost(total);
}

export function calculateLineCost(
  unitCost: string | number,
  quantity: string | number,
) {
  return money(d(unitCost).mul(d(quantity)));
}
