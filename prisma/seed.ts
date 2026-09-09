import {
  ExpenseCategory,
  MovementType,
  PaymentMethod,
  Prisma,
  PrismaClient,
  SaleStatus,
} from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { readFileSync } from "fs";
import { join } from "path";
import {
  d,
  money,
  toFixedCost,
  toFixedMoney,
  toFixedQty,
  weightedAverageCost,
  effectiveRecipeQty,
} from "../src/lib/decimal";
import { calculateSaleTotals } from "../src/modules/sales/totals";
import { calculateRecipeUnitCost } from "../src/modules/recipes/cost";

function createSeedClient() {
  let url = process.env.DATABASE_URL ?? "";
  url = url.replace(":5432", ":6543");
  const separator = url.includes("?") ? "&" : "?";
  url = `${url}${separator}pgbouncer=true&connection_limit=3&pool_timeout=10`;
  return new PrismaClient({ datasources: { db: { url } } });
}

const prisma = createSeedClient();

const argonOpts = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

const DEMO_MODE = process.env.SEED_MODE === "demo" || process.argv.includes("--demo");

const SEED_DAYS = 5;

function daysAgo(n: number) {
  const dte = new Date();
  dte.setHours(10, 0, 0, 0);
  dte.setDate(dte.getDate() - Math.min(n, SEED_DAYS));
  return dte;
}

async function main() {
  const t0 = Date.now();
  console.log("Cleaning database...");
  const tables = [
    "audit_log",
    "sale_items",
    "sales",
    "purchase_items",
    "purchases",
    "inventory_count_items",
    "inventory_counts",
    "inventory_movements",
    "expenses",
    "cash_movements",
    "cash_sessions",
    "recipe_items",
    "recipes",
    "production_orders",
    "ingredient_purchase_units",
    "ingredients",
    "ingredient_categories",
    "products",
    "product_categories",
    "suppliers",
    "units",
    "users",
    "businesses",
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE;`).catch(() => {
      // table may not exist yet
    });
  }

  console.log("Creating business and owner...");
  const business = await prisma.business.create({
    data: {
      name: "Mucho Matcha",
      currency: "GTQ",
      timezone: "America/Guatemala",
      taxRate: "12.00",
    },
  });

  const passwordHash = await hash("Matcha2026!", argonOpts);
  const owner = await prisma.user.create({
    data: {
      businessId: business.id,
      name: "Propietario",
      email: "owner@muchomatcha.gt",
      passwordHash,
      role: "OWNER",
    },
  });

  const unitDefs = [
    { code: "g", name: "Gramo", decimals: 3 },
    { code: "kg", name: "Kilogramo", decimals: 3 },
    { code: "ml", name: "Mililitro", decimals: 3 },
    { code: "l", name: "Litro", decimals: 3 },
    { code: "u", name: "Unidad", decimals: 0 },
    { code: "pq", name: "Paquete", decimals: 0 },
  ];
  const units: Record<string, string> = {};
  for (const u of unitDefs) {
    const row = await prisma.unit.create({
      data: { businessId: business.id, ...u },
    });
    units[u.code] = row.id;
  }

  const productCats = ["Bebidas", "Matcha", "Panadería", "Comida", "Extras"];
  const pCatIds: Record<string, string> = {};
  for (const name of productCats) {
    const c = await prisma.productCategory.create({
      data: { businessId: business.id, name },
    });
    pCatIds[name] = c.id;
  }

  const ingCats = ["Lácteos", "Tés", "Endulzantes", "Panadería", "Empaques", "Otros"];
  const iCatIds: Record<string, string> = {};
  for (const name of ingCats) {
    const c = await prisma.ingredientCategory.create({
      data: { businessId: business.id, name },
    });
    iCatIds[name] = c.id;
  }

  if (!DEMO_MODE) {
    console.log("Modo limpio: solo negocio, usuario y unidades base creados.");
    await applyBiViews(prisma);
    console.log("Seed limpio completado en", Math.round((Date.now() - t0) / 1000), "segundos.");
    console.log("Login: owner@muchomatcha.gt / Matcha2026!");
    return;
  }

  console.log("Modo demo: poblando datos de ejemplo...");

  type IngDef = {
    sku: string;
    name: string;
    unit: string;
    cat: string;
    min: number;
    purchase?: { unit: string; factor: number };
  };

  const ingredientDefs: IngDef[] = [
    { sku: "ING-LECHE", name: "Leche entera", unit: "ml", cat: "Lácteos", min: 5000, purchase: { unit: "l", factor: 1000 } },
    { sku: "ING-LECHEV", name: "Leche vegetal", unit: "ml", cat: "Lácteos", min: 2000, purchase: { unit: "l", factor: 1000 } },
    { sku: "ING-MATCHA", name: "Matcha ceremonial", unit: "g", cat: "Tés", min: 200, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-MATCHAC", name: "Matcha culinario", unit: "g", cat: "Tés", min: 300, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-TEVERDE", name: "Té verde", unit: "g", cat: "Tés", min: 150, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-TECHA", name: "Té chai", unit: "g", cat: "Tés", min: 150, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-CAFE", name: "Café molido", unit: "g", cat: "Tés", min: 1000, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-AZUCAR", name: "Azúcar", unit: "g", cat: "Endulzantes", min: 2000, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-MIEL", name: "Miel", unit: "ml", cat: "Endulzantes", min: 500, purchase: { unit: "l", factor: 1000 } },
    { sku: "ING-JARABE", name: "Jarabe vainilla", unit: "ml", cat: "Endulzantes", min: 500, purchase: { unit: "l", factor: 1000 } },
    { sku: "ING-HIELO", name: "Hielo", unit: "g", cat: "Otros", min: 5000, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-AGUA", name: "Agua filtrada", unit: "ml", cat: "Otros", min: 10000, purchase: { unit: "l", factor: 1000 } },
    { sku: "ING-CREMA", name: "Crema batir", unit: "ml", cat: "Lácteos", min: 1000, purchase: { unit: "l", factor: 1000 } },
    { sku: "ING-CHOCO", name: "Cacao", unit: "g", cat: "Otros", min: 300, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-HARINA", name: "Harina", unit: "g", cat: "Panadería", min: 3000, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-MANTEQ", name: "Mantequilla", unit: "g", cat: "Panadería", min: 1000, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-HUEVO", name: "Huevo", unit: "u", cat: "Panadería", min: 30, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-QUESO", name: "Queso crema", unit: "g", cat: "Lácteos", min: 500, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-PAN", name: "Pan brioche", unit: "u", cat: "Panadería", min: 20, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-AGUAC", name: "Aguacate", unit: "u", cat: "Otros", min: 10, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-TOMATE", name: "Tomate", unit: "g", cat: "Otros", min: 1000, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-LECHUGA", name: "Lechuga", unit: "g", cat: "Otros", min: 500, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-JAMON", name: "Jamón", unit: "g", cat: "Otros", min: 500, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-VASO12", name: "Vaso 12oz", unit: "u", cat: "Empaques", min: 100, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-VASO16", name: "Vaso 16oz", unit: "u", cat: "Empaques", min: 100, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-TAPA", name: "Tapa vaso", unit: "u", cat: "Empaques", min: 100, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-PAJILLA", name: "Pajilla", unit: "u", cat: "Empaques", min: 100, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-BOLSA", name: "Bolsa papel", unit: "u", cat: "Empaques", min: 50, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-NAPKIN", name: "Servilleta", unit: "u", cat: "Empaques", min: 200, purchase: { unit: "u", factor: 1 } },
    { sku: "ING-GRANOLA", name: "Granola", unit: "g", cat: "Otros", min: 500, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-FRESAS", name: "Fresas", unit: "g", cat: "Otros", min: 1000, purchase: { unit: "kg", factor: 1000 } },
    { sku: "ING-GAS", name: "Gas propano", unit: "u", cat: "Otros", min: 1, purchase: { unit: "u", factor: 1 } },
  ];

  const ingredients: Record<string, { id: string; unit: string }> = {};
  const purchaseUnitIds: Record<string, string> = {};

  for (const def of ingredientDefs) {
    const ing = await prisma.ingredient.create({
      data: {
        businessId: business.id,
        categoryId: iCatIds[def.cat],
        sku: def.sku,
        name: def.name,
        baseUnitId: units[def.unit],
        minimumStock: toFixedQty(def.min),
        currentAverageCost: toFixedCost(0),
      },
    });
    ingredients[def.sku] = { id: ing.id, unit: def.unit };
    if (def.purchase) {
      const pu = await prisma.ingredientPurchaseUnit.create({
        data: {
          ingredientId: ing.id,
          unitId: units[def.purchase.unit],
          conversionFactor: def.purchase.factor.toFixed(6),
        },
      });
      purchaseUnitIds[def.sku] = pu.id;
      // also allow buying in base unit 1:1
      if (def.purchase.unit !== def.unit) {
        await prisma.ingredientPurchaseUnit.create({
          data: {
            ingredientId: ing.id,
            unitId: units[def.unit],
            conversionFactor: "1.000000",
          },
        });
      }
    }
  }

  const suppliersData = [
    { name: "Distribuidora Café GT", taxId: "1234567-8", phone: "2222-1111" },
    { name: "Lácteos del Valle", taxId: "2345678-9", phone: "2222-2222" },
    { name: "Tés del Mundo", taxId: "3456789-0", phone: "2222-3333" },
    { name: "Empaques Eco", taxId: "4567890-1", phone: "2222-4444" },
    { name: "Pan Artesanal", taxId: "5678901-2", phone: "2222-5555" },
  ];
  const supplierIds: string[] = [];
  for (const s of suppliersData) {
    const row = await prisma.supplier.create({
      data: { businessId: business.id, ...s, email: `${s.name.split(" ")[0].toLowerCase()}@prov.gt` },
    });
    supplierIds.push(row.id);
  }

  type ProdDef = { sku: string; name: string; cat: string; price: number; recipe: Array<{ sku: string; qty: number; waste?: number }> };
  const productsDefs: ProdDef[] = [
    { sku: "BEB-001", name: "Matcha Latte", cat: "Matcha", price: 32, recipe: [{ sku: "ING-MATCHA", qty: 3, waste: 5 }, { sku: "ING-LECHE", qty: 250 }, { sku: "ING-VASO12", qty: 1 }, { sku: "ING-TAPA", qty: 1 }] },
    { sku: "BEB-002", name: "Matcha Latte Grande", cat: "Matcha", price: 38, recipe: [{ sku: "ING-MATCHA", qty: 4, waste: 5 }, { sku: "ING-LECHE", qty: 350 }, { sku: "ING-VASO16", qty: 1 }, { sku: "ING-TAPA", qty: 1 }] },
    { sku: "BEB-003", name: "Iced Matcha", cat: "Matcha", price: 34, recipe: [{ sku: "ING-MATCHA", qty: 3 }, { sku: "ING-LECHE", qty: 200 }, { sku: "ING-HIELO", qty: 120 }, { sku: "ING-VASO16", qty: 1 }, { sku: "ING-PAJILLA", qty: 1 }] },
    { sku: "BEB-004", name: "Matcha Vainilla", cat: "Matcha", price: 36, recipe: [{ sku: "ING-MATCHA", qty: 3 }, { sku: "ING-LECHE", qty: 240 }, { sku: "ING-JARABE", qty: 20 }, { sku: "ING-VASO12", qty: 1 }] },
    { sku: "BEB-005", name: "Café Americano", cat: "Bebidas", price: 18, recipe: [{ sku: "ING-CAFE", qty: 18 }, { sku: "ING-AGUA", qty: 240 }, { sku: "ING-VASO12", qty: 1 }] },
    { sku: "BEB-006", name: "Cappuccino", cat: "Bebidas", price: 26, recipe: [{ sku: "ING-CAFE", qty: 18 }, { sku: "ING-LECHE", qty: 180 }, { sku: "ING-VASO12", qty: 1 }] },
    { sku: "BEB-007", name: "Latte Clásico", cat: "Bebidas", price: 28, recipe: [{ sku: "ING-CAFE", qty: 18 }, { sku: "ING-LECHE", qty: 250 }, { sku: "ING-VASO12", qty: 1 }] },
    { sku: "BEB-008", name: "Chai Latte", cat: "Bebidas", price: 30, recipe: [{ sku: "ING-TECHA", qty: 4 }, { sku: "ING-LECHE", qty: 250 }, { sku: "ING-MIEL", qty: 15 }, { sku: "ING-VASO12", qty: 1 }] },
    { sku: "BEB-009", name: "Té Verde", cat: "Bebidas", price: 16, recipe: [{ sku: "ING-TEVERDE", qty: 3 }, { sku: "ING-AGUA", qty: 300 }, { sku: "ING-VASO12", qty: 1 }] },
    { sku: "BEB-010", name: "Chocolate Caliente", cat: "Bebidas", price: 24, recipe: [{ sku: "ING-CHOCO", qty: 20 }, { sku: "ING-LECHE", qty: 250 }, { sku: "ING-AZUCAR", qty: 10 }, { sku: "ING-VASO12", qty: 1 }] },
    { sku: "BEB-011", name: "Matcha Frappe", cat: "Matcha", price: 40, recipe: [{ sku: "ING-MATCHAC", qty: 5 }, { sku: "ING-LECHE", qty: 200 }, { sku: "ING-HIELO", qty: 150 }, { sku: "ING-AZUCAR", qty: 15 }, { sku: "ING-VASO16", qty: 1 }, { sku: "ING-PAJILLA", qty: 1 }] },
    { sku: "BEB-012", name: "Cold Brew", cat: "Bebidas", price: 28, recipe: [{ sku: "ING-CAFE", qty: 25 }, { sku: "ING-AGUA", qty: 300 }, { sku: "ING-HIELO", qty: 100 }, { sku: "ING-VASO16", qty: 1 }] },
    { sku: "PAN-001", name: "Croissant", cat: "Panadería", price: 15, recipe: [{ sku: "ING-HARINA", qty: 40 }, { sku: "ING-MANTEQ", qty: 20 }, { sku: "ING-HUEVO", qty: 0.2 }, { sku: "ING-NAPKIN", qty: 1 }] },
    { sku: "PAN-002", name: "Muffin matcha", cat: "Panadería", price: 18, recipe: [{ sku: "ING-HARINA", qty: 45 }, { sku: "ING-MATCHAC", qty: 4 }, { sku: "ING-AZUCAR", qty: 20 }, { sku: "ING-HUEVO", qty: 0.3 }, { sku: "ING-NAPKIN", qty: 1 }] },
    { sku: "PAN-003", name: "Cookie chocolate", cat: "Panadería", price: 12, recipe: [{ sku: "ING-HARINA", qty: 30 }, { sku: "ING-CHOCO", qty: 15 }, { sku: "ING-AZUCAR", qty: 15 }, { sku: "ING-MANTEQ", qty: 12 }] },
    { sku: "COM-001", name: "Sandwich jamón", cat: "Comida", price: 35, recipe: [{ sku: "ING-PAN", qty: 1 }, { sku: "ING-JAMON", qty: 60 }, { sku: "ING-LECHUGA", qty: 20 }, { sku: "ING-TOMATE", qty: 30 }, { sku: "ING-BOLSA", qty: 1 }] },
    { sku: "COM-002", name: "Toast aguacate", cat: "Comida", price: 38, recipe: [{ sku: "ING-PAN", qty: 1 }, { sku: "ING-AGUAC", qty: 0.5 }, { sku: "ING-TOMATE", qty: 20 }, { sku: "ING-NAPKIN", qty: 1 }] },
    { sku: "COM-003", name: "Bagel queso", cat: "Comida", price: 32, recipe: [{ sku: "ING-PAN", qty: 1 }, { sku: "ING-QUESO", qty: 40 }, { sku: "ING-NAPKIN", qty: 1 }] },
    { sku: "EXT-001", name: "Extra shot matcha", cat: "Extras", price: 8, recipe: [{ sku: "ING-MATCHA", qty: 2 }] },
    { sku: "EXT-002", name: "Granola bowl top", cat: "Extras", price: 10, recipe: [{ sku: "ING-GRANOLA", qty: 40 }, { sku: "ING-MIEL", qty: 10 }] },
  ];

  const productIds: Record<string, string> = {};
  for (const p of productsDefs) {
    const row = await prisma.product.create({
      data: {
        businessId: business.id,
        categoryId: pCatIds[p.cat],
        sku: p.sku,
        name: p.name,
        salePrice: toFixedMoney(p.price),
        taxIncluded: false,
      },
    });
    productIds[p.sku] = row.id;

    await prisma.recipe.create({
      data: {
        businessId: business.id,
        productId: row.id,
        version: 1,
        yieldQuantity: "1.000",
        active: true,
        items: {
          create: p.recipe.map((r) => ({
            ingredientId: ingredients[r.sku].id,
            quantity: toFixedQty(r.qty),
            wastePercentage: (r.waste ?? 0).toFixed(2),
          })),
        },
      },
    });
  }

  // Subproducto de ejemplo: Jalea de Fresa
  console.log("Seeding subproduct...");
  const jaleaIng = await prisma.ingredient.create({
    data: {
      businessId: business.id,
      categoryId: iCatIds["Otros"],
      sku: "SUB-JALEA",
      name: "Jalea de Fresa",
      baseUnitId: units["g"],
      minimumStock: toFixedQty(500),
      currentAverageCost: toFixedCost(0),
    },
  });
  const jaleaRecipe = await prisma.recipe.create({
    data: {
      businessId: business.id,
      productId: null,
      version: 1,
      yieldQuantity: toFixedQty(1000),
      active: true,
      notes: "Receta base para jalea de fresa artesanal",
      items: {
        create: [
          { ingredientId: ingredients["ING-FRESAS"].id, quantity: toFixedQty(600), wastePercentage: "5.00" },
          { ingredientId: ingredients["ING-AZUCAR"].id, quantity: toFixedQty(300) },
          { ingredientId: ingredients["ING-AGUA"].id, quantity: toFixedQty(100) },
          { ingredientId: ingredients["ING-GAS"].id, quantity: toFixedQty(0.1) },
        ],
      },
    },
  });
  await prisma.ingredient.update({
    where: { id: jaleaIng.id },
    data: { recipeId: jaleaRecipe.id },
  });
  // add jalea to the ingredients map so product recipes can reference it
  ingredients["SUB-JALEA"] = { id: jaleaIng.id, unit: "g" };

  // Producto demo que usa subproducto: Strawberry Matcha
  const strawberryProduct = await prisma.product.create({
    data: {
      businessId: business.id,
      categoryId: pCatIds["Matcha"],
      sku: "BEB-013",
      name: "Strawberry Matcha",
      salePrice: toFixedMoney(42),
      taxIncluded: false,
    },
  });
  await prisma.recipe.create({
    data: {
      businessId: business.id,
      productId: strawberryProduct.id,
      version: 1,
      yieldQuantity: "1.000",
      active: true,
      items: {
        create: [
          { ingredientId: ingredients["ING-MATCHA"].id, quantity: toFixedQty(3), wastePercentage: "5.00" },
          { ingredientId: ingredients["ING-LECHE"].id, quantity: toFixedQty(250) },
          { ingredientId: ingredients["ING-HIELO"].id, quantity: toFixedQty(120) },
          { ingredientId: ingredients["ING-AGUA"].id, quantity: toFixedQty(50) },
          { ingredientId: jaleaIng.id, quantity: toFixedQty(40) },
          { ingredientId: ingredients["ING-VASO16"].id, quantity: toFixedQty(1) },
          { ingredientId: ingredients["ING-PAJILLA"].id, quantity: toFixedQty(1) },
        ],
      },
    },
  });

  // Purchases over time to stock inventory
  console.log("Seeding purchases...");
  const purchaseBatches = [
    { day: 58, supplier: 0, items: [
      { sku: "ING-MATCHA", qty: 1, total: 450 },
      { sku: "ING-MATCHAC", qty: 2, total: 500 },
      { sku: "ING-CAFE", qty: 5, total: 400 },
      { sku: "ING-TEVERDE", qty: 1, total: 180 },
      { sku: "ING-TECHA", qty: 1, total: 200 },
    ]},
    { day: 55, supplier: 1, items: [
      { sku: "ING-LECHE", qty: 40, total: 480 },
      { sku: "ING-LECHEV", qty: 10, total: 220 },
      { sku: "ING-CREMA", qty: 5, total: 150 },
      { sku: "ING-QUESO", qty: 2, total: 160 },
    ]},
    { day: 50, supplier: 3, items: [
      { sku: "ING-VASO12", qty: 500, total: 250 },
      { sku: "ING-VASO16", qty: 400, total: 240 },
      { sku: "ING-TAPA", qty: 900, total: 180 },
      { sku: "ING-PAJILLA", qty: 1000, total: 80 },
      { sku: "ING-BOLSA", qty: 300, total: 90 },
      { sku: "ING-NAPKIN", qty: 2000, total: 60 },
    ]},
    { day: 45, supplier: 4, items: [
      { sku: "ING-HARINA", qty: 10, total: 120 },
      { sku: "ING-MANTEQ", qty: 5, total: 200 },
      { sku: "ING-HUEVO", qty: 120, total: 180 },
      { sku: "ING-PAN", qty: 80, total: 240 },
      { sku: "ING-AZUCAR", qty: 5, total: 50 },
      { sku: "ING-FRESAS", qty: 3, total: 90 },
    ]},
    { day: 40, supplier: 2, items: [
      { sku: "ING-MIEL", qty: 3, total: 150 },
      { sku: "ING-JARABE", qty: 4, total: 200 },
      { sku: "ING-CHOCO", qty: 2, total: 160 },
      { sku: "ING-GRANOLA", qty: 3, total: 180 },
      { sku: "ING-GAS", qty: 2, total: 40 },
    ]},
  ];

  // generate ~5 purchases
  for (let i = 0; i < SEED_DAYS; i++) {
    const batch = purchaseBatches[i % purchaseBatches.length];
    const day = batch.day - Math.floor(i / purchaseBatches.length) * 7;
    const supplierId = supplierIds[(batch.supplier + i) % supplierIds.length];
    let subtotal = d(0);
    const prepared: Array<{
      ingredientId: string;
      purchaseUnitId: string;
      purchaseQuantity: string;
      baseQuantity: string;
      unitCost: string;
      unitPrice: string;
      lineTotal: string;
    }> = [];

    for (const item of batch.items) {
      const puId = purchaseUnitIds[item.sku];
      const factor = ingredientDefs.find((x) => x.sku === item.sku)!.purchase!.factor;
      const baseQty = qtySafe(item.qty * factor);
      const lineTotal = money(item.total * (1 + (i % 3) * 0.02));
      const unitPrice = money(lineTotal.div(item.qty));
      subtotal = subtotal.plus(lineTotal);
      prepared.push({
        ingredientId: ingredients[item.sku].id,
        purchaseUnitId: puId,
        purchaseQuantity: toFixedQty(item.qty),
        baseQuantity: toFixedQty(baseQty),
        unitCost: toFixedCost(lineTotal.div(baseQty)),
        unitPrice: toFixedMoney(unitPrice),
        lineTotal: toFixedMoney(lineTotal),
      });
    }

    const tax = money(subtotal.mul(0.12));
    const purchase = await prisma.purchase.create({
      data: {
        businessId: business.id,
        supplierId,
        documentNumber: `FAC-${1000 + i}`,
        purchasedAt: daysAgo(Math.max(1, day)),
        paymentMethod: i % 2 === 0 ? PaymentMethod.TRANSFER : PaymentMethod.CASH,
        subtotal: toFixedMoney(subtotal),
        taxTotal: toFixedMoney(tax),
        total: toFixedMoney(subtotal.plus(tax)),
        userId: owner.id,
        status: "RECEIVED",
      },
    });

    for (const line of prepared) {
      await prisma.purchaseItem.create({
        data: { purchaseId: purchase.id, ...line },
      });
      const prev = await prisma.inventoryMovement.aggregate({
        where: { ingredientId: line.ingredientId },
        _sum: { quantityDelta: true },
      });
      const ing = await prisma.ingredient.findUniqueOrThrow({
        where: { id: line.ingredientId },
      });
      const newAvg = weightedAverageCost({
        previousQty: prev._sum.quantityDelta ?? 0,
        previousAvgCost: ing.currentAverageCost,
        inboundQty: line.baseQuantity,
        inboundUnitCost: line.unitCost,
      });
      await prisma.ingredient.update({
        where: { id: line.ingredientId },
        data: {
          currentAverageCost: toFixedCost(newAvg),
          lastPurchaseCost: line.unitCost,
        },
      });
      await prisma.inventoryMovement.create({
        data: {
          businessId: business.id,
          ingredientId: line.ingredientId,
          occurredAt: daysAgo(Math.max(1, day)),
          movementType: MovementType.PURCHASE,
          quantityDelta: line.baseQuantity,
          unitCost: line.unitCost,
          referenceType: "purchase",
          referenceId: purchase.id,
          reason: `Seed purchase ${purchase.documentNumber}`,
          userId: owner.id,
        },
      });
    }
  }

  // also seed remaining ingredients lightly
  for (const sku of ["ING-AGUA", "ING-HIELO", "ING-AGUAC", "ING-TOMATE", "ING-LECHUGA", "ING-JAMON"]) {
    const def = ingredientDefs.find((x) => x.sku === sku)!;
    const factor = def.purchase!.factor;
    const qtyPurchase = def.unit === "u" ? 50 : 10;
    const baseQty = qtyPurchase * factor;
    const unitCost = def.unit === "u" ? 3 : 0.01;
    const lineTotal = baseQty * unitCost;
    const prev = await prisma.inventoryMovement.aggregate({
      where: { ingredientId: ingredients[sku].id },
      _sum: { quantityDelta: true },
    });
    if (Number(prev._sum.quantityDelta ?? 0) > 0) continue;
    await prisma.ingredient.update({
      where: { id: ingredients[sku].id },
      data: { currentAverageCost: toFixedCost(unitCost) },
    });
    await prisma.inventoryMovement.create({
      data: {
        businessId: business.id,
        ingredientId: ingredients[sku].id,
        occurredAt: daysAgo(50),
        movementType: MovementType.INITIAL,
        quantityDelta: toFixedQty(baseQty),
        unitCost: toFixedCost(unitCost),
        referenceType: "initial",
        reason: "Inventario inicial seed",
        userId: owner.id,
      },
    });
    void lineTotal;
  }

  console.log("Seeding sales (5 days)...");
  const productList = Object.entries(productIds);
  const recipes = await prisma.recipe.findMany({
    where: { businessId: business.id, active: true },
    include: { items: { include: { ingredient: true } }, product: true },
  });
  const recipeByProduct = new Map(recipes.map((r) => [r.productId, r]));

  let saleNumber = 0;
  const bulkSaleItems: Array<{
    saleId: string;
    productId: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    tax: string;
    lineTotal: string;
    unitCostSnapshot: string;
  }> = [];
  const bulkMovements: Array<{
    businessId: string;
    ingredientId: string;
    occurredAt: Date;
    movementType: MovementType;
    quantityDelta: string;
    unitCost: string;
    referenceType: string;
    referenceId: string;
    reason: string;
    userId: string;
  }> = [];

  for (let day = SEED_DAYS; day >= 0; day--) {
    const open = await prisma.cashSession.create({
      data: {
        businessId: business.id,
        openedAt: daysAgo(day),
        openingAmount: "200.00",
        openedById: owner.id,
        status: day === 0 ? "OPEN" : "CLOSED",
      },
    });

    const tickets = 5 + day;
    let cashSales = d(0);

    for (let t = 0; t < tickets; t++) {
      saleNumber += 1;
      const itemCount = 1 + (t % 2);
      const chosen: Array<{ productId: string; quantity: number; unitPrice: number }> = [];
      for (let k = 0; k < itemCount; k++) {
        const [sku, pid] = productList[(day + t + k) % productList.length];
        const price = productsDefs.find((p) => p.sku === sku)!.price;
        chosen.push({ productId: pid, quantity: 1, unitPrice: price });
      }
      const totals = calculateSaleTotals(
        chosen.map((c) => ({ quantity: c.quantity, unitPrice: c.unitPrice })),
        12,
      );
      const method =
        t % 3 === 0 ? PaymentMethod.CARD : t % 3 === 1 ? PaymentMethod.TRANSFER : PaymentMethod.CASH;

      const soldAt = new Date(daysAgo(day));
      soldAt.setHours(8 + (t % 8), (t * 11) % 60, 0, 0);

      const sale = await prisma.sale.create({
        data: {
          businessId: business.id,
          saleNumber,
          soldAt,
          status: SaleStatus.CONFIRMED,
          paymentMethod: method,
          subtotal: toFixedMoney(totals.subtotal),
          discountTotal: toFixedMoney(totals.discountTotal),
          taxTotal: toFixedMoney(totals.taxTotal),
          total: toFixedMoney(totals.total),
          cashSessionId: method === PaymentMethod.CASH ? open.id : null,
          userId: owner.id,
        },
      });

      if (method === PaymentMethod.CASH) {
        cashSales = cashSales.plus(totals.total);
      }

      for (let i = 0; i < chosen.length; i++) {
        const c = chosen[i];
        const line = totals.lines[i];
        const recipe = recipeByProduct.get(c.productId);
        let unitCost = d(0);
        if (recipe) {
          unitCost = calculateRecipeUnitCost(
            recipe.items.map((ri) => ({
              quantity: ri.quantity.toString(),
              wastePercentage: ri.wastePercentage.toString(),
              averageCost: ri.ingredient.currentAverageCost.toString(),
            })),
            recipe.yieldQuantity.toString(),
          );
          for (const ri of recipe.items) {
            const delta = effectiveRecipeQty({
              quantity: ri.quantity, wastePercentage: ri.wastePercentage,
              yieldQuantity: recipe.yieldQuantity,
            }).mul(d(c.quantity));
            bulkMovements.push({
              businessId: business.id,
              ingredientId: ri.ingredientId,
              occurredAt: soldAt,
              movementType: MovementType.SALE,
              quantityDelta: toFixedQty(delta.neg()),
              unitCost: toFixedCost(ri.ingredient.currentAverageCost),
              referenceType: "sale_item",
              referenceId: sale.id,
              reason: `Venta #${saleNumber}`,
              userId: owner.id,
            });
          }
        }
        bulkSaleItems.push({
          saleId: sale.id,
          productId: c.productId,
          quantity: toFixedQty(line.quantity),
          unitPrice: toFixedMoney(line.unitPrice),
          discount: toFixedMoney(line.discount),
          tax: toFixedMoney(line.tax),
          lineTotal: toFixedMoney(line.lineTotal),
          unitCostSnapshot: toFixedCost(unitCost),
        });
      }
    }

    if (day !== 0) {
      const expected = money(d(200).plus(cashSales));
      await prisma.cashSession.update({
        where: { id: open.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(daysAgo(day).getTime() + 10 * 3600 * 1000),
          closedById: owner.id,
          expectedAmount: toFixedMoney(expected),
          countedAmount: toFixedMoney(expected),
          differenceAmount: "0.00",
          saleCashTotal: toFixedMoney(cashSales),
          closeNotes: "Seed",
        },
      });
    }
  }

  await prisma.saleItem.createMany({ data: bulkSaleItems });
  await prisma.inventoryMovement.createMany({ data: bulkMovements });

  console.log("Seeding expenses...");
  const expenseCats: ExpenseCategory[] = ["RENT", "UTILITIES", "SALARIES", "SUPPLIES", "MARKETING", "MAINTENANCE", "TRANSPORT", "OTHER"];
  const bulkExpenses: Array<Prisma.ExpenseCreateManyInput> = [];
  for (let i = 0; i < 8; i++) {
    const sub = money(100 + i * 17);
    const tax = money(sub.mul(0.12));
    bulkExpenses.push({
      businessId: business.id,
      expenseDate: daysAgo(i),
      category: expenseCats[i % expenseCats.length],
      description: `Gasto op #${i + 1}`,
      supplierId: supplierIds[i % supplierIds.length],
      subtotal: toFixedMoney(sub),
      taxTotal: toFixedMoney(tax),
      total: toFixedMoney(sub.plus(tax)),
      paymentMethod: i % 3 === 0 ? "CASH" : "TRANSFER",
      paymentStatus: "PAID",
      userId: owner.id,
    });
  }
  if (bulkExpenses.length) await prisma.expense.createMany({ data: bulkExpenses });

  console.log("Seeding inventory counts...");
  for (let c = 0; c < 2; c++) {
    const ings = await prisma.ingredient.findMany({
      where: { businessId: business.id, active: true },
      take: 4,
      skip: c * 3,
    });
    const count = await prisma.inventoryCount.create({
      data: {
        businessId: business.id,
        countedAt: daysAgo(10 + c * 7),
        status: "CONFIRMED",
        notes: "Conteo seed",
        userId: owner.id,
      },
    });
    for (const ing of ings) {
      const stock = await prisma.inventoryMovement.aggregate({
        where: { ingredientId: ing.id },
        _sum: { quantityDelta: true },
      });
      const theoretical = d(stock._sum.quantityDelta ?? 0);
      const physical = qtySafe(Math.max(0, theoretical.toNumber() + ((c % 2) - 0.5)));
      const diff = d(physical).minus(theoretical);
      await prisma.inventoryCountItem.create({
        data: {
          countId: count.id,
          ingredientId: ing.id,
          theoreticalQuantity: toFixedQty(theoretical),
          physicalQuantity: toFixedQty(physical),
          differenceQuantity: toFixedQty(diff),
          unitCost: toFixedCost(ing.currentAverageCost),
        },
      });
      if (!diff.eq(0)) {
        await prisma.inventoryMovement.create({
          data: {
            businessId: business.id,
            ingredientId: ing.id,
            occurredAt: daysAgo(10 + c * 7),
            movementType: MovementType.COUNT_ADJUSTMENT,
            quantityDelta: toFixedQty(diff),
            unitCost: toFixedCost(ing.currentAverageCost),
            referenceType: "inventory_count",
            referenceId: count.id,
            reason: "Conteo seed",
            userId: owner.id,
          },
        });
      }
    }
  }

  // a couple of wastes
  const matcha = ingredients["ING-MATCHA"];
  await prisma.inventoryMovement.create({
    data: {
      businessId: business.id,
      ingredientId: matcha.id,
      movementType: MovementType.WASTE,
      quantityDelta: toFixedQty(-15),
      unitCost: "0.4500",
      referenceType: "adjustment",
      reason: "Matcha vencido (seed)",
      userId: owner.id,
      occurredAt: daysAgo(1),
    },
  });

  await applyBiViews(prisma);

  console.log("Seed completo en", Math.round((Date.now() - t0) / 1000), "segundos.");
  console.log("Login: owner@muchomatcha.gt / Matcha2026!");
  console.log("Seed mode: DEMO. Usa SEED_MODE=clean o --clean para arranque limpio.");
}

async function applyBiViews(client: typeof prisma) {
  console.log("Applying BI views...");
  const sqlPath = join(process.cwd(), "sql", "bi-views.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const parts = sql.split(/;(?:\s*\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    try {
      await client.$executeRawUnsafe(part);
    } catch (err) {
      console.warn("View statement failed (fine if exists):", err instanceof Error ? err.message : String(err));
    }
  }
}

function qtySafe(n: number) {
  return d(n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
