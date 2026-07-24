"use client";

import { useActionState } from "react";
import { saveIngredientAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function IngredientForm({
  categories,
  units,
}: {
  categories: Array<{ id: string; name: string }>;
  units: Array<{ id: string; code: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(saveIngredientAction, null);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ing-sku">SKU</Label>
        <Input id="ing-sku" name="sku" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ing-name">Nombre</Label>
        <Input id="ing-name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="baseUnitId">Unidad base</Label>
        <Select id="baseUnitId" name="baseUnitId" required defaultValue={units[0]?.id}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ing-cat">Categoría</Label>
        <Select id="ing-cat" name="categoryId" defaultValue="">
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="minimumStock">Stock mínimo</Label>
        <Input
          id="minimumStock"
          name="minimumStock"
          type="number"
          step="0.001"
          min="0"
          defaultValue="0"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ing-pu-unit">Unidad de compra</Label>
        <Select id="ing-pu-unit" name="purchaseUnitId" defaultValue="">
          <option value="">Igual que la unidad base</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ing-pu-factor">
          Factor de conversión
          <span className="text-xs text-muted-foreground ml-1">
            (1 unidad de compra = ? unidades base)
          </span>
        </Label>
        <Input
          id="ing-pu-factor"
          name="conversionFactor"
          type="number"
          step="0.001"
          min="0.001"
          defaultValue=""
          placeholder="Ej: 907 si 1 bolsa = 907g"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ing-image">Imagen</Label>
        <input
          id="ing-image"
          name="image"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-muted file:text-foreground file:cursor-pointer"
        />
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full" variant="secondary">
        {pending ? "Guardando..." : "Guardar ingrediente"}
      </Button>
    </form>
  );
}
