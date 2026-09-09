import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { listProductionOrders } from "@/modules/production/service";
import { listManufacturedIngredients } from "@/modules/production/service";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductionTable } from "@/components/production/production-table";
import { ProductionFilters } from "@/components/production/production-filters";
import { SubproductSection } from "@/components/production/subproduct-section";

export default async function ProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; take?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const sp = await searchParams;

  const [orders, subproducts, ingredients] = await Promise.all([
    listProductionOrders(session.user.businessId, {
      ...(sp.status ? { status: sp.status as "DRAFT" | "COMPLETED" | "CANCELLED" } : {}),
      take: Number(sp.take ?? 50),
    }),
    listManufacturedIngredients(session.user.businessId),
    prisma.ingredient.findMany({
      where: { businessId: session.user.businessId, active: true },
      include: { baseUnit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Producción"
        description="Gestiona la producción de subproductos"
        actions={
          <Link href="/produccion/nueva">
            <Button>+ Nueva Orden</Button>
          </Link>
        }
      />

      <SubproductSection
        subproducts={subproducts}
        allIngredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.baseUnit.code,
          cost: Number(i.currentAverageCost),
        }))}
      />

      <div className="mb-4">
        <ProductionFilters />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Sin órdenes de producción"
          description={
            subproducts.length === 0
              ? "No hay subproductos definidos. Crea un ingrediente con receta para empezar."
              : "Crea tu primera orden de producción para fabricar subproductos."
          }
          action={
            <Link href="/produccion/nueva">
              <Button>+ Nueva Orden</Button>
            </Link>
          }
        />
      ) : (
        <ProductionTable orders={orders} />
      )}
    </div>
  );
}
