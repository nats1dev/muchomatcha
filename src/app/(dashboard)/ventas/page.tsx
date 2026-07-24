import Link from "next/link";
import { auth } from "@/auth";
import { listSales } from "@/modules/sales/service";
import { resolvePeriod, type PeriodKey, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const sp = await searchParams;
  const { from, to } = resolvePeriod((sp.period as PeriodKey) || "30d");
  const sales = await listSales(session.user.businessId, {
    from,
    to,
    q: sp.q,
  });

  return (
    <div>
      <PageHeader
        title="Ventas"
        description="Consulta, filtra y anula ventas confirmadas"
        actions={
          <Button asChild>
            <Link href="/ventas/nueva">Registrar venta</Link>
          </Button>
        }
      />
      {!sales.length ? (
        <EmptyState
          title="Registra tu primera venta para comenzar a ver resultados"
          action={
            <Button asChild>
              <Link href="/ventas/nueva">Registrar venta</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Pago</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id} className="border-b border-border/70">
                      <td className="px-4 py-3">
                        <Link
                          href={`/ventas/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {s.saleNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(s.soldAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            s.status === "VOIDED" ? "error" : "success"
                          }
                        >
                          {s.status === "VOIDED" ? "Anulada" : "Confirmada"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{s.paymentMethod}</td>
                      <td className="px-4 py-3">{s._count.items}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(s.total))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.user.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
