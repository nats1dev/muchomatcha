import { SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { d, money } from "@/lib/decimal";
import { listCurrentInventory } from "@/modules/inventory/stock";
import { formatInTimeZone } from "date-fns-tz";
import { DEFAULT_TZ } from "@/lib/dates";
import { getExpectedForSession } from "@/modules/cash/service";

export async function getDashboard(params: {
  businessId: string;
  from: Date;
  to: Date;
  tz?: string;
}) {
  const tz = params.tz ?? DEFAULT_TZ;
  const range = { gte: params.from, lte: params.to };

  const [
    sales,
    inventory,
    openCash,
    purchases,
    expenses,
    recentClosures,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: {
        businessId: params.businessId,
        soldAt: range,
        status: SaleStatus.CONFIRMED,
      },
      select: {
        id: true,
        saleNumber: true,
        soldAt: true,
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        total: true,
        paymentMethod: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            unitCostSnapshot: true,
            product: {
              select: {
                name: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { soldAt: "desc" },
    }),
    listCurrentInventory(params.businessId),
    prisma.cashSession.findFirst({
      where: { businessId: params.businessId, status: "OPEN" },
      select: { id: true },
    }),
    prisma.purchase.aggregate({
      where: {
        businessId: params.businessId,
        purchasedAt: range,
        status: "RECEIVED",
      },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: {
        businessId: params.businessId,
        expenseDate: range,
      },
      _sum: { total: true },
    }),
    prisma.cashSession.findMany({
      where: {
        businessId: params.businessId,
        status: "CLOSED",
        closedAt: range,
      },
      orderBy: { closedAt: "desc" },
      take: 5,
      select: {
        id: true,
        closedAt: true,
        differenceAmount: true,
        expectedAmount: true,
        countedAmount: true,
      },
    }),
  ]);

  const expectedCash = openCash
    ? (await getExpectedForSession(openCash.id)).breakdown.expected
    : money(0);

  let salesNet = d(0);
  let taxTotal = d(0);
  let costTotal = d(0);
  const byDay = new Map<string, { sales: ReturnType<typeof d>; count: number }>();
  const byCategory = new Map<string, ReturnType<typeof d>>();
  const byProduct = new Map<
    string,
    {
      name: string;
      qty: ReturnType<typeof d>;
      revenue: ReturnType<typeof d>;
      cost: ReturnType<typeof d>;
    }
  >();

  for (const sale of sales) {
    const net = d(sale.subtotal).minus(d(sale.discountTotal));
    salesNet = salesNet.plus(net);
    taxTotal = taxTotal.plus(d(sale.taxTotal));

    const day = formatInTimeZone(sale.soldAt, tz, "yyyy-MM-dd");
    const dayRow = byDay.get(day) ?? { sales: d(0), count: 0 };
    dayRow.sales = dayRow.sales.plus(net);
    dayRow.count += 1;
    byDay.set(day, dayRow);

    for (const item of sale.items) {
      const lineNet = d(item.unitPrice)
        .mul(d(item.quantity))
        .minus(d(item.discount));
      const lineCost = d(item.unitCostSnapshot).mul(d(item.quantity));
      costTotal = costTotal.plus(lineCost);

      const cat = item.product.category?.name ?? "Sin categoría";
      byCategory.set(cat, (byCategory.get(cat) ?? d(0)).plus(lineNet));

      const prod = byProduct.get(item.productId) ?? {
        name: item.product.name,
        qty: d(0),
        revenue: d(0),
        cost: d(0),
      };
      prod.qty = prod.qty.plus(d(item.quantity));
      prod.revenue = prod.revenue.plus(lineNet);
      prod.cost = prod.cost.plus(lineCost);
      byProduct.set(item.productId, prod);
    }
  }

  const grossProfit = money(salesNet.minus(costTotal));
  const margin = salesNet.gt(0)
    ? money(grossProfit.div(salesNet).mul(100))
    : money(0);
  const ticketAvg = sales.length
    ? money(salesNet.div(sales.length))
    : money(0);

  const inventoryValue = inventory.reduce(
    (acc, i) => acc.plus(d(i.value)),
    d(0),
  );
  const belowMin = inventory.filter((i) => i.belowMin);

  const salesByDay = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      sales: Number(money(v.sales).toFixed(2)),
      count: v.count,
    }));

  const salesByCategory = Array.from(byCategory.entries())
    .map(([name, value]) => ({
      name,
      value: Number(money(value).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  const topProducts = Array.from(byProduct.values())
    .map((p) => ({
      name: p.name,
      qty: Number(p.qty.toFixed(3)),
      revenue: Number(money(p.revenue).toFixed(2)),
      margin: Number(money(p.revenue.minus(p.cost)).toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  return {
    kpis: {
      salesNet: Number(money(salesNet).toFixed(2)),
      taxTotal: Number(money(taxTotal).toFixed(2)),
      costTotal: Number(money(costTotal).toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      margin: Number(margin.toFixed(2)),
      ticketAvg: Number(ticketAvg.toFixed(2)),
      salesCount: sales.length,
      expectedCash: Number(expectedCash.toFixed(2)),
      inventoryValue: Number(money(inventoryValue).toFixed(2)),
      belowMinCount: belowMin.length,
      purchasesTotal: Number(money(purchases._sum.total ?? 0).toFixed(2)),
      expensesTotal: Number(money(expenses._sum.total ?? 0).toFixed(2)),
      cashOpen: !!openCash,
    },
    salesByDay,
    salesByCategory,
    topProducts,
    recentSales: sales.slice(0, 8).map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      soldAt: s.soldAt.toISOString(),
      total: Number(s.total),
      paymentMethod: s.paymentMethod,
      items: s.items.length,
    })),
    criticalInventory: belowMin.slice(0, 8),
    recentClosures: recentClosures.map((c) => ({
      id: c.id,
      closedAt: c.closedAt?.toISOString() ?? null,
      difference: Number(c.differenceAmount ?? 0),
      expected: Number(c.expectedAmount ?? 0),
      counted: Number(c.countedAmount ?? 0),
    })),
  };
}
