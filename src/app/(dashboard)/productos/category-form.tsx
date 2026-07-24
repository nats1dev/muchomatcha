"use client";

import { useActionState } from "react";
import { saveProductCategoryAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CategoryForm() {
  const [state, action, pending] = useActionState(
    saveProductCategoryAction,
    null,
  );
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cat-name">Nombre</Label>
        <Input id="cat-name" name="name" required placeholder="Bebidas" />
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full" variant="secondary">
        {pending ? "Guardando..." : "Agregar categoría"}
      </Button>
    </form>
  );
}
