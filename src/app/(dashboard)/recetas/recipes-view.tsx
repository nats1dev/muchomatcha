"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, PowerOff, Trash2 } from "lucide-react";
import { deactivateRecipeAction, deleteRecipeAction } from "@/app/actions/operations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/utils";
import { RecipeForm } from "./recipe-form";

type RecipeRow = {
  id: string;
  productId: string | null;
  version: number;
  yieldQuantity: number;
  notes: string | null;
  unitCost: string;
  margin: string;
  product: { id: string; name: string };
  items: Array<{
    id: string;
    ingredientId: string;
    quantity: number;
    wastePercentage: number;
    ingredient: { id: string; name: string; baseUnit: { code: string } };
  }>;
};

export function RecipesView({
  recipes,
  missing,
  products,
  ingredients,
}: {
  recipes: RecipeRow[];
  missing: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; salePrice: number }>;
  ingredients: Array<{
    id: string;
    name: string;
    unit: string;
    cost: number;
  }>;
}) {
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const activeRecipeIds = new Set(recipes.map((r) => r.productId).filter(Boolean) as string[]);

  const editingRecipe = editingRecipeId
    ? recipes.find((r) => r.id === editingRecipeId)
    : null;

  async function handleDeactivate(recipeId: string, productName: string) {
    if (!confirm(`¿Desactivar la receta de "${productName}"?`)) return;
    const res = await deactivateRecipeAction(recipeId);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Receta de "${productName}" desactivada`);
  }

  async function handleDelete(recipeId: string, productName: string) {
    if (
      !confirm(
        `¿Eliminar permanentemente la receta de "${productName}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    const res = await deleteRecipeAction(recipeId);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Receta de "${productName}" eliminada`);
  }

  return (
    <div>
      {missing.length ? (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">
              {missing.length} producto(s) sin receta activa
            </p>
            <p className="mt-1 text-muted-foreground">
              {missing
                .slice(0, 8)
                .map((p) => p.name)
                .join(", ")}
              {missing.length > 8 ? "…" : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Recetas activas</CardTitle>
          </CardHeader>
          <CardContent>
            {!recipes.length ? (
              <EmptyState title="Agrega ingredientes para calcular el costo real" />
            ) : (
              <div className="space-y-3">
                {recipes.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-[12px] border p-4 ${
                      editingRecipeId === r.id
                        ? "border-primary/40 bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{r.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          v{r.version} · {r.items.length} ingredientes
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingRecipeId(r.id)}
                          title="Editar receta"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-error"
                          onClick={() =>
                            handleDeactivate(r.id, r.product.name)
                          }
                          title="Desactivar receta"
                        >
                          <PowerOff className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-error"
                          onClick={() =>
                            handleDelete(r.id, r.product.name)
                          }
                          title="Eliminar receta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="tabular-nums">
                        Costo {formatMoney(Number(r.unitCost))}
                      </span>
                      <Badge variant="success">Margen {r.margin}%</Badge>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {r.items.map((item) => (
                        <li key={item.id}>
                          {item.ingredient.name}: {Number(item.quantity)}{" "}
                          {item.ingredient.baseUnit.code}
                          {Number(item.wastePercentage) > 0
                            ? ` (+${Number(item.wastePercentage)}% merma)`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {editingRecipe ? "Editar receta" : "Nueva receta"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecipeForm
              key={editingRecipeId ?? "new"}
              products={products}
              ingredients={ingredients}
              productsWithRecipeIds={activeRecipeIds}
              initialData={
                editingRecipe
                  ? {
                      recipeId: editingRecipe.id,
                      productId: editingRecipe.productId,
                      productName: editingRecipe.product.name,
                      yieldQuantity: Number(editingRecipe.yieldQuantity),
                      notes: editingRecipe.notes ?? undefined,
                      items: editingRecipe.items.map((i) => ({
                        ingredientId: i.ingredientId,
                        quantity: Number(i.quantity),
                        wastePercentage: Number(i.wastePercentage),
                      })),
                    }
                  : undefined
              }
              onSaved={() => setEditingRecipeId(null)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
