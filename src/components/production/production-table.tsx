import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { formatCost, formatQty } from "@/lib/utils";
import { ProductionStatusBadge } from "./production-status-badge";

type Order = {
  id: string;
  orderNumber: number;
  quantity: string;
  actualQuantity: string | null;
  unitCost: string;
  totalCost: string;
  estimatedUnitCost: string | null;
  status: string;
  occurredAt: Date;
  startedAt: Date | null;
  ingredient: { name: string; sku: string; baseUnit: { code: string } };
  user: { name: string };
  startedBy: { name: string } | null;
  completedBy: { name: string } | null;
};

export function ProductionTable({ orders }: { orders: Order[] }) {
  if (!orders.length) return null;

  return (
    <div className="overflow-x-auto rounded-[12px] border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Subproducto</th>
            <th className="px-4 py-3">Cantidad</th>
            <th className="px-4 py-3">Costo Unit.</th>
            <th className="px-4 py-3">Costo Total</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Creada</th>
            <th className="px-4 py-3">Creado por</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((order) => (
            <tr
              key={order.id}
              className="transition-colors hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/produccion/${order.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  #{order.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="font-medium">{order.ingredient.name}</span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({order.ingredient.sku})
                </span>
              </td>
              <td className="px-4 py-3">
                {formatQty(order.quantity)} {order.ingredient.baseUnit.code}
              </td>
              <td className="px-4 py-3">{formatCost(order.unitCost)}</td>
              <td className="px-4 py-3">{formatCost(order.totalCost)}</td>
              <td className="px-4 py-3">
                <ProductionStatusBadge status={order.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateTime(order.occurredAt)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {order.user.name}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
