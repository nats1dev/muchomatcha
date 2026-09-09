import { describe, expect, it } from "vitest";
import {
  calculateRecipeLineCost,
  calculateRecipeUnitCost,
} from "../../src/modules/recipes/cost";
import { d } from "../../src/lib/decimal";

describe("costo por línea de receta (REQ-03)", () => {
  it("calcula lote y aporte con merma y rendimiento", () => {
    // lote: 10 × 1.10 × 0.5 = 5.5 ; aporte: 5.5 / 1 = 5.5
    const line = calculateRecipeLineCost({
      quantity: 10,
      wastePercentage: 10,
      averageCost: 0.5,
      yieldQuantity: 1,
    });
    expect(line.batchCost.toNumber()).toBe(5.5);
    expect(line.unitContribution.toNumber()).toBe(5.5);
  });

  it("divide el lote entre el rendimiento", () => {
    // lote: 20 × 1.05 × 2 = 42 ; aporte: 42 / 2 = 21
    const line = calculateRecipeLineCost({
      quantity: 20,
      wastePercentage: 5,
      averageCost: 2,
      yieldQuantity: 2,
    });
    expect(line.batchCost.toNumber()).toBe(42);
    expect(line.unitContribution.toNumber()).toBe(21);
  });

  it("costo cero da aporte cero (advertencia la muestra la UI)", () => {
    const line = calculateRecipeLineCost({
      quantity: 5,
      wastePercentage: 10,
      averageCost: 0,
      yieldQuantity: 2,
    });
    expect(line.batchCost.toNumber()).toBe(0);
    expect(line.unitContribution.toNumber()).toBe(0);
  });

  it("conserva decimales con Decimal (sin float)", () => {
    // lote: 0.333 × 1.025 × 1.2345 = 0.4213657125 → 0.4214
    // aporte: / 3 = 0.1404552375 → 0.1405
    const line = calculateRecipeLineCost({
      quantity: 0.333,
      wastePercentage: 2.5,
      averageCost: 1.2345,
      yieldQuantity: 3,
    });
    expect(line.batchCost.toNumber()).toBeCloseTo(0.4214, 4);
    expect(line.unitContribution.toNumber()).toBeCloseTo(0.1405, 4);
  });

  it("el lote equivale al aporte por el rendimiento", () => {
    const line = calculateRecipeLineCost({
      quantity: 4,
      wastePercentage: 25,
      averageCost: 1.5,
      yieldQuantity: 2,
    });
    // 4 × 1.25 × 1.5 = 7.5 ; 7.5 / 2 = 3.75
    expect(line.batchCost.toNumber()).toBe(7.5);
    expect(line.unitContribution.toNumber()).toBe(3.75);
  });

  it("lanza error con rendimiento no positivo", () => {
    expect(() =>
      calculateRecipeLineCost({
        quantity: 1,
        wastePercentage: 0,
        averageCost: 1,
        yieldQuantity: 0,
      }),
    ).toThrow();
  });
});

describe("suma de aportes vs costo unitario total (REQ-03)", () => {
  it("la suma de aportes coincide con calculateRecipeUnitCost", () => {
    const items = [
      { quantity: 10, wastePercentage: 10, averageCost: 0.5 },
      { quantity: 5, wastePercentage: 0, averageCost: 1.2 },
    ];
    const yieldQuantity = 2;

    const contributions = items.map(
      (i) =>
        calculateRecipeLineCost({ ...i, yieldQuantity }).unitContribution,
    );
    const sum = contributions
      .reduce((acc, c) => acc.plus(c), contributions[0].minus(contributions[0]))
      .toNumber();
    const total = calculateRecipeUnitCost(items, yieldQuantity).toNumber();

    // 2.75 + 3 = 5.75 exacto en este caso
    expect(sum).toBeCloseTo(5.75, 4);
    expect(total).toBeCloseTo(5.75, 4);
    expect(sum).toBeCloseTo(total, 4);
  });

  it("con decimales la diferencia no supera el redondeo de 4 decimales", () => {
    const items = [
      { quantity: 0.333, wastePercentage: 2.5, averageCost: 1.2345 },
      { quantity: 1.111, wastePercentage: 7.3, averageCost: 0.9876 },
    ];
    const yieldQuantity = 3;

    const sum = items
      .map(
        (i) => calculateRecipeLineCost({ ...i, yieldQuantity }).unitContribution,
      )
      .reduce((acc, c) => acc.plus(c))
      .toNumber();
    const total = calculateRecipeUnitCost(items, yieldQuantity).toNumber();

    expect(Math.abs(sum - total)).toBeLessThanOrEqual(0.0001 * items.length);
  });
});

describe("resumen de lote del subproducto (REQ-03)", () => {
  it("el lote equivale al unitario por el rendimiento", () => {
    // unitario: 10 × 1.10 × 0.5 / 2 = 2.75 ; lote: 2.75 × 2 = 5.5
    const items = [{ quantity: 10, wastePercentage: 10, averageCost: 0.5 }];
    const yieldQuantity = 2;
    const unit = calculateRecipeUnitCost(items, yieldQuantity);
    const batch = d(unit).mul(d(yieldQuantity));
    expect(unit.toNumber()).toBeCloseTo(2.75, 4);
    expect(batch.toNumber()).toBeCloseTo(5.5, 4);
  });

  it("el resumen conserva decimales sin float", () => {
    // unitario: 4 × 1.25 × 1.5 / 2 = 3.75 ; lote: 3.75 × 2 = 7.5
    const items = [{ quantity: 4, wastePercentage: 25, averageCost: 1.5 }];
    const yieldQuantity = 2;
    const unit = calculateRecipeUnitCost(items, yieldQuantity);
    const batch = d(unit).mul(d(yieldQuantity));
    expect(unit.toNumber()).toBeCloseTo(3.75, 4);
    expect(batch.toNumber()).toBeCloseTo(7.5, 4);
  });
});
