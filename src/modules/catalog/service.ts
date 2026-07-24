import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { toFixedCost, toFixedMoney, toFixedQty } from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";

export async function upsertProductCategory(params: {
  businessId: string;
  userId: string;
  id?: string;
  name: string;
  active?: boolean;
}) {
  const name = params.name.trim();
  if (!name) throw new AppError("El nombre es obligatorio");

  if (params.id) {
    const updated = await prisma.productCategory.update({
      where: { id: params.id },
      data: { name, active: params.active ?? true },
    });
    await writeAudit(prisma, {
      businessId: params.businessId,
      userId: params.userId,
      action: "UPDATE",
      entityType: "product_category",
      entityId: updated.id,
      afterData: updated,
    });
    return updated;
  }

  const created = await prisma.productCategory.create({
    data: { businessId: params.businessId, name },
  });
  await writeAudit(prisma, {
    businessId: params.businessId,
    userId: params.userId,
    action: "CREATE",
    entityType: "product_category",
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function upsertProduct(params: {
  businessId: string;
  userId: string;
  id?: string;
  sku: string;
  name: string;
  salePrice: number;
  categoryId?: string | null;
  active?: boolean;
}) {
  const sku = params.sku.trim().toUpperCase();
  const name = params.name.trim();
  if (!sku || !name) throw new AppError("SKU y nombre son obligatorios");
  if (params.salePrice < 0) throw new AppError("El precio no puede ser negativo");

  const data = {
    sku,
    name,
    salePrice: toFixedMoney(params.salePrice),
    categoryId: params.categoryId || null,
    taxIncluded: false,
    active: params.active ?? true,
  };

  if (params.id) {
    const existing = await prisma.product.findFirst({
      where: { id: params.id, businessId: params.businessId },
    });
    if (!existing) throw new AppError("Producto no encontrado");
    const updated = await prisma.product.update({
      where: { id: params.id },
      data,
    });
    await writeAudit(prisma, {
      businessId: params.businessId,
      userId: params.userId,
      action: "UPDATE",
      entityType: "product",
      entityId: updated.id,
      beforeData: existing,
      afterData: updated,
    });
    return updated;
  }

  const created = await prisma.product.create({
    data: { ...data, businessId: params.businessId },
  });
  await writeAudit(prisma, {
    businessId: params.businessId,
    userId: params.userId,
    action: "CREATE",
    entityType: "product",
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function upsertIngredientCategory(params: {
  businessId: string;
  userId: string;
  id?: string;
  name: string;
  active?: boolean;
}) {
  const name = params.name.trim();
  if (!name) throw new AppError("El nombre es obligatorio");
  if (params.id) {
    return prisma.ingredientCategory.update({
      where: { id: params.id },
      data: { name, active: params.active ?? true },
    });
  }
  return prisma.ingredientCategory.create({
    data: { businessId: params.businessId, name },
  });
}

export async function upsertIngredient(params: {
  businessId: string;
  userId: string;
  id?: string;
  sku: string;
  name: string;
  baseUnitId: string;
  categoryId?: string | null;
  minimumStock?: number;
  active?: boolean;
}) {
  const sku = params.sku.trim().toUpperCase();
  const name = params.name.trim();
  if (!sku || !name) throw new AppError("SKU y nombre son obligatorios");

  const data = {
    sku,
    name,
    baseUnitId: params.baseUnitId,
    categoryId: params.categoryId || null,
    minimumStock: toFixedQty(params.minimumStock ?? 0),
    active: params.active ?? true,
  };

  if (params.id) {
    const existing = await prisma.ingredient.findFirst({
      where: { id: params.id, businessId: params.businessId },
    });
    if (!existing) throw new AppError("Ingrediente no encontrado");
    return prisma.ingredient.update({ where: { id: params.id }, data });
  }

  return prisma.ingredient.create({
    data: {
      ...data,
      businessId: params.businessId,
      currentAverageCost: toFixedCost(0),
    },
  });
}

export async function upsertPurchaseUnit(params: {
  businessId: string;
  ingredientId: string;
  unitId: string;
  conversionFactor: number;
  id?: string;
  active?: boolean;
}) {
  if (params.conversionFactor <= 0) {
    throw new AppError("El factor de conversión debe ser mayor a 0");
  }
  const ingredient = await prisma.ingredient.findFirst({
    where: { id: params.ingredientId, businessId: params.businessId },
  });
  if (!ingredient) throw new AppError("Ingrediente no encontrado");

  if (params.id) {
    return prisma.ingredientPurchaseUnit.update({
      where: { id: params.id },
      data: {
        conversionFactor: params.conversionFactor.toFixed(6),
        active: params.active ?? true,
      },
    });
  }

  return prisma.ingredientPurchaseUnit.create({
    data: {
      ingredientId: params.ingredientId,
      unitId: params.unitId,
      conversionFactor: params.conversionFactor.toFixed(6),
    },
  });
}

export async function upsertSupplier(params: {
  businessId: string;
  userId: string;
  id?: string;
  name: string;
  taxId?: string;
  phone?: string;
  email?: string;
  active?: boolean;
}) {
  const name = params.name.trim();
  if (!name) throw new AppError("El nombre es obligatorio");
  const data = {
    name,
    taxId: params.taxId?.trim() || null,
    phone: params.phone?.trim() || null,
    email: params.email?.trim().toLowerCase() || null,
    active: params.active ?? true,
  };
  if (params.id) {
    return prisma.supplier.update({ where: { id: params.id }, data });
  }
  return prisma.supplier.create({
    data: { ...data, businessId: params.businessId },
  });
}

export async function ensureDefaultUnits(businessId: string) {
  const defaults = [
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
      create: { businessId, ...u },
    });
  }
  return prisma.unit.findMany({
    where: { businessId, active: true },
    orderBy: { code: "asc" },
  });
}
