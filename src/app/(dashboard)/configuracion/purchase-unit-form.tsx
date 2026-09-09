"use client";

import { useActionState } from "react";
import { savePurchaseUnitAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { LocalizedNumberInput } from "@/components/ui/localized-number-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function PurchaseUnitForm({
  ingredients,
  units,
}: {
  ingredients: Array<{ id: string; name: string }>;
  units: Array<{ id: string; code: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(savePurchaseUnitAction, null);
  return (
    <form action={action} className="space-y-2">
      <Label>Nueva conversión</Label>
      <Select name="ingredientId" required defaultValue={ingredients[0]?.id}>
        {ingredients.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </Select>
      <Select name="unitId" required defaultValue={units[0]?.id}>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.code} — {u.name}
          </option>
        ))}
      </Select>
      <LocalizedNumberInput decimals={6}
        name="conversionFactor"
        step="0.000001"
        min="0.000001"
        placeholder="Factor a unidad base (ej. 1000)"
        required
      />
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full" variant="secondary">
        {pending ? "Guardando..." : "Guardar conversión"}
      </Button>
    </form>
  );
}
