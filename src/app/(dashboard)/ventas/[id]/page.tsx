import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { hasAtLeast, isRoleName } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, formatQty } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoidSaleForm } from "./void-form";

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const role = isRoleName(session.user.role) ? session.user.role : "VIEWER";
  const canVoid = hasAtLeast(role, "ADMIN");
  const { id } = await params;

  const sale = await prisma.sale.findFirst({
    where: { id, businessId: session.user.businessId },
    include: {
      items: { include: { product: true } },
      user: true,
      voidedBy: true,
    },
  });
  if (!sale) notFound();

  return (
    <div>
      <PageHeader
        title={`Venta #${sale.saleNumber}`}
        description={formatDateTime(sale.soldAt)}
        actions={
          <Button asChild variant="secondary">
            <Link href="/ventas">Volver</Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Detalle</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 font-medium">Cant.</th>
                  <th className="pb-2 text-right font-medium">P. unit.</th>
                  <th className="pb-2 text-right font-medium">Costo</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id} className="border-b border-border/70">
                    <td className="py-2.5">{item.product.name}</td>
                    <td className="py-2.5 tabular-nums">
                      {formatQty(Number(item.quantity))}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatMoney(Number(item.unitPrice))}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatMoney(Number(item.unitCostSnapshot))}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatMoney(Number(item.lineTotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={sale.status === "VOIDED" ? "error" : "success"}>
                  {sale.status === "VOIDED" ? "Anulada" : "Confirmada"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pago</span>
                <span>{sale.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {formatMoney(Number(sale.subtotal))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">
                  {formatMoney(Number(sale.taxTotal))}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatMoney(Number(sale.total))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registró</span>
                <span>{sale.user.name}</span>
              </div>
              {sale.voidReason ? (
                <p className="pt-2 text-error">Motivo: {sale.voidReason}</p>
              ) : null}
            </CardContent>
          </Card>
          {sale.status === "CONFIRMED" ? (
            <Card>
              <CardHeader>
                <CardTitle>Anular venta</CardTitle>
              </CardHeader>
              <CardContent>
                <VoidSaleForm saleId={sale.id} canVoid={canVoid} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
