"use client";

import { useActionState } from "react";
import { createExpenseAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalizedNumberInput } from "@/components/ui/localized-number-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const categories = [
  "RENT",
  "UTILITIES",
  "SALARIES",
  "SUPPLIES",
  "MARKETING",
  "MAINTENANCE",
  "TRANSPORT",
  "OTHER",
] as const;

export function ExpenseForm({
  suppliers,
}: {
  suppliers: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createExpenseAction, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Fecha</Label>
        <Input name="expenseDate" type="date" defaultValue={today} required />
      </div>
      <div className="space-y-1.5">
        <Label>Categoría</Label>
        <Select name="category" defaultValue="UTILITIES">
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Descripción</Label>
        <Textarea name="description" required />
      </div>
      <div className="space-y-1.5">
        <Label>Proveedor / beneficiario</Label>
        <Select name="supplierId" defaultValue="">
          <option value="">—</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input name="beneficiary" placeholder="Beneficiario (opcional)" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Subtotal</Label>
          <LocalizedNumberInput name="subtotal" decimals={2} step="0.01" min="0" required />
        </div>
        <div className="space-y-1.5">
          <Label>IVA</Label>
          <LocalizedNumberInput name="taxTotal" decimals={2} step="0.01" min="0" defaultValue="0" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Método de pago</Label>
        <Select name="paymentMethod" defaultValue="TRANSFER">
          <option value="CASH">Efectivo</option>
          <option value="CARD">Tarjeta</option>
          <option value="TRANSFER">Transferencia</option>
        </Select>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">Gasto registrado</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando..." : "Guardar gasto"}
      </Button>
    </form>
  );
}
