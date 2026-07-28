import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { SaleForm } from "./sale-form";
import { calculateRecipeUnitCost } from "@/modules/recipes/cost";

export default async function NuevaVentaPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;

  const [products, business, openCash] = await Promise.all([
    prisma.product.findMany({
      where: { businessId: session.user.businessId, active: true },
      include: {
        category: true,
        recipes: {
          where: { active: true },
          select: {
            yieldQuantity: true,
            items: {
              select: {
                quantity: true,
                wastePercentage: true,
                ingredient: { select: { currentAverageCost: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.business.findUnique({
      where: { id: session.user.businessId },
    }).then((b) => { if (!b) redirect("/login"); return b; }),
    prisma.cashSession.findFirst({
      where: { businessId: session.user.businessId, status: "OPEN" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Registrar venta"
        description="Busca productos, ajusta cantidades y confirma el cobro"
      />
      <SaleForm
        products={products.map((p) => {
          const recipe = p.recipes[0];
          const unitCost = recipe
            ? calculateRecipeUnitCost(
                recipe.items.map((ri) => ({
                  quantity: ri.quantity.toString(),
                  wastePercentage: ri.wastePercentage.toString(),
                  averageCost: ri.ingredient.currentAverageCost.toString(),
                })),
                recipe.yieldQuantity.toString(),
              )
            : null;
          return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            salePrice: Number(p.salePrice),
            category: p.category?.name ?? "Sin categoría",
            hasRecipe: recipe != null,
            unitCost: unitCost ? Number(unitCost) : null,
          };
        })}
        taxRate={Number(business.taxRate)}
        cashOpen={!!openCash}
      />
    </div>
  );
}
