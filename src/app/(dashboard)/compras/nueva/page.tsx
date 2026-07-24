import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseForm } from "./purchase-form";

export default async function NuevaCompraPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;

  const [suppliers, ingredients] = await Promise.all([
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
  ]);

  return (
    <div>
      <PageHeader
        title="Registrar compra"
        description="La recepción actualiza inventario y costo promedio"
      />
      <PurchaseForm
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
      />
    </div>
  );
}
