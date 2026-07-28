"use server";

import { revalidatePath } from "next/cache";
import {
  CashMovementType,
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
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

export async function createSaleAction(payload: {
  paymentMethod: PaymentMethod;
  notes?: string;
  globalDiscount?: number;
  items: Array<{ productId: string; quantity: number; discount?: number }>;
}): Promise<ActionResult<{ saleId: string; saleNumber: number; warnings: string[] }>> {
  try {
    const user = await requireSession();
    const result = await createSale({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
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

export async function createDraftSaleAction(payload: {
  notes?: string;
  items: Array<{ productId: string; quantity: number }>;
}): Promise<ActionResult<{ saleId: string; saleNumber: number }>> {
  try {
    const user = await requireSession();
    const result = await createDraftSale({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
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

export async function confirmDraftSaleAction(payload: {
  saleId: string;
  paymentMethod: "CASH" | "CARD" | "TRANSFER";
}): Promise<ActionResult<{ warnings: string[] }>> {
  try {
    const user = await requireSession();
    const result = await confirmDraftSale({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
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
    const user = await requireSession();
    await voidSale({
      businessId: user.businessId,
      userId: user.id,
      saleId: String(formData.get("saleId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
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

export async function receivePurchaseAction(payload: {
  supplierId: string;
  documentNumber?: string;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  purchasedAt?: string;
  taxTotal?: number;
  notes?: string;
  items: Array<{
    ingredientId: string;
    purchaseUnitId: string;
    purchaseQuantity: number;
    unitPrice: number;
    lineTotal: number;
    expiresAt?: string | null;
  }>;
}): Promise<ActionResult<{ purchaseId: string }>> {
  try {
    const user = await requireSession();
    const purchase = await receivePurchase({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
    });
    revalidatePath("/compras");
    revalidatePath("/inventario");
    revalidatePath("/resumen");
    return { ok: true, data: { purchaseId: purchase.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function voidPurchaseAction(payload: {
  purchaseId: string;
  reason?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await voidPurchase({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
    });
    revalidatePath("/compras");
    revalidatePath("/inventario");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function quickAddIngredientAction(payload: {
  sku: string;
  name: string;
  baseUnitId: string;
  categoryId?: string | null;
  purchaseUnitId: string;
  conversionFactor: number;
}): Promise<ActionResult<{ ingredientId: string; purchaseUnitId: string }>> {
  try {
    const user = await requireSession();
    const ingredient = await upsertIngredient({
      businessId: user.businessId,
      userId: user.id,
      sku: payload.sku,
      name: payload.name,
      baseUnitId: payload.baseUnitId,
      categoryId: payload.categoryId || null,
      minimumStock: 0,
    });
    const purchaseUnit = await upsertPurchaseUnit({
      businessId: user.businessId,
      userId: user.id,
      ingredientId: ingredient.id,
      unitId: payload.purchaseUnitId,
      conversionFactor: payload.conversionFactor,
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

export async function quickAddCategoryAction(payload: {
  name: string;
}): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await requireSession();
    const name = payload.name.trim();
    if (!name) {
      return { ok: false, message: "El nombre es obligatorio", code: "VALIDATION" };
    }
    const existing = await prisma.ingredientCategory.findFirst({
      where: {
        businessId: user.businessId,
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (existing) {
      return {
        ok: false,
        message: `Ya existe una categoría similar: "${existing.name}"`,
        code: "DUPLICATE",
      };
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
    const user = await requireSession();
    await openCashSession({
      businessId: user.businessId,
      userId: user.id,
      openingAmount: Number(formData.get("openingAmount") ?? 0),
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
    const user = await requireSession();
    await addCashMovement({
      businessId: user.businessId,
      userId: user.id,
      movementType: String(formData.get("movementType")) as CashMovementType,
      amount: Number(formData.get("amount") ?? 0),
      reason: String(formData.get("reason") ?? ""),
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
    const user = await requireSession();
    await closeCashSession({
      businessId: user.businessId,
      userId: user.id,
      countedAmount: Number(formData.get("countedAmount") ?? 0),
      closeNotes: String(formData.get("closeNotes") ?? ""),
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
    const user = await requireSession();
    await createExpense({
      businessId: user.businessId,
      userId: user.id,
      expenseDate: String(formData.get("expenseDate") ?? ""),
      category: String(formData.get("category")) as ExpenseCategory,
      description: String(formData.get("description") ?? ""),
      supplierId: (formData.get("supplierId") as string) || null,
      beneficiary: String(formData.get("beneficiary") ?? ""),
      subtotal: Number(formData.get("subtotal") ?? 0),
      taxTotal: Number(formData.get("taxTotal") ?? 0),
      paymentMethod: String(formData.get("paymentMethod")) as PaymentMethod,
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
    const user = await requireSession();
    await createAdjustment({
      businessId: user.businessId,
      userId: user.id,
      ingredientId: String(formData.get("ingredientId") ?? ""),
      quantityDelta: Number(formData.get("quantityDelta") ?? 0),
      reason: String(formData.get("reason") ?? ""),
      type: String(formData.get("type") ?? "WASTE") as
        | "WASTE"
        | "ADJUSTMENT_IN"
        | "ADJUSTMENT_OUT",
    });
    revalidatePath("/inventario");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function confirmCountAction(payload: {
  notes?: string;
  items: Array<{ ingredientId: string; physicalQuantity: number }>;
}): Promise<ActionResult<{ countId: string }>> {
  try {
    const user = await requireSession();
    const count = await confirmInventoryCount({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
    });
    revalidatePath("/inventario");
    return { ok: true, data: { countId: count.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createInitialInventoryAction(payload: {
  items: Array<{ ingredientId: string; quantity: number; unitCost: number }>;
}): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await createInitialInventory({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
    });
    revalidatePath("/inventario");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveRecipeAction(payload: {
  productId: string;
  yieldQuantity?: number;
  notes?: string;
  items: Array<{
    ingredientId: string;
    quantity: number;
    wastePercentage?: number;
    isNonInventoriable?: boolean;
  }>;
}): Promise<ActionResult<{ recipeId: string; unitCost: string }>> {
  try {
    const user = await requireSession();
    const result = await saveRecipe({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
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
  recipeId: string,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await deactivateRecipe({
      businessId: user.businessId,
      userId: user.id,
      recipeId,
    });
    revalidatePath("/recetas");
    revalidatePath("/productos");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteRecipeAction(
  recipeId: string,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await deleteRecipe({
      businessId: user.businessId,
      userId: user.id,
      recipeId,
    });
    revalidatePath("/recetas");
    revalidatePath("/productos");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
