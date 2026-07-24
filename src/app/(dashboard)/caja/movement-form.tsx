"use client";

import { useActionState } from "react";
import { cashMovementAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function MovementForm() {
  const [state, action, pending] = useActionState(cashMovementAction, null);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <Select name="movementType" defaultValue="WITHDRAWAL">
          <option value="INCOME">Ingreso extraordinario</option>
          <option value="WITHDRAWAL">Retiro</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Monto</Label>
        <Input name="amount" type="number" min="0.01" step="0.01" required />
      </div>
      <div className="space-y-1.5">
        <Label>Motivo</Label>
        <Textarea name="reason" required />
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
