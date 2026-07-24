import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseForm } from "./purchase-form";

export default async function NuevaCompraPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;

  const [business, suppliers, ingredients, units, ingredientCategories, lastPurchaseItems] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { taxRate: true },
    }),
    prisma.supplier.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.findMany({
      where: { businessId, active: true },
      include: {
        baseUnit: true,
        purchaseUnits: {
          where: { active: true },
          include: { unit: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      where: { businessId, active: true },
      orderBy: { code: "asc" },
    }),
    prisma.ingredientCategory.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseItem.findMany({
      where: {
        purchase: { businessId, status: "RECEIVED" },
        unitPrice: { not: 0 },
      },
      orderBy: { purchase: { purchasedAt: "desc" } },
      select: { ingredientId: true, unitPrice: true },
    }),
  ]);

  const lastUnitPrices: Record<string, number> = {};
  for (const item of lastPurchaseItems) {
    if (!(item.ingredientId in lastUnitPrices)) {
      lastUnitPrices[item.ingredientId] = Number(item.unitPrice);
    }
  }

  return (
    <div>
      <PageHeader
        title="Registrar compra"
        description="La recepción actualiza inventario y costo promedio"
      />
      <PurchaseForm
        taxRate={Number(business.taxRate)}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          baseUnit: i.baseUnit.code,
          purchaseUnits: i.purchaseUnits.map((pu) => ({
            id: pu.id,
            unitId: pu.unitId,
            unitCode: pu.unit.code,
            conversionFactor: Number(pu.conversionFactor),
          })),
        }))}
        units={units.map((u) => ({ id: u.id, code: u.code, name: u.name }))}
        ingredientCategories={ingredientCategories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        lastUnitPrices={lastUnitPrices}
      />
    </div>
  );
}
