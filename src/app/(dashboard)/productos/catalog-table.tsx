"use client";

import { toast } from "sonner";
import { Trash2, RefreshCw, Coffee, FlaskConical } from "lucide-react";
import {
  toggleProductActiveAction,
  toggleIngredientActiveAction,
} from "@/app/actions/catalog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCost, formatMoney } from "@/lib/utils";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  image: string | null;
  salePrice: number;
  active: boolean;
  category: { id: string; name: string } | null;
  recipes: { id: string }[];
};

type IngredientRow = {
  id: string;
  sku: string;
  name: string;
  image: string | null;
  active: boolean;
  baseUnit: { code: string };
  currentAverageCost: number;
  minimumStock: number;
};

function Thumbnail({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Coffee className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded-lg object-cover"
    />
  );
}

function IngredientThumbnail({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  if (!src) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FlaskConical className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded-lg object-cover"
    />
  );
}

function formatClientPrice(salePrice: number, taxRate: number) {
  return formatMoney(salePrice * (1 + taxRate / 100));
}

export function CatalogTable({
  products,
  ingredients,
  taxRate,
}: {
  products: ProductRow[];
  ingredients: IngredientRow[];
  taxRate: number;
}) {
  async function handleToggleProduct(id: string, name: string, active: boolean) {
    const action = active ? "desactivar" : "reactivar";
    if (!confirm(`¿${action} "${name}"?`)) return;

    const formData = new FormData();
    formData.set("id", id);
    const res = await toggleProductActiveAction(null, formData);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(
      `"${res.data.name}" ${res.data.active ? "reactivado" : "desactivado"}`,
    );
  }

  async function handleToggleIngredient(
    id: string,
    name: string,
    active: boolean,
  ) {
    const action = active ? "desactivar" : "reactivar";
    if (!confirm(`¿${action} "${name}"?`)) return;

    const formData = new FormData();
    formData.set("id", id);
    const res = await toggleIngredientActiveAction(null, formData);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(
      `"${res.data.name}" ${res.data.active ? "reactivado" : "desactivado"}`,
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Menú ({products.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!products.length ? (
            <div className="p-5">
              <EmptyState title="Crea el menú de tu cafetería" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="w-10 px-4 py-3" />
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Precio venta
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      s/IVA
                    </th>
                    <th className="px-4 py-3 font-medium">Receta</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-border/70 ${
                        !p.active ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <Thumbnail src={p.image} alt={p.name} />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {p.sku}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{p.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.category?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatClientPrice(p.salePrice, taxRate)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatMoney(p.salePrice)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={
                            p.recipes.length ? "success" : "warning"
                          }
                        >
                          {p.recipes.length ? "Sí" : "No"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={p.active ? "default" : "error"}
                        >
                          {p.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-error"
                          onClick={() =>
                            handleToggleProduct(p.id, p.name, p.active)
                          }
                          title={
                            p.active ? "Desactivar" : "Reactivar"
                          }
                        >
                          {p.active ? (
                            <Trash2 className="h-3.5 w-3.5" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingredientes ({ingredients.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Unidad</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Costo prom.
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Mín.</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {ingredients.map((i) => (
                  <tr
                    key={i.id}
                    className={`border-b border-border/70 ${
                      !i.active ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <IngredientThumbnail src={i.image} alt={i.name} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {i.sku}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{i.name}</td>
                    <td className="px-4 py-2.5">{i.baseUnit.code}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatCost(i.currentAverageCost)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {i.minimumStock}
                    </td>
                    <td className="px-4 py-2.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-error"
                        onClick={() =>
                          handleToggleIngredient(i.id, i.name, i.active)
                        }
                        title={
                          i.active ? "Desactivar" : "Reactivar"
                        }
                      >
                        {i.active ? (
                          <Trash2 className="h-3.5 w-3.5" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
