"use client";

import { useActionState } from "react";
import { openCashAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { LocalizedNumberInput } from "@/components/ui/localized-number-input";
import { Label } from "@/components/ui/label";

export function OpenCashForm() {
  const [state, action, pending] = useActionState(openCashAction, null);
  return (
    <form action={action} className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="openingAmount">Fondo inicial (GTQ)</Label>
        <LocalizedNumberInput decimals={2}
          id="openingAmount"
          name="openingAmount"
          min="0"
          step="0.01"
          defaultValue="200"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Abriendo..." : "Abrir caja"}
      </Button>
      {state && !state.ok ? (
        <p className="text-sm text-error sm:basis-full">{state.message}</p>
      ) : null}
    </form>
  );
}
