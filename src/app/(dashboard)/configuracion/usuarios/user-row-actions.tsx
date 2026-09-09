"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import {
  resetPasswordAction,
  toggleUserActiveAction,
} from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Acciones por fila. El servidor vuelve a comprobar permisos y reglas
 * (no desactivarse a uno mismo, no tocar roles superiores, no dejar el negocio
 * sin propietario activo): estos botones solo evitan intentos obvios.
 */
export function UserRowActions({
  userId,
  active,
  isSelf,
}: {
  userId: string;
  active: boolean;
  isSelf: boolean;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleUserActiveAction,
    null,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordAction,
    null,
  );
  const [showReset, setShowReset] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowReset((v) => !v)}
          aria-expanded={showReset}
        >
          <KeyRound className="mr-1 h-4 w-4" />
          Contraseña
        </Button>

        <form action={toggleAction}>
          <input type="hidden" name="userId" value={userId} />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={togglePending || isSelf}
            title={
              isSelf ? "No puedes desactivar tu propia cuenta" : undefined
            }
          >
            {togglePending ? "..." : active ? "Desactivar" : "Activar"}
          </Button>
        </form>
      </div>

      {showReset ? (
        <form action={resetAction} className="flex items-start gap-2">
          <input type="hidden" name="userId" value={userId} />
          <div className="flex-1">
            <Input
              name="password"
              type="password"
              placeholder="Nueva contraseña (mín. 10)"
              autoComplete="new-password"
              minLength={10}
              required
            />
            {resetState && !resetState.ok ? (
              <p className="mt-1 text-xs text-error">{resetState.message}</p>
            ) : null}
            {resetState?.ok ? (
              <p className="mt-1 text-xs text-success">Contraseña actualizada.</p>
            ) : null}
          </div>
          <Button type="submit" size="sm" disabled={resetPending}>
            {resetPending ? "..." : "Guardar"}
          </Button>
        </form>
      ) : null}

      {toggleState && !toggleState.ok ? (
        <p className="text-right text-xs text-error">{toggleState.message}</p>
      ) : null}
    </div>
  );
}
