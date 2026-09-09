/**
 * Catálogo de troubleshooting interno del importador CSV (Fase B2, DEC-19).
 *
 * Cada código de problema mapea a un motivo (`reason`) y a cómo solucionarlo
 * (`fix`) en español. Lo consumen las server actions de
 * `src/app/actions/importer.ts`: el cliente solo recibe strings ya armados,
 * nunca este módulo directamente.
 *
 * Los códigos `SUPPLIER_*`, `*_NOT_FOUND`, `ZERO_COST`, `RECIPE_CYCLE`,
 * `HAS_STOCK` y `RECIPE_UPDATED` están reservados para la Fase C
 * (proveedores, recetas, inventario): ya existen aquí para no romper el
 * contrato cuando esas ramas se conecten al mismo pipeline preview/confirm.
 */

export type PreviewStatus = "ok" | "info" | "warning" | "error";

export type ImportIssueCode =
  | "FILE_EMPTY"
  | "NOT_CSV"
  | "FILE_TOO_BIG"
  | "NEEDS_ROWS"
  | "UNKNOWN_FORMAT"
  | "DUP_HEADER"
  | "ROW_LIMIT"
  | "MISSING_COLUMNS"
  | "RAGGED_ROW"
  | "ROW_INVALID"
  | "GROUP_CONFLICT"
  | "DUP_IN_FILE"
  | "MISMATCHED_PAIR"
  | "UNIT_NOT_FOUND"
  | "PURCHASE_UNIT_NOT_FOUND"
  | "SKU_EXISTS"
  | "CATEGORY_NEW"
  | "SUPPLIER_EXISTS"
  | "PRODUCT_NOT_FOUND"
  | "INGREDIENT_NOT_FOUND"
  | "ZERO_COST"
  | "RECIPE_CYCLE"
  | "HAS_STOCK"
  | "RECIPE_UPDATED";

/** Fila problemática del reporte: motivo + cómo solucionarlo. */
export type PreviewRow = {
  line: number | null;
  label: string;
  status: Exclude<PreviewStatus, "ok">;
  code: ImportIssueCode;
  reason: string;
  fix: string;
};

export type ImportPreview = {
  type: string;
  fileName: string;
  /** Filas válidas listas para importar (no se listan, solo se cuentan). */
  validCount: number;
  /** Solo filas con problema (error/aviso). */
  rows: PreviewRow[];
  /** Categorías que se crearán al confirmar (informativo). */
  newCategories: string[];
  /** Recetas que pasarán a nueva versión al confirmar (informativo). */
  updatedRecipes: string[];
};

type CatalogEntry = { reason: string; fix: string };

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

const CATALOG: Record<ImportIssueCode, CatalogEntry> = {
  FILE_EMPTY: {
    reason: "El archivo está vacío.",
    fix: "Elige el CSV con tus datos (o descarga la plantilla de plantillas/).",
  },
  NOT_CSV: {
    reason: "El archivo debe ser .csv.",
    fix: "En Excel: Archivo > Guardar como > CSV UTF-8 (delimitado por comas).",
  },
  FILE_TOO_BIG: {
    reason: "El archivo supera los 2 MB.",
    fix: "Divídelo en archivos de máximo 500 filas cada uno.",
  },
  NEEDS_ROWS: {
    reason: "El CSV necesita al menos un encabezado y una fila.",
    fix: "Agrega una fila de datos debajo del encabezado.",
  },
  UNKNOWN_FORMAT: {
    reason: "No se detectó formato válido.",
    fix: "Usa una plantilla de plantillas/: ingredientes (baseUnit), productos (salePrice), recetas (productSku/subproductSku), inventario (unitCost) o proveedores (taxId/phone/email).",
  },
  DUP_HEADER: {
    reason: 'Encabezado duplicado: "{detail}".',
    fix: "Deja una sola columna con ese nombre y vuelve a subir el archivo.",
  },
  ROW_LIMIT: {
    reason: "Máximo 500 filas por archivo (recibidas {detail}).",
    fix: "Parte el archivo en dos o más CSVs de 500 filas o menos.",
  },
  MISSING_COLUMNS: {
    reason: "Faltan columnas requeridas ({detail}).",
    fix: "Agrega las columnas indicadas al encabezado (en inglés, minúsculas).",
  },
  RAGGED_ROW: {
    reason: "Columnas descuadradas (se esperaban {detail}).",
    fix: "Iguala el número de comas al del encabezado; revisa comas dentro de textos (usa comillas).",
  },
  ROW_INVALID: {
    reason: "{detail}",
    fix: "Corrige la columna {column}: obligatorios completos, textos dentro de su largo (código ≤50, nombre ≤150, categoría ≤100), números con punto decimal, precio/cantidad > 0, costo ≥ 0, merma entera 0–20, nonInventoriable SI/NO.",
  },
  GROUP_CONFLICT: {
    reason: "{detail}",
    fix: "Deja el mismo yieldQuantity y notes en todas las filas de la receta.",
  },
  DUP_IN_FILE: {
    reason: "{detail}",
    fix: "Deja una sola fila por SKU (se importa la primera aparición).",
  },
  MISMATCHED_PAIR: {
    reason: "purchaseUnit y conversionFactor deben venir juntos o ninguno.",
    fix: "Completa ambos (ej. purchaseUnit kg + conversionFactor 1000) o deja ambos vacíos.",
  },
  UNIT_NOT_FOUND: {
    reason: 'Unidad "{detail}" no encontrada.',
    fix: "Créala en Configuración o usa una válida: {valid}.",
  },
  PURCHASE_UNIT_NOT_FOUND: {
    reason: 'Unidad de compra "{detail}" no encontrada.',
    fix: "Créala en Configuración o usa una válida: {valid}.",
  },
  SKU_EXISTS: {
    reason: 'El SKU "{detail}" ya existe en tu negocio.',
    fix: "Cambia el SKU en el CSV o edita el registro existente en Productos; el importador solo crea, nunca actualiza.",
  },
  CATEGORY_NEW: {
    reason: 'Se creará la categoría "{detail}".',
    fix: "Sin acción: al confirmar se crea sola.",
  },
  SUPPLIER_EXISTS: {
    reason: 'El proveedor "{detail}" ya existe.',
    fix: "Quita la fila o usa el proveedor existente en Compras; el importador no duplica ni actualiza proveedores.",
  },
  PRODUCT_NOT_FOUND: {
    reason: 'Producto "{detail}" no encontrado.',
    fix: "Carga primero los productos (hoja 02) y verifica el SKU en mayúsculas.",
  },
  INGREDIENT_NOT_FOUND: {
    reason: 'Ingrediente "{detail}" no encontrado.',
    fix: "Carga primero los ingredientes (hoja 01) y verifica el SKU en mayúsculas.",
  },
  ZERO_COST: {
    reason: 'El insumo "{detail}" aún no tiene costo (Q0).',
    fix: "Carga su inventario inicial (hoja 07) o regístrale una compra antes de importar recetas de subproducto.",
  },
  RECIPE_CYCLE: {
    reason: "{detail}",
    fix: "Revisa la composición: un subproducto no puede usarse (directa o indirectamente) en su propia receta.",
  },
  HAS_STOCK: {
    reason: '"{detail}" ya tiene existencias y se omitirá.',
    fix: "Sin acción si el stock actual es correcto; si quieres corregirlo, haz un ajuste o conteo en Inventario.",
  },
  RECIPE_UPDATED: {
    reason: '"{detail}" ya tiene receta: se creará una nueva versión.',
    fix: "Sin acción: la versión anterior se desactiva sola, igual que al editar en la interfaz.",
  },
};

/** Todos los códigos del catálogo (para tests y validación exhaustiva). */
export const IMPORT_ISSUE_CODES = Object.keys(CATALOG) as ImportIssueCode[];

/**
 * Arma motivo+síntesis de solución para un código, interpolando `{clave}`
 * con `params`. Las claves ausentes se dejan tal cual (`{clave}`).
 */
export function troubleshoot(
  code: ImportIssueCode,
  params: Record<string, string | number> = {},
): { reason: string; fix: string } {
  const entry = CATALOG[code];
  return { reason: fill(entry.reason, params), fix: fill(entry.fix, params) };
}
