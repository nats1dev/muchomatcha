"use client";

import { useActionState } from "react";
import { closeCashAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/utils";

export function CloseCashForm({ expected }: { expected: number }) {
  const [state, action, pending] = useActionState(closeCashAction, null);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Efectivo esperado:{" "}
        <span className="font-semibold text-foreground">
          {formatMoney(expected)}
        </span>
      </p>
      <div className="space-y-1.5">
        <Label>Efectivo contado</Label>
        <Input
          name="countedAmount"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={expected}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Observaciones</Label>
        <Textarea name="closeNotes" placeholder="Opcional" />
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">Caja cerrada</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Cerrando..." : "Confirmar cierre"}
      </Button>
    </form>
  );
}
