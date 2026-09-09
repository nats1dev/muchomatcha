import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { listCurrentInventory } from "@/modules/inventory/stock";
import { requireRole } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ report: string }> },
) {
  let businessId: string;
  try {
    // Exportar revela ventas, costos y arqueos completos: exige al menos
    // rol de solo lectura, no unicamente tener sesion iniciada.
    ({ businessId } = await requireRole("VIEWER"));
  } catch (e) {
    const status = isAppError(e) ? e.status : 500;
    const message = isAppError(e) ? e.message : "Error inesperado";
    return new Response(message, { status });
  }
  const { report } = await ctx.params;
  const name = report.replace(/\.csv$/i, "");

  if (name === "sales") {
    const rows = await prisma.sale.findMany({
      where: { businessId },
      include: { items: { include: { product: true } }, user: true },
      orderBy: { soldAt: "desc" },
      take: 5000,
    });
    const csv = toCsv(
      [
        "sale_number",
        "sold_at",
        "status",
        "payment_method",
        "product",
        "quantity",
        "unit_price",
        "tax",
        "line_total",
        "unit_cost",
        "user",
      ],
      rows.flatMap((s) =>
        s.items.map((i) => [
          s.saleNumber,
          s.soldAt.toISOString(),
          s.status,
          s.paymentMethod,
          i.product.name,
          i.quantity.toString(),
          i.unitPrice.toString(),
          i.tax.toString(),
          i.lineTotal.toString(),
          i.unitCostSnapshot.toString(),
          s.user.name,
        ]),
      ),
    );
    return csvResponse("sales.csv", csv);
  }

  if (name === "purchases") {
    const rows = await prisma.purchase.findMany({
      where: { businessId },
      include: {
        supplier: true,
        items: { include: { ingredient: true } },
      },
      orderBy: { purchasedAt: "desc" },
      take: 5000,
    });
    const csv = toCsv(
      [
        "purchased_at",
        "supplier",
        "document",
        "ingredient",
        "base_quantity",
        "unit_cost",
        "unit_price",
        "line_total",
        "total",
      ],
      rows.flatMap((p) =>
        p.items.map((i) => [
          p.purchasedAt.toISOString(),
          p.supplier.name,
          p.documentNumber ?? "",
          i.ingredient.name,
          i.baseQuantity.toString(),
          i.unitCost.toString(),
          i.unitPrice.toString(),
          i.lineTotal.toString(),
          p.total.toString(),
        ]),
      ),
    );
    return csvResponse("purchases.csv", csv);
  }

  if (name === "inventory") {
    const rows = await listCurrentInventory(businessId);
    const csv = toCsv(
      [
        "sku",
        "name",
        "category",
        "unit",
        "quantity",
        "minimum_stock",
        "average_cost",
        "value",
        "below_min",
      ],
      rows.map((r) => [
        r.sku,
        r.name,
        r.category,
        r.unit,
        r.quantity,
        r.minimumStock,
        r.averageCost,
        r.value,
        r.belowMin ? "yes" : "no",
      ]),
    );
    return csvResponse("inventory.csv", csv);
  }

  if (name === "expenses") {
    const rows = await prisma.expense.findMany({
      where: { businessId },
      orderBy: { expenseDate: "desc" },
      take: 5000,
    });
    const csv = toCsv(
      [
        "expense_date",
        "category",
        "description",
        "subtotal",
        "tax_total",
        "total",
        "payment_method",
        "payment_status",
      ],
      rows.map((e) => [
        e.expenseDate.toISOString().slice(0, 10),
        e.category,
        e.description,
        e.subtotal.toString(),
        e.taxTotal.toString(),
        e.total.toString(),
        e.paymentMethod,
        e.paymentStatus,
      ]),
    );
    return csvResponse("expenses.csv", csv);
  }

  if (name === "cash") {
    const rows = await prisma.cashSession.findMany({
      where: { businessId },
      orderBy: { openedAt: "desc" },
      take: 1000,
    });
    const csv = toCsv(
      [
        "opened_at",
        "closed_at",
        "status",
        "opening_amount",
        "expected_amount",
        "counted_amount",
        "difference_amount",
        "sale_cash_total",
      ],
      rows.map((c) => [
        c.openedAt.toISOString(),
        c.closedAt?.toISOString() ?? "",
        c.status,
        c.openingAmount.toString(),
        c.expectedAmount?.toString() ?? "",
        c.countedAmount?.toString() ?? "",
        c.differenceAmount?.toString() ?? "",
        c.saleCashTotal?.toString() ?? "",
      ]),
    );
    return csvResponse("cash.csv", csv);
  }

  if (name === "production") {
    const rows = await prisma.productionOrder.findMany({
      where: { businessId },
      include: {
        ingredient: { select: { name: true, sku: true, baseUnit: { select: { code: true } } } },
      },
      orderBy: { occurredAt: "desc" },
      take: 5000,
    });
    const csv = toCsv(
      [
        "order_number",
        "ingredient",
        "sku",
        "unit",
        "planned_quantity",
        "actual_quantity",
        "yield_variance_pct",
        "estimated_unit_cost",
        "actual_unit_cost",
        "cost_variance_pct",
        "waste_cost",
        "status",
        "occurred_at",
        "started_at",
        "completed_at",
        "cycle_time_hours",
      ],
      rows.map((po) => {
        const actual = Number(po.actualQuantity ?? po.quantity);
        const planned = Number(po.quantity);
        const yieldVar = planned > 0 ? ((actual - planned) / planned) * 100 : 0;
        const unitCost = Number(po.unitCost);
        const wasteCost = planned > actual ? (planned - actual) * unitCost : 0;
        const estUnit = Number(po.estimatedUnitCost ?? 0);
        const costVar = estUnit > 0 ? ((unitCost - estUnit) / estUnit) * 100 : null;
        const cycleHrs = po.completedAt && po.startedAt
          ? (new Date(po.completedAt).getTime() - new Date(po.startedAt).getTime()) / 3600000
          : null;
        return [
          po.orderNumber,
          po.ingredient.name,
          po.ingredient.sku,
          po.ingredient.baseUnit.code,
          planned,
          actual,
          yieldVar.toFixed(2),
          Number(po.estimatedUnitCost ?? 0).toFixed(4),
          unitCost.toFixed(4),
          costVar != null ? costVar.toFixed(2) : "",
          wasteCost.toFixed(2),
          po.status,
          po.occurredAt.toISOString(),
          po.startedAt?.toISOString() ?? "",
          po.completedAt?.toISOString() ?? "",
          cycleHrs != null ? cycleHrs.toFixed(2) : "",
        ];
      }),
    );
    return csvResponse("produccion.csv", csv);
  }

  return new Response("Reporte no encontrado", { status: 404 });
}
