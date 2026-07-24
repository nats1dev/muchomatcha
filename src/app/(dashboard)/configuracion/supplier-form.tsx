"use client";

import { useActionState } from "react";
import { saveSupplierAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SupplierForm() {
  const [state, action, pending] = useActionState(saveSupplierAction, null);
  return (
    <form action={action} className="space-y-2">
      <Label>Nuevo proveedor</Label>
      <Input name="name" placeholder="Nombre" required />
      <Input name="taxId" placeholder="NIT" />
      <Input name="phone" placeholder="Teléfono" />
      <Input name="email" type="email" placeholder="Correo" />
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full" variant="secondary">
        {pending ? "Guardando..." : "Agregar proveedor"}
      </Button>
    </form>
  );
}
