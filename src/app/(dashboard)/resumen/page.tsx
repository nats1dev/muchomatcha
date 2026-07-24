import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { resolvePeriod, type PeriodKey, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";
import { getDashboard } from "@/modules/dashboard/service";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryPieChart, SalesBarChart } from "@/components/dashboard/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.businessId) return null;

  const sp = await searchParams;
  const period = (sp.period as PeriodKey) || "today";
  const { from, to } = resolvePeriod(period);

  const [data, ingredientCount] = await Promise.all([
    getDashboard({
      businessId: session.user.businessId,
      from,
      to,
    }),
    prisma.ingredient.count({
      where: { businessId: session.user.businessId },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Resumen"
        description="Ventas, utilidad, caja e inventario en un solo panel"
      />

      {ingredientCount === 0 ? (
        <div className="mb-4 rounded-[12px] border border-primary/20 bg-primary/5 p-5">
          <h2 className="text-lg font-semibold">👋 ¡Bienvenido a Café Control!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Para empezar, configura tus ingredientes y registra tu primer inventario.
            El setup guiado te llevará paso a paso.
          </p>
          <div className="mt-3 flex gap-3">
            <Button asChild>
              <Link href="/setup">Comenzar setup guiado</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/compras/nueva">Registrar compra directa</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ventas netas"
          value={formatMoney(data.kpis.salesNet)}
          hint={`${data.kpis.salesCount} tickets`}
        />
        <MetricCard
          label="Utilidad bruta"
          value={formatMoney(data.kpis.grossProfit)}
          hint={`Margen ${data.kpis.margin.toFixed(1)}%`}
          dark
        />
        <MetricCard
          label="Ticket promedio"
          value={formatMoney(data.kpis.ticketAvg)}
        />
        <MetricCard
          label={data.kpis.cashOpen ? "Efectivo esperado" : "Caja"}
          value={
            data.kpis.cashOpen
              ? formatMoney(data.kpis.expectedCash)
              : "Cerrada"
          }
          hint={`Inventario ${formatMoney(data.kpis.inventoryValue)}`}
        />
      </div>

      <div className="mt-4 rounded-[12px] border border-border bg-ivory p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">Ventas por día</h2>
            <SalesBarChart data={data.salesByDay} />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Por categoría</h2>
            <CategoryPieChart data={data.salesByCategory} />
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-[10px] bg-card p-3">
                <p className="text-muted-foreground">Transacciones</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {data.kpis.salesCount}
                </p>
              </div>
              <div className="rounded-[10px] bg-card p-3">
                <p className="text-muted-foreground">Bajo mínimo</p>
                <p className="text-2xl font-semibold tabular-nums text-warning">
                  {data.kpis.belowMinCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas recientes</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.recentSales.length ? (
              <EmptyState
                title="Registra tu primera venta para comenzar a ver resultados"
                action={
                  <Button asChild>
                    <Link href="/ventas/nueva">Registrar venta</Link>
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Fecha</th>
                      <th className="pb-2 font-medium">Pago</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSales.map((s) => (
                      <tr key={s.id} className="border-b border-border/70">
                        <td className="py-2.5">
                          <Link
                            href={`/ventas/${s.id}`}
                            className="font-medium hover:underline"
                          >
                            {s.saleNumber}
                          </Link>
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {formatDateTime(s.soldAt)}
                        </td>
                        <td className="py-2.5">
                          <Badge>{s.paymentMethod}</Badge>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatMoney(s.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventario crítico</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.criticalInventory.length ? (
              <p className="text-sm text-muted-foreground">
                No hay ingredientes bajo el mínimo.
              </p>
            ) : (
              <div className="space-y-2">
                {data.criticalInventory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-[10px] border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Mín. {item.minimumStock} {item.unit}
                      </p>
                    </div>
                    <Badge variant="warning">
                      {item.quantity} {item.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Compras del período</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(data.kpis.purchasesTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Gastos del período</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(data.kpis.expensesTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Productos más vendidos
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.topProducts.slice(0, 4).map((p) => (
                <li key={p.name} className="flex justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMoney(p.revenue)}
                  </span>
                </li>
              ))}
              {!data.topProducts.length ? (
                <li className="text-muted-foreground">Sin datos</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
