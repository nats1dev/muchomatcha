import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { listCurrentInventory } from "@/modules/inventory/stock";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ report: string }> },
) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const businessId = session.user.businessId;
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

  return new Response("Reporte no encontrado", { status: 404 });
}
