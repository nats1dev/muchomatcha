import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { hasAtLeast } from "@/lib/auth/roles";
import { listProductionOrdersSchema } from "@/app/actions/schemas";
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
  searchParams: Promise<{ status?: string | string[]; take?: string | string[] }>;
}) {
  const session = await requirePageRole("VIEWER");
  const canProduce = hasAtLeast(session.role, "CASHIER");
  const canEditRecipes = hasAtLeast(session.role, "ADMIN");
  const sp = await searchParams;
  const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const rawTake = Array.isArray(sp.take) ? sp.take[0] : sp.take;
  const parsedFilters = listProductionOrdersSchema.safeParse({
    status: rawStatus || undefined,
    take: rawTake || undefined,
  });
  const filters = parsedFilters.success ? parsedFilters.data ?? {} : {};
  const status = filters.status;
  const take = filters.take ?? 50;

  const [orders, subproducts, ingredients] = await Promise.all([
    listProductionOrders(session.businessId, {
      ...(status ? { status } : {}),
      take,
    }),
    listManufacturedIngredients(session.businessId),
    prisma.ingredient.findMany({
      where: { businessId: session.businessId, active: true },
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
          canProduce ? (
            <Link href="/produccion/nueva">
              <Button>+ Nueva Orden</Button>
            </Link>
          ) : null
        }
      />

      <SubproductSection
        subproducts={subproducts.map((s) => ({
          id: s.id,
          name: s.name,
          sku: s.sku,
          baseUnit: { code: s.baseUnit.code },
          recipe: s.recipe
            ? {
                id: s.recipe.id,
                version: s.recipe.version,
                yieldQuantity: Number(s.recipe.yieldQuantity),
                notes: s.recipe.notes,
                items: s.recipe.items.map((item) => ({
                  ingredientId: item.ingredientId,
                  quantity: Number(item.quantity),
                  wastePercentage: Number(item.wastePercentage),
                  isNonInventoriable: item.isNonInventoriable,
                  ingredient: {
                    id: item.ingredient.id,
                    name: item.ingredient.name,
                  },
                })),
              }
            : null,
        }))}
        allIngredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.baseUnit.code,
          cost: Number(i.currentAverageCost),
        }))}
        canEdit={canEditRecipes}
      />

      <div className="mb-4">
        <ProductionFilters />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Sin órdenes de producción"
          description={
            subproducts.length === 0
              ? canEditRecipes
                ? "No hay subproductos definidos. Crea un ingrediente con receta para empezar."
                : "No hay subproductos definidos todavía."
              : canProduce
                ? "Crea tu primera orden de producción para fabricar subproductos."
                : "Todavía no hay órdenes de producción registradas."
          }
          action={
            canProduce ? (
            <Link href="/produccion/nueva">
              <Button>+ Nueva Orden</Button>
            </Link>
            ) : undefined
          }
        />
      ) : (
        <ProductionTable orders={orders} />
      )}
    </div>
  );
}
