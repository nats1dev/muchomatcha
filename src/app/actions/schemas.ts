import { z } from "zod";

/**
 * Esquemas de validacion de la frontera (Fase 2.1 de `docs/IMPLEMENTACION.md`).
 *
 * Toda server action es un endpoint publico: los tipos de TypeScript se borran
 * al compilar, asi que un cliente puede enviar cualquier cosa. Aqui se valida
 * lo que entra ANTES de llamar al dominio; los servicios de `src/modules/`
 * pueden confiar en sus tipos porque nadie los invoca sin pasar por aqui.
 *
 * Reglas: cantidades `positive().finite()`, importes y descuentos
 * `nonnegative()`, identificadores UUID, enums cerrados, fechas ISO y
 * longitudes maximas en todo texto libre.
 */

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

export const uuid = z.string().uuid("Identificador inválido");

/** UUID opcional que acepta "" (los `<select>` vacios envian cadena vacia). */
export const optionalUuid = z
  .preprocess((v) => (v === "" || v === null ? undefined : v), uuid.optional());

/** UUID que ademas admite `null` explicito (categoria "sin asignar"). */
export const nullableUuid = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  uuid.nullable(),
);

export function requiredText(label: string, max = 200) {
  return z.string().trim().min(1, `${label} es obligatorio`).max(max, `${label} es demasiado largo`);
}

export function optionalText(max = 500) {
  return z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : v),
    z.string().trim().max(max, "Texto demasiado largo").optional(),
  );
}

/**
 * Numero desde FormData o JSON. `Number("")` es 0 y `Number("x")` es NaN:
 * ambos entrarian a la base sin este filtro (NaN llega a Postgres como error
 * opaco, y un 0 silencioso falsea totales).
 */
const numberFromInput = z.preprocess((v) => {
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed === "") return undefined;
    return Number(trimmed);
  }
  return v;
}, z.number({ error: "Debe ser un número" }).finite("Debe ser un número válido"));

/** Cantidad de producto/insumo: siempre > 0. */
export const quantity = numberFromInput.pipe(
  z.number().positive("La cantidad debe ser mayor que cero"),
);

/** Importe de dinero: nunca negativo. */
export const amount = numberFromInput.pipe(
  z.number().nonnegative("El importe no puede ser negativo"),
);

/** Delta de inventario: puede ser negativo, pero nunca cero. */
export const signedQuantity = numberFromInput.pipe(
  z.number().refine((n) => n !== 0, "La cantidad no puede ser cero"),
);

export const percentage = numberFromInput.pipe(
  z.number().min(0, "El porcentaje no puede ser negativo").max(100, "El porcentaje no puede pasar de 100"),
);

/**
 * Un campo numerico vacio significa "sin valor", no "cero". Se normaliza antes
 * de `.optional()`: si no, `""` entra al esquema numerico y falla en vez de
 * quedar en `undefined`.
 */
const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

export const optionalQuantity = z.preprocess(emptyToUndefined, quantity.optional());
export const optionalAmount = z.preprocess(emptyToUndefined, amount.optional());
export const optionalPercentage = z.preprocess(
  emptyToUndefined,
  percentage.optional(),
);

/**
 * Importe con valor por defecto cuando el campo llega vacio o ausente.
 * No sirve `amount.default(0)`: `.default` solo mira el valor de ENTRADA, y
 * desde un formulario lo que llega es `""`, no `undefined`.
 */
export function amountOr(fallback: number) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? fallback : v),
    amount,
  );
}

/** Fecha civil `YYYY-MM-DD`. */
export const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (formato aaaa-mm-dd)")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Fecha inválida");

export const optionalIsoDate = z.preprocess(
  (v) => (v === null || v === undefined || v === "" ? undefined : v),
  isoDate.optional(),
);

/** Fecha opcional que admite `null` (vencimiento de una linea de compra). */
export const nullableIsoDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  isoDate.nullable(),
);

/** Casilla de FormData: solo la cadena "false" desactiva. */
export const activeFlag = z.preprocess((v) => v !== "false", z.boolean());

export const optionalBool = z.preprocess(
  (v) => (v === undefined || v === null || v === "" ? undefined : v === true || v === "true"),
  z.boolean().optional(),
);

// Enums cerrados (espejo de `prisma/schema.prisma`).
export const paymentMethodEnum = z.enum(["CASH", "CARD", "TRANSFER", "NONE"]);
export const salePaymentMethodEnum = z.enum(["CASH", "CARD", "TRANSFER"]);
export const paymentStatusEnum = z.enum(["PAID", "PENDING", "PARTIAL"]);
export const cashMovementTypeEnum = z.enum(["INCOME", "WITHDRAWAL", "EXPENSE"]);
export const expenseCategoryEnum = z.enum([
  "RENT",
  "UTILITIES",
  "SALARIES",
  "SUPPLIES",
  "MARKETING",
  "MAINTENANCE",
  "TRANSPORT",
  "OTHER",
]);
export const adjustmentTypeEnum = z.enum(["WASTE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"]);
export const productionStatusEnum = z.enum([
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

/** Tope de lineas por documento: evita transacciones interminables. */
const MAX_ITEMS = 200;
function itemList<T extends z.ZodTypeAny>(item: T, label = "un renglón") {
  return z.array(item).min(1, `Agrega al menos ${label}`).max(MAX_ITEMS, "Demasiados renglones");
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const saveProductSchema = z.object({
  id: optionalUuid,
  sku: requiredText("El código", 50),
  name: requiredText("El nombre", 150),
  clientPrice: amount,
  categoryId: nullableUuid,
  active: activeFlag,
});

export const saveCategorySchema = z.object({
  id: optionalUuid,
  name: requiredText("El nombre", 100),
});

export const saveIngredientSchema = z.object({
  id: optionalUuid,
  sku: requiredText("El código", 50),
  name: requiredText("El nombre", 150),
  baseUnitId: uuid,
  categoryId: nullableUuid,
  minimumStock: amountOr(0),
  currentAverageCost: optionalAmount,
  purchaseUnitId: optionalUuid,
  conversionFactor: optionalQuantity,
  active: activeFlag,
});

export const idOnlySchema = z.object({ id: uuid });

export const savePurchaseUnitSchema = z.object({
  ingredientId: uuid,
  unitId: uuid,
  conversionFactor: quantity,
});

export const saveSupplierSchema = z.object({
  id: optionalUuid,
  name: requiredText("El nombre", 150),
  taxId: optionalText(50),
  phone: optionalText(50),
  email: optionalText(200),
  active: activeFlag,
});

export const quickAddIngredientSchema = z.object({
  sku: requiredText("El código", 50),
  name: requiredText("El nombre", 150),
  baseUnitId: uuid,
  categoryId: nullableUuid,
  purchaseUnitId: uuid,
  conversionFactor: quantity,
});

export const quickAddCategorySchema = z.object({
  name: requiredText("El nombre", 100),
});

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

export const createSaleSchema = z.object({
  paymentMethod: paymentMethodEnum,
  notes: optionalText(500),
  globalDiscount: optionalAmount,
  items: itemList(
    z.object({
      productId: uuid,
      quantity,
      discount: optionalAmount,
    }),
    "un producto",
  ),
});

export const createDraftSaleSchema = z.object({
  notes: optionalText(500),
  items: itemList(z.object({ productId: uuid, quantity }), "un producto"),
});

export const confirmDraftSaleSchema = z.object({
  saleId: uuid,
  paymentMethod: salePaymentMethodEnum,
});

export const voidSaleSchema = z.object({
  saleId: uuid,
  reason: requiredText("El motivo", 300),
});

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

export const receivePurchaseSchema = z.object({
  supplierId: uuid,
  documentNumber: optionalText(60),
  paymentMethod: paymentMethodEnum,
  paymentStatus: paymentStatusEnum.optional(),
  purchasedAt: optionalIsoDate,
  taxTotal: optionalAmount,
  notes: optionalText(500),
  items: itemList(
    z.object({
      ingredientId: uuid,
      purchaseUnitId: uuid,
      purchaseQuantity: quantity,
      unitPrice: amount,
      lineTotal: amount,
      expiresAt: nullableIsoDate.optional(),
    }),
    "un insumo",
  ),
});

export const voidPurchaseSchema = z.object({
  purchaseId: uuid,
  reason: optionalText(300),
});

// ---------------------------------------------------------------------------
// Caja y gastos
// ---------------------------------------------------------------------------

export const openCashSchema = z.object({ openingAmount: amount });

export const cashMovementSchema = z.object({
  movementType: cashMovementTypeEnum,
  amount,
  reason: requiredText("El motivo", 300),
});

export const closeCashSchema = z.object({
  countedAmount: amount,
  closeNotes: optionalText(500),
});

export const createExpenseSchema = z.object({
  expenseDate: isoDate,
  category: expenseCategoryEnum,
  description: requiredText("La descripción", 300),
  supplierId: nullableUuid,
  beneficiary: optionalText(150),
  subtotal: amount,
  taxTotal: amountOr(0),
  paymentMethod: paymentMethodEnum,
});

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

export const createAdjustmentSchema = z.object({
  ingredientId: uuid,
  quantityDelta: signedQuantity,
  reason: requiredText("El motivo", 300),
  type: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? "WASTE" : v),
    adjustmentTypeEnum,
  ),
});

export const confirmCountSchema = z.object({
  notes: optionalText(500),
  items: itemList(
    z.object({
      ingredientId: uuid,
      // Un conteo fisico si puede dar cero: no se usa `quantity`.
      physicalQuantity: amount,
    }),
    "un insumo",
  ),
});

export const initialInventorySchema = z.object({
  items: itemList(
    z.object({ ingredientId: uuid, quantity, unitCost: amount }),
    "un insumo",
  ),
});

// ---------------------------------------------------------------------------
// Recetas y producción
// ---------------------------------------------------------------------------

const recipeItemSchema = z.object({
  ingredientId: uuid,
  quantity,
  wastePercentage: optionalPercentage,
  isNonInventoriable: optionalBool,
});

export const saveRecipeSchema = z.object({
  productId: uuid,
  yieldQuantity: optionalQuantity,
  notes: optionalText(500),
  items: itemList(recipeItemSchema, "un insumo"),
});

export const saveSubproductRecipeSchema = z.object({
  ingredientId: uuid,
  yieldQuantity: optionalQuantity,
  notes: optionalText(500),
  items: itemList(recipeItemSchema, "un insumo"),
});

export const recipeIdSchema = z.object({ recipeId: uuid });

export const createProductionOrderSchema = z.object({
  ingredientId: uuid,
  quantity,
  notes: optionalText(500),
});

export const orderIdSchema = z.object({ orderId: uuid });

export const completeProductionOrderSchema = z.object({
  orderId: uuid,
  actualQuantity: optionalQuantity,
});

export const cancelProductionOrderSchema = z.object({
  orderId: uuid,
  reason: requiredText("El motivo", 300),
});

export const listProductionOrdersSchema = z
  .object({
    ingredientId: optionalUuid,
    status: productionStatusEnum.optional(),
    from: optionalIsoDate,
    to: optionalIsoDate,
    take: numberFromInput.pipe(z.number().int().positive().max(500)).optional(),
    skip: numberFromInput.pipe(z.number().int().nonnegative()).optional(),
  })
  .optional();

export const ingredientIdSchema = z.object({ ingredientId: uuid });

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Convierte un FormData en objeto plano para `schema.parse`. Descarta los
 * `File` (las imagenes las procesa `saveUpload`, no Zod) y se queda con el
 * ultimo valor de cada campo repetido, igual que `formData.get`.
 */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
