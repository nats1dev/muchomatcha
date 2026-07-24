import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export function d(value: Decimal.Value = 0): Decimal {
  return new Decimal(value ?? 0);
}

export function money(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function qty(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

export function cost(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function toNumber(value: Decimal.Value): number {
  return d(value).toNumber();
}

export function toFixedMoney(value: Decimal.Value): string {
  return money(value).toFixed(2);
}

export function toFixedQty(value: Decimal.Value): string {
  return qty(value).toFixed(3);
}

export function toFixedCost(value: Decimal.Value): string {
  return cost(value).toFixed(4);
}

/** Weighted average cost after an inbound receipt. Protects against negative stock distortion. */
export function weightedAverageCost(params: {
  previousQty: Decimal.Value;
  previousAvgCost: Decimal.Value;
  inboundQty: Decimal.Value;
  inboundUnitCost: Decimal.Value;
}): Decimal {
  const prevQty = d(params.previousQty);
  const inboundQty = d(params.inboundQty);
  const inboundCost = d(params.inboundUnitCost);

  if (inboundQty.lte(0)) return cost(params.previousAvgCost);

  if (prevQty.lte(0)) {
    return cost(inboundCost);
  }

  const prevValue = prevQty.mul(d(params.previousAvgCost));
  const inboundValue = inboundQty.mul(inboundCost);
  const newQty = prevQty.plus(inboundQty);
  if (newQty.lte(0)) return cost(inboundCost);
  return cost(prevValue.plus(inboundValue).div(newQty));
}

/** Effective ingredient quantity per product unit from recipe item. */
export function effectiveRecipeQty(params: {
  quantity: Decimal.Value;
  wastePercentage: Decimal.Value;
  yieldQuantity: Decimal.Value;
}): Decimal {
  const yieldQty = d(params.yieldQuantity);
  if (yieldQty.lte(0)) throw new Error("El rendimiento de la receta debe ser mayor a 0");
  const wasteFactor = d(1).plus(d(params.wastePercentage).div(100));
  return qty(d(params.quantity).mul(wasteFactor).div(yieldQty));
}
