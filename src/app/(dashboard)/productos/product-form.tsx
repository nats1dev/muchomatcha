"use client";

import { useActionState } from "react";
import { saveProductAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function ProductForm({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(saveProductAction, null);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="sku">SKU</Label>
        <Input id="sku" name="sku" required placeholder="LAT-01" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required placeholder="Latte matcha" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="salePrice">Precio sin IVA (GTQ)</Label>
        <Input
          id="salePrice"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="categoryId">Categoría</Label>
        <Select id="categoryId" name="categoryId" defaultValue="">
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">Producto guardado</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Guardar producto"}
      </Button>
    </form>
  );
}
