"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import {
  upsertIngredient,
  upsertIngredientCategory,
  upsertProduct,
  upsertProductCategory,
  upsertPurchaseUnit,
  upsertSupplier,
} from "@/modules/catalog/service";

export async function saveProductAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await upsertProduct({
      businessId: user.businessId,
      userId: user.id,
      id: (formData.get("id") as string) || undefined,
      sku: String(formData.get("sku") ?? ""),
      name: String(formData.get("name") ?? ""),
      salePrice: Number(formData.get("salePrice") ?? 0),
      categoryId: (formData.get("categoryId") as string) || null,
      active: formData.get("active") !== "false",
    });
    revalidatePath("/productos");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveProductCategoryAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await upsertProductCategory({
      businessId: user.businessId,
      userId: user.id,
      id: (formData.get("id") as string) || undefined,
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath("/productos");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveIngredientAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await upsertIngredient({
      businessId: user.businessId,
      userId: user.id,
      id: (formData.get("id") as string) || undefined,
      sku: String(formData.get("sku") ?? ""),
      name: String(formData.get("name") ?? ""),
      baseUnitId: String(formData.get("baseUnitId") ?? ""),
      categoryId: (formData.get("categoryId") as string) || null,
      minimumStock: Number(formData.get("minimumStock") ?? 0),
      active: formData.get("active") !== "false",
    });
    revalidatePath("/inventario");
    revalidatePath("/productos");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveIngredientCategoryAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await upsertIngredientCategory({
      businessId: user.businessId,
      userId: user.id,
      name: String(formData.get("name") ?? ""),
    });
    revalidatePath("/inventario");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function savePurchaseUnitAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await upsertPurchaseUnit({
      businessId: user.businessId,
      ingredientId: String(formData.get("ingredientId") ?? ""),
      unitId: String(formData.get("unitId") ?? ""),
      conversionFactor: Number(formData.get("conversionFactor") ?? 0),
    });
    revalidatePath("/inventario");
    revalidatePath("/compras");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveSupplierAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await upsertSupplier({
      businessId: user.businessId,
      userId: user.id,
      id: (formData.get("id") as string) || undefined,
      name: String(formData.get("name") ?? ""),
      taxId: String(formData.get("taxId") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      active: formData.get("active") !== "false",
    });
    revalidatePath("/compras");
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
