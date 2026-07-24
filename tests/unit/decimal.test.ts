import { describe, expect, it } from "vitest";
import {
  calculateSaleTotals,
} from "../../src/modules/sales/totals";
import {
  calculateRecipeUnitCost,
} from "../../src/modules/recipes/cost";
import {
  weightedAverageCost,
  effectiveRecipeQty,
  d,
} from "../../src/lib/decimal";
import {
  calculateExpectedCash,
  calculateCashDifference,
} from "../../src/modules/cash/expected";

describe("sale totals (tax excluded from price)", () => {
  it("adds IVA after discount", () => {
    const result = calculateSaleTotals(
      [
        { quantity: 2, unitPrice: 25 },
        { quantity: 1, unitPrice: 30, discount: 5 },
      ],
      12,
    );
    // subtotal = 50 + 30 = 80; discount = 5; net = 75; tax = 9; total = 84
    expect(result.subtotal.toNumber()).toBe(80);
    expect(result.discountTotal.toNumber()).toBe(5);
    expect(result.netBeforeTax.toNumber()).toBe(75);
    expect(result.taxTotal.toNumber()).toBe(9);
    expect(result.total.toNumber()).toBe(84);
  });
});

describe("recipe cost", () => {
  it("includes waste and yield", () => {
    // 10g * 1.1 waste / yield 1 * cost 0.5 = 5.5
    const unit = calculateRecipeUnitCost(
      [{ quantity: 10, wastePercentage: 10, averageCost: 0.5 }],
      1,
    );
    expect(unit.toNumber()).toBe(5.5);
  });

  it("effective qty formula", () => {
    const q = effectiveRecipeQty({
      quantity: 20,
      wastePercentage: 5,
      yieldQuantity: 2,
    });
    expect(q.toNumber()).toBeCloseTo(10.5, 3);
  });
});

describe("weighted average cost", () => {
  it("blends previous and inbound", () => {
    const avg = weightedAverageCost({
      previousQty: 100,
      previousAvgCost: 2,
      inboundQty: 100,
      inboundUnitCost: 4,
    });
    expect(avg.toNumber()).toBe(3);
  });

  it("uses inbound cost when previous stock is non-positive", () => {
    const avg = weightedAverageCost({
      previousQty: -5,
      previousAvgCost: 2,
      inboundQty: 10,
      inboundUnitCost: 5,
    });
    expect(avg.toNumber()).toBe(5);
  });
});

describe("cash expected", () => {
  it("computes expected and difference", () => {
    const expected = calculateExpectedCash({
      openingAmount: 200,
      confirmedCashSales: 500,
      voidedCashSales: 0,
      incomes: 50,
      withdrawals: 100,
      cashExpenses: 30,
    });
    // 200 + 500 + 50 - 100 - 30 = 620
    expect(expected.toNumber()).toBe(620);
    expect(calculateCashDifference(610, expected).toNumber()).toBe(-10);
    expect(d(1).plus(1).toNumber()).toBe(2);
  });
});
