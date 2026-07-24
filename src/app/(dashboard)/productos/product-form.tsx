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
        <Label htmlFor="clientPrice">
          Precio de venta a cliente (IVA incluido, GTQ)
        </Label>
        <Input
          id="clientPrice"
          name="clientPrice"
          type="number"
          step="0.01"
          min="0.01"
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
      <div className="space-y-1.5">
        <Label htmlFor="image">Imagen</Label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-muted file:text-foreground file:cursor-pointer"
        />
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
