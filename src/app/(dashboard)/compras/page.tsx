import Link from "next/link";
import { auth } from "@/auth";
import { hasAtLeast, isRoleName } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { VoidPurchaseButton } from "./void-purchase-button";

const paymentStatusLabel: Record<string, string> = {
  PAID: "Pagado",
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
};

const paymentStatusVariant: Record<string, "default" | "success" | "warning" | "error"> = {
  PAID: "success",
  PENDING: "warning",
  PARTIAL: "warning",
};

const paymentMethodLabel: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

export default async function ComprasPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const role = isRoleName(session.user.role) ? session.user.role : "VIEWER";
  const canVoid = hasAtLeast(role, "ADMIN");

  const purchases = await prisma.purchase.findMany({
    where: { businessId: session.user.businessId },
    include: {
      supplier: true,
      items: true,
      user: { select: { name: true } },
    },
    orderBy: { purchasedAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Compras"
        description="Recepción de mercancía e ingreso a inventario"
        actions={
          <Button asChild>
            <Link href="/compras/nueva">Registrar compra</Link>
          </Button>
        }
      />
      {!purchases.length ? (
        <EmptyState
          title="Registra una compra o un inventario inicial"
          action={
            <Button asChild>
              <Link href="/compras/nueva">Registrar compra</Link>
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
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">Documento</th>
                    <th className="px-4 py-3 font-medium">Líneas</th>
                    <th className="px-4 py-3 font-medium">Pago</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-border/70">
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(p.purchasedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {p.supplier.name}
                      </td>
                      <td className="px-4 py-3">
                        {p.documentNumber || "—"}
                      </td>
                      <td className="px-4 py-3">{p.items.length}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={paymentStatusVariant[p.paymentStatus] ?? "default"}
                        >
                          {paymentStatusLabel[p.paymentStatus] ?? p.paymentStatus}
                        </Badge>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {paymentMethodLabel[p.paymentMethod]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            p.status === "RECEIVED" ? "success" : "error"
                          }
                        >
                          {p.status === "RECEIVED" ? "Recibido" : "Anulado"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(p.total))}
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "RECEIVED" && (
                          <VoidPurchaseButton purchaseId={p.id} canVoid={canVoid} />
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
    </div>
  );
}
