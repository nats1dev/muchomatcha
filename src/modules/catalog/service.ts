import { Prisma, MovementType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { d, toFixedCost, toFixedMoney, toFixedQty } from "@/lib/decimal";
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
  image?: string | null;
  active?: boolean;
}) {
  const sku = params.sku.trim().toUpperCase();
  const name = params.name.trim();
  if (!sku || !name) throw new AppError("SKU y nombre son obligatorios");
  if (params.salePrice <= 0) throw new AppError("El precio debe ser mayor a 0");

  const data = {
    sku,
    name,
    salePrice: toFixedMoney(params.salePrice),
    categoryId: params.categoryId || null,
    image: params.image ?? null,
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

  let created;
  try {
    created = await prisma.product.create({
      data: { ...data, businessId: params.businessId },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new AppError(`El SKU "${sku}" ya existe`, { code: "DUPLICATE_SKU" });
    }
    throw e;
  }
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

export async function deactivateProduct(businessId: string, id: string, userId: string) {
  const existing = await prisma.product.findFirst({
    where: { id, businessId },
  });
  if (!existing) throw new AppError("Producto no encontrado");

  const updated = await prisma.product.update({
    where: { id },
    data: { active: !existing.active },
  });

  await writeAudit(prisma, {
    businessId,
    userId,
    action: updated.active ? "ACTIVATE" : "DEACTIVATE",
    entityType: "product",
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
  });

  return updated;
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
    const existing = await prisma.ingredientCategory.findFirst({
      where: { id: params.id, businessId: params.businessId },
    });
    if (!existing) throw new AppError("Categoría de ingrediente no encontrada");
    const updated = await prisma.ingredientCategory.update({
      where: { id: params.id },
      data: { name, active: params.active ?? true },
    });
    await writeAudit(prisma, {
      businessId: params.businessId,
      userId: params.userId,
      action: "UPDATE",
      entityType: "ingredient_category",
      entityId: updated.id,
      afterData: updated,
    });
    return updated;
  }
  const created = await prisma.ingredientCategory.create({
    data: { businessId: params.businessId, name },
  });
  await writeAudit(prisma, {
    businessId: params.businessId,
    userId: params.userId,
    action: "CREATE",
    entityType: "ingredient_category",
    entityId: created.id,
    afterData: created,
  });
  return created;
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
  currentAverageCost?: number;
  image?: string | null;
  active?: boolean;
  purchaseUnitId?: string;
  conversionFactor?: number;
}) {
  const sku = params.sku.trim().toUpperCase();
  const name = params.name.trim();
  if (!sku || !name) throw new AppError("SKU y nombre son obligatorios");

  const unit = await prisma.unit.findFirst({
    where: { id: params.baseUnitId, businessId: params.businessId },
  });
  if (!unit) throw new AppError("Unidad base no encontrada");

  const data = {
    sku,
    name,
    baseUnitId: params.baseUnitId,
    categoryId: params.categoryId || null,
    image: params.image ?? null,
    minimumStock: toFixedQty(params.minimumStock ?? 0),
    active: params.active ?? true,
  };

  if (params.id) {
    const existing = await prisma.ingredient.findFirst({
      where: { id: params.id, businessId: params.businessId },
    });
    if (!existing) throw new AppError("Ingrediente no encontrado");

    const costChanged = params.currentAverageCost !== undefined &&
      d(params.currentAverageCost).toFixed(4) !== d(existing.currentAverageCost).toFixed(4);

    if (costChanged) {
      (data as Record<string, unknown>).currentAverageCost = toFixedCost(params.currentAverageCost!);
    }

    const updated = await prisma.ingredient.update({ where: { id: params.id }, data });

    if (costChanged) {
      await prisma.inventoryMovement.create({
        data: {
          businessId: params.businessId,
          ingredientId: params.id,
          movementType: "COST_ADJUSTMENT" as MovementType,
          quantityDelta: toFixedQty(0),
          unitCost: toFixedCost(params.currentAverageCost!),
          referenceType: "ingredient_edit",
          reason: `Ajuste manual de costo: de ${toFixedCost(existing.currentAverageCost)} a ${toFixedCost(params.currentAverageCost!)}`,
          userId: params.userId,
        },
      });
    }

    // Si la creación incluye datos de unidad de compra, upsertearla
    if (params.purchaseUnitId && params.conversionFactor && params.conversionFactor > 0) {
      const existingPU = await prisma.ingredientPurchaseUnit.findFirst({
        where: { ingredientId: params.id, unitId: params.purchaseUnitId, active: true },
      });
      if (existingPU) {
        await prisma.ingredientPurchaseUnit.update({
          where: { id: existingPU.id },
          data: { conversionFactor: params.conversionFactor.toFixed(6) },
        });
      } else {
        await prisma.ingredientPurchaseUnit.create({
          data: {
            ingredientId: params.id,
            unitId: params.purchaseUnitId,
            conversionFactor: params.conversionFactor.toFixed(6),
          },
        });
      }
    }

    await writeAudit(prisma, {
      businessId: params.businessId,
      userId: params.userId,
      action: "UPDATE",
      entityType: "ingredient",
      entityId: updated.id,
      beforeData: existing,
      afterData: updated,
    });
    return updated;
  }

  const created = await prisma.ingredient.create({
    data: {
      ...data,
      businessId: params.businessId,
      currentAverageCost: toFixedCost(0),
    },
  });

  // Crear unidad de compra si se especificó, o auto-generar 1:1
  if (params.purchaseUnitId && params.conversionFactor && params.conversionFactor > 0) {
    await prisma.ingredientPurchaseUnit.create({
      data: {
        ingredientId: created.id,
        unitId: params.purchaseUnitId,
        conversionFactor: params.conversionFactor.toFixed(6),
      },
    });
  }
  // Auto-crear unidad de compra 1:1 con la unidad base
  if (!params.purchaseUnitId) {
    const existingPU = await prisma.ingredientPurchaseUnit.findFirst({
      where: { ingredientId: created.id },
    });
    if (!existingPU) {
      await prisma.ingredientPurchaseUnit.create({
        data: {
          ingredientId: created.id,
          unitId: created.baseUnitId,
          conversionFactor: "1.000000",
        },
      });
    }
  }

  await writeAudit(prisma, {
    businessId: params.businessId,
    userId: params.userId,
    action: "CREATE",
    entityType: "ingredient",
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function deactivateIngredient(businessId: string, id: string, userId: string) {
  const existing = await prisma.ingredient.findFirst({
    where: { id, businessId },
  });
  if (!existing) throw new AppError("Ingrediente no encontrado");

  const updated = await prisma.ingredient.update({
    where: { id },
    data: { active: !existing.active },
  });

  await writeAudit(prisma, {
    businessId,
    userId,
    action: updated.active ? "ACTIVATE" : "DEACTIVATE",
    entityType: "ingredient",
    entityId: updated.id,
    beforeData: existing,
    afterData: updated,
  });

  return updated;
}

export async function upsertPurchaseUnit(params: {
  businessId: string;
  userId: string;
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
    const existing = await prisma.ingredientPurchaseUnit.findFirst({
      where: { id: params.id, ingredientId: params.ingredientId },
      include: { ingredient: { select: { businessId: true } } },
    });
    if (!existing || existing.ingredient.businessId !== params.businessId) {
      throw new AppError("Unidad de compra no encontrada");
    }
    const updated = await prisma.ingredientPurchaseUnit.update({
      where: { id: params.id },
      data: {
        conversionFactor: params.conversionFactor.toFixed(6),
        active: params.active ?? true,
      },
    });
    await writeAudit(prisma, {
      businessId: params.businessId,
      userId: params.userId,
      action: "UPDATE",
      entityType: "ingredient_purchase_unit",
      entityId: updated.id,
      afterData: updated,
    });
    return updated;
  }

  const created = await prisma.ingredientPurchaseUnit.create({
    data: {
      ingredientId: params.ingredientId,
      unitId: params.unitId,
      conversionFactor: params.conversionFactor.toFixed(6),
    },
  });
  await writeAudit(prisma, {
    businessId: params.businessId,
    userId: params.userId,
    action: "CREATE",
    entityType: "ingredient_purchase_unit",
    entityId: created.id,
    afterData: created,
  });
  return created;
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
  const email = params.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("El correo electrónico no es válido");
  }
  const data = {
    name,
    taxId: params.taxId?.trim() || null,
    phone: params.phone?.trim() || null,
    email,
    active: params.active ?? true,
  };
  if (params.id) {
    const existing = await prisma.supplier.findFirst({
      where: { id: params.id, businessId: params.businessId },
    });
    if (!existing) throw new AppError("Proveedor no encontrado");
    const updated = await prisma.supplier.update({ where: { id: params.id }, data });
    await writeAudit(prisma, {
      businessId: params.businessId,
      userId: params.userId,
      action: "UPDATE",
      entityType: "supplier",
      entityId: updated.id,
      beforeData: existing,
      afterData: updated,
    });
    return updated;
  }
  const created = await prisma.supplier.create({
    data: { ...data, businessId: params.businessId },
  });
  await writeAudit(prisma, {
    businessId: params.businessId,
    userId: params.userId,
    action: "CREATE",
    entityType: "supplier",
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function ensureDefaultUnits(businessId: string) {
  const defaults = [
    { code: "g", name: "Gramo", decimals: 3 },
    { code: "kg", name: "Kilogramo", decimals: 3 },
    { code: "ml", name: "Mililitro", decimals: 3 },
    { code: "l", name: "Litro", decimals: 3 },
    { code: "u", name: "Unidad", decimals: 0 },
    { code: "pq", name: "Paquete", decimals: 0 },
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
