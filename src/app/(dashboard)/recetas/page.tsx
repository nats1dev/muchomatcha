import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { listRecipes, productsWithoutRecipe } from "@/modules/recipes/service";
import { PageHeader } from "@/components/ui/page-header";
import { RecipesView } from "./recipes-view";

export default async function RecetasPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;

  const [recipesRaw, missing, products, ingredients] = await Promise.all([
    listRecipes(businessId),
    productsWithoutRecipe(businessId),
    prisma.product.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.findMany({
      where: { businessId, active: true },
      include: { baseUnit: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const recipes = recipesRaw.map((r) => ({
    id: r.id,
    productId: r.productId,
    version: r.version,
    yieldQuantity: Number(r.yieldQuantity),
    notes: r.notes,
    unitCost: r.unitCost,
    margin: r.margin,
    product: { id: r.product!.id, name: r.product!.name },
    items: r.items.map((item) => ({
      id: item.id,
      ingredientId: item.ingredientId,
      quantity: Number(item.quantity),
      wastePercentage: Number(item.wastePercentage),
      ingredient: {
        id: item.ingredient.id,
        name: item.ingredient.name,
        baseUnit: { code: item.ingredient.baseUnit.code },
      },
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Recetas"
        description="Relaciona productos con ingredientes y calcula el costo teórico"
      />
      <RecipesView
        recipes={recipes}
        missing={missing}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          salePrice: Number(p.salePrice),
        }))}
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.baseUnit.code,
          cost: Number(i.currentAverageCost),
        }))}
      />
    </div>
  );
}
