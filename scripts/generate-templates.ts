/**
 * Genera las plantillas de carga masiva (Fase A).
 *
 * Fuente única: este archivo define los headers exactos que espera
 * `src/lib/csv-import.ts` (hojas 01-02, importables hoy) y el formato
 * propuesto para las hojas 03-08 (03, 05, 06 y 07 importables desde Fase C;
 * 04 se carga vía 01 y 08 es solo referencia).
 *
 * Uso: `npx tsx scripts/generate-templates.ts`
 * Salida: `plantillas/plantillas-mucho-matcha.xlsx` + `plantillas/csv/*.csv`
 *
 * Los ejemplos están copiados de `prisma/seed.ts` (modo demo) para que
 * lo que ves en la plantilla exista igual en una base con seed.
 * Sincronizar unidades con `src/modules/catalog/service.ts:ensureDefaultUnits`.
 */

import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT_XLSX = join(ROOT, "plantillas", "plantillas-mucho-matcha.xlsx");
const OUT_CSV_DIR = join(ROOT, "plantillas", "csv");

// Unidades base aceptadas por el importador (`importer.ts` hace lookup por
// `code`; si no existe la fila se salta). No se crean desde el CSV.
const UNITS: Array<[string, string]> = [
  ["g", "Gramo"],
  ["kg", "Kilogramo"],
  ["ml", "Mililitro"],
  ["l", "Litro"],
  ["u", "Unidad"],
  ["pq", "Paquete"],
];
const UNIT_CODES = UNITS.map(([c]) => c).join(",");

// ---------------------------------------------------------------------------
// Datos de ejemplo (subset del seed demo)
// ---------------------------------------------------------------------------

const INGREDIENT_HEADERS = [
  "name",
  "sku",
  "baseUnit",
  "category",
  "minStock",
  "purchaseUnit",
  "conversionFactor",
] as const;

const INGREDIENT_ROWS: string[][] = [
  ["Leche entera", "ING-LECHE", "ml", "Lácteos", "5000", "l", "1000"],
  ["Leche vegetal", "ING-LECHEV", "ml", "Lácteos", "2000", "l", "1000"],
  ["Matcha ceremonial", "ING-MATCHA", "g", "Tés", "200", "kg", "1000"],
  ["Matcha culinario", "ING-MATCHAC", "g", "Tés", "300", "kg", "1000"],
  ["Café molido", "ING-CAFE", "g", "Tés", "1000", "kg", "1000"],
  ["Azúcar", "ING-AZUCAR", "g", "Endulzantes", "2000", "kg", "1000"],
  ["Miel", "ING-MIEL", "ml", "Endulzantes", "500", "l", "1000"],
  ["Hielo", "ING-HIELO", "g", "Otros", "5000", "kg", "1000"],
  ["Vaso 12oz", "ING-VASO12", "u", "Empaques", "100", "u", "1"],
  ["Fresas", "ING-FRESAS", "g", "Otros", "1000", "kg", "1000"],
];

const PRODUCT_HEADERS = ["name", "sku", "salePrice", "category"] as const;
const PRODUCT_ROWS: string[][] = [
  ["Matcha Latte", "BEB-001", "32", "Matcha"],
  ["Café Americano", "BEB-005", "18", "Bebidas"],
  ["Chai Latte", "BEB-008", "30", "Bebidas"],
  ["Croissant", "PAN-001", "15", "Panadería"],
  ["Sandwich jamón", "COM-001", "35", "Comida"],
];

const SUPPLIER_HEADERS = ["name", "taxId", "phone", "email"] as const;
const SUPPLIER_ROWS: string[][] = [
  ["Distribuidora Café GT", "1234567-8", "2222-1111", "distribuidora@prov.gt"],
  ["Lácteos del Valle", "2345678-9", "2222-2222", "lácteos@prov.gt"],
  ["Tés del Mundo", "3456789-0", "2222-3333", "tés@prov.gt"],
  ["Empaques Eco", "4567890-1", "2222-4444", "empaques@prov.gt"],
  ["Pan Artesanal", "5678901-2", "2222-5555", "pan@prov.gt"],
];

const SUBPRODUCT_HEADERS = [
  "name",
  "sku",
  "baseUnit",
  "category",
  "yieldQuantity",
  "notes",
] as const;
const SUBPRODUCT_ROWS: string[][] = [
  ["Jalea de Fresa", "SUB-JALEA", "g", "Otros", "1000", "Receta base para jalea de fresa artesanal"],
];

const RECIPE_PRODUCT_HEADERS = [
  "productSku",
  "ingredientSku",
  "quantity",
  "wastePercentage",
  "nonInventoriable",
  "yieldQuantity",
  "notes",
] as const;
const RECIPE_PRODUCT_ROWS: string[][] = [
  ["BEB-001", "ING-MATCHA", "3", "5", "", "1", "Menú base"],
  ["BEB-001", "ING-LECHE", "250", "0", "", "1", "Menú base"],
  ["BEB-001", "ING-VASO12", "1", "0", "", "1", "Menú base"],
  ["BEB-001", "ING-TAPA", "1", "0", "", "1", "Menú base"],
  ["BEB-013", "ING-MATCHA", "3", "5", "", "1", ""],
  ["BEB-013", "ING-LECHE", "250", "0", "", "1", ""],
  ["BEB-013", "ING-HIELO", "120", "0", "", "1", ""],
  ["BEB-013", "ING-AGUA", "50", "0", "", "1", ""],
  ["BEB-013", "SUB-JALEA", "40", "0", "", "1", ""],
  ["BEB-013", "ING-VASO16", "1", "0", "", "1", ""],
  ["BEB-013", "ING-PAJILLA", "1", "0", "", "1", ""],
];

const RECIPE_SUBPRODUCT_HEADERS = [
  "subproductSku",
  "ingredientSku",
  "quantity",
  "wastePercentage",
  "nonInventoriable",
  "yieldQuantity",
  "notes",
] as const;
const RECIPE_SUBPRODUCT_ROWS: string[][] = [
  ["SUB-JALEA", "ING-FRESAS", "600", "5", "", "1000", ""],
  ["SUB-JALEA", "ING-AZUCAR", "300", "0", "", "1000", ""],
  ["SUB-JALEA", "ING-AGUA", "100", "0", "", "1000", ""],
  ["SUB-JALEA", "ING-GAS", "0.1", "0", "", "1000", ""],
];

const INVENTORY_HEADERS = ["ingredientSku", "quantity", "unitCost"] as const;
const INVENTORY_ROWS: string[][] = [
  ["ING-MATCHA", "1000", "0.45"],
  ["ING-LECHE", "40000", "0.012"],
  ["ING-CAFE", "5000", "0.08"],
  ["ING-AZUCAR", "5000", "0.01"],
  ["ING-VASO12", "500", "0.5"],
];

const PURCHASE_HEADERS = [
  "supplierName",
  "documentNumber",
  "ingredientSku",
  "purchaseUnit",
  "purchaseQuantity",
  "unitPrice",
] as const;
const PURCHASE_ROWS: string[][] = [
  ["Distribuidora Café GT", "FAC-1000", "ING-MATCHA", "kg", "1", "450"],
  ["Lácteos del Valle", "FAC-1001", "ING-LECHE", "l", "40", "12"],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(cell: string): string {
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function toCsv(headers: readonly string[], rows: string[][]): string {
  const lines = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  return `\uFEFF${lines.join("\n")}\n`;
}

function styleHeader(ws: ExcelJS.Worksheet, cols: number, future: boolean): void {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: future ? "FF808080" : "FF1F7A3D" },
  };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  if (cols > 0) {
    const lastCol = ws.getColumn(cols).letter;
    ws.autoFilter = { from: `A1`, to: `${lastCol}1` };
  }
}

function addTable(
  ws: ExcelJS.Worksheet,
  headers: readonly string[],
  rows: string[][],
  widths: number[],
): void {
  ws.addRow([...headers]);
  for (const r of rows) ws.addRow([...r]);
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = widths[i] ?? 18;
  });
}

function note(cell: ExcelJS.Cell, text: string): void {
  cell.note = text;
}

function applyValidation(
  ws: ExcelJS.Worksheet,
  col: string,
  fromRow: number,
  toRow: number,
  validation: ExcelJS.DataValidation,
): void {
  for (let r = fromRow; r <= toRow; r++) {
    ws.getCell(`${col}${r}`).dataValidation = { ...validation };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  mkdirSync(OUT_CSV_DIR, { recursive: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mucho Matcha";
  wb.created = new Date();

  // LEEME ---------------------------------------------------------------
  const leeme = wb.addWorksheet("LEEME");
  leeme.getColumn(1).width = 110;
  const leemeLines = [
    "PLANTILLAS DE CARGA MASIVA — Mucho Matcha (Fases A-C)",
    "",
    "ORDEN DE CARGA (por dependencias): 01 Ingredientes → 02 Productos →",
    "03 Proveedores → 07 Inventario inicial → 06 Recetas de subproductos →",
    "05 Recetas de productos. (04 Subproductos se crea como ingrediente en 01;",
    "08 Compras es solo referencia: las compras van en la interfaz.)",
    "",
    "CÓMO EXPORTAR DESDE EXCEL (importante en Excel en español):",
    "1. Completa la hoja. 2. En cada hoja: Archivo > Guardar como >",
    "'CSV UTF-8 (delimitado por comas)'. 3. Verifica: delimitador COMA o punto y",
    "coma (ambos se detectan), decimales con PUNTO (32.50, no 32,50), sin",
    "separador de miles, primera fila = headers exactos en inglés. 4. En",
    "/productos o /setup pulsa Importar CSV con rol ADMIN: verás una revisión",
    "con motivo y solución por cada problema; confirma u omite, o cancela todo.",
    "5. Repetir un archivo da errores de duplicado: el importador solo CREA,",
    "nunca actualiza (proveedores e inventario omiten duplicados; recetas crean",
    "nueva versión).",
    "",
    "REGLAS RÁPIDAS: sku siempre en MAYÚSCULAS. baseUnit/purchaseUnit deben existir en el negocio",
    `(códigos válidos: ${UNIT_CODES}). category se crea/reutiliza sola (insensible a`,
    "mayúsculas). minStock >= 0, conversionFactor > 0, salePrice > 0. wastePercentage es",
    "entero 0-20. Cantidades > 0, importes >= 0, nunca uses coma decimal.",
    "nonInventoriable acepta SI/NO/1/0/TRUE/FALSE (vacío = No).",
  ];
  for (const line of leemeLines) leeme.addRow([line]);
  leeme.getCell("A1").font = { bold: true, size: 14 };

  // Unidades (referencia) ------------------------------------------------
  const wsUnits = wb.addWorksheet("Unidades");
  addTable(wsUnits, ["code", "name"], UNITS.map(([c, n]) => [c, n]), [14, 22]);
  styleHeader(wsUnits, 2, true);
  note(wsUnits.getCell("A1"), "Código exacto a usar en baseUnit/purchaseUnit. Si no existe, la fila se salta.");

  // 01 Ingredientes (importable) ------------------------------------------
  const wsIng = wb.addWorksheet("01-Ingredientes");
  addTable(wsIng, INGREDIENT_HEADERS, INGREDIENT_ROWS, [22, 14, 12, 16, 12, 14, 18]);
  styleHeader(wsIng, INGREDIENT_HEADERS.length, false);
  note(wsIng.getCell("A1"), "Obligatorio.");
  note(wsIng.getCell("B1"), "Obligatorio, se guarda en MAYÚSCULAS. Único por negocio.");
  note(wsIng.getCell("C1"), `Obligatorio. Debe existir. Válidos: ${UNIT_CODES}.`);
  note(wsIng.getCell("D1"), "Opcional. Se crea sola la primera vez.");
  note(wsIng.getCell("E1"), "Opcional. Número >= 0. Si es inválido se ignora en silencio.");
  note(wsIng.getCell("F1"), "Opcional, solo junto con conversionFactor.");
  note(wsIng.getCell("G1"), "Opcional, número > 0. Ej: 1 kg = 1000 g.");
  applyValidation(wsIng, "C", 2, 500, {
    type: "list",
    formulae: [`"${UNIT_CODES}"`],
    showErrorMessage: true,
    errorTitle: "Unidad inválida",
    error: `Usa uno de: ${UNIT_CODES}`,
  });
  applyValidation(wsIng, "F", 2, 500, {
    type: "list",
    formulae: [`"${UNIT_CODES}"`],
    showErrorMessage: true,
    errorTitle: "Unidad inválida",
    error: `Usa uno de: ${UNIT_CODES}`,
  });
  applyValidation(wsIng, "E", 2, 500, {
    type: "decimal",
    operator: "greaterThanOrEqual",
    formulae: [0],
    showErrorMessage: true,
    errorTitle: "minStock",
    error: "Debe ser un número >= 0.",
  });
  applyValidation(wsIng, "G", 2, 500, {
    type: "decimal",
    operator: "greaterThan",
    formulae: [0],
    showErrorMessage: true,
    errorTitle: "conversionFactor",
    error: "Debe ser un número > 0. Ej: 1000.",
  });

  // 02 Productos (importable) ----------------------------------------------
  const wsProd = wb.addWorksheet("02-Productos");
  addTable(wsProd, PRODUCT_HEADERS, PRODUCT_ROWS, [24, 14, 14, 16]);
  styleHeader(wsProd, PRODUCT_HEADERS.length, false);
  note(wsProd.getCell("C1"), "Obligatorio, número > 0 con punto decimal. Precio sin IVA (se cobra al vender).");
  applyValidation(wsProd, "C", 2, 500, {
    type: "decimal",
    operator: "greaterThan",
    formulae: [0],
    showErrorMessage: true,
    errorTitle: "salePrice",
    error: "Debe ser un número > 0. Usa punto decimal.",
  });

  // Hojas con banner (03, 05, 06 y 07 importables desde Fase C) --------------
  const future = (
    name: string,
    headers: readonly string[],
    rows: string[][],
    widths: number[],
    banner: string,
  ): ExcelJS.Worksheet => {
    const ws = wb.addWorksheet(name);
    ws.addRow([banner]);
    ws.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB00020" } };
    ws.addRow([]);
    addTable(ws, headers, rows, widths);
    styleHeader(ws, 0, true);
    // Reaplica estilo al header real (fila 3) porque styleHeader tocó la fila 1.
    const hr = ws.getRow(3);
    hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF808080" } };
    ws.views = [{ state: "frozen", ySplit: 3 }];
    const lastCol = ws.getColumn(headers.length).letter;
    ws.autoFilter = { from: `A3`, to: `${lastCol}3` };
    return ws;
  };

  future(
    "03-Proveedores",
    SUPPLIER_HEADERS,
    SUPPLIER_ROWS,
    [26, 14, 14, 28],
    "name, taxId, phone, email. El proveedor duplicado se omite con aviso.",
  );
  future(
    "04-Subproductos-FUTURO",
    SUBPRODUCT_HEADERS,
    SUBPRODUCT_ROWS,
    [22, 14, 12, 16, 16, 40],
    "FUTURO — crea el subproducto como ingrediente (hoja 01); su receta se carga en la hoja 06.",
  );
  const wsR5 = future(
    "05-Recetas-Productos",
    RECIPE_PRODUCT_HEADERS,
    RECIPE_PRODUCT_ROWS,
    [14, 15, 12, 17, 16, 15, 24],
    "Una fila por línea de receta; el grupo con igual productSku es una receta. Reimportar crea nueva versión.",
  );
  const wsR6 = future(
    "06-Recetas-Subproductos",
    RECIPE_SUBPRODUCT_HEADERS,
    RECIPE_SUBPRODUCT_ROWS,
    [16, 15, 12, 17, 16, 15, 24],
    "Respeta: un subproducto no usa otro subproducto (DEC-10). Requiere costos cargados (hoja 07).",
  );
  // Validaciones de recetas sobre el rango de datos (filas 4-500, header en 3).
  for (const ws of [wsR5, wsR6]) {
    applyValidation(ws, "C", 4, 500, {
      type: "decimal",
      operator: "greaterThan",
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "quantity",
      error: "Debe ser un número > 0.",
    });
    applyValidation(ws, "D", 4, 500, {
      type: "whole",
      operator: "between",
      formulae: [0, 20],
      showErrorMessage: true,
      errorTitle: "wastePercentage",
      error: "Entero 0-20 (0% = sin merma).",
    });
    applyValidation(ws, "F", 4, 500, {
      type: "decimal",
      operator: "greaterThan",
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "yieldQuantity",
      error: "Debe ser un número > 0. Ej: 1 bebida, 1000 g de jalea.",
    });
  }
  future(
    "07-Inventario-Inicial",
    INVENTORY_HEADERS,
    INVENTORY_ROWS,
    [16, 14, 14],
    "Carga fundacional: lo ya existente se omite (nunca suma en silencio).",
  );
  future(
    "08-Compras-FUTURO",
    PURCHASE_HEADERS,
    PURCHASE_ROWS,
    [24, 16, 16, 14, 18, 14],
    "FUTURO / referencia — las compras se registran en la UI (promedio ponderado).",
  );

  await wb.xlsx.writeFile(OUT_XLSX);

  // CSVs espejo --------------------------------------------------------------
  const csvFiles: Array<[string, readonly string[], string[][]]> = [
    ["01-ingredientes.csv", INGREDIENT_HEADERS, INGREDIENT_ROWS],
    ["02-productos.csv", PRODUCT_HEADERS, PRODUCT_ROWS],
    ["03-proveedores.csv", SUPPLIER_HEADERS, SUPPLIER_ROWS],
    ["04-subproductos.csv", SUBPRODUCT_HEADERS, SUBPRODUCT_ROWS],
    ["05-recetas-productos.csv", RECIPE_PRODUCT_HEADERS, RECIPE_PRODUCT_ROWS],
    ["06-recetas-subproductos.csv", RECIPE_SUBPRODUCT_HEADERS, RECIPE_SUBPRODUCT_ROWS],
    ["07-inventario-inicial.csv", INVENTORY_HEADERS, INVENTORY_ROWS],
    ["08-compras-ejemplo.csv", PURCHASE_HEADERS, PURCHASE_ROWS],
  ];
  for (const [file, headers, rows] of csvFiles) {
    writeFileSync(join(OUT_CSV_DIR, file), toCsv(headers, rows), "utf8");
  }

  console.log(`OK: ${OUT_XLSX} + ${csvFiles.length} CSVs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
