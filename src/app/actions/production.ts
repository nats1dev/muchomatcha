"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import {
  cancelProductionOrderSchema,
  completeProductionOrderSchema,
  createProductionOrderSchema,
  ingredientIdSchema,
  listProductionOrdersSchema,
  orderIdSchema,
  saveSubproductRecipeSchema,
} from "./schemas";
import {
  createProductionOrder,
  startProductionOrder,
  completeProductionOrder,
  cancelProductionOrder,
  listProductionOrders,
  getProductionOrderDetail,
  listManufacturedIngredients,
  getSubproductRecipe,
} from "@/modules/production/service";
import { saveSubproductRecipe } from "@/modules/recipes/service";

export async function createProductionOrderAction(payload: unknown): Promise<
  ActionResult<{
    orderId: string;
    orderNumber: number;
    estimatedUnitCost: string;
    status: string;
  }>
> {
  try {
    const user = await requireRole("CASHIER");
    const input = createProductionOrderSchema.parse(payload);
    const result = await createProductionOrder({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/produccion");
    revalidatePath("/inventario");
    return {
      ok: true,
      data: {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        estimatedUnitCost: result.estimatedUnitCost,
        status: result.order.status,
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function startProductionOrderAction(
  orderId: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireRole("CASHIER");
    const input = orderIdSchema.parse({ orderId });
    await startProductionOrder({
      businessId: user.businessId,
      userId: user.id,
      orderId: input.orderId,
    });
    revalidatePath("/produccion");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function completeProductionOrderAction(
  orderId: unknown,
  actualQuantity?: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireRole("CASHIER");
    const input = completeProductionOrderSchema.parse({
      orderId,
      actualQuantity,
    });
    await completeProductionOrder({
      businessId: user.businessId,
      userId: user.id,
      orderId: input.orderId,
      actualQuantity: input.actualQuantity,
    });
    revalidatePath("/produccion");
    revalidatePath("/inventario");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cancelProductionOrderAction(
  orderId: unknown,
  reason: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = cancelProductionOrderSchema.parse({ orderId, reason });
    await cancelProductionOrder({
      businessId: user.businessId,
      userId: user.id,
      orderId: input.orderId,
      reason: input.reason,
    });
    revalidatePath("/produccion");
    revalidatePath("/inventario");
    revalidatePath("/resumen");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function listProductionOrdersAction(
  payload?: unknown,
): Promise<ActionResult<unknown[]>> {
  try {
    const user = await requireRole("VIEWER");
    const input = listProductionOrdersSchema.parse(payload);
    const orders = await listProductionOrders(
      user.businessId,
      input
        ? {
            ...input,
            from: input.from ? new Date(input.from) : undefined,
            to: input.to ? new Date(input.to) : undefined,
          }
        : undefined,
    );
    return { ok: true, data: orders };
  } catch (e) {
    return toActionError(e);
  }
}

export async function getProductionOrderDetailAction(
  orderId: unknown,
): Promise<ActionResult<unknown>> {
  try {
    const user = await requireRole("VIEWER");
    const input = orderIdSchema.parse({ orderId });
    const detail = await getProductionOrderDetail(
      user.businessId,
      input.orderId,
    );
    return { ok: true, data: detail };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveSubproductRecipeAction(
  payload: unknown,
): Promise<ActionResult<{ recipeId: string; unitCost: string }>> {
  try {
    const user = await requireRole("ADMIN");
    const input = saveSubproductRecipeSchema.parse(payload);
    const result = await saveSubproductRecipe({
      businessId: user.businessId,
      userId: user.id,
      ...input,
    });
    revalidatePath("/productos");
    revalidatePath("/produccion");
    return {
      ok: true,
      data: { recipeId: result.recipe.id, unitCost: result.unitCost },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function listManufacturedIngredientsAction(): Promise<
  ActionResult<unknown[]>
> {
  try {
    const user = await requireRole("VIEWER");
    const ingredients = await listManufacturedIngredients(user.businessId);
    return { ok: true, data: ingredients };
  } catch (e) {
    return toActionError(e);
  }
}

export async function getSubproductRecipeAction(
  ingredientId: unknown,
): Promise<ActionResult<unknown>> {
  try {
    const user = await requireRole("VIEWER");
    const input = ingredientIdSchema.parse({ ingredientId });
    const data = await getSubproductRecipe(user.businessId, input.ingredientId);
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}
