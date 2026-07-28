import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

export interface TestContext {
  businessId: string;
  userId: string;
}

export async function createTestBusiness(
  name: string,
): Promise<TestContext> {
  const business = await prisma.business.create({
    data: {
      name,
      currency: "GTQ",
      timezone: "America/Guatemala",
      taxRate: "12.00",
    },
  });
  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      name: "Test User",
      email: `test-${Date.now()}@test.gt`,
      passwordHash: "test",
      role: Role.OWNER,
    },
  });
  return { businessId: business.id, userId: user.id };
}

export async function createDefaultUnits(
  businessId: string,
): Promise<Record<string, string>> {
  const defaults: Array<{ code: string; name: string; decimals: number }> = [
    { code: "g", name: "Gramo", decimals: 3 },
    { code: "kg", name: "Kilogramo", decimals: 3 },
    { code: "ml", name: "Mililitro", decimals: 3 },
    { code: "l", name: "Litro", decimals: 3 },
    { code: "u", name: "Unidad", decimals: 0 },
  ];
  for (const u of defaults) {
    await prisma.unit.upsert({
      where: { businessId_code: { businessId, code: u.code } },
      update: {},
      create: { businessId: businessId, ...u },
    });
  }
  const units = await prisma.unit.findMany({
    where: { businessId, active: true },
  });
  const map: Record<string, string> = {};
  for (const u of units) {
    map[u.code] = u.id;
  }
  return map;
}

export async function cleanupTestBusiness(businessId: string) {
  const safe = `$1::uuid`;
  const bid = businessId;

  const queries = [
    // Layer 1: child tables without business_id — delete via parent FK
    `DELETE FROM "sale_items" WHERE "sale_id" IN (SELECT "id" FROM "sales" WHERE "business_id" = ${safe})`,
    `DELETE FROM "purchase_items" WHERE "purchase_id" IN (SELECT "id" FROM "purchases" WHERE "business_id" = ${safe})`,
    `DELETE FROM "recipe_items" WHERE "recipe_id" IN (SELECT "id" FROM "recipes" WHERE "business_id" = ${safe})`,
    `DELETE FROM "inventory_count_items" WHERE "count_id" IN (SELECT "id" FROM "inventory_counts" WHERE "business_id" = ${safe})`,
    `DELETE FROM "cash_movements" WHERE "cash_session_id" IN (SELECT "id" FROM "cash_sessions" WHERE "business_id" = ${safe})`,
    `DELETE FROM "ingredient_purchase_units" WHERE "ingredient_id" IN (SELECT "id" FROM "ingredients" WHERE "business_id" = ${safe})`,

    // Layer 2: tables with business_id, no children
    `DELETE FROM "inventory_movements" WHERE "business_id" = ${safe}`,
    `DELETE FROM "production_orders" WHERE "business_id" = ${safe}`,
    `DELETE FROM "audit_log" WHERE "business_id" = ${safe}`,

    // Layer 3: business-scoped tables
    `DELETE FROM "sales" WHERE "business_id" = ${safe}`,
    `DELETE FROM "purchases" WHERE "business_id" = ${safe}`,
    `DELETE FROM "inventory_counts" WHERE "business_id" = ${safe}`,
    `DELETE FROM "recipes" WHERE "business_id" = ${safe}`,
    `DELETE FROM "expenses" WHERE "business_id" = ${safe}`,
    `DELETE FROM "cash_sessions" WHERE "business_id" = ${safe}`,
    `DELETE FROM "ingredients" WHERE "business_id" = ${safe}`,
    `DELETE FROM "products" WHERE "business_id" = ${safe}`,
    `DELETE FROM "suppliers" WHERE "business_id" = ${safe}`,
    `DELETE FROM "product_categories" WHERE "business_id" = ${safe}`,
    `DELETE FROM "ingredient_categories" WHERE "business_id" = ${safe}`,
    `DELETE FROM "units" WHERE "business_id" = ${safe}`,
    `DELETE FROM "users" WHERE "business_id" = ${safe}`,

    // Layer 4: the business itself
    `DELETE FROM "businesses" WHERE "id" = ${safe}`,
  ];

  for (const q of queries) {
    await prisma.$executeRawUnsafe(q, bid).catch(() => {});
  }
}
