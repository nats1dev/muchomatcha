import { effectiveRecipeQty, d, cost, money } from "@/lib/decimal";

export type RecipeCostItem = {
  quantity: string | number;
  wastePercentage: string | number;
  averageCost: string | number;
};

export function calculateRecipeUnitCost(
  items: RecipeCostItem[],
  yieldQuantity: string | number = 1,
) {
  let total = d(0);
  for (const item of items) {
    const effective = effectiveRecipeQty({
      quantity: item.quantity,
      wastePercentage: item.wastePercentage,
      yieldQuantity,
    });
    total = total.plus(effective.mul(d(item.averageCost)));
  }
  return cost(total);
}

export function calculateLineCost(
  unitCost: string | number,
  quantity: string | number,
) {
  return money(d(unitCost).mul(d(quantity)));
}
