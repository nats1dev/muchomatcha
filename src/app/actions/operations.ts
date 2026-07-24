"use server";

import { revalidatePath } from "next/cache";
import { CashMovementType, ExpenseCategory, PaymentMethod } from "@prisma/client";
import { requireSession } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { createSale, voidSale } from "@/modules/sales/service";
import { receivePurchase } from "@/modules/purchases/service";
import {
  addCashMovement,
  closeCashSession,
  openCashSession,
} from "@/modules/cash/service";
import { createExpense } from "@/modules/expenses/service";
import {
  confirmInventoryCount,
  createAdjustment,
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
  taxTotal?: number;
  notes?: string;
  items: Array<{
    ingredientId: string;
    purchaseUnitId: string;
    purchaseQuantity: number;
    lineTotal: number;
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

export async function saveRecipeAction(payload: {
  productId: string;
  yieldQuantity?: number;
  notes?: string;
  items: Array<{
    ingredientId: string;
    quantity: number;
    wastePercentage?: number;
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
