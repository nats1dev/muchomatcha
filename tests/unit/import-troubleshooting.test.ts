import { describe, expect, it } from "vitest";
import {
  IMPORT_ISSUE_CODES,
  troubleshoot,
  type ImportIssueCode,
} from "@/lib/import-troubleshooting";

describe("catálogo de troubleshooting (Fase B2)", () => {
  it("todo código tiene motivo y solución no vacíos", () => {
    expect(IMPORT_ISSUE_CODES.length).toBeGreaterThan(0);
    for (const code of IMPORT_ISSUE_CODES) {
      const t = troubleshoot(code);
      expect(t.reason.trim(), code).not.toBe("");
      expect(t.fix.trim(), code).not.toBe("");
    }
  });

  it("interpola parámetros y deja intactas las claves ausentes", () => {
    const t = troubleshoot("UNIT_NOT_FOUND", { detail: "kilo", valid: "g, kg" });
    expect(t.reason).toContain("kilo");
    expect(t.fix).toContain("g, kg");
    const partial = troubleshoot("UNIT_NOT_FOUND", { detail: "kilo" });
    expect(partial.fix).toContain("{valid}");
  });

  it("cubre los casos analizados en Fases A-C", () => {
    const required: ImportIssueCode[] = [
      "FILE_TOO_BIG",
      "UNKNOWN_FORMAT",
      "ROW_LIMIT",
      "ROW_INVALID",
      "DUP_IN_FILE",
      "MISMATCHED_PAIR",
      "UNIT_NOT_FOUND",
      "PURCHASE_UNIT_NOT_FOUND",
      "SKU_EXISTS",
      "CATEGORY_NEW",
      "SUPPLIER_EXISTS",
      "PRODUCT_NOT_FOUND",
      "INGREDIENT_NOT_FOUND",
      "ZERO_COST",
      "RECIPE_CYCLE",
      "HAS_STOCK",
      "RECIPE_UPDATED",
    ];
    for (const code of required) {
      expect(IMPORT_ISSUE_CODES, code).toContain(code);
    }
  });
});
