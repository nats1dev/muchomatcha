import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { toFixedCost, toFixedQty } from "@/lib/decimal";
import { writeAudit } from "@/modules/audit/service";
import { calculateRecipeUnitCost } from "@/modules/recipes/cost";

async function detectRecipeCycle(
  businessId: string,
  targetIngredientId: string,
  ingredientIds: string[],
  maxDepth: number = 3,
): Promise<boolean> {
  if (maxDepth <= 0) return true;

  const withRecipes = await prisma.ingredient.findMany({
    where: {
      businessId,
      id: { in: ingredientIds },
      recipeId: { not: null },
    },
    select: {
      id: true,
      recipe: {
        where: { active: true },
        select: {
          items: { select: { ingredientId: true } },
        },
      },
    },
  });

  for (const ing of withRecipes) {
    const itemIds = ing.recipe?.items.map((ri) => ri.ingredientId) ?? [];
    if (itemIds.length === 0) continue;
    if (itemIds.includes(targetIngredientId)) return true;
    const deeper = await detectRecipeCycle(businessId, targetIngredientId, itemIds, maxDepth - 1);
    if (deeper) return true;
  }

  return false;
}

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
    isNonInventoriable?: boolean;
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
            isNonInventoriable: item.isNonInventoriable ?? false,
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

export async function saveSubproductRecipe(params: {
  businessId: string;
  userId: string;
  ingredientId: string;
  yieldQuantity?: number;
  notes?: string;
  activate?: boolean;
  items: Array<{
    ingredientId: string;
    quantity: number;
    wastePercentage?: number;
    isNonInventoriable?: boolean;
  }>;
}) {
  if (!params.items.length) {
    throw new AppError("La receta necesita al menos un ingrediente");
  }
  if ((params.yieldQuantity ?? 1) <= 0) {
    throw new AppError("El rendimiento debe ser mayor a 0");
  }

  const ingredientIds = params.items.map((i) => i.ingredientId);
  const nestedIngredients = await prisma.ingredient.findMany({
    where: {
      businessId: params.businessId,
      id: { in: ingredientIds },
      recipeId: { not: null },
    },
    select: { id: true, name: true, recipeId: true },
  });

  if (nestedIngredients.length > 0) {
    const targetIngredient = await prisma.ingredient.findUnique({
      where: { id: params.ingredientId },
      select: { id: true },
    });
    if (targetIngredient) {
      const hasCycle = await detectRecipeCycle(
        params.businessId,
        params.ingredientId,
        ingredientIds,
      );
      if (hasCycle) {
        throw new AppError("Se ha detectado un ciclo en los subproductos. Revisa la cadena de dependencias.", {
          code: "NESTED_SUBPRODUCT",
        });
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.findFirst({
      where: { id: params.ingredientId, businessId: params.businessId },
    });
    if (!ingredient) throw new AppError("Ingrediente no encontrado");

    const last = await tx.recipe.findFirst({
      where: { producedIngredients: { some: { id: params.ingredientId } } },
      orderBy: { version: "desc" },
    });
    const version = (last?.version ?? 0) + 1;

    if (params.activate !== false) {
      await tx.recipe.updateMany({
        where: {
          producedIngredients: { some: { id: params.ingredientId } },
          active: true,
        },
        data: { active: false },
      });
    }

    const recipe = await tx.recipe.create({
      data: {
        businessId: params.businessId,
        productId: null,
        version,
        yieldQuantity: toFixedQty(params.yieldQuantity ?? 1),
        notes: params.notes,
        active: params.activate !== false,
        items: {
          create: params.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: toFixedQty(item.quantity),
            wastePercentage: (item.wastePercentage ?? 0).toFixed(2),
            isNonInventoriable: item.isNonInventoriable ?? false,
          })),
        },
      },
      include: {
        items: { include: { ingredient: true } },
      },
    });

    const unitCost = calculateRecipeUnitCost(
      recipe.items.map((i) => ({
        quantity: i.quantity.toString(),
        wastePercentage: i.wastePercentage.toString(),
        averageCost: i.ingredient.currentAverageCost.toString(),
      })),
      recipe.yieldQuantity.toString(),
    );

    // Bloqueo Q0 (decisión del dueño 2026-09-09): el subproducto persiste su
    // costo en `currentAverageCost`, así que no puede nacer en cero. Se valida
    // en el servidor porque la UI se puede saltear. El `throw` revierte el `tx`.
    const hasZeroCostInput = recipe.items.some(
      (i) => Number(i.ingredient.currentAverageCost) <= 0,
    );
    if (hasZeroCostInput) {
      throw new AppError(
        "Todos los ingredientes deben tener costo promedio mayor a cero para guardar el subproducto",
      );
    }

    // Estimado persistido (decisión del dueño 2026-09-09): el subproducto ya
    // sale con costo unitario en Recetas sin esperar a producir. Sobrescribe
    // directo, sin movimiento de kardex; `completeProductionOrder` lo vuelve a
    // promediar con el stock real al producir.
    await tx.ingredient.update({
      where: { id: params.ingredientId },
      data: {
        recipeId: recipe.id,
        currentAverageCost: toFixedCost(unitCost),
      },
    });

    await writeAudit(tx, {
      businessId: params.businessId,
      userId: params.userId,
      action: "CREATE",
      entityType: "recipe",
      entityId: recipe.id,
      afterData: {
        ingredientId: params.ingredientId,
        version,
        unitCost: unitCost.toFixed(4),
      },
    });

    return { recipe, unitCost: unitCost.toFixed(4) };
  });
}

export async function listRecipes(businessId: string) {
  const recipes = await prisma.recipe.findMany({
    where: { businessId, active: true, productId: { not: null } },
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
        r.product && Number(r.product.salePrice) > 0
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
        productName: recipe.product?.name ?? "Subproducto",
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
