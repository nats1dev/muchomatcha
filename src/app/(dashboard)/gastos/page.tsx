import { auth } from "@/auth";
import { listExpenses } from "@/modules/expenses/service";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { formatMoney as baseFormatMoney } from "@/lib/utils";
import { getNumberDisplaySettings } from "@/lib/number-format-server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseForm } from "./expense-form";

export default async function GastosPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;
  const numberSettings = await getNumberDisplaySettings(businessId);
  const formatMoney = (value: number | string) => baseFormatMoney(value, "GTQ", numberSettings);

  const [expenses, suppliers] = await Promise.all([
    listExpenses(businessId),
    prisma.supplier.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Gastos"
        description="Gastos fijos y variables del negocio"
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardContent className="p-0">
            {!expenses.length ? (
              <div className="p-5">
                <EmptyState title="Aún no hay gastos registrados" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Categoría</th>
                      <th className="px-4 py-3 font-medium">Descripción</th>
                      <th className="px-4 py-3 font-medium">Pago</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-border/70">
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(e.expenseDate)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge>{e.category}</Badge>
                        </td>
                        <td className="px-4 py-3">{e.description}</td>
                        <td className="px-4 py-3">{e.paymentMethod}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(Number(e.total))}
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
            <CardTitle>Nuevo gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
