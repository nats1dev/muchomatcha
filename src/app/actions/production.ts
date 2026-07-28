"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
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

export async function createProductionOrderAction(payload: {
  ingredientId: string;
  quantity: number;
  notes?: string;
}): Promise<
  ActionResult<{
    orderId: string;
    orderNumber: number;
    estimatedUnitCost: string;
  }>
> {
  try {
    const user = await requireSession();
    const result = await createProductionOrder({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
    });
    revalidatePath("/produccion");
    revalidatePath("/inventario");
    return {
      ok: true,
      data: {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
        estimatedUnitCost: result.estimatedUnitCost,
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function startProductionOrderAction(
  orderId: string,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await startProductionOrder({
      businessId: user.businessId,
      userId: user.id,
      orderId,
    });
    revalidatePath("/produccion");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function completeProductionOrderAction(
  orderId: string,
  actualQuantity?: number,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await completeProductionOrder({
      businessId: user.businessId,
      userId: user.id,
      orderId,
      actualQuantity,
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
  orderId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await cancelProductionOrder({
      businessId: user.businessId,
      userId: user.id,
      orderId,
      reason,
    });
    revalidatePath("/produccion");
    revalidatePath("/inventario");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function listProductionOrdersAction(payload?: {
  ingredientId?: string;
  status?: string;
  from?: string;
  to?: string;
  take?: number;
  skip?: number;
}): Promise<ActionResult<unknown[]>> {
  try {
    const user = await requireSession();
    const orders = await listProductionOrders(
      user.businessId,
      payload
        ? {
            ...payload,
            status: payload.status as
              | import("@prisma/client").ProductionStatus
              | undefined,
            from: payload.from ? new Date(payload.from) : undefined,
            to: payload.to ? new Date(payload.to) : undefined,
          }
        : undefined,
    );
    return { ok: true, data: orders };
  } catch (e) {
    return toActionError(e);
  }
}

export async function getProductionOrderDetailAction(
  orderId: string,
): Promise<ActionResult<unknown>> {
  try {
    const user = await requireSession();
    const detail = await getProductionOrderDetail(user.businessId, orderId);
    return { ok: true, data: detail };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveSubproductRecipeAction(payload: {
  ingredientId: string;
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
    const result = await saveSubproductRecipe({
      businessId: user.businessId,
      userId: user.id,
      ...payload,
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
    const user = await requireSession();
    const ingredients = await listManufacturedIngredients(user.businessId);
    return { ok: true, data: ingredients };
  } catch (e) {
    return toActionError(e);
  }
}

export async function getSubproductRecipeAction(
  ingredientId: string,
): Promise<ActionResult<unknown>> {
  try {
    const user = await requireSession();
    const data = await getSubproductRecipe(user.businessId, ingredientId);
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}
