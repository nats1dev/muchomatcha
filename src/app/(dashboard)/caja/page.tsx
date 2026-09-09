import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getExpectedForSession,
  getOpenCashSession,
} from "@/modules/cash/service";
import { formatDateTime } from "@/lib/dates";
import { formatMoney as baseFormatMoney } from "@/lib/utils";
import { getNumberDisplaySettings } from "@/lib/number-format-server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OpenCashForm } from "./open-form";
import { MovementForm } from "./movement-form";
import { CloseCashForm } from "./close-form";

export default async function CajaPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;
  const numberSettings = await getNumberDisplaySettings(businessId);
  const formatMoney = (value: number | string) => baseFormatMoney(value, "GTQ", numberSettings);

  const open = await getOpenCashSession(businessId);
  const expected = open ? await getExpectedForSession(open.id) : null;
  const history = await prisma.cashSession.findMany({
    where: { businessId, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 15,
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Caja"
        description="Apertura, movimientos y cierre de turno"
      />

      {open && expected ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Fondo inicial"
              value={formatMoney(
                Number(expected.breakdown.openingAmount.toFixed(2)),
              )}
            />
            <MetricCard
              label="Ventas efectivo"
              value={formatMoney(
                Number(expected.breakdown.confirmedCashSales.toFixed(2)),
              )}
            />
            <MetricCard
              label="Esperado"
              value={formatMoney(Number(expected.breakdown.expected.toFixed(2)))}
              dark
            />
            <MetricCard
              label="Estado"
              value="ABIERTA"
              hint={`Desde ${formatDateTime(open.openedAt)}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Movimiento manual</CardTitle>
              </CardHeader>
              <CardContent>
                <MovementForm />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cerrar caja</CardTitle>
              </CardHeader>
              <CardContent>
                <CloseCashForm
                  expected={Number(expected.breakdown.expected.toFixed(2))}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Movimientos del turno</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {open.movements.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-[10px] border border-border px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{m.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.movementType} · {formatDateTime(m.occurredAt)}
                      </p>
                    </div>
                    <span className="tabular-nums">
                      {formatMoney(Number(m.amount))}
                    </span>
                  </li>
                ))}
                {!open.movements.length ? (
                  <li className="text-muted-foreground">
                    Sin movimientos manuales
                  </li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Abrir caja</CardTitle>
          </CardHeader>
          <CardContent>
            <OpenCashForm />
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Historial de cierres</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cierre</th>
                  <th className="px-4 py-3 text-right font-medium">Esperado</th>
                  <th className="px-4 py-3 text-right font-medium">Contado</th>
                  <th className="px-4 py-3 text-right font-medium">Diferencia</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const diff = Number(h.differenceAmount ?? 0);
                  return (
                    <tr key={h.id} className="border-b border-border/70">
                      <td className="px-4 py-3 text-muted-foreground">
                        {h.closedAt ? formatDateTime(h.closedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(h.expectedAmount ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(h.countedAmount ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(diff)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            diff === 0
                              ? "success"
                              : diff > 0
                                ? "warning"
                                : "error"
                          }
                        >
                          {diff === 0
                            ? "Cuadra"
                            : diff > 0
                              ? "Sobrante"
                              : "Faltante"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
