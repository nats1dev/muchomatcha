"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Cambio de contrasena propia. Disponible para cualquier rol. */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPasswordAction, null);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Contraseña actual</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        {state && !state.ok && state.fieldErrors?.currentPassword ? (
          <p className="text-sm text-error">
            {state.fieldErrors.currentPassword[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-password">Contraseña nueva</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        {state && !state.ok && state.fieldErrors?.newPassword ? (
          <p className="text-sm text-error">{state.fieldErrors.newPassword[0]}</p>
        ) : null}
      </div>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">Contraseña actualizada.</p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Guardando..." : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
