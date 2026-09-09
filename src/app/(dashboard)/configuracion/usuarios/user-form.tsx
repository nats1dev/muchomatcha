"use client";

import { useActionState } from "react";
import { createUserAction } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROLE_LABELS, ROLE_RANK, type RoleName } from "@/lib/auth/roles";

export function UserForm({ actorRole }: { actorRole: RoleName }) {
  const [state, action, pending] = useActionState(createUserAction, null);

  // Nadie puede crear una cuenta con mas permisos que los suyos.
  const assignableRoles = (Object.keys(ROLE_RANK) as RoleName[])
    .filter((r) => ROLE_RANK[r] <= ROLE_RANK[actorRole])
    .sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="user-name">Nombre</Label>
        <Input id="user-name" name="name" placeholder="Nombre y apellido" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="user-email">Correo</Label>
        <Input
          id="user-email"
          name="email"
          type="email"
          placeholder="persona@muchomatcha.gt"
          autoComplete="off"
          required
        />
        {state && !state.ok && state.fieldErrors?.email ? (
          <p className="text-sm text-error">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="user-role">Rol</Label>
        <Select id="user-role" name="role" defaultValue="CASHIER" required>
          {assignableRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="user-password">Contraseña temporal</Label>
        <Input
          id="user-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-xs text-muted-foreground">
          Mínimo 10 caracteres. Comunícasela a la persona y pídele que la cambie
          desde su perfil al entrar.
        </p>
        {state && !state.ok && state.fieldErrors?.password ? (
          <p className="text-sm text-error">{state.fieldErrors.password[0]}</p>
        ) : null}
      </div>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">Usuario creado correctamente.</p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creando..." : "Crear usuario"}
      </Button>
    </form>
  );
}
