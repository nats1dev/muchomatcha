"use client";

import { useActionState } from "react";
import { voidSaleAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function VoidSaleForm({ saleId }: { saleId: string }) {
  const [state, action, pending] = useActionState(voidSaleAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="saleId" value={saleId} />
      <div className="space-y-2">
        <Label htmlFor="reason">Motivo</Label>
        <Textarea
          id="reason"
          name="reason"
          required
          placeholder="Describe el motivo de la anulación"
        />
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">Venta anulada</p>
      ) : null}
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Anulando..." : "Confirmar anulación"}
      </Button>
    </form>
  );
}
