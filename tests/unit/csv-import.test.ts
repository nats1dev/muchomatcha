import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ROWS, parseImportCsv } from "@/lib/csv-import";
import { importFileSchema } from "@/app/actions/schemas";

const ING_HEADER = "name,sku,baseUnit,category,minStock,purchaseUnit,conversionFactor";
const PROD_HEADER = "name,sku,salePrice,category";

describe("parseImportCsv: detección de formato", () => {
  it("detecta ingredientes por la columna baseUnit", () => {
    const r = parseImportCsv(`${ING_HEADER}\nLeche,ING-L,g,Lácteos,100,l,1000`);
    expect(r.type).toBe("ingredients");
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });

  it("detecta productos por la columna salePrice", () => {
    const r = parseImportCsv(`${PROD_HEADER}\nLatte,LAT-01,25,Bebidas`);
    expect(r.type).toBe("products");
    expect(r.errors).toEqual([]);
  });

  it("rechaza un formato desconocido", () => {
    const r = parseImportCsv("a,b,c\n1,2,3");
    expect(r.rows).toHaveLength(0);
    expect(r.errors.join()).toMatch("formato válido");
  });

  it("exige encabezado y al menos una fila", () => {
    expect(parseImportCsv("").errors).toHaveLength(1);
    expect(parseImportCsv(ING_HEADER).rows).toHaveLength(0);
  });

  it("rechaza encabezados duplicados", () => {
    const r = parseImportCsv("name,sku,name\nA,B,C");
    expect(r.rows).toHaveLength(0);
    expect(r.errors.join()).toMatch("duplicado");
  });

  it("acepta delimitador punto y coma (Excel en español)", () => {
    const r = parseImportCsv("name;sku;salePrice\nLatte;LAT-01;25");
    expect(r.type).toBe("products");
    expect(r.rows).toHaveLength(1);
  });

  it("tolera el BOM de Excel UTF-8", () => {
    const r = parseImportCsv(`\uFEFF${PROD_HEADER}\nLatte,LAT-01,25,`);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it("aplica el tope de filas por archivo", () => {
    const lines = [ING_HEADER];
    for (let i = 0; i < MAX_IMPORT_ROWS + 1; i++) lines.push(`N${i},SKU-${i},g,,,`);
    const r = parseImportCsv(lines.join("\n"));
    expect(r.rows).toHaveLength(0);
    expect(r.errors.join()).toMatch(String(MAX_IMPORT_ROWS));
  });
});

describe("parseImportCsv: ingredientes", () => {
  it("normaliza el SKU a mayúsculas y conserva opcionales válidos", () => {
    const r = parseImportCsv(`${ING_HEADER}\nMatcha,mat-01,g,Tés,200,kg,1000`);
    expect(r.type).toBe("ingredients");
    if (r.type !== "ingredients") throw new Error("tipo");
    expect(r.rows[0].data.sku).toBe("MAT-01");
    expect(r.rows[0].data.minStock).toBe(200);
    expect(r.rows[0].line).toBe(2);
  });

  it("rechaza la fila con minStock negativo o no numérico (antes se ignoraba)", () => {
    for (const v of ["-5", "abc", "Infinity"]) {
      const r = parseImportCsv(`${ING_HEADER}\nMatcha,MAT-01,g,,${v},,`);
      expect(r.rows).toHaveLength(0);
      expect(r.errors.join()).toMatch("Fila 2");
    }
  });

  it("rechaza conversionFactor en cero (antes se ignoraba)", () => {
    const r = parseImportCsv(`${ING_HEADER}\nMatcha,MAT-01,g,,,kg,0`);
    expect(r.rows).toHaveLength(0);
    expect(r.errors.join()).toMatch("Fila 2");
  });

  it("rechaza purchaseUnit sin factor y factor sin unidad", () => {
    const a = parseImportCsv(`${ING_HEADER}\nMatcha,MAT-01,g,,,kg,`);
    const b = parseImportCsv(`${ING_HEADER}\nMatcha,MAT-01,g,,,,1000`);
    expect(a.rows).toHaveLength(0);
    expect(b.rows).toHaveLength(0);
    expect(a.errors.join()).toMatch("juntos");
  });

  it("rechaza textos que exceden la longitud de la UI", () => {
    const sku51 = "S".repeat(51);
    const r = parseImportCsv(`${ING_HEADER}\nN,${sku51},g,,,,`);
    expect(r.rows).toHaveLength(0);
    const cat101 = "C".repeat(101);
    const r2 = parseImportCsv(`${ING_HEADER}\nN,S-1,g,${cat101},,,`);
    expect(r2.rows).toHaveLength(0);
  });

  it("marca la segunda aparición de un SKU duplicado con ambas líneas", () => {
    const r = parseImportCsv(`${ING_HEADER}\nA,DUP-1,g,,,,\nB,DUP-1,g,,,,`);
    if (r.type !== "ingredients") throw new Error("tipo");
    expect(r.rows).toHaveLength(1);
    expect(r.errors.join()).toMatch('Fila 3');
    expect(r.errors.join()).toMatch('fila 2');
  });

  it("salta líneas vacías conservando el número real de línea", () => {
    const r = parseImportCsv(`${ING_HEADER}\n\nA,A-1,g,,,,\n`);
    if (r.type !== "ingredients") throw new Error("tipo");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].line).toBe(3);
  });

  it("reporta filas con columnas descuadradas", () => {
    const r = parseImportCsv(`${ING_HEADER}\nSolo,tres,columnas`);
    expect(r.rows).toHaveLength(0);
    expect(r.errors.join()).toMatch("descuadradas");
  });
});

describe("parseImportCsv: productos", () => {
  it("rechaza salePrice en cero, negativo, texto o infinito", () => {
    for (const v of ["0", "-1", "x", "Infinity", ""]) {
      const r = parseImportCsv(`${PROD_HEADER}\nLatte,LAT-01,${v},`);
      expect(r.rows).toHaveLength(0);
      expect(r.errors.join()).toMatch("Fila 2");
    }
  });

  it("rechaza nombre o SKU ausente", () => {
    const r = parseImportCsv(`${PROD_HEADER}\n,NO-SKU,10,`);
    expect(r.rows).toHaveLength(0);
  });
});

describe("importFileSchema", () => {
  it("rechaza archivo vacío, mayor a 2 MB o no .csv", () => {
    expect(() => importFileSchema.parse({ size: 0, name: "a.csv" })).toThrow();
    expect(() =>
      importFileSchema.parse({ size: 2 * 1024 * 1024 + 1, name: "a.csv" }),
    ).toThrow();
    expect(() => importFileSchema.parse({ size: 10, name: "a.txt" })).toThrow();
  });

  it("acepta un CSV dentro del límite", () => {
    expect(importFileSchema.parse({ size: 10, name: "PLANTILLA.CSV" }).size).toBe(10);
  });
});
