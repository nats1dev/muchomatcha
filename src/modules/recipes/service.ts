import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { toFixedQty } from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";
import { calculateRecipeUnitCost } from "@/modules/recipes/cost";

export async function saveRecipe(params: {
  businessId: string;
  userId: string;
  productId: string;
  yieldQuantity?: number;
  notes?: string;
  activate?: boolean;
  items: Array<{
    ingredientId: string;
    quantity: number;
    wastePercentage?: number;
  }>;
}) {
  if (!params.items.length) {
    throw new AppError("La receta necesita al menos un ingrediente");
  }
  if ((params.yieldQuantity ?? 1) <= 0) {
    throw new AppError("El rendimiento debe ser mayor a 0");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: params.productId, businessId: params.businessId },
    });
    if (!product) throw new AppError("Producto no encontrado");

    const last = await tx.recipe.findFirst({
      where: { productId: params.productId },
      orderBy: { version: "desc" },
    });
    const version = (last?.version ?? 0) + 1;

    if (params.activate !== false) {
      await tx.recipe.updateMany({
        where: { productId: params.productId, active: true },
        data: { active: false },
      });
    }

    const recipe = await tx.recipe.create({
      data: {
        businessId: params.businessId,
        productId: params.productId,
        version,
        yieldQuantity: toFixedQty(params.yieldQuantity ?? 1),
        notes: params.notes,
        active: params.activate !== false,
        items: {
          create: params.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: toFixedQty(item.quantity),
            wastePercentage: (item.wastePercentage ?? 0).toFixed(2),
          })),
        },
      },
      include: {
        items: { include: { ingredient: true } },
        product: true,
      },
    });

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "CREATE",
      entityType: "recipe",
      entityId: recipe.id,
      afterData: { productId: params.productId, version },
    });

    const unitCost = calculateRecipeUnitCost(
      recipe.items.map((i) => ({
        quantity: i.quantity.toString(),
        wastePercentage: i.wastePercentage.toString(),
        averageCost: i.ingredient.currentAverageCost.toString(),
      })),
      recipe.yieldQuantity.toString(),
    );

    return { recipe, unitCost: unitCost.toFixed(4) };
  });
}

export async function listRecipes(businessId: string) {
  const recipes = await prisma.recipe.findMany({
    where: { businessId, active: true },
    include: {
      product: { include: { category: true } },
      items: { include: { ingredient: { include: { baseUnit: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return recipes.map((r) => {
    const unitCost = calculateRecipeUnitCost(
      r.items.map((i) => ({
        quantity: i.quantity.toString(),
        wastePercentage: i.wastePercentage.toString(),
        averageCost: i.ingredient.currentAverageCost.toString(),
      })),
      r.yieldQuantity.toString(),
    );
    return {
      ...r,
      unitCost: unitCost.toFixed(4),
      margin:
        Number(r.product.salePrice) > 0
          ? (
              ((Number(r.product.salePrice) - unitCost.toNumber()) /
                Number(r.product.salePrice)) *
              100
            ).toFixed(1)
          : "0",
    };
  });
}

export async function deactivateRecipe(params: {
  recipeId: string;
  businessId: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.findFirst({
      where: { id: params.recipeId, businessId: params.businessId },
    });
    if (!recipe) throw new AppError("Receta no encontrada");

    await tx.recipe.update({
      where: { id: params.recipeId },
      data: { active: false },
    });

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "DEACTIVATE",
      entityType: "recipe",
      entityId: params.recipeId,
      beforeData: { active: true },
      afterData: { active: false },
    });
  });
}

export async function deleteRecipe(params: {
  recipeId: string;
  businessId: string;
  userId: string;
}) {
  const recipe = await prisma.recipe.findFirst({
    where: { id: params.recipeId, businessId: params.businessId },
    include: { items: true, product: true },
  });
  if (!recipe) throw new AppError("Receta no encontrada");

  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "DELETE",
      entityType: "recipe",
      entityId: params.recipeId,
      beforeData: {
        productName: recipe.product.name,
        version: recipe.version,
        items: recipe.items.length,
      },
    });

    await tx.recipe.delete({
      where: { id: params.recipeId },
    });
  });
}

export async function productsWithoutRecipe(businessId: string) {
  const products = await prisma.product.findMany({
    where: {
      businessId,
      active: true,
      recipes: { none: { active: true } },
    },
    orderBy: { name: "asc" },
  });
  return products;
}
