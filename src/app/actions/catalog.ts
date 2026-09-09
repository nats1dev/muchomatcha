"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireBusinessContext, requireRole } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { money, d } from "@/lib/decimal";
import { saveUpload } from "@/lib/upload";
import {
  formValues,
  idOnlySchema,
  saveCategorySchema,
  saveIngredientSchema,
  saveProductSchema,
  savePurchaseUnitSchema,
  saveSupplierSchema,
  saveNumberSettingsSchema,
  saveUnitSchema,
  toggleUnitSchema,
} from "./schemas";
import {
  upsertIngredient,
  upsertIngredientCategory,
  upsertProduct,
  upsertProductCategory,
  upsertPurchaseUnit,
  upsertSupplier,
  deactivateProduct,
  deactivateIngredient,
  createUnit,
  toggleUnitActive,
} from "@/modules/catalog/service";
import { writeAudit } from "@/modules/audit/service";

export async function saveProductAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { user, business } = await requireBusinessContext("ADMIN");
    const input = saveProductSchema.parse(formValues(formData));

    const taxRate = Number(business.taxRate);
    const salePrice = money(
      d(input.clientPrice).div(d(1).plus(d(taxRate).div(100))),
    );

    const oldImage = input.id
      ? (
          await prisma.product.findUnique({
            where: { id: input.id },
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
      id: input.id,
      sku: input.sku,
      name: input.name,
      salePrice: salePrice.toNumber(),
      categoryId: input.categoryId,
      image,
      active: input.active,
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
    const user = await requireRole("ADMIN");
    const input = saveCategorySchema.parse(formValues(formData));
    await upsertProductCategory({
      businessId: user.businessId,
      userId: user.id,
      id: input.id,
      name: input.name,
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
    const user = await requireRole("ADMIN");
    const input = saveIngredientSchema.parse(formValues(formData));

    const oldImage = input.id
      ? (
          await prisma.ingredient.findUnique({
            where: { id: input.id },
            select: { image: true },
          })
        )?.image
      : null;

    const image = await saveUpload(
      formData.get("image") as File | null,
      oldImage,
    );

    await upsertIngredient({
      businessId: user.businessId,
      userId: user.id,
      id: input.id,
      sku: input.sku,
      name: input.name,
      baseUnitId: input.baseUnitId,
      categoryId: input.categoryId,
      minimumStock: input.minimumStock,
      currentAverageCost: input.currentAverageCost,
      purchaseUnitId: input.purchaseUnitId,
      conversionFactor: input.conversionFactor,
      image,
      active: input.active,
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
    const user = await requireRole("ADMIN");
    const { id } = idOnlySchema.parse(formValues(formData));
    const updated = await deactivateProduct(user.businessId, id, user.id);
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
    const user = await requireRole("ADMIN");
    const { id } = idOnlySchema.parse(formValues(formData));
    const updated = await deactivateIngredient(user.businessId, id, user.id);
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
    const user = await requireRole("ADMIN");
    const input = saveCategorySchema.parse(formValues(formData));
    await upsertIngredientCategory({
      businessId: user.businessId,
      userId: user.id,
      name: input.name,
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
    const user = await requireRole("ADMIN");
    const input = savePurchaseUnitSchema.parse(formValues(formData));
    await upsertPurchaseUnit({
      businessId: user.businessId,
      userId: user.id,
      ingredientId: input.ingredientId,
      unitId: input.unitId,
      conversionFactor: input.conversionFactor,
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
    const user = await requireRole("ADMIN");
    const input = saveSupplierSchema.parse(formValues(formData));
    const supplier = await upsertSupplier({
      businessId: user.businessId,
      userId: user.id,
      id: input.id,
      name: input.name,
      taxId: input.taxId ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      active: input.active,
    });
    revalidatePath("/compras");
    revalidatePath("/configuracion");
    return { ok: true, data: { id: supplier.id, name: supplier.name } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveNumberSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = saveNumberSettingsSchema.parse(formValues(formData));
    const before = await prisma.business.findFirst({
      where: { id: user.businessId },
      select: { numberFormat: true, moneyDecimals: true, costDecimals: true, quantityDecimals: true },
    });
    if (!before) throw new Error("Negocio no encontrado");
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.business.update({
        where: { id: user.businessId },
        data: input,
        select: { numberFormat: true, moneyDecimals: true, costDecimals: true, quantityDecimals: true },
      });
      await writeAudit(tx, {
        businessId: user.businessId,
        userId: user.id,
        action: "UPDATE",
        entityType: "number_display_settings",
        entityId: user.businessId,
        beforeData: before,
        afterData: updated,
      });
      return updated;
    });
    void after;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveUnitAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = saveUnitSchema.parse(formValues(formData));
    await createUnit({ ...input, businessId: user.businessId, userId: user.id });
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleUnitAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const input = toggleUnitSchema.parse(formValues(formData));
    await toggleUnitActive({ ...input, businessId: user.businessId, userId: user.id });
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
