import { describe, expect, it } from "vitest";
import {
  formatDisplayCost,
  formatDisplayMoney,
  formatDisplayQuantity,
  parseLocalizedNumber,
  type NumberDisplaySettings,
} from "../../src/lib/number-format";

const us: NumberDisplaySettings = { numberFormat: "US", moneyDecimals: 2, costDecimals: 4, quantityDecimals: 3 };
const eu: NumberDisplaySettings = { ...us, numberFormat: "EU" };

describe("formato numerico por negocio", () => {
  it("formatea ambos estilos y perfiles", () => {
    expect(formatDisplayMoney(1234.5, "GTQ", us)).toContain("1,234.50");
    expect(formatDisplayMoney(1234.5, "GTQ", eu)).toContain("1.234,50");
    expect(formatDisplayCost(12.3, "GTQ", us)).toContain("12.3000");
    expect(formatDisplayQuantity(1234.5678, eu)).toBe("1.234,568");
  });

  it("admite perfiles de 0 a 6 y la unidad prevalece", () => {
    expect(formatDisplayQuantity(12.6, { ...us, quantityDecimals: 0 })).toBe("13");
    expect(formatDisplayQuantity(1.2345678, us, 6)).toBe("1.234568");
    expect(formatDisplayQuantity(1.9, us, 0)).toBe("2");
  });

  it("parsea entradas localizadas estrictamente", () => {
    expect(parseLocalizedNumber("-1,234.50", "US")).toBe(-1234.5);
    expect(parseLocalizedNumber("+1.234,50", "EU")).toBe(1234.5);
    expect(parseLocalizedNumber("0", "US")).toBe(0);
  });

  it("rechaza agrupaciones ambiguas, NaN e infinitos", () => {
    for (const value of ["1,00.00", "1.00,00", "NaN", "Infinity", "", "1 000"]) {
      expect(parseLocalizedNumber(value, "EU")).toBeNull();
    }
    expect(parseLocalizedNumber("12,34.56", "US")).toBeNull();
  });
});
