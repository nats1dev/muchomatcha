import Link from "next/link";
import { auth } from "@/auth";
import { listCurrentInventory } from "@/modules/inventory/stock";
import { listMovements } from "@/modules/inventory/service";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, formatQty } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AdjustmentForm } from "./adjustment-form";
import { CountForm } from "./count-form";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ low?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const sp = await searchParams;
  const businessId = session.user.businessId;

  const [inventory, movements, ingredients] = await Promise.all([
    listCurrentInventory(businessId),
    listMovements(businessId, { take: 30 }),
    prisma.ingredient.findMany({
      where: { businessId, active: true },
      include: { baseUnit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows =
    sp.low === "1" ? inventory.filter((i) => i.belowMin) : inventory;

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Existencias teóricas, movimientos, mermas y conteos"
        actions={
          <div className="flex gap-2">
            <Button asChild variant={sp.low === "1" ? "default" : "secondary"}>
              <Link href="/inventario?low=1">Bajo mínimo</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/inventario">Todos</Link>
            </Button>
          </div>
        }
      />

      {!inventory.length ? (
        <EmptyState title="Registra una compra o un inventario inicial" />
      ) : (
        <Card className="mb-4">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Ingrediente</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Existencia
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Mín.</th>
                    <th className="px-4 py-3 text-right font-medium">Costo</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/70">
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.sku} · {row.category}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatQty(row.quantityNum)} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.minimumStock}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(row.averageCost))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(row.value))}
                      </td>
                      <td className="px-4 py-3">
                        {row.belowMin ? (
                          <Badge variant="warning">Bajo mínimo</Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Merma / ajuste</CardTitle>
          </CardHeader>
          <CardContent>
            <AdjustmentForm
              ingredients={ingredients.map((i) => ({
                id: i.id,
                name: i.name,
                unit: i.baseUnit.code,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conteo físico</CardTitle>
          </CardHeader>
          <CardContent>
            <CountForm
              ingredients={inventory.map((i) => ({
                id: i.id,
                name: i.name,
                unit: i.unit,
                theoretical: i.quantityNum,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Movimientos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {movements.map((m) => (
                <li
                  key={m.id}
                  className="rounded-[10px] border border-border px-3 py-2"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{m.ingredient.name}</span>
                    <span
                      className={
                        Number(m.quantityDelta) < 0
                          ? "text-error tabular-nums"
                          : "text-success tabular-nums"
                      }
                    >
                      {Number(m.quantityDelta) > 0 ? "+" : ""}
                      {formatQty(Number(m.quantityDelta))}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.movementType} · {formatDateTime(m.occurredAt)}
                  </p>
                </li>
              ))}
              {!movements.length ? (
                <li className="text-muted-foreground">Sin movimientos</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
