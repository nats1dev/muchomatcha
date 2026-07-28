import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "./product-form";
import { CategoryForm } from "./category-form";
import { IngredientForm } from "./ingredient-form";
import { CatalogTable } from "./catalog-table";
import { CsvImportButton } from "@/components/csv-import-button";

export default async function ProductosPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;

  const [
    business,
    products,
    categories,
    ingredients,
    ingredientCategories,
    units,
  ] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { taxRate: true },
    }).then((b) => { if (!b) redirect("/login"); return b; }),
    prisma.product.findMany({
      where: { businessId },
      include: {
        category: true,
        recipes: { where: { active: true }, select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.productCategory.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.findMany({
      where: { businessId },
      include: { baseUnit: true, category: true },
      orderBy: { name: "asc" },
    }),
    prisma.ingredientCategory.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      where: { businessId, active: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Productos e ingredientes"
        description="Administra el menú, precios e insumos"
        actions={<CsvImportButton />}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <CatalogTable
          products={products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            image: p.image,
            salePrice: Number(p.salePrice),
            active: p.active,
            category: p.category
              ? { id: p.category.id, name: p.category.name }
              : null,
            recipes: p.recipes.map((r) => ({ id: r.id })),
          }))}
          ingredients={ingredients.map((i) => ({
            id: i.id,
            sku: i.sku,
            name: i.name,
            image: i.image,
            active: i.active,
            baseUnit: { code: i.baseUnit.code },
            currentAverageCost: Number(i.currentAverageCost),
            minimumStock: Number(i.minimumStock),
            recipeId: i.recipeId,
          }))}
          taxRate={Number(business.taxRate)}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nuevo producto</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductForm categories={categories} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Categoría de producto</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Nuevo ingrediente</CardTitle>
            </CardHeader>
            <CardContent>
              <IngredientForm
                categories={ingredientCategories}
                units={units}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
