import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { ROLE_LABELS, type RoleName } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserForm } from "./user-form";
import { UserRowActions } from "./user-row-actions";

export default async function UsuariosPage() {
  // Redirige a /resumen si el rol no alcanza: la pagina no debe quedar en blanco.
  const actor = await requirePageRole("ADMIN");

  const users = await prisma.user.findMany({
    where: { businessId: actor.businessId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Cuentas de acceso al sistema y sus permisos"
        actions={
          <Button asChild variant="secondary">
            <Link href="/configuracion">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Configuración
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cuentas ({users.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Correo</th>
                    <th className="px-4 py-3 font-medium">Rol</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Alta</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {u.name}
                        {u.id === actor.id ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (tú)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        {ROLE_LABELS[u.role as RoleName] ?? u.role}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.active ? "success" : "default"}>
                          {u.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <UserRowActions
                          userId={u.id}
                          active={u.active}
                          isSelf={u.id === actor.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <UserForm actorRole={actor.role} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Qué puede hacer cada rol</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Propietario:</strong> todo,
            incluida la gestión de usuarios.
          </p>
          <p>
            <strong className="text-foreground">Encargado:</strong> correcciones y
            catálogo — anular ventas y compras, registrar compras y gastos,
            ajustar inventario, editar recetas y cerrar caja.
          </p>
          <p>
            <strong className="text-foreground">Cajero:</strong> operación diaria —
            registrar ventas, abrir caja, movimientos de efectivo y producción.
          </p>
          <p>
            <strong className="text-foreground">Solo lectura:</strong> consultar
            pantallas y descargar reportes, sin modificar nada. Pensado para el
            contador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
