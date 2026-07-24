"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireBusinessContext, requireSession } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { money, d } from "@/lib/decimal";
import { saveUpload } from "@/lib/upload";
import {
  upsertIngredient,
  upsertIngredientCategory,
  upsertProduct,
  upsertProductCategory,
  upsertPurchaseUnit,
  upsertSupplier,
  deactivateProduct,
  deactivateIngredient,
} from "@/modules/catalog/service";

export async function saveProductAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user, business } = await requireBusinessContext();

    const clientPrice = Number(formData.get("clientPrice") ?? 0);
    const taxRate = Number(business.taxRate);
    const salePrice = money(d(clientPrice).div(d(1).plus(d(taxRate).div(100))));

    const id = (formData.get("id") as string) || undefined;
    const oldImage = id
      ? (
          await prisma.product.findUnique({
            where: { id },
            select: { image: true },
          })
        )?.image
      : null;

    const image = await saveUpload(
      formData.get("image") as File | null,
      oldImage,
    );

    await upsertProduct({
      businessId: user.businessId,
      userId: user.id,
      id,
      sku: String(formData.get("sku") ?? ""),
      name: String(formData.get("name") ?? ""),
      salePrice: salePrice.toNumber(),
      categoryId: (formData.get("categoryId") as string) || null,
      image,
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

    const id = (formData.get("id") as string) || undefined;
    const oldImage = id
      ? (
          await prisma.ingredient.findUnique({
            where: { id },
            select: { image: true },
          })
        )?.image
      : null;

    const image = await saveUpload(
      formData.get("image") as File | null,
      oldImage,
    );

    const currentAverageCostRaw = formData.get("currentAverageCost");
    const currentAverageCost = currentAverageCostRaw !== null && currentAverageCostRaw !== ""
      ? Number(currentAverageCostRaw)
      : undefined;

    const purchaseUnitId = (formData.get("purchaseUnitId") as string) || undefined;
    const conversionFactorRaw = formData.get("conversionFactor");
    const conversionFactor = conversionFactorRaw && conversionFactorRaw !== ""
      ? Number(conversionFactorRaw)
      : undefined;

    await upsertIngredient({
      businessId: user.businessId,
      userId: user.id,
      id,
      sku: String(formData.get("sku") ?? ""),
      name: String(formData.get("name") ?? ""),
      baseUnitId: String(formData.get("baseUnitId") ?? ""),
      categoryId: (formData.get("categoryId") as string) || null,
      minimumStock: Number(formData.get("minimumStock") ?? 0),
      currentAverageCost,
      purchaseUnitId,
      conversionFactor,
      image,
      active: formData.get("active") !== "false",
    });
    revalidatePath("/inventario");
    revalidatePath("/productos");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleProductActiveAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ active: boolean; name: string }>> {
  try {
    const user = await requireSession();
    const updated = await deactivateProduct(
      user.businessId,
      String(formData.get("id") ?? ""),
      user.id,
    );
    revalidatePath("/productos");
    return { ok: true, data: { active: updated.active, name: updated.name } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleIngredientActiveAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ active: boolean; name: string }>> {
  try {
    const user = await requireSession();
    const updated = await deactivateIngredient(
      user.businessId,
      String(formData.get("id") ?? ""),
      user.id,
    );
    revalidatePath("/inventario");
    revalidatePath("/productos");
    return { ok: true, data: { active: updated.active, name: updated.name } };
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
      userId: user.id,
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
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await requireSession();
    const supplier = await upsertSupplier({
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
    return { ok: true, data: { id: supplier.id, name: supplier.name } };
  } catch (e) {
    return toActionError(e);
  }
}
