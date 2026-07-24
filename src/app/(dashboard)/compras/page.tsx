import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ComprasPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;

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
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-border/70">
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(p.purchasedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {p.supplier.name}
                      </td>
                      <td className="px-4 py-3">
                        {p.documentNumber || "—"}
                      </td>
                      <td className="px-4 py-3">{p.items.length}</td>
                      <td className="px-4 py-3">
                        <Badge variant="success">{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(Number(p.total))}
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
