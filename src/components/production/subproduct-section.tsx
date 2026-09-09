"use client";

import { useState } from "react";
import { Plus, ChevronUp, Factory, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SubproductRecipeForm } from "./subproduct-recipe-form";

type Subproduct = {
  id: string;
  name: string;
  sku: string;
  baseUnit: { code: string };
  recipe: {
    id: string;
    version: number;
    yieldQuantity: number;
    notes: string | null;
    items: Array<{
      ingredientId: string;
      quantity: number;
      wastePercentage: number;
      isNonInventoriable: boolean;
      ingredient: { id: string; name: string };
    }>;
  } | null;
};

export function SubproductSection({
  subproducts,
  allIngredients,
  canEdit = true,
}: {
  subproducts: Subproduct[];
  allIngredients: Array<{ id: string; name: string; unit: string; cost: number }>;
  canEdit?: boolean;
}) {
  const [showForm, setShowForm] = useState(canEdit && subproducts.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const manufacturedIds = new Set(subproducts.map((s) => s.id));

  const editingSubproduct = editingId
    ? subproducts.find((s) => s.id === editingId)
    : null;

  function startEditing(id: string) {
    setEditingId(id);
    setShowForm(true);
  }

  function stopEditing() {
    setEditingId(null);
    setShowForm(false);
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-muted-foreground" />
            Subproductos ({subproducts.length})
          </CardTitle>
          {canEdit ? <Button
            type="button"
            variant={showForm ? "secondary" : "default"}
            size="sm"
            onClick={() => {
              if (showForm) {
                stopEditing();
              } else {
                setShowForm(true);
              }
            }}
          >
            {showForm ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Ocultar
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Definir subproducto
              </>
            )}
          </Button> : null}
        </div>
      </CardHeader>
      <CardContent>
        {subproducts.length > 0 ? (
          <div className="mb-4 space-y-2">
            {subproducts.map((sp) => (
              <div
                key={sp.id}
                className={`flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-sm ${
                  editingId === sp.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border"
                }`}
              >
                <div>
                  <p className="font-medium">{sp.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sp.sku} &middot; v{sp.recipe?.version ?? "—"}{" "}
                    &middot; {sp.recipe?.items.length ?? 0} ingredientes
                    &middot; rinde {sp.recipe?.yieldQuantity ?? "—"} {sp.baseUnit.code}
                  </p>
                  {sp.recipe && sp.recipe.items.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {sp.recipe.items.map((item) => (
                        <li key={item.ingredientId}>
                          {item.ingredient.name}: {Number(item.quantity)}{" "}
                          {Number(item.wastePercentage) > 0
                            ? `(+${Number(item.wastePercentage)}% merma)`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Badge variant="success">Subproducto</Badge>
                  {canEdit && sp.recipe ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => startEditing(sp.id)}
                      title={`Editar receta de ${sp.name}`}
                      aria-label={`Editar receta de ${sp.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !showForm ? (
            <EmptyState
              title="No hay subproductos definidos"
              description="Crea un ingrediente con receta para poder producirlo internamente."
            />
          ) : null
        )}

        {canEdit && showForm ? (
          <div className="rounded-[10px] border border-border p-4">
            <p className="mb-3 text-sm font-medium">
              {editingSubproduct
                ? `Editar receta de ${editingSubproduct.name}`
                : "Nueva receta de subproducto"}
            </p>
            <SubproductRecipeForm
              key={editingId ?? "new"}
              ingredients={allIngredients}
              manufacturedIds={manufacturedIds}
              initialData={
                editingSubproduct?.recipe
                  ? {
                      ingredientId: editingSubproduct.id,
                      ingredientName: editingSubproduct.name,
                      yieldQuantity: Number(
                        editingSubproduct.recipe.yieldQuantity,
                      ),
                      notes: editingSubproduct.recipe.notes ?? undefined,
                      items: editingSubproduct.recipe.items
                        // Ingredientes desactivados ya no vienen en
                        // `allIngredients`: se conservan en la lista para no
                        // perder la línea en silencio.
                        .map((i) => ({
                          ingredientId: i.ingredientId,
                          quantity: Number(i.quantity),
                          wastePercentage: Number(i.wastePercentage),
                          isNonInventoriable: i.isNonInventoriable,
                        })),
                    }
                  : undefined
              }
              onSaved={stopEditing}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
