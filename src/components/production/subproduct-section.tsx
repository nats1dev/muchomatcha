"use client";

import { useState } from "react";
import { Plus, ChevronUp, Factory } from "lucide-react";
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
    yieldQuantity: string;
    items: Array<{
      ingredient: { id: string; name: string };
    }>;
  } | null;
};

export function SubproductSection({
  subproducts,
  allIngredients,
}: {
  subproducts: Subproduct[];
  allIngredients: Array<{ id: string; name: string; unit: string; cost: number }>;
}) {
  const [showForm, setShowForm] = useState(subproducts.length === 0);

  const manufacturedIds = new Set(subproducts.map((s) => s.id));

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-muted-foreground" />
            Subproductos ({subproducts.length})
          </CardTitle>
          <Button
            type="button"
            variant={showForm ? "secondary" : "default"}
            size="sm"
            onClick={() => setShowForm((prev) => !prev)}
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
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {subproducts.length > 0 ? (
          <div className="mb-4 space-y-2">
            {subproducts.map((sp) => (
              <div
                key={sp.id}
                className="flex items-center justify-between rounded-[10px] border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{sp.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sp.sku} &middot; v{sp.recipe?.version ?? "—"}{" "}
                    &middot; {sp.recipe?.items.length ?? 0} ingredientes
                    &middot; rinde {sp.recipe?.yieldQuantity ?? "—"} {sp.baseUnit.code}
                  </p>
                </div>
                <Badge variant="success">Subproducto</Badge>
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

        {showForm ? (
          <div className="rounded-[10px] border border-border p-4">
            <SubproductRecipeForm
              ingredients={allIngredients}
              manufacturedIds={manufacturedIds}
              onSaved={() => setShowForm(false)}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
