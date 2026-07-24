"use client";

import { useActionState } from "react";
import { createAdjustmentAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function AdjustmentForm({
  ingredients,
}: {
  ingredients: Array<{ id: string; name: string; unit: string }>;
}) {
  const [state, action, pending] = useActionState(createAdjustmentAction, null);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <Select name="type" defaultValue="WASTE">
          <option value="WASTE">Merma</option>
          <option value="ADJUSTMENT_OUT">Ajuste salida</option>
          <option value="ADJUSTMENT_IN">Ajuste entrada</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Ingrediente</Label>
        <Select name="ingredientId" required defaultValue={ingredients[0]?.id}>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Cantidad</Label>
        <Input
          name="quantityDelta"
          type="number"
          step="0.001"
          min="0.001"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Motivo</Label>
        <Textarea name="reason" required placeholder="Obligatorio" />
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">Movimiento registrado</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Registrar"}
      </Button>
    </form>
  );
}
