"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { AppError, toActionError, type ActionResult } from "@/lib/errors";
import {
  cashMovementSchema,
  closeCashSchema,
  confirmCountSchema,
  confirmDraftSaleSchema,
  createAdjustmentSchema,
  createDraftSaleSchema,
  createExpenseSchema,
  createSaleSchema,
  formValues,
  initialInventorySchema,
  openCashSchema,
  quickAddCategorySchema,
  quickAddIngredientSchema,
  receivePurchaseSchema,
  recipeIdSchema,
  saveRecipeSchema,
  voidPurchaseSchema,
  voidSaleSchema,
} from "./schemas";
import {
  upsertIngredient,
  upsertIngredientCategory,
  upsertPurchaseUnit,
} from "@/modules/catalog/service";
import { createSale, voidSale, createDraftSale, confirmDraftSale } from "@/modules/sales/service";
import { receivePurchase, voidPurchase } from "@/modules/purchases/service";
import {
  addCashMovement,
  closeCashSession,
  openCashSession,
} from "@/modules/cash/service";
import { createExpense } from "@/modules/expenses/service";
import {
  confirmInventoryCount,
  createAdjustment,
  createInitialInventory,
} from "@/modules/inventory/service";
import { saveRecipe, deactivateRecipe, deleteRecipe } from "@/modules/recipes/service";

// Los `payload` llegan como `unknown` a proposito: una server action es un
// endpoint publico y los tipos de TypeScript no existen en tiempo de ejecucion.
// El contrato real es el esquema de `./schemas`.

export async function createSaleAction(
  payload: unknown,
): Promise<ActionResult<{ saleId: string; saleNumber: number; warnings: string[] }>> {
  try {
    const user = await requireRole("CASHIER");
    const input = createSaleSchema.parse(payload);
    const result = await createSale({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/ventas");
    revalidatePath("/resumen");
    revalidatePath("/inventario");
    revalidatePath("/caja");
    return {
      ok: true,
      data: {
        saleId: result.sale.id,
        saleNumber: result.sale.saleNumber,
        warnings: result.warnings,
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createDraftSaleAction(
  payload: unknown,
): Promise<ActionResult<{ saleId: string; saleNumber: number }>> {
  try {
    const user = await requireRole("CASHIER");
    const input = createDraftSaleSchema.parse(payload);
    const result = await createDraftSale({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/ventas");
    return {
      ok: true,
      data: { saleId: result.id, saleNumber: result.saleNumber },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function confirmDraftSaleAction(
  payload: unknown,
): Promise<ActionResult<{ warnings: string[] }>> {
  try {
    const user = await requireRole("CASHIER");
    const input = confirmDraftSaleSchema.parse(payload);
    const result = await confirmDraftSale({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/ventas");
    revalidatePath("/resumen");
    revalidatePath("/inventario");
    revalidatePath("/caja");
    return {
      ok: true,
      data: { warnings: result.warnings },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function voidSaleAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = voidSaleSchema.parse(formValues(formData));
    await voidSale({
      businessId: user.businessId,
      userId: user.id,
      saleId: input.saleId,
      reason: input.reason,
    });
    revalidatePath("/ventas");
    revalidatePath("/resumen");
    revalidatePath("/inventario");
    revalidatePath("/caja");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function receivePurchaseAction(
  payload: unknown,
): Promise<ActionResult<{ purchaseId: string }>> {
  try {
    const user = await requireRole("ADMIN");
    const input = receivePurchaseSchema.parse(payload);
    const purchase = await receivePurchase({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/compras");
    revalidatePath("/inventario");
    revalidatePath("/resumen");
    return { ok: true, data: { purchaseId: purchase.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function voidPurchaseAction(
  payload: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = voidPurchaseSchema.parse(payload);
    await voidPurchase({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/compras");
    revalidatePath("/inventario");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function quickAddIngredientAction(
  payload: unknown,
): Promise<ActionResult<{ ingredientId: string; purchaseUnitId: string }>> {
  try {
    const user = await requireRole("ADMIN");
    const input = quickAddIngredientSchema.parse(payload);
    const ingredient = await upsertIngredient({
      businessId: user.businessId,
      userId: user.id,
      sku: input.sku,
      name: input.name,
      baseUnitId: input.baseUnitId,
      categoryId: input.categoryId,
      minimumStock: 0,
    });
    const purchaseUnit = await upsertPurchaseUnit({
      businessId: user.businessId,
      userId: user.id,
      ingredientId: ingredient.id,
      unitId: input.purchaseUnitId,
      conversionFactor: input.conversionFactor,
    });
    revalidatePath("/compras");
    revalidatePath("/productos");
    revalidatePath("/inventario");
    return {
      ok: true,
      data: { ingredientId: ingredient.id, purchaseUnitId: purchaseUnit.id },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function quickAddCategoryAction(
  payload: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await requireRole("ADMIN");
    const { name } = quickAddCategorySchema.parse(payload);
    const existing = await prisma.ingredientCategory.findFirst({
      where: {
        businessId: user.businessId,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (existing) {
      throw new AppError(`Ya existe una categoría similar: "${existing.name}"`, {
        code: "DUPLICATE",
        fieldErrors: { name: ["Ya existe una categoría con ese nombre"] },
      });
    }
    const created = await upsertIngredientCategory({
      businessId: user.businessId,
      userId: user.id,
      name,
    });
    revalidatePath("/compras");
    return { ok: true, data: { id: created.id, name: created.name } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function openCashAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("CASHIER");
    const input = openCashSchema.parse(formValues(formData));
    await openCashSession({
      businessId: user.businessId,
      userId: user.id,
      openingAmount: input.openingAmount,
    });
    revalidatePath("/caja");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cashMovementAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("CASHIER");
    const input = cashMovementSchema.parse(formValues(formData));
    await addCashMovement({
      businessId: user.businessId,
      userId: user.id,
      movementType: input.movementType,
      amount: input.amount,
      reason: input.reason,
    });
    revalidatePath("/caja");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function closeCashAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = closeCashSchema.parse(formValues(formData));
    await closeCashSession({
      businessId: user.businessId,
      userId: user.id,
      countedAmount: input.countedAmount,
      closeNotes: input.closeNotes ?? "",
    });
    revalidatePath("/caja");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createExpenseAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = createExpenseSchema.parse(formValues(formData));
    await createExpense({
      businessId: user.businessId,
      userId: user.id,
      expenseDate: input.expenseDate,
      category: input.category,
      description: input.description,
      supplierId: input.supplierId,
      beneficiary: input.beneficiary ?? "",
      subtotal: input.subtotal,
      taxTotal: input.taxTotal,
      paymentMethod: input.paymentMethod,
    });
    revalidatePath("/gastos");
    revalidatePath("/caja");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createAdjustmentAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = createAdjustmentSchema.parse(formValues(formData));
    await createAdjustment({
      businessId: user.businessId,
      userId: user.id,
      ingredientId: input.ingredientId,
      quantityDelta: input.quantityDelta,
      reason: input.reason,
      type: input.type,
    });
    revalidatePath("/inventario");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function confirmCountAction(
  payload: unknown,
): Promise<ActionResult<{ countId: string }>> {
  try {
    const user = await requireRole("ADMIN");
    const input = confirmCountSchema.parse(payload);
    const count = await confirmInventoryCount({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/inventario");
    return { ok: true, data: { countId: count.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createInitialInventoryAction(
  payload: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = initialInventorySchema.parse(payload);
    await createInitialInventory({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/inventario");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveRecipeAction(
  payload: unknown,
): Promise<ActionResult<{ recipeId: string; unitCost: string }>> {
  try {
    const user = await requireRole("ADMIN");
    const input = saveRecipeSchema.parse(payload);
    const result = await saveRecipe({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/recetas");
    revalidatePath("/productos");
    return {
      ok: true,
      data: { recipeId: result.recipe.id, unitCost: result.unitCost },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deactivateRecipeAction(
  recipeId: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = recipeIdSchema.parse({ recipeId });
    await deactivateRecipe({
      businessId: user.businessId,
      userId: user.id,
      recipeId: input.recipeId,
    });
    revalidatePath("/recetas");
    revalidatePath("/productos");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteRecipeAction(
  recipeId: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = recipeIdSchema.parse({ recipeId });
    await deleteRecipe({
      businessId: user.businessId,
      userId: user.id,
      recipeId: input.recipeId,
    });
    revalidatePath("/recetas");
    revalidatePath("/productos");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
