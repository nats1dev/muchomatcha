import { describe, expect, it } from "vitest";
import { groupRecipeLines, parseImportCsv } from "@/lib/csv-import";

const REC_HEAD = "productSku,ingredientSku,quantity,wastePercentage,nonInventoriable,yieldQuantity,notes";
const SUB_HEAD = "subproductSku,ingredientSku,quantity,wastePercentage,nonInventoriable,yieldQuantity,notes";
const SUP_HEAD = "name,taxId,phone,email";
const INV_HEAD = "ingredientSku,quantity,unitCost";

function codes(r: { issues: Array<{ code: string }> }): string[] {
  return r.issues.map((i) => i.code);
}

describe("parseImportCsv: detección Fase C", () => {
  it("detecta recetas de producto y subproducto", () => {
    expect(parseImportCsv(`${REC_HEAD}\nBEB-001,ING-X,1,0,,1,`).type).toBe("productRecipes");
    expect(parseImportCsv(`${SUB_HEAD}\nSUB-1,ING-X,1,0,,1,`).type).toBe("subproductRecipes");
  });

  it("detecta proveedores e inventario", () => {
    expect(parseImportCsv(`${SUP_HEAD}\nAcme,123,5555,a@b.gt`).type).toBe("suppliers");
    expect(parseImportCsv(`${INV_HEAD}\nING-X,10,0.5`).type).toBe("inventory");
  });

  it("la receta tiene precedencia sobre columnas de catálogo", () => {
    const r = parseImportCsv("productSku,salePrice,ingredientSku,quantity\nBEB-001,10,ING-X,1");
    expect(r.type).toBe("productRecipes");
  });

  it("un archivo solo con nombre no es formato válido (guía a plantillas)", () => {
    const r = parseImportCsv("name\nSolo nombre");
    expect(r.rows).toHaveLength(0);
    expect(codes(r)).toContain("UNKNOWN_FORMAT");
  });
});

describe("groupRecipeLines", () => {
  const line = (targetSku: string, ingredientSku: string, extra: Record<string, unknown> = {}) => ({
    line: 2,
    data: {
      targetSku,
      ingredientSku,
      quantity: 1,
      wastePercentage: 0,
      nonInventoriable: undefined,
      yieldQuantity: 1,
      notes: undefined,
      ...extra,
    },
  });

  it("agrupa por target conservando orden y primera línea", () => {
    const r = parseImportCsv(`${REC_HEAD}\nBEB-001,ING-A,1,0,,1,\nBEB-002,ING-B,2,0,,1,\nBEB-001,ING-C,3,0,,1,`);
    if (r.type !== "productRecipes") throw new Error("tipo");
    const g = groupRecipeLines(r.rows);
    expect(g.issues).toHaveLength(0);
    expect(g.groups.map((x) => [x.targetSku, x.lines.length])).toEqual([
      ["BEB-001", 2],
      ["BEB-002", 1],
    ]);
    expect(g.groups[0].firstLine).toBe(2);
  });

  it("rechaza yield o notes inconsistentes en el grupo", () => {
    const y = parseImportCsv(`${REC_HEAD}\nBEB-001,ING-A,1,0,,1,\nBEB-001,ING-B,1,0,,2,`);
    if (y.type !== "productRecipes") throw new Error("tipo");
    expect(codes(groupRecipeLines(y.rows))).toContain("GROUP_CONFLICT");
    const n = parseImportCsv(`${REC_HEAD}\nBEB-001,ING-A,1,0,,1,X\nBEB-001,ING-B,1,0,,1,Y`);
    if (n.type !== "productRecipes") throw new Error("tipo");
    expect(codes(groupRecipeLines(n.rows))).toContain("GROUP_CONFLICT");
  });

  it("rechaza insumo repetido y auto-referencia en el grupo", () => {
    const d = parseImportCsv(`${REC_HEAD}\nBEB-001,ING-A,1,0,,1,\nBEB-001,ING-A,2,0,,1,`);
    if (d.type !== "productRecipes") throw new Error("tipo");
    expect(codes(groupRecipeLines(d.rows))).toContain("DUP_IN_FILE");
    const s = parseImportCsv(`${SUB_HEAD}\nSUB-1,SUB-1,1,0,,1,`);
    if (s.type !== "subproductRecipes") throw new Error("tipo");
    expect(codes(groupRecipeLines(s.rows))).toContain("RECIPE_CYCLE");
  });

  it("rechaza grupos de más de 200 líneas", () => {
    const lines = ["productSku,ingredientSku,quantity"];
    for (let i = 0; i < 201; i++) lines.push(`BEB-001,ING-${i},1`);
    const r = parseImportCsv(lines.join("\n"));
    if (r.type !== "productRecipes") throw new Error("tipo");
    const g = groupRecipeLines(r.rows);
    expect(g.groups[0].lines).toHaveLength(200);
    expect(codes(g)).toContain("ROW_INVALID");
  });

  it("normaliza nonInventoriable ES/EN y rechaza valores raros", () => {
    const cases: Array<[string, boolean | undefined]> = [
      ["SI", true],
      ["no", false],
      ["1", true],
      ["0", false],
      ["TRUE", true],
      ["", undefined],
    ];
    for (const [v, expected] of cases) {
      const r = parseImportCsv(`${REC_HEAD}\nBEB-001,ING-A,1,0,${v},1,`);
      if (r.type !== "productRecipes") throw new Error("tipo " + v);
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].data.nonInventoriable, v).toBe(expected);
    }
    const bad = parseImportCsv(`${REC_HEAD}\nBEB-001,ING-A,1,0,quizas,1,`);
    expect(bad.rows).toHaveLength(0);
  });

  it("rechaza merma no entera o mayor a 20", () => {
    for (const w of ["21", "2.5"]) {
      const r = parseImportCsv(`${REC_HEAD}\nBEB-001,ING-A,1,${w},,1,`);
      expect(r.rows).toHaveLength(0);
    }
  });

  it("exige columnas de receta", () => {
    const r = parseImportCsv("productSku,ingredientSku\nBEB-001,ING-A");
    expect(r.rows).toHaveLength(0);
    expect(codes(r)).toContain("MISSING_COLUMNS");
  });

  it("helper directo: respeta tope y orden", () => {
    const g = groupRecipeLines([line("B-1", "I-1"), line("B-1", "I-2")]);
    expect(g.groups).toHaveLength(1);
    expect(g.groups[0].lines).toHaveLength(2);
  });
});

describe("parseImportCsv: proveedores e inventario", () => {
  it("acepta proveedor válido y email opcional", () => {
    const r = parseImportCsv(`${SUP_HEAD}\nAcme,123,5555,a@b.gt\nOtro,,,`);
    expect(r.type).toBe("suppliers");
    if (r.type !== "suppliers") throw new Error("tipo");
    expect(r.rows).toHaveLength(2);
  });

  it("rechaza nombre ausente y textos largos", () => {
    expect(parseImportCsv(`${SUP_HEAD}\n,123,,`).rows).toHaveLength(0);
    const long = parseImportCsv(`${SUP_HEAD}\n${"N".repeat(151)},,,`);
    expect(long.rows).toHaveLength(0);
  });

  it("detecta proveedor repetido sin importar capitalización", () => {
    const r = parseImportCsv(`${SUP_HEAD}\nAcme,,,\nACME,,,`);
    if (r.type !== "suppliers") throw new Error("tipo");
    expect(r.rows).toHaveLength(1);
    expect(codes(r)).toContain("DUP_IN_FILE");
  });

  it("acepta inventario con costo cero y rechaza cantidad cero o costo negativo", () => {
    const ok = parseImportCsv(`${INV_HEAD}\nING-X,10,0`);
    expect(ok.rows).toHaveLength(1);
    expect(parseImportCsv(`${INV_HEAD}\nING-X,0,1`).rows).toHaveLength(0);
    expect(parseImportCsv(`${INV_HEAD}\nING-X,10,-1`).rows).toHaveLength(0);
  });

  it("detecta SKU duplicado en inventario y exige columnas", () => {
    const r = parseImportCsv(`${INV_HEAD}\nING-X,10,1\nING-X,5,1`);
    if (r.type !== "inventory") throw new Error("tipo");
    expect(r.rows).toHaveLength(1);
    expect(codes(r)).toContain("DUP_IN_FILE");
    const m = parseImportCsv("ingredientSku,unitCost\nING-X,1");
    expect(codes(m)).toContain("MISSING_COLUMNS");
  });
});
