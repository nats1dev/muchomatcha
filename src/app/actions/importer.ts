"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { isAppError, toActionError, type ActionResult } from "@/lib/errors";
import {
  upsertIngredient,
  upsertIngredientCategory,
  upsertProduct,
  upsertProductCategory,
  upsertSupplier,
} from "@/modules/catalog/service";
import { saveRecipe, saveSubproductRecipe } from "@/modules/recipes/service";
import { createInitialInventory } from "@/modules/inventory/service";
import { getStockMap } from "@/modules/inventory/stock";
import { prisma } from "@/lib/db";
import {
  groupRecipeLines,
  parseImportCsv,
  type ImportedRow,
  type IngredientRow,
  type InventoryRow,
  type ParserIssue,
  type ProductRow,
  type SupplierRow,
} from "@/lib/csv-import";
import { importFileSchema } from "@/app/actions/schemas";
import {
  troubleshoot,
  type ImportPreview,
  type PreviewRow,
} from "@/lib/import-troubleshooting";

const normKey = (s: string) => s.trim().toLowerCase();

type PlannedIngredient = {
  line: number;
  data: IngredientRow;
  baseUnitId: string;
  categoryName?: string;
  purchaseUnitId?: string;
  conversionFactor?: number;
};

type PlannedProduct = {
  line: number;
  data: ProductRow;
  categoryName?: string;
};

type PlannedRecipeGroup = {
  targetSku: string;
  firstLine: number;
  targetId: string;
  isProduct: boolean;
  yieldQuantity?: number;
  notes?: string;
  items: Array<{
    ingredientId: string;
    quantity: number;
    wastePercentage?: number;
    isNonInventoriable?: boolean;
  }>;
};

type PlannedSupplier = {
  line: number;
  data: SupplierRow;
};

type PlannedInventory = {
  line: number;
  data: InventoryRow;
  ingredientId: string;
};

type ImportPlan =
  | { type: "ingredients"; fileName: string; planned: PlannedIngredient[]; issueRows: PreviewRow[]; newCategories: string[]; updatedRecipes: string[] }
  | { type: "products"; fileName: string; planned: PlannedProduct[]; issueRows: PreviewRow[]; newCategories: string[]; updatedRecipes: string[] }
  | { type: "productRecipes" | "subproductRecipes"; fileName: string; planned: PlannedRecipeGroup[]; issueRows: PreviewRow[]; newCategories: string[]; updatedRecipes: string[] }
  | { type: "suppliers"; fileName: string; planned: PlannedSupplier[]; issueRows: PreviewRow[]; newCategories: string[]; updatedRecipes: string[] }
  | { type: "inventory"; fileName: string; planned: PlannedInventory[]; issueRows: PreviewRow[]; newCategories: string[]; updatedRecipes: string[] };

function issueToRow(issue: ParserIssue): PreviewRow {
  const t = troubleshoot(issue.code, { detail: issue.detail, column: issue.column ?? "" });
  return {
    line: issue.line,
    label: issue.line ? `Fila ${issue.line}` : "Archivo",
    status: "error",
    code: issue.code,
    reason: t.reason,
    fix: t.fix,
  };
}

/**
 * Núcleo compartido preview/confirm: valida y resuelve todo SIN escribir.
 * Las categorías nuevas solo se reportan (`newCategories`); se crean en confirm.
 */
async function buildImportPlan(
  businessId: string,
  file: File,
): Promise<ImportPlan> {
  const parsed = parseImportCsv(await file.text());
  const issueRows = parsed.issues.map(issueToRow);

  if (parsed.errors.length && !parsed.rows.length) {
    throw new AppErrorRef(parsed.errors.join("\n"));
  }

  if (parsed.type === "ingredients") {
    const [units, cats, existing] = await Promise.all([
      prisma.unit.findMany({ where: { businessId, active: true } }),
      prisma.ingredientCategory.findMany({ where: { businessId } }),
      prisma.ingredient.findMany({ where: { businessId }, select: { sku: true } }),
    ]);
    const unitByCode = new Map(units.map((u) => [u.code, u.id]));
    const catByName = new Map(cats.map((c) => [normKey(c.name), c.id]));
    const existingSku = new Set(existing.map((e) => e.sku.toUpperCase()));
    const validUnits = [...unitByCode.keys()].join(", ");

    const planned: PlannedIngredient[] = [];
    const newCatKeys = new Map<string, string>();
    for (const { line, data: row } of parsed.rows as ImportedRow<IngredientRow>[]) {
      const tag = `Fila ${line} (${row.name})`;
      if (existingSku.has(row.sku)) {
        const t = troubleshoot("SKU_EXISTS", { detail: row.sku });
        issueRows.push({ line, label: tag, status: "error", code: "SKU_EXISTS", reason: t.reason, fix: t.fix });
        continue;
      }
      const baseUnitId = unitByCode.get(row.baseUnit);
      if (!baseUnitId) {
        const t = troubleshoot("UNIT_NOT_FOUND", { detail: row.baseUnit, valid: validUnits });
        issueRows.push({ line, label: tag, status: "error", code: "UNIT_NOT_FOUND", reason: t.reason, fix: t.fix });
        continue;
      }
      let purchaseUnitId: string | undefined;
      let conversionFactor: number | undefined;
      if (row.purchaseUnit !== undefined || row.conversionFactor !== undefined) {
        if (row.purchaseUnit === undefined || row.conversionFactor === undefined) {
          const t = troubleshoot("MISMATCHED_PAIR");
          issueRows.push({ line, label: tag, status: "error", code: "MISMATCHED_PAIR", reason: t.reason, fix: t.fix });
          continue;
        }
        const puId = unitByCode.get(row.purchaseUnit);
        if (!puId) {
          const t = troubleshoot("PURCHASE_UNIT_NOT_FOUND", { detail: row.purchaseUnit, valid: validUnits });
          issueRows.push({ line, label: tag, status: "error", code: "PURCHASE_UNIT_NOT_FOUND", reason: t.reason, fix: t.fix });
          continue;
        }
        purchaseUnitId = puId;
        conversionFactor = row.conversionFactor;
      }
      let categoryName: string | undefined;
      if (row.category) {
        const key = normKey(row.category);
        if (!catByName.has(key) && !newCatKeys.has(key)) newCatKeys.set(key, row.category.trim());
        categoryName = row.category;
      }
      planned.push({ line, data: row, baseUnitId, categoryName, purchaseUnitId, conversionFactor });
    }
    return { type: "ingredients", fileName: file.name, planned, issueRows, newCategories: [...newCatKeys.values()], updatedRecipes: [] };
  }

  if (parsed.type === "suppliers") {
    const existing = await prisma.supplier.findMany({ where: { businessId }, select: { name: true } });
    const existingNames = new Set(existing.map((s) => normKey(s.name)));
    const planned: PlannedSupplier[] = [];
    for (const { line, data: row } of parsed.rows) {
      const tag = `Fila ${line} (${row.name})`;
      if (existingNames.has(normKey(row.name))) {
        const t = troubleshoot("SUPPLIER_EXISTS", { detail: row.name });
        issueRows.push({ line, label: tag, status: "error", code: "SUPPLIER_EXISTS", reason: t.reason, fix: t.fix });
        continue;
      }
      existingNames.add(normKey(row.name));
      planned.push({ line, data: row });
    }
    return { type: "suppliers", fileName: file.name, planned, issueRows, newCategories: [], updatedRecipes: [] };
  }

  if (parsed.type === "inventory") {
    const ingredients = await prisma.ingredient.findMany({ where: { businessId }, select: { id: true, sku: true } });
    const ingBySku = new Map(ingredients.map((i) => [i.sku.toUpperCase(), i.id]));
    const stock = await getStockMap(businessId, ingredients.map((i) => i.id));
    const planned: PlannedInventory[] = [];
    for (const { line, data: row } of parsed.rows) {
      const tag = `Fila ${line} (${row.ingredientSku})`;
      const ingredientId = ingBySku.get(row.ingredientSku);
      if (!ingredientId) {
        const t = troubleshoot("INGREDIENT_NOT_FOUND", { detail: row.ingredientSku });
        issueRows.push({ line, label: tag, status: "error", code: "INGREDIENT_NOT_FOUND", reason: t.reason, fix: t.fix });
        continue;
      }
      const qty = stock.get(ingredientId);
      if (qty !== undefined && qty.toNumber() !== 0) {
        const t = troubleshoot("HAS_STOCK", { detail: row.ingredientSku });
        issueRows.push({
          line,
          label: `Fila ${line} (${row.ingredientSku}, stock ${qty.toNumber()})`,
          status: "warning",
          code: "HAS_STOCK",
          reason: t.reason,
          fix: t.fix,
        });
        continue;
      }
      planned.push({ line, data: row, ingredientId });
    }
    return { type: "inventory", fileName: file.name, planned, issueRows, newCategories: [], updatedRecipes: [] };
  }

  if (parsed.type === "productRecipes" || parsed.type === "subproductRecipes") {
    const isProduct = parsed.type === "productRecipes";
    const [products, ingredients, prodRecipes, subRecipes] = await Promise.all([
      prisma.product.findMany({ where: { businessId }, select: { id: true, sku: true } }),
      prisma.ingredient.findMany({ where: { businessId }, select: { id: true, sku: true, currentAverageCost: true } }),
      prisma.recipe.findMany({
        where: { businessId, active: true, productId: { not: null } },
        select: { productId: true, version: true },
      }),
      prisma.recipe.findMany({
        where: { businessId, active: true, productId: null },
        select: { version: true, producedIngredients: { select: { id: true } } },
      }),
    ]);
    const productBySku = new Map(products.map((p) => [p.sku.toUpperCase(), p.id]));
    const ingBySku = new Map(ingredients.map((i) => [i.sku.toUpperCase(), i]));
    const prodVersion = new Map<string, number>();
    for (const r of prodRecipes) {
      if (r.productId) prodVersion.set(r.productId, r.version);
    }
    const subVersion = new Map<string, number>();
    for (const r of subRecipes) {
      for (const pi of r.producedIngredients) subVersion.set(pi.id, r.version);
    }

    const { groups, issues: groupIssues } = groupRecipeLines(parsed.rows);
    for (const issue of groupIssues) issueRows.push(issueToRow(issue));

    const planned: PlannedRecipeGroup[] = [];
    const updatedRecipes: string[] = [];
    for (const group of groups) {
      const tag = `Receta ${group.targetSku} (fila ${group.firstLine})`;
      const targetId = isProduct ? productBySku.get(group.targetSku) : ingBySku.get(group.targetSku)?.id;
      if (!targetId) {
        const t = troubleshoot(isProduct ? "PRODUCT_NOT_FOUND" : "INGREDIENT_NOT_FOUND", {
          detail: group.targetSku,
        });
        issueRows.push({
          line: group.firstLine,
          label: tag,
          status: "error",
          code: isProduct ? "PRODUCT_NOT_FOUND" : "INGREDIENT_NOT_FOUND",
          reason: t.reason,
          fix: t.fix,
        });
        continue;
      }
      const items: PlannedRecipeGroup["items"] = [];
      let bad = false;
      for (const { line, data } of group.lines) {
        const ing = ingBySku.get(data.ingredientSku);
        if (!ing) {
          const t = troubleshoot("INGREDIENT_NOT_FOUND", { detail: data.ingredientSku });
          issueRows.push({
            line,
            label: `Fila ${line} (${data.ingredientSku})`,
            status: "error",
            code: "INGREDIENT_NOT_FOUND",
            reason: t.reason,
            fix: t.fix,
          });
          bad = true;
          continue;
        }
        items.push({
          ingredientId: ing.id,
          quantity: data.quantity,
          wastePercentage: data.wastePercentage,
          isNonInventoriable: data.nonInventoriable ?? false,
        });
      }
      if (bad) continue;
      if (!isProduct) {
        const zero = group.lines.find(
          (l) => Number(ingBySku.get(l.data.ingredientSku)?.currentAverageCost ?? 0) <= 0,
        );
        if (zero) {
          const t = troubleshoot("ZERO_COST", { detail: zero.data.ingredientSku });
          issueRows.push({
            line: zero.line,
            label: `Fila ${zero.line} (${zero.data.ingredientSku})`,
            status: "error",
            code: "ZERO_COST",
            reason: t.reason,
            fix: t.fix,
          });
          continue;
        }
      }
      const prevVersion = isProduct ? prodVersion.get(targetId) : subVersion.get(targetId);
      if (prevVersion !== undefined) {
        updatedRecipes.push(`${group.targetSku} (v${prevVersion}→v${prevVersion + 1})`);
      }
      planned.push({
        targetSku: group.targetSku,
        firstLine: group.firstLine,
        targetId,
        isProduct,
        yieldQuantity: group.yieldQuantity,
        notes: group.notes ?? undefined,
        items,
      });
    }
    return { type: parsed.type, fileName: file.name, planned, issueRows, newCategories: [], updatedRecipes };
  }

  if (parsed.type !== "products") {
    throw new AppErrorRef("Tipo de archivo no soportado");
  }

  const [cats, existing] = await Promise.all([
    prisma.productCategory.findMany({ where: { businessId } }),
    prisma.product.findMany({ where: { businessId }, select: { sku: true } }),
  ]);
  const catByName = new Map(cats.map((c) => [normKey(c.name), c.id]));
  const existingSku = new Set(existing.map((e) => e.sku.toUpperCase()));

  const planned: PlannedProduct[] = [];
  const newCatKeys = new Map<string, string>();
  for (const { line, data: row } of parsed.rows as ImportedRow<ProductRow>[]) {
    const tag = `Fila ${line} (${row.name})`;
    if (existingSku.has(row.sku)) {
      const t = troubleshoot("SKU_EXISTS", { detail: row.sku });
      issueRows.push({ line, label: tag, status: "error", code: "SKU_EXISTS", reason: t.reason, fix: t.fix });
      continue;
    }
    let categoryName: string | undefined;
    if (row.category) {
      const key = normKey(row.category);
      if (!catByName.has(key) && !newCatKeys.has(key)) newCatKeys.set(key, row.category.trim());
      categoryName = row.category;
    }
    planned.push({ line, data: row, categoryName });
  }
  return { type: "products", fileName: file.name, planned, issueRows, newCategories: [...newCatKeys.values()], updatedRecipes: [] };
}

/** Error interno para abortar el preview con el mensaje ya armado. */
class AppErrorRef extends Error {}

/**
 * Paso 1: analiza el CSV sin escribir nada. Devuelve filas válidas (conteo),
 * filas con problema (motivo + cómo solucionarlo) y categorías a crear.
 */
export async function previewCsvAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<ImportPreview>> {
  try {
    const user = await requireRole("ADMIN");
    const file = formData.get("file") as File | null;
    if (!file)
      return { ok: false, message: "Selecciona un archivo CSV", code: "VALIDATION_ERROR" };

    const fileCheck = importFileSchema.safeParse({ size: file.size, name: file.name });
    if (!fileCheck.success) {
      return {
        ok: false,
        message: fileCheck.error.issues[0]?.message ?? "Archivo inválido",
        code: "VALIDATION_ERROR",
      };
    }

    const plan = await buildImportPlan(user.businessId, file);
    return {
      ok: true,
      data: {
        type: plan.type,
        fileName: plan.fileName,
        validCount: plan.planned.length,
        rows: plan.issueRows,
        newCategories: plan.newCategories,
        updatedRecipes: plan.updatedRecipes,
      },
    };
  } catch (e) {
    if (e instanceof AppErrorRef) {
      return { ok: false, message: e.message, code: "VALIDATION_ERROR" };
    }
    return toActionError(e);
  }
}

/**
 * Paso 2: revalida el archivo reenviado y escribe SOLO las filas válidas.
 * Cancelar el diálogo nunca llega aquí, así que cancelar = cero escrituras.
 */
export async function confirmCsvAction(
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

    const fileCheck = importFileSchema.safeParse({ size: file.size, name: file.name });
    if (!fileCheck.success) {
      return {
        ok: false,
        message: fileCheck.error.issues[0]?.message ?? "Archivo inválido",
        code: "VALIDATION_ERROR",
      };
    }

    let plan: ImportPlan;
    try {
      plan = await buildImportPlan(user.businessId, file);
    } catch (e) {
      if (e instanceof AppErrorRef) {
        return { ok: false, message: e.message, code: "VALIDATION_ERROR" };
      }
      throw e;
    }

    const created: string[] = [];
    const omitted = plan.issueRows.map((r) =>
      r.line ? `[${r.code}] Fila ${r.line} (${r.label}): ${r.reason}` : `[${r.code}] ${r.reason}`,
    );

    if (plan.type === "ingredients") {
      const catCache = new Map<string, string>();
      for (const item of plan.planned) {
        const { line, data: row } = item;
        const tag = `Fila ${line} (${row.name})`;
        try {
          let categoryId: string | undefined;
          if (item.categoryName) {
            const key = normKey(item.categoryName);
            categoryId = catCache.get(key);
            if (!categoryId) {
              const cat = await upsertIngredientCategory({
                businessId: user.businessId,
                userId: user.id,
                name: item.categoryName,
              });
              categoryId = cat.id;
              catCache.set(key, cat.id);
            }
          }
          await upsertIngredient({
            businessId: user.businessId,
            userId: user.id,
            sku: row.sku,
            name: row.name,
            baseUnitId: item.baseUnitId,
            categoryId,
            minimumStock: row.minStock,
            purchaseUnitId: item.purchaseUnitId,
            conversionFactor: item.conversionFactor,
          });
          created.push(row.name);
        } catch (e) {
          omitted.push(`${tag}: ${isAppError(e) ? e.message : "error al crear"}`);
        }
      }
    } else if (plan.type === "products") {
      const catCache = new Map<string, string>();
      for (const item of plan.planned) {
        const { line, data: row } = item;
        const tag = `Fila ${line} (${row.name})`;
        try {
          let categoryId: string | null = null;
          if (item.categoryName) {
            const key = normKey(item.categoryName);
            categoryId = catCache.get(key) ?? null;
            if (!categoryId) {
              const cat = await upsertProductCategory({
                businessId: user.businessId,
                userId: user.id,
                name: item.categoryName,
              });
              categoryId = cat.id;
              catCache.set(key, cat.id);
            }
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
        } catch (e) {
          omitted.push(`${tag}: ${isAppError(e) ? e.message : "error al crear"}`);
        }
      }
    } else if (plan.type === "suppliers") {
      for (const item of plan.planned) {
        const { line, data: row } = item;
        const tag = `Fila ${line} (${row.name})`;
        try {
          await upsertSupplier({
            businessId: user.businessId,
            userId: user.id,
            name: row.name,
            taxId: row.taxId,
            phone: row.phone,
            email: row.email,
          });
          created.push(row.name);
        } catch (e) {
          omitted.push(`${tag}: ${isAppError(e) ? e.message : "error al crear"}`);
        }
      }
    } else if (plan.type === "inventory") {
      // createInitialInventory acepta 200 renglones; se parte en lotes.
      const CHUNK = 200;
      for (let i = 0; i < plan.planned.length; i += CHUNK) {
        const chunk = plan.planned.slice(i, i + CHUNK);
        try {
          await createInitialInventory({
            businessId: user.businessId,
            userId: user.id,
            items: chunk.map((c) => ({
              ingredientId: c.ingredientId,
              quantity: c.data.quantity,
              unitCost: c.data.unitCost,
            })),
          });
          for (const c of chunk) created.push(c.data.ingredientSku);
        } catch (e) {
          const msg = isAppError(e) ? e.message : "error al registrar";
          for (const c of chunk) omitted.push(`Fila ${c.line} (${c.data.ingredientSku}): ${msg}`);
        }
      }
    } else if (plan.type === "productRecipes" || plan.type === "subproductRecipes") {
      for (const group of plan.planned) {
        const tag = `Receta ${group.targetSku} (fila ${group.firstLine})`;
        try {
          const saved = group.isProduct
            ? await saveRecipe({
                businessId: user.businessId,
                userId: user.id,
                productId: group.targetId,
                yieldQuantity: group.yieldQuantity,
                notes: group.notes,
                items: group.items,
              })
            : await saveSubproductRecipe({
                businessId: user.businessId,
                userId: user.id,
                ingredientId: group.targetId,
                yieldQuantity: group.yieldQuantity,
                notes: group.notes,
                items: group.items,
              });
          created.push(`${group.targetSku} (v${saved.recipe.version})`);
        } catch (e) {
          omitted.push(`${tag}: ${isAppError(e) ? e.message : "error al guardar"}`);
        }
      }
    }

    const noun: Record<ImportPlan["type"], string> = {
      ingredients: "ingredientes creados",
      products: "productos creados",
      suppliers: "proveedores creados",
      inventory: "líneas de inventario inicial registradas",
      productRecipes: "recetas guardadas",
      subproductRecipes: "recetas guardadas",
    };
    revalidatePath("/setup");
    revalidatePath("/productos");
    revalidatePath("/inventario");
    if (plan.type === "suppliers") {
      revalidatePath("/compras");
      revalidatePath("/configuracion");
    }
    if (plan.type === "productRecipes" || plan.type === "subproductRecipes") {
      revalidatePath("/recetas");
      revalidatePath("/produccion");
    }

    return {
      ok: true,
      data: {
        created: created.length,
        errors: omitted,
        type: plan.type,
        summary: `${created.length} ${noun[plan.type]}${omitted.length ? `. ${omitted.length} omitidos` : ""}`,
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}
