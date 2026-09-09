"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import {
  upsertIngredient,
  upsertIngredientCategory,
  upsertProduct,
  upsertProductCategory,
} from "@/modules/catalog/service";
import { prisma } from "@/lib/db";
import { parseImportCsv } from "@/lib/csv-import";

export async function importCsvAction(
  _prev: unknown,
  formData: FormData,
): Promise<
  ActionResult<{
    created: number;
    errors: string[];
    type: string;
    summary: string;
  }>
> {
  try {
    const user = await requireRole("ADMIN");
    const file = formData.get("file") as File | null;
    if (!file)
      return { ok: false, message: "Selecciona un archivo CSV", code: "VALIDATION_ERROR" };

    const content = await file.text();
    const result = parseImportCsv(content);

    if (result.errors.length && !result.rows.length) {
      return {
        ok: false,
        message: result.errors.join("\n"),
        code: "VALIDATION_ERROR",
      };
    }

    const created: string[] = [];
    const skipped: string[] = [];

    if (result.type === "ingredients") {
      for (const row of result.rows as Array<{ name: string; sku: string; baseUnit: string; category?: string; minStock?: number; purchaseUnit?: string; conversionFactor?: number }>) {
        try {
          let categoryId: string | undefined;
          if (row.category) {
            const cat = await upsertIngredientCategory({
              businessId: user.businessId,
              userId: user.id,
              name: row.category,
            });
            categoryId = cat.id;
          }

          const unit = await prisma.unit.findFirst({
            where: { businessId: user.businessId, code: row.baseUnit, active: true },
          });
          if (!unit) {
            skipped.push(`${row.name}: unidad "${row.baseUnit}" no encontrada`);
            continue;
          }

          let purchaseUnitId: string | undefined;
          let conversionFactor: number | undefined;
          if (row.purchaseUnit && row.conversionFactor) {
            const pu = await prisma.unit.findFirst({
              where: { businessId: user.businessId, code: row.purchaseUnit, active: true },
            });
            if (pu) {
              purchaseUnitId = pu.id;
              conversionFactor = row.conversionFactor;
            }
          }

          await upsertIngredient({
            businessId: user.businessId,
            userId: user.id,
            sku: row.sku,
            name: row.name,
            baseUnitId: unit.id,
            categoryId,
            minimumStock: row.minStock,
            purchaseUnitId,
            conversionFactor,
          });
          created.push(row.name);
        } catch {
          skipped.push(`${row.name}: error al crear`);
        }
      }
    } else {
      for (const row of result.rows as Array<{ name: string; sku: string; salePrice: number; category?: string }>) {
        try {
          let categoryId: string | null = null;
          if (row.category) {
            const cat = await upsertProductCategory({
              businessId: user.businessId,
              userId: user.id,
              name: row.category,
            });
            categoryId = cat.id;
          }

          await upsertProduct({
            businessId: user.businessId,
            userId: user.id,
            sku: row.sku,
            name: row.name,
            salePrice: row.salePrice,
            categoryId,
          });
          created.push(row.name);
        } catch {
          skipped.push(`${row.name}: error al crear`);
        }
      }
    }

    revalidatePath("/setup");
    revalidatePath("/productos");
    revalidatePath("/inventario");

    const parseErrors = result.errors.map((e) => `[CSV] ${e}`);
    const skipErrors = skipped.map((s) => `[DB] ${s}`);
    const allErrors = [...parseErrors, ...skipErrors];

    return {
      ok: true,
      data: {
        created: created.length,
        errors: allErrors,
        type: result.type,
        summary: `${created.length} ${result.type === "ingredients" ? "ingredientes" : "productos"} creados${allErrors.length ? `. ${allErrors.length} errores` : ""}`,
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}
