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
