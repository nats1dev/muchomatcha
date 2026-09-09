import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierForm } from "./supplier-form";
import { PurchaseUnitForm } from "./purchase-unit-form";
import { ChangePasswordForm } from "./change-password-form";

export default async function ConfiguracionPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;

  const [business, suppliers, units, ingredients] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId } }).then((b) => { if (!b) redirect("/login"); return b; }),
    prisma.supplier.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      where: { businessId, active: true },
      orderBy: { code: "asc" },
    }),
    prisma.ingredient.findMany({
      where: { businessId, active: true },
      include: {
        baseUnit: true,
        purchaseUnits: { include: { unit: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Negocio, proveedores, unidades y conversiones"
        actions={
          <Button asChild>
            <Link href="/configuracion/usuarios">
              <Users className="mr-1 h-4 w-4" />
              Usuarios
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Negocio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nombre</span>
              <span className="font-medium">{business.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Moneda</span>
              <span>{business.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zona horaria</span>
              <span>{business.timezone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span>{Number(business.taxRate)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precios</span>
              <span>Sin IVA (se cobra al vender)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unidades</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {units.map((u) => (
                <li
                  key={u.id}
                  className="flex justify-between rounded-[10px] border border-border px-3 py-2"
                >
                  <span className="font-medium">{u.code}</span>
                  <span className="text-muted-foreground">{u.name}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proveedores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-1 text-sm">
              {suppliers.map((s) => (
                <li
                  key={s.id}
                  className="rounded-[10px] border border-border px-3 py-2"
                >
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[s.taxId, s.phone, s.email].filter(Boolean).join(" · ") ||
                      "Sin datos de contacto"}
                  </p>
                </li>
              ))}
            </ul>
            <SupplierForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversión de compra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {ingredients.flatMap((i) =>
                i.purchaseUnits.map((pu) => (
                  <li
                    key={pu.id}
                    className="rounded-[10px] border border-border px-3 py-2"
                  >
                    {i.name}: 1 {pu.unit.code} = {Number(pu.conversionFactor)}{" "}
                    {i.baseUnit.code}
                  </li>
                )),
              )}
            </ul>
            <PurchaseUnitForm
              ingredients={ingredients.map((i) => ({
                id: i.id,
                name: i.name,
              }))}
              units={units.map((u) => ({
                id: u.id,
                code: u.code,
                name: u.name,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mi contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
