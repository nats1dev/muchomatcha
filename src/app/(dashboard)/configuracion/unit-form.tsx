"use client";

import { useActionState } from "react";
import { saveUnitAction, toggleUnitAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function UnitForm({ defaultDecimals }: { defaultDecimals: number }) {
  const [state, action, pending] = useActionState(saveUnitAction, null);
  return (
    <form action={action} className="mt-4 space-y-2 border-t border-border pt-4">
      <Label>Nueva unidad</Label>
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Input name="code" placeholder={"C\u00f3digo"} maxLength={20} required />
        <Input name="name" placeholder="Nombre" maxLength={100} required />
      </div>
      <Select name="decimals" defaultValue={defaultDecimals}>
        {Array.from({ length: 7 }, (_, value) => <option key={value} value={value}>{value} decimales</option>)}
      </Select>
      {state && !state.ok ? <p className="text-sm text-error">{state.message}</p> : null}
      <Button type="submit" disabled={pending} className="w-full" variant="secondary">{pending ? "Guardando..." : "Agregar unidad"}</Button>
    </form>
  );
}

export function UnitToggle({ id, active }: { id: string; active: boolean }) {
  const [, action, pending] = useActionState(toggleUnitAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>{active ? "Desactivar" : "Reactivar"}</Button>
    </form>
  );
}
