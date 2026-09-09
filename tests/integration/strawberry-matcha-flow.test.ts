if (process.env.DATABASE_URL) {
  const raw = process.env.DATABASE_URL;
  const base = raw.split("?")[0];
  process.env.DATABASE_URL = `${base}?pgbouncer=true&connection_limit=2&pool_timeout=30`;
}
process.env.PRISMA_TX_TIMEOUT = "30000";
process.env.PRISMA_TX_MAX_WAIT = "15000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { MovementType, PaymentMethod, PaymentStatus, SaleStatus, ProductionStatus } from "@prisma/client";
import { calculateSaleTotals } from "@/modules/sales/totals";
import { getIngredientStock } from "@/modules/inventory/stock";
import {
  upsertSupplier,
  upsertIngredient,
  upsertProduct,
  upsertProductCategory,
} from "@/modules/catalog/service";
import { receivePurchase } from "@/modules/purchases/service";
import {
  saveSubproductRecipe,
  saveRecipe,
} from "@/modules/recipes/service";
import {
  createProductionOrder,
  startProductionOrder,
  completeProductionOrder,
  cancelProductionOrder,
} from "@/modules/production/service";
import { openCashSession, closeCashSession } from "@/modules/cash/service";
import { createSale } from "@/modules/sales/service";
import {
  type TestContext,
  createTestBusiness,
  createDefaultUnits,
  cleanupTestBusiness,
} from "./helpers";

const TEST_SUITE = `strawberry-flow-${Date.now()}`;

describe("Flujo completo Strawberry Matcha", () => {
  let ctx: TestContext;
  let units: Record<string, string>;
  let productCategoryId: string;
  let supplierId: string;

  const raw: Record<string, { id: string; puId: string }> = {};
  let jaleaIngredientId: string;
  let strawberryProductId: string;
  let orderId: string;

  beforeAll(async () => {
    console.log(`[setup] Creando negocio de prueba: ${TEST_SUITE}`);
    ctx = await createTestBusiness(TEST_SUITE);
    units = await createDefaultUnits(ctx.businessId);
    console.log(`[setup] Business ID: ${ctx.businessId}`);

    const cat = await upsertProductCategory({
      businessId: ctx.businessId,
      userId: ctx.userId,
      name: "Matcha",
    });
    productCategoryId = cat.id;
  }, 30000);

  afterAll(async () => {
    console.log(`[cleanup] Eliminando datos de prueba...`);
    if (ctx?.businessId) {
      await cleanupTestBusiness(ctx.businessId);
    }
    await prisma.$disconnect();
    console.log(`[cleanup] OK`);
  }, 30000);

  // ─── STEP 1: Proveedor ──────────────────────────────────────────

  it("1. Crea proveedor", { timeout: 15000 }, async () => {
    const s = await upsertSupplier({
      businessId: ctx.businessId,
      userId: ctx.userId,
      name: "Distribuidora Test",
    });
    supplierId = s.id;
    expect(supplierId).toBeTruthy();
  });

  // ─── STEP 2: Ingredientes materia prima ──────────────────────────

  it("2. Crea 9 ingredientes de materia prima con unidades de compra", { timeout: 30000 }, async () => {
    const defs = [
      { key: "matcha", sku: "ING-MATCHA", name: "Matcha ceremonial", base: "g", pu: "kg", factor: 1000 },
      { key: "leche", sku: "ING-LECHE", name: "Leche entera", base: "ml", pu: "l", factor: 1000 },
      { key: "hielo", sku: "ING-HIELO", name: "Hielo", base: "g", pu: "kg", factor: 1000 },
      { key: "fresas", sku: "ING-FRESAS", name: "Fresas", base: "g", pu: "kg", factor: 1000 },
      { key: "azucar", sku: "ING-AZUCAR", name: "Azúcar", base: "g", pu: "kg", factor: 1000 },
      { key: "agua", sku: "ING-AGUA", name: "Agua purificada", base: "ml", pu: "l", factor: 1000 },
      { key: "gas", sku: "ING-GAS", name: "Gas propano", base: "kg", pu: "kg", factor: 1 },
      { key: "vaso16", sku: "ING-VASO16", name: "Vaso 16oz", base: "u", pu: "u", factor: 1 },
      { key: "pajilla", sku: "ING-PAJILLA", name: "Pajilla", base: "u", pu: "u", factor: 1 },
    ];

    for (const def of defs) {
      const ing = await upsertIngredient({
        businessId: ctx.businessId,
        userId: ctx.userId,
        sku: def.sku,
        name: def.name,
        baseUnitId: units[def.base],
        purchaseUnitId: units[def.pu],
        conversionFactor: def.factor,
      });

      const pu = await prisma.ingredientPurchaseUnit.findFirst({
        where: { ingredientId: ing.id, active: true },
      });
      expect(pu).toBeTruthy();
      raw[def.key] = { id: ing.id, puId: pu!.id };
    }

    expect(Object.keys(raw)).toHaveLength(9);
  });

  // ─── STEP 3: Compra materia prima ────────────────────────────────

  it("3. Registra compra de materia prima y verifica stock > 0", { timeout: 180000 }, async () => {
    const items = [
      { key: "matcha", purchaseQty: 1, unitPrice: 450, lineTotal: 450 },
      { key: "leche", purchaseQty: 10, unitPrice: 12, lineTotal: 120 },
      { key: "hielo", purchaseQty: 5, unitPrice: 2, lineTotal: 10 },
      { key: "fresas", purchaseQty: 2, unitPrice: 30, lineTotal: 60 },
      { key: "azucar", purchaseQty: 5, unitPrice: 8, lineTotal: 40 },
      { key: "agua", purchaseQty: 20, unitPrice: 0.75, lineTotal: 15 },
      { key: "vaso16", purchaseQty: 100, unitPrice: 1.5, lineTotal: 150 },
      { key: "pajilla", purchaseQty: 100, unitPrice: 0.25, lineTotal: 25 },
      { key: "gas", purchaseQty: 10, unitPrice: 4, lineTotal: 40 },
    ];

    for (const item of items) {
      await receivePurchase({
        businessId: ctx.businessId,
        userId: ctx.userId,
        supplierId,
        paymentMethod: PaymentMethod.TRANSFER,
        paymentStatus: PaymentStatus.PAID,
        items: [{
          ingredientId: raw[item.key].id,
          purchaseUnitId: raw[item.key].puId,
          purchaseQuantity: item.purchaseQty,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        }],
      });
      await new Promise(r => setTimeout(r, 300));
    }

    for (const item of items) {
      const stock = await getIngredientStock(ctx.businessId, raw[item.key].id);
      expect(stock.gt(0)).toBe(true);
    }

    const matcha = await prisma.ingredient.findUnique({
      where: { id: raw.matcha.id },
    });
    expect(Number(matcha!.currentAverageCost)).toBeGreaterThan(0);
  });

  // ─── STEP 4: Subproducto ─────────────────────────────────────────

  it("4. Crea ingrediente Jalea de Fresa (sin receta todavia)", { timeout: 15000 }, async () => {
    const ing = await upsertIngredient({
      businessId: ctx.businessId,
      userId: ctx.userId,
      sku: "SUB-JALEA",
      name: "Jalea de Fresa",
      baseUnitId: units.g,
      minimumStock: 500,
    });
    jaleaIngredientId = ing.id;
    expect(jaleaIngredientId).toBeTruthy();
    expect(ing.recipeId).toBeNull();
  });

  // ─── STEP 5: Receta subproducto ──────────────────────────────────

  it("5. Crea receta para Jalea de Fresa (rendimiento 1000g)", { timeout: 15000 }, async () => {
    const result = await saveSubproductRecipe({
      businessId: ctx.businessId,
      userId: ctx.userId,
      ingredientId: jaleaIngredientId,
      yieldQuantity: 1000,
      notes: "Receta base jalea de fresa",
      items: [
        { ingredientId: raw.fresas.id, quantity: 600, wastePercentage: 5 },
        { ingredientId: raw.azucar.id, quantity: 300 },
        { ingredientId: raw.agua.id, quantity: 100 },
        { ingredientId: raw.gas.id, quantity: 0.1 },
      ],
    });

    expect(result.recipe.id).toBeTruthy();
    expect(Number(result.unitCost)).toBeGreaterThan(0);
    expect(result.recipe.active).toBe(true);
    expect(result.recipe.productId).toBeNull();

    const updated = await prisma.ingredient.findUnique({
      where: { id: jaleaIngredientId },
    });
    expect(updated!.recipeId).toBe(result.recipe.id);

    const items = await prisma.recipeItem.findMany({
      where: { recipeId: result.recipe.id },
    });
    expect(items).toHaveLength(4);
  });

  // ─── STEP 6: Orden de produccion ─────────────────────────────────

  it("6. Crea y completa orden de produccion de 2000g de Jalea de Fresa", { timeout: 30000 }, async () => {
    const createResult = await createProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      ingredientId: jaleaIngredientId,
      quantity: 2000,
    });

    orderId = createResult.order.id;
    expect(createResult.order.status).toBe(ProductionStatus.DRAFT);
    expect(Number(createResult.estimatedUnitCost)).toBeGreaterThan(0);

    const started = await startProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      orderId,
    });
    expect(started.status).toBe(ProductionStatus.IN_PROGRESS);

    const completed = await completeProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      orderId,
    });

    expect(completed.status).toBe(ProductionStatus.COMPLETED);
    expect(Number(completed.unitCost)).toBeGreaterThan(0);

    const jaleaStock = await getIngredientStock(ctx.businessId, jaleaIngredientId);
    expect(jaleaStock.toNumber()).toBe(2000);

    const fresasStock = await getIngredientStock(ctx.businessId, raw.fresas.id);
    expect(fresasStock.toNumber()).toBe(740);

    const azucarStock = await getIngredientStock(ctx.businessId, raw.azucar.id);
    expect(azucarStock.toNumber()).toBe(4400);

    const aguaStock = await getIngredientStock(ctx.businessId, raw.agua.id);
    expect(aguaStock.toNumber()).toBe(19800);

    const gasStock = await getIngredientStock(ctx.businessId, raw.gas.id);
    expect(gasStock.toNumber()).toBe(9.8);
  });

  // ─── STEP 7: Producto final ──────────────────────────────────────

  it("7. Crea producto Strawberry Matcha a Q42", { timeout: 15000 }, async () => {
    const prod = await upsertProduct({
      businessId: ctx.businessId,
      userId: ctx.userId,
      sku: "BEB-013",
      name: "Strawberry Matcha",
      salePrice: 42,
      categoryId: productCategoryId,
    });
    strawberryProductId = prod.id;
    expect(Number(prod.salePrice)).toBe(42);
  });

  // ─── STEP 8: Receta del producto (con saveRecipe directo) ─────────

  it("8. Crea receta de Strawberry Matcha via saveRecipe (subproducto incluido)", { timeout: 15000 }, async () => {
    const result = await saveRecipe({
      businessId: ctx.businessId,
      userId: ctx.userId,
      productId: strawberryProductId,
      yieldQuantity: 1,
      items: [
        { ingredientId: raw.matcha.id, quantity: 3, wastePercentage: 5 },
        { ingredientId: raw.leche.id, quantity: 250 },
        { ingredientId: raw.hielo.id, quantity: 120 },
        { ingredientId: raw.agua.id, quantity: 50 },
        { ingredientId: jaleaIngredientId, quantity: 40 },
        { ingredientId: raw.vaso16.id, quantity: 1 },
        { ingredientId: raw.pajilla.id, quantity: 1 },
      ],
    });
    expect(result.recipe.id).toBeTruthy();
    expect(Number(result.unitCost)).toBeGreaterThan(0);
    expect(result.recipe.active).toBe(true);
  });

  // ─── STEP 9: Abrir caja ──────────────────────────────────────────

  it("9. Abre sesion de caja con Q500", { timeout: 15000 }, async () => {
    const session = await openCashSession({
      businessId: ctx.businessId,
      userId: ctx.userId,
      openingAmount: 500,
    });
    expect(session.status).toBe("OPEN");
    expect(Number(session.openingAmount)).toBe(500);
  });

  // ─── STEP 10: Venta ──────────────────────────────────────────────

  it("10. Registra venta de 2x Strawberry Matcha en efectivo", { timeout: 30000 }, async () => {
    const result = await createSale({
      businessId: ctx.businessId,
      userId: ctx.userId,
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: strawberryProductId, quantity: 2 }],
    });

    expect(result.sale.status).toBe(SaleStatus.CONFIRMED);
    expect(result.sale.saleNumber).toBe(1);
    expect(result.warnings).toHaveLength(0);

    const total = Number(result.sale.total);
    expect(total).toBeGreaterThan(0);

    const totals = calculateSaleTotals(
      [{ quantity: 2, unitPrice: 42, discount: 0 }],
      12,
    );
    expect(total).toBe(totals.total.toNumber());

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        businessId: ctx.businessId,
        referenceType: "sale_item",
        referenceId: result.sale.id,
      },
    });
    expect(movements).toHaveLength(7);
    for (const m of movements) {
      expect(Number(m.quantityDelta)).toBeLessThan(0);
    }
  });

  // ─── STEP 11: Verificar inventario ───────────────────────────────

  it("11. Inventario final cuadra con todo el flujo", { timeout: 15000 }, async () => {
    const jaleaStock = await getIngredientStock(ctx.businessId, jaleaIngredientId);
    expect(jaleaStock.toNumber()).toBeCloseTo(1920, 0);

    const expected: Record<string, number> = {
      matcha: 1000 - (3 * 1.05 * 2),
      leche: 10000 - (250 * 2),
      hielo: 5000 - (120 * 2),
      fresas: 2000 - (600 * 1.05 * 2),
      azucar: 5000 - (300 * 2),
      agua: 20000 - (100 * 2) - (50 * 2),
      gas: 10 - (0.1 * 2),
      vaso16: 100 - (1 * 2),
      pajilla: 100 - (1 * 2),
    };

    for (const [key, exp] of Object.entries(expected)) {
      const stock = await getIngredientStock(ctx.businessId, raw[key].id);
      expect(stock.toNumber()).toBeCloseTo(exp, 1);
    }
  });

  // ─── STEP 12: Cerrar caja ────────────────────────────────────────

  it("12. Cierra sesion de caja", { timeout: 15000 }, async () => {
    const totals = calculateSaleTotals(
      [{ quantity: 2, unitPrice: 42, discount: 0 }],
      12,
    );
    const countedAmount = 500 + totals.total.toNumber();

    const closed = await closeCashSession({
      businessId: ctx.businessId,
      userId: ctx.userId,
      countedAmount,
    });

    expect(closed.status).toBe("CLOSED");
    expect(Number(closed.countedAmount)).toBe(countedAmount);
  });

  it("13. Asigna números distintos cuando se crean órdenes en paralelo", { timeout: 30000 }, async () => {
    const [first, second] = await Promise.all([
      createProductionOrder({
        businessId: ctx.businessId,
        userId: ctx.userId,
        ingredientId: jaleaIngredientId,
        quantity: 1,
      }),
      createProductionOrder({
        businessId: ctx.businessId,
        userId: ctx.userId,
        ingredientId: jaleaIngredientId,
        quantity: 1,
      }),
    ]);

    expect(first.order.orderNumber).not.toBe(second.order.orderNumber);
    expect(first.order.status).toBe(ProductionStatus.DRAFT);
    expect(second.order.status).toBe(ProductionStatus.DRAFT);

    const immediate = await createProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      ingredientId: jaleaIngredientId,
      quantity: 1,
      startImmediately: true,
    });
    expect(immediate.order.status).toBe(ProductionStatus.IN_PROGRESS);
    const completed = await completeProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      orderId: immediate.order.id,
    });
    expect(completed.status).toBe(ProductionStatus.COMPLETED);
  });

  it("14. Completar dos veces en paralelo solo genera un lote de movimientos", { timeout: 30000 }, async () => {
    const created = await createProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      ingredientId: jaleaIngredientId,
      quantity: 1,
    });
    await startProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      orderId: created.order.id,
    });

    const results = await Promise.allSettled([
      completeProductionOrder({ businessId: ctx.businessId, userId: ctx.userId, orderId: created.order.id }),
      completeProductionOrder({ businessId: ctx.businessId, userId: ctx.userId, orderId: created.order.id }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const movements = await prisma.inventoryMovement.count({
      where: { businessId: ctx.businessId, referenceType: "production", referenceId: created.order.id },
    });
    expect(movements).toBe(created.items.length + 1);
  });

  it("15. Anular una producción completa revierte movimientos e idempotentemente no repite la reversa", { timeout: 30000 }, async () => {
    const created = await createProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      ingredientId: jaleaIngredientId,
      quantity: 1,
    });
    await startProductionOrder({ businessId: ctx.businessId, userId: ctx.userId, orderId: created.order.id });
    const completed = await completeProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      orderId: created.order.id,
      actualQuantity: 0.8,
    });
    expect(Number(completed.actualQuantity)).toBeCloseTo(0.8, 3);
    const cancelled = await cancelProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      orderId: created.order.id,
      reason: "Prueba de reversa controlada",
    });
    expect(cancelled.status).toBe(ProductionStatus.CANCELLED);

    const reversalCount = await prisma.inventoryMovement.count({
      where: { businessId: ctx.businessId, referenceType: "production_cancel", referenceId: created.order.id },
    });
    expect(reversalCount).toBe(created.items.length + 1);
    const secondCancel = await cancelProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      orderId: created.order.id,
      reason: "Segundo intento",
    });
    expect(secondCancel.status).toBe(ProductionStatus.CANCELLED);
    expect(completed.status).toBe(ProductionStatus.COMPLETED);
  });

  it("16. Stock insuficiente no cambia el estado ni crea movimientos", { timeout: 30000 }, async () => {
    const created = await createProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      ingredientId: jaleaIngredientId,
      quantity: 999999,
    });
    await startProductionOrder({ businessId: ctx.businessId, userId: ctx.userId, orderId: created.order.id });

    await expect(
      completeProductionOrder({ businessId: ctx.businessId, userId: ctx.userId, orderId: created.order.id }),
    ).rejects.toThrow(/Stock insuficiente/);

    const persisted = await prisma.productionOrder.findUnique({ where: { id: created.order.id } });
    expect(persisted?.status).toBe(ProductionStatus.IN_PROGRESS);
    const movements = await prisma.inventoryMovement.count({
      where: { businessId: ctx.businessId, referenceType: "production", referenceId: created.order.id },
    });
    expect(movements).toBe(0);
  });

  it("17. No permite anular si el subproducto ya no tiene existencia suficiente", { timeout: 30000 }, async () => {
    const created = await createProductionOrder({
      businessId: ctx.businessId,
      userId: ctx.userId,
      ingredientId: jaleaIngredientId,
      quantity: 1,
    });
    await startProductionOrder({ businessId: ctx.businessId, userId: ctx.userId, orderId: created.order.id });
    const completed = await completeProductionOrder({ businessId: ctx.businessId, userId: ctx.userId, orderId: created.order.id });
    const stock = await getIngredientStock(ctx.businessId, jaleaIngredientId);
    await prisma.inventoryMovement.create({
      data: {
        businessId: ctx.businessId,
        ingredientId: jaleaIngredientId,
        movementType: MovementType.SALE,
        quantityDelta: stock.plus(1).neg().toFixed(3),
        unitCost: completed.unitCost,
        referenceType: "test_consume",
        reason: "Consumo total de prueba",
        userId: ctx.userId,
      },
    });

    await expect(
      cancelProductionOrder({
        businessId: ctx.businessId,
        userId: ctx.userId,
        orderId: created.order.id,
        reason: "Debe bloquearse por stock insuficiente",
      }),
    ).rejects.toThrow(/No se puede anular/);
    const persisted = await prisma.productionOrder.findUnique({ where: { id: created.order.id } });
    expect(persisted?.status).toBe(ProductionStatus.COMPLETED);
    const reversals = await prisma.inventoryMovement.count({
      where: { businessId: ctx.businessId, referenceType: "production_cancel", referenceId: created.order.id },
    });
    expect(reversals).toBe(0);
  });
});
