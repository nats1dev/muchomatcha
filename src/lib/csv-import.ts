import Papa from "papaparse";

export type IngredientRow = {
  name: string;
  sku: string;
  baseUnit: string;
  category?: string;
  minStock?: number;
  purchaseUnit?: string;
  conversionFactor?: number;
};

export type ProductRow = {
  name: string;
  sku: string;
  salePrice: number;
  category?: string;
};

export type ImportResult = {
  type: "ingredients" | "products";
  rows: IngredientRow[] | ProductRow[];
  errors: string[];
};

export function parseImportCsv(content: string): ImportResult {
  const parsed = Papa.parse<string[]>(content.trim(), {
    skipEmptyLines: true,
  });

  if (parsed.data.length < 2) {
    return { type: "ingredients", rows: [], errors: ["El CSV necesita al menos un encabezado y una fila"] };
  }

  const headers = parsed.data[0].map((h) => h.trim().toLowerCase());
  const rows = parsed.data.slice(1);
  const errors: string[] = [];

  if (headers.includes("saleprice")) {
    return parseProductRows(headers, rows, errors);
  }
  if (headers.includes("baseunit")) {
    return parseIngredientRows(headers, rows, errors);
  }

  return {
    type: "ingredients",
    rows: [],
    errors: ["No se detectó formato válido. El CSV debe tener columnas 'baseUnit' (ingredientes) o 'salePrice' (productos)"],
  };
}

function parseIngredientRows(headers: string[], rows: string[][], errors: string[]) {
  const nameIdx = headers.indexOf("name");
  const skuIdx = headers.indexOf("sku");
  const baseUnitIdx = headers.indexOf("baseunit");
  const catIdx = headers.indexOf("category");
  const minIdx = headers.indexOf("minstock");
  const puIdx = headers.indexOf("purchaseunit");
  const cfIdx = headers.indexOf("conversionfactor");

  if (nameIdx === -1 || skuIdx === -1 || baseUnitIdx === -1) {
    return { type: "ingredients" as const, rows: [], errors: ["Columnas requeridas: name, sku, baseUnit"] };
  }

  const result: IngredientRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = r[nameIdx]?.trim();
    const sku = r[skuIdx]?.trim();
    const baseUnit = r[baseUnitIdx]?.trim();

    if (!name || !sku || !baseUnit) {
      errors.push(`Fila ${i + 2}: name, sku y baseUnit son obligatorios`);
      continue;
    }

    const row: IngredientRow = { name, sku: sku.toUpperCase(), baseUnit };
    if (catIdx >= 0 && r[catIdx]?.trim()) row.category = r[catIdx].trim();
    if (minIdx >= 0 && r[minIdx]?.trim()) {
      const val = Number(r[minIdx]);
      if (!isNaN(val) && val >= 0) row.minStock = val;
    }
    if (puIdx >= 0 && r[puIdx]?.trim()) row.purchaseUnit = r[puIdx].trim();
    if (cfIdx >= 0 && r[cfIdx]?.trim()) {
      const val = Number(r[cfIdx]);
      if (!isNaN(val) && val > 0) row.conversionFactor = val;
    }
    result.push(row);
  }

  return { type: "ingredients" as const, rows: result, errors };
}

function parseProductRows(headers: string[], rows: string[][], errors: string[]) {
  const nameIdx = headers.indexOf("name");
  const skuIdx = headers.indexOf("sku");
  const priceIdx = headers.indexOf("saleprice");
  const catIdx = headers.indexOf("category");

  if (nameIdx === -1 || skuIdx === -1 || priceIdx === -1) {
    return { type: "products" as const, rows: [], errors: ["Columnas requeridas: name, sku, salePrice"] };
  }

  const result: ProductRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = r[nameIdx]?.trim();
    const sku = r[skuIdx]?.trim();
    const rawPrice = Number(r[priceIdx]?.trim());

    if (!name || !sku) {
      errors.push(`Fila ${i + 2}: name y sku son obligatorios`);
      continue;
    }
    if (isNaN(rawPrice) || rawPrice <= 0) {
      errors.push(`Fila ${i + 2}: salePrice debe ser un número > 0`);
      continue;
    }

    const row: ProductRow = { name, sku: sku.toUpperCase(), salePrice: rawPrice };
    if (catIdx >= 0 && r[catIdx]?.trim()) row.category = r[catIdx].trim();
    result.push(row);
  }

  return { type: "products" as const, rows: result, errors };
}
