import { describe, expect, it } from "vitest";
import {
  confirmCountSchema,
  createAdjustmentSchema,
  createExpenseSchema,
  createProductionOrderSchema,
  createSaleSchema,
  formValues,
  listProductionOrdersSchema,
  openCashSchema,
  receivePurchaseSchema,
  saveIngredientSchema,
  saveProductSchema,
  saveRecipeSchema,
  saveNumberSettingsSchema,
  saveUnitSchema,
} from "@/app/actions/schemas";

const UUID = "3f1e6a3e-0f4a-4a7a-9c2a-2b6d5f0c1111";

describe("preferencias numÃ©ricas y unidades", () => {
  it("acepta los rangos y normaliza el cÃ³digo", () => {
    expect(saveNumberSettingsSchema.parse({ numberFormat: "EU", moneyDecimals: "2", costDecimals: "6", quantityDecimals: "0" })).toEqual({ numberFormat: "EU", moneyDecimals: 2, costDecimals: 6, quantityDecimals: 0 });
    expect(saveUnitSchema.parse({ code: "  OZ ", name: "Onza", decimals: "2" })).toEqual({ code: "oz", name: "Onza", decimals: 2 });
  });

  it("rechaza estilos y precisiones fuera de rango", () => {
    expect(() => saveNumberSettingsSchema.parse({ numberFormat: "GT", moneyDecimals: 2, costDecimals: 4, quantityDecimals: 3 })).toThrow();
    expect(() => saveNumberSettingsSchema.parse({ numberFormat: "US", moneyDecimals: 7, costDecimals: 4, quantityDecimals: 3 })).toThrow();
  });
});

describe("validación de la frontera (Fase 2.1)", () => {
  it("acepta un producto válido y convierte el precio de texto a número", () => {
    const out = saveProductSchema.parse({
      sku: "LAT-01",
      name: "Latte matcha",
      clientPrice: "25.50",
      categoryId: "",
    });
    expect(out.clientPrice).toBe(25.5);
    expect(out.categoryId).toBeNull();
    expect(out.active).toBe(true);
  });

  it("rechaza un precio vacío en vez de guardarlo como 0", () => {
    expect(() =>
      saveProductSchema.parse({ sku: "L", name: "L", clientPrice: "" }),
    ).toThrow();
  });

  it("aplica el valor por defecto de stock mínimo cuando el campo viene vacío", () => {
    const out = saveIngredientSchema.parse({
      sku: "MAT-01",
      name: "Matcha",
      baseUnitId: UUID,
      categoryId: "",
      minimumStock: "",
      conversionFactor: "",
    });
    expect(out.minimumStock).toBe(0);
    expect(out.conversionFactor).toBeUndefined();
  });

  it("rechaza cantidades negativas en una venta (sumaban stock)", () => {
    expect(() =>
      createSaleSchema.parse({
        paymentMethod: "CASH",
        items: [{ productId: UUID, quantity: -2 }],
      }),
    ).toThrow();
  });

  it("rechaza NaN antes de que llegue a Postgres", () => {
    expect(() =>
      createSaleSchema.parse({
        paymentMethod: "CASH",
        items: [{ productId: UUID, quantity: Number("x") }],
      }),
    ).toThrow();
  });

  it("rechaza un método de pago fuera del enum", () => {
    expect(() =>
      createSaleSchema.parse({
        paymentMethod: "BITCOIN",
        items: [{ productId: UUID, quantity: 1 }],
      }),
    ).toThrow();
  });

  it("exige al menos un renglón", () => {
    expect(() =>
      createSaleSchema.parse({ paymentMethod: "CASH", items: [] }),
    ).toThrow();
  });

  it("descarta campos ajenos al esquema en las líneas de compra", () => {
    const out = receivePurchaseSchema.parse({
      supplierId: UUID,
      documentNumber: "",
      paymentMethod: "TRANSFER",
      paymentStatus: "PAID",
      purchasedAt: "2026-09-09",
      taxTotal: 0,
      items: [
        {
          ingredientId: UUID,
          purchaseUnitId: UUID,
          purchaseQuantity: 1,
          unitPrice: 10,
          lineTotal: 10,
          expiresAt: null,
          campoInventado: "x",
        },
      ],
    });
    expect(out.items[0]).not.toHaveProperty("campoInventado");
    expect(out.documentNumber).toBeUndefined();
  });

  it("exige fecha ISO en un gasto", () => {
    expect(() =>
      createExpenseSchema.parse({
        expenseDate: "09/09/2026",
        category: "UTILITIES",
        description: "Luz",
        supplierId: "",
        subtotal: "100",
        paymentMethod: "CASH",
      }),
    ).toThrow();

    const ok = createExpenseSchema.parse({
      expenseDate: "2026-09-09",
      category: "UTILITIES",
      description: "Luz",
      supplierId: "",
      beneficiary: "",
      subtotal: "100",
      taxTotal: "",
      paymentMethod: "CASH",
    });
    expect(ok.taxTotal).toBe(0);
    expect(ok.supplierId).toBeNull();
  });

  it("no permite un ajuste de inventario de cero, pero sí negativo", () => {
    expect(() =>
      createAdjustmentSchema.parse({
        ingredientId: UUID,
        quantityDelta: "0",
        reason: "merma",
      }),
    ).toThrow();

    const out = createAdjustmentSchema.parse({
      ingredientId: UUID,
      quantityDelta: "-3",
      reason: "merma",
    });
    expect(out.quantityDelta).toBe(-3);
    expect(out.type).toBe("WASTE");
  });

  it("permite cero en un conteo físico (contar nada es un dato válido)", () => {
    const out = confirmCountSchema.parse({
      items: [{ ingredientId: UUID, physicalQuantity: 0 }],
    });
    expect(out.items[0].physicalQuantity).toBe(0);
  });

  it("rechaza una apertura de caja sin monto", () => {
    expect(() => openCashSchema.parse({ openingAmount: "" })).toThrow();
  });

  it("acepta filtros de producción ausentes", () => {
    expect(listProductionOrdersSchema.parse(undefined)).toBeUndefined();
  });

  it("acepta el filtro de órdenes en progreso y rechaza estados desconocidos", () => {
    expect(listProductionOrdersSchema.parse({ status: "IN_PROGRESS" })?.status).toBe("IN_PROGRESS");
    expect(() => listProductionOrdersSchema.parse({ status: "RUNNING" })).toThrow();
  });

  it("valida los lÃ­mites de paginaciÃ³n de producciÃ³n", () => {
    expect(listProductionOrdersSchema.parse({ take: "10" })?.take).toBe(10);
    expect(() => listProductionOrdersSchema.parse({ take: "0" })).toThrow();
    expect(() => listProductionOrdersSchema.parse({ take: "501" })).toThrow();
  });

  it("inicia por defecto las nuevas órdenes y permite conservar un borrador", () => {
    const base = { ingredientId: UUID, quantity: "2" };
    expect(createProductionOrderSchema.parse(base).startImmediately).toBe(true);
    expect(createProductionOrderSchema.parse({ ...base, startImmediately: false }).startImmediately).toBe(false);
    expect(createProductionOrderSchema.parse({ ...base, startImmediately: "false" }).startImmediately).toBe(false);
  });

  it("formValues descarta los archivos del FormData", () => {
    const fd = new FormData();
    fd.set("name", "Matcha");
    fd.set("image", new File(["x"], "foto.png", { type: "image/png" }));
    expect(formValues(fd)).toEqual({ name: "Matcha" });
  });

  it("la merma de receta solo acepta enteros de 0 a 20 (REQ-03)", () => {
    const base = { productId: UUID, items: [{ ingredientId: UUID, quantity: 1 }] };
    expect(() =>
      saveRecipeSchema.parse({
        ...base,
        items: [{ ingredientId: UUID, quantity: 1, wastePercentage: 5 }],
      }),
    ).not.toThrow();
    expect(() =>
      saveRecipeSchema.parse({
        ...base,
        items: [{ ingredientId: UUID, quantity: 1, wastePercentage: 0 }],
      }),
    ).not.toThrow();
    expect(() =>
      saveRecipeSchema.parse({
        ...base,
        items: [{ ingredientId: UUID, quantity: 1, wastePercentage: 20 }],
      }),
    ).not.toThrow();
    expect(() =>
      saveRecipeSchema.parse({
        ...base,
        items: [{ ingredientId: UUID, quantity: 1, wastePercentage: 21 }],
      }),
    ).toThrow();
    expect(() =>
      saveRecipeSchema.parse({
        ...base,
        items: [{ ingredientId: UUID, quantity: 1, wastePercentage: 2.5 }],
      }),
    ).toThrow();
    expect(() =>
      saveRecipeSchema.parse({
        ...base,
        items: [{ ingredientId: UUID, quantity: 1, wastePercentage: -1 }],
      }),
    ).toThrow();
  });
});
