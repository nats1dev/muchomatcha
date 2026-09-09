import Papa from "papaparse";
import type { z } from "zod";
import {
  importIngredientRowSchema,
  importInventoryRowSchema,
  importProductRowSchema,
  importRecipeLineSchema,
  importSupplierRowSchema,
} from "@/app/actions/schemas";
import type { ImportIssueCode } from "@/lib/import-troubleshooting";

export type IngredientRow = z.infer<typeof importIngredientRowSchema>;
export type ProductRow = z.infer<typeof importProductRowSchema>;
export type RecipeLineRow = z.infer<typeof importRecipeLineSchema>;
export type SupplierRow = z.infer<typeof importSupplierRowSchema>;
export type InventoryRow = z.infer<typeof importInventoryRowSchema>;

export type ImportedRow<T> = { line: number; data: T };

/** Error estructurado para el reporte preview (los `errors` string se mantienen). */
export type ParserIssue = {
  line: number | null;
  code: ImportIssueCode;
  detail: string;
  column?: string;
};

export type ImportResult =
  | { type: "ingredients"; rows: ImportedRow<IngredientRow>[]; errors: string[]; issues: ParserIssue[] }
  | { type: "products"; rows: ImportedRow<ProductRow>[]; errors: string[]; issues: ParserIssue[] }
  | { type: "productRecipes"; rows: ImportedRow<RecipeLineRow>[]; errors: string[]; issues: ParserIssue[] }
  | { type: "subproductRecipes"; rows: ImportedRow<RecipeLineRow>[]; errors: string[]; issues: ParserIssue[] }
  | { type: "suppliers"; rows: ImportedRow<SupplierRow>[]; errors: string[]; issues: ParserIssue[] }
  | { type: "inventory"; rows: ImportedRow<InventoryRow>[]; errors: string[]; issues: ParserIssue[] };

/** Tope de filas de datos por archivo (DEC-18: documentos acotados). */
export const MAX_IMPORT_ROWS = 500;

/** Tope de líneas por receta (espejo de `itemList`, `schemas.ts`). */
export const MAX_RECIPE_LINES = 200;

function isBlankRow(cells: string[]): boolean {
  return cells.every((c) => (c ?? "").trim() === "");
}

export function parseImportCsv(content: string): ImportResult {
  // Sin BOM (Excel lo antepone en "CSV UTF-8") y con autodetección de
  // delimitador: Excel en español exporta con `;`, no con `,`.
  const normalized = content.replace(/^\uFEFF/, "").trim();
  const parsed = Papa.parse<string[]>(normalized, {
    skipEmptyLines: false,
    delimitersToGuess: [",", ";", "\t"],
  });

  const rawLines = parsed.data.filter((r) => !isBlankRow(r));
  if (rawLines.length < 2) {
    return {
      type: "ingredients",
      rows: [],
      errors: ["El CSV necesita al menos un encabezado y una fila"],
      issues: [{ line: null, code: "NEEDS_ROWS", detail: "" }],
    };
  }

  const headers = rawLines[0].map((h) => (h ?? "").trim().toLowerCase());

  const seenHeader = new Set<string>();
  for (const h of headers) {
    if (seenHeader.has(h)) {
      return {
        type: "ingredients",
        rows: [],
        errors: [`Encabezado duplicado: "${h}"`],
        issues: [{ line: null, code: "DUP_HEADER", detail: h }],
      };
    }
    seenHeader.add(h);
  }

  // Líneas con su número real (cabecera = 1); las vacías se saltan en silencio.
  const body: Array<{ line: number; cells: string[] }> = [];
  for (let i = 1; i < parsed.data.length; i++) {
    if (isBlankRow(parsed.data[i])) continue;
    body.push({ line: i + 1, cells: parsed.data[i] });
  }

  if (body.length > MAX_IMPORT_ROWS) {
    return {
      type: "ingredients",
      rows: [],
      errors: [`Máximo ${MAX_IMPORT_ROWS} filas por archivo (recibidas ${body.length})`],
      issues: [{ line: null, code: "ROW_LIMIT", detail: String(body.length) }],
    };
  }

  if (headers.includes("subproductsku")) {
    return parseRecipeLines(headers, body, "subproductsku", "subproductRecipes");
  }
  if (headers.includes("productsku")) {
    return parseRecipeLines(headers, body, "productsku", "productRecipes");
  }
  if (headers.includes("saleprice")) {
    return parseProductRows(headers, body);
  }
  if (headers.includes("baseunit")) {
    return parseIngredientRows(headers, body);
  }
  if (headers.includes("unitcost")) {
    return parseInventoryRows(headers, body);
  }
  if (headers.includes("taxid") || headers.includes("phone") || headers.includes("email")) {
    return parseSupplierRows(headers, body);
  }

  return {
    type: "ingredients",
    rows: [],
    errors: ["No se detectó formato válido. Usa una plantilla de plantillas/: ingredientes (baseUnit), productos (salePrice), recetas (productSku/subproductSku), inventario (unitCost) o proveedores (taxId/phone/email)"],
    issues: [{ line: null, code: "UNKNOWN_FORMAT", detail: "" }],
  };
}

type BodyLine = { line: number; cells: string[] };

function cell(cells: string[], idx: number): string {
  return idx >= 0 ? (cells[idx] ?? "").trim() : "";
}

/** Clasifica un fallo Zod para el reporte (el par purchaseUnit/factor tiene guía propia). */
function zodIssue(line: number, err: z.ZodError): ParserIssue {
  const first = err.issues[0];
  const message = first?.message ?? "datos inválidos";
  if (first && first.code === "custom") {
    return { line, code: "MISMATCHED_PAIR", detail: message };
  }
  const column = first && first.path.length > 0 ? String(first.path[0]) : "";
  return { line, code: "ROW_INVALID", detail: message, column };
}

function parseIngredientRows(headers: string[], body: BodyLine[]) {
  const nameIdx = headers.indexOf("name");
  const skuIdx = headers.indexOf("sku");
  const baseUnitIdx = headers.indexOf("baseunit");
  const catIdx = headers.indexOf("category");
  const minIdx = headers.indexOf("minstock");
  const puIdx = headers.indexOf("purchaseunit");
  const cfIdx = headers.indexOf("conversionfactor");

  if (nameIdx === -1 || skuIdx === -1 || baseUnitIdx === -1) {
    return {
      type: "ingredients" as const,
      rows: [],
      errors: ["Columnas requeridas: name, sku, baseUnit"],
      issues: [{ line: null, code: "MISSING_COLUMNS" as const, detail: "name, sku, baseUnit" }],
    };
  }

  const result: ImportedRow<IngredientRow>[] = [];
  const errors: string[] = [];
  const issues: ParserIssue[] = [];
  const seenSku = new Map<string, number>();
  for (const { line, cells } of body) {
    if (cells.length !== headers.length) {
      errors.push(`Fila ${line}: columnas descuadradas (se esperaban ${headers.length})`);
      issues.push({ line, code: "RAGGED_ROW", detail: String(headers.length) });
      continue;
    }
    const parsed = importIngredientRowSchema.safeParse({
      name: cell(cells, nameIdx),
      sku: cell(cells, skuIdx),
      baseUnit: cell(cells, baseUnitIdx),
      category: cell(cells, catIdx),
      minStock: cell(cells, minIdx),
      purchaseUnit: cell(cells, puIdx),
      conversionFactor: cell(cells, cfIdx),
    });
    if (!parsed.success) {
      errors.push(`Fila ${line}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
      issues.push(zodIssue(line, parsed.error));
      continue;
    }
    const row = parsed.data;
    const firstLine = seenSku.get(row.sku);
    if (firstLine !== undefined) {
      const message = `SKU "${row.sku}" duplicado en el archivo (primero en fila ${firstLine})`;
      errors.push(`Fila ${line}: ${message}`);
      issues.push({ line, code: "DUP_IN_FILE", detail: message });
      continue;
    }
    seenSku.set(row.sku, line);
    result.push({ line, data: row });
  }

  return { type: "ingredients" as const, rows: result, errors, issues };
}

function parseProductRows(headers: string[], body: BodyLine[]) {
  const nameIdx = headers.indexOf("name");
  const skuIdx = headers.indexOf("sku");
  const priceIdx = headers.indexOf("saleprice");
  const catIdx = headers.indexOf("category");

  if (nameIdx === -1 || skuIdx === -1 || priceIdx === -1) {
    return {
      type: "products" as const,
      rows: [],
      errors: ["Columnas requeridas: name, sku, salePrice"],
      issues: [{ line: null, code: "MISSING_COLUMNS" as const, detail: "name, sku, salePrice" }],
    };
  }

  const result: ImportedRow<ProductRow>[] = [];
  const errors: string[] = [];
  const issues: ParserIssue[] = [];
  const seenSku = new Map<string, number>();
  for (const { line, cells } of body) {
    if (cells.length !== headers.length) {
      errors.push(`Fila ${line}: columnas descuadradas (se esperaban ${headers.length})`);
      issues.push({ line, code: "RAGGED_ROW", detail: String(headers.length) });
      continue;
    }
    const parsed = importProductRowSchema.safeParse({
      name: cell(cells, nameIdx),
      sku: cell(cells, skuIdx),
      salePrice: cell(cells, priceIdx),
      category: cell(cells, catIdx),
    });
    if (!parsed.success) {
      errors.push(`Fila ${line}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
      issues.push(zodIssue(line, parsed.error));
      continue;
    }
    const row = parsed.data;
    const firstLine = seenSku.get(row.sku);
    if (firstLine !== undefined) {
      const message = `SKU "${row.sku}" duplicado en el archivo (primero en fila ${firstLine})`;
      errors.push(`Fila ${line}: ${message}`);
      issues.push({ line, code: "DUP_IN_FILE", detail: message });
      continue;
    }
    seenSku.set(row.sku, line);
    result.push({ line, data: row });
  }

  return { type: "products" as const, rows: result, errors, issues };
}

function parseRecipeLines(
  headers: string[],
  body: BodyLine[],
  targetHeader: "productsku" | "subproductsku",
  type: "productRecipes" | "subproductRecipes",
) {
  const targetIdx = headers.indexOf(targetHeader);
  const ingIdx = headers.indexOf("ingredientsku");
  const qtyIdx = headers.indexOf("quantity");
  const wasteIdx = headers.indexOf("wastepercentage");
  const nonInvIdx = headers.indexOf("noninventoriable");
  const yieldIdx = headers.indexOf("yieldquantity");
  const notesIdx = headers.indexOf("notes");
  const targetLabel = targetHeader === "productsku" ? "productSku" : "subproductSku";

  if (targetIdx === -1 || ingIdx === -1 || qtyIdx === -1) {
    return {
      type,
      rows: [],
      errors: [`Columnas requeridas: ${targetLabel}, ingredientSku, quantity`],
      issues: [{ line: null, code: "MISSING_COLUMNS" as const, detail: `${targetLabel}, ingredientSku, quantity` }],
    };
  }

  const result: ImportedRow<RecipeLineRow>[] = [];
  const errors: string[] = [];
  const issues: ParserIssue[] = [];
  for (const { line, cells } of body) {
    if (cells.length !== headers.length) {
      errors.push(`Fila ${line}: columnas descuadradas (se esperaban ${headers.length})`);
      issues.push({ line, code: "RAGGED_ROW", detail: String(headers.length) });
      continue;
    }
    const parsed = importRecipeLineSchema.safeParse({
      targetSku: cell(cells, targetIdx),
      ingredientSku: cell(cells, ingIdx),
      quantity: cell(cells, qtyIdx),
      wastePercentage: cell(cells, wasteIdx),
      nonInventoriable: cell(cells, nonInvIdx),
      yieldQuantity: cell(cells, yieldIdx),
      notes: cell(cells, notesIdx),
    });
    if (!parsed.success) {
      errors.push(`Fila ${line}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
      issues.push(zodIssue(line, parsed.error));
      continue;
    }
    result.push({ line, data: parsed.data });
  }

  return { type, rows: result, errors, issues };
}

function parseSupplierRows(headers: string[], body: BodyLine[]) {
  const nameIdx = headers.indexOf("name");
  const taxIdx = headers.indexOf("taxid");
  const phoneIdx = headers.indexOf("phone");
  const emailIdx = headers.indexOf("email");

  if (nameIdx === -1) {
    return {
      type: "suppliers" as const,
      rows: [],
      errors: ["Columnas requeridas: name (más taxId, phone o email)"],
      issues: [{ line: null, code: "MISSING_COLUMNS" as const, detail: "name" }],
    };
  }

  const result: ImportedRow<SupplierRow>[] = [];
  const errors: string[] = [];
  const issues: ParserIssue[] = [];
  const seenName = new Map<string, number>();
  for (const { line, cells } of body) {
    if (cells.length !== headers.length) {
      errors.push(`Fila ${line}: columnas descuadradas (se esperaban ${headers.length})`);
      issues.push({ line, code: "RAGGED_ROW", detail: String(headers.length) });
      continue;
    }
    const parsed = importSupplierRowSchema.safeParse({
      name: cell(cells, nameIdx),
      taxId: cell(cells, taxIdx),
      phone: cell(cells, phoneIdx),
      email: cell(cells, emailIdx),
    });
    if (!parsed.success) {
      errors.push(`Fila ${line}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
      issues.push(zodIssue(line, parsed.error));
      continue;
    }
    const key = parsed.data.name.trim().toLowerCase();
    const firstLine = seenName.get(key);
    if (firstLine !== undefined) {
      const message = `Proveedor "${parsed.data.name}" repetido en el archivo (primero en fila ${firstLine})`;
      errors.push(`Fila ${line}: ${message}`);
      issues.push({ line, code: "DUP_IN_FILE", detail: message });
      continue;
    }
    seenName.set(key, line);
    result.push({ line, data: parsed.data });
  }

  return { type: "suppliers" as const, rows: result, errors, issues };
}

function parseInventoryRows(headers: string[], body: BodyLine[]) {
  const skuIdx = headers.indexOf("ingredientsku");
  const qtyIdx = headers.indexOf("quantity");
  const costIdx = headers.indexOf("unitcost");

  if (skuIdx === -1 || qtyIdx === -1 || costIdx === -1) {
    return {
      type: "inventory" as const,
      rows: [],
      errors: ["Columnas requeridas: ingredientSku, quantity, unitCost"],
      issues: [{ line: null, code: "MISSING_COLUMNS" as const, detail: "ingredientSku, quantity, unitCost" }],
    };
  }

  const result: ImportedRow<InventoryRow>[] = [];
  const errors: string[] = [];
  const issues: ParserIssue[] = [];
  const seenSku = new Map<string, number>();
  for (const { line, cells } of body) {
    if (cells.length !== headers.length) {
      errors.push(`Fila ${line}: columnas descuadradas (se esperaban ${headers.length})`);
      issues.push({ line, code: "RAGGED_ROW", detail: String(headers.length) });
      continue;
    }
    const parsed = importInventoryRowSchema.safeParse({
      ingredientSku: cell(cells, skuIdx),
      quantity: cell(cells, qtyIdx),
      unitCost: cell(cells, costIdx),
    });
    if (!parsed.success) {
      errors.push(`Fila ${line}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
      issues.push(zodIssue(line, parsed.error));
      continue;
    }
    const firstLine = seenSku.get(parsed.data.ingredientSku);
    if (firstLine !== undefined) {
      const message = `SKU "${parsed.data.ingredientSku}" duplicado en el archivo (primero en fila ${firstLine})`;
      errors.push(`Fila ${line}: ${message}`);
      issues.push({ line, code: "DUP_IN_FILE", detail: message });
      continue;
    }
    seenSku.set(parsed.data.ingredientSku, line);
    result.push({ line, data: parsed.data });
  }

  return { type: "inventory" as const, rows: result, errors, issues };
}

export type RecipeGroup = {
  targetSku: string;
  firstLine: number;
  yieldQuantity?: number;
  notes?: string;
  lines: ImportedRow<RecipeLineRow>[];
};

/**
 * Agrupa líneas validadas por receta (puro, sin DB). Detecta sin tocar la
 * base: yield/notes inconsistentes, insumo repetido, >200 líneas y
 * auto-referencia directa.
 */
export function groupRecipeLines(
  lines: ImportedRow<RecipeLineRow>[],
): { groups: RecipeGroup[]; issues: ParserIssue[] } {
  const groups = new Map<string, RecipeGroup>();
  const issues: ParserIssue[] = [];
  const order: string[] = [];

  for (const { line, data } of lines) {
    let group = groups.get(data.targetSku);
    if (!group) {
      group = {
        targetSku: data.targetSku,
        firstLine: line,
        yieldQuantity: data.yieldQuantity,
        notes: data.notes,
        lines: [],
      };
      groups.set(data.targetSku, group);
      order.push(data.targetSku);
    } else {
      const sameYield = (group.yieldQuantity ?? null) === (data.yieldQuantity ?? null);
      const sameNotes = (group.notes ?? null) === (data.notes ?? null);
      if (!sameYield || !sameNotes) {
        issues.push({
          line,
          code: "GROUP_CONFLICT",
          detail: `"${data.targetSku}" trae yieldQuantity/notes distintos a los de la fila ${group.firstLine}`,
        });
        continue;
      }
    }
    if (group.lines.some((l) => l.data.ingredientSku === data.ingredientSku)) {
      issues.push({
        line,
        code: "DUP_IN_FILE",
        detail: `Insumo "${data.ingredientSku}" repetido en la receta "${data.targetSku}"`,
      });
      continue;
    }
    if (data.ingredientSku === data.targetSku) {
      issues.push({
        line,
        code: "RECIPE_CYCLE",
        detail: `"${data.targetSku}" se usa en su propia receta`,
      });
      continue;
    }
    group.lines.push({ line, data });
    if (group.lines.length > MAX_RECIPE_LINES) {
      issues.push({
        line,
        code: "ROW_INVALID",
        detail: `La receta "${data.targetSku}" supera ${MAX_RECIPE_LINES} líneas`,
        column: "quantity",
      });
      group.lines.pop();
    }
  }

  const out: RecipeGroup[] = [];
  for (const k of order) {
    const g = groups.get(k);
    if (g && g.lines.length > 0) out.push(g);
  }
  return { groups: out, issues };
}
