import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductForm } from "./product-form";
import { CategoryForm } from "./category-form";
import { IngredientForm } from "./ingredient-form";

export default async function ProductosPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;

  const [products, categories, ingredients, ingredientCategories, units] =
    await Promise.all([
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
        description="Administra el menú, precios (sin IVA) e insumos"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Menú ({products.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!products.length ? (
                <div className="p-5">
                  <EmptyState title="Crea el menú de tu cafetería" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                        <th className="px-4 py-3 font-medium">SKU</th>
                        <th className="px-4 py-3 font-medium">Nombre</th>
                        <th className="px-4 py-3 font-medium">Categoría</th>
                        <th className="px-4 py-3 text-right font-medium">
                          Precio s/IVA
                        </th>
                        <th className="px-4 py-3 font-medium">Receta</th>
                        <th className="px-4 py-3 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-b border-border/70">
                          <td className="px-4 py-3 font-mono text-xs">
                            {p.sku}
                          </td>
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.category?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatMoney(Number(p.salePrice))}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                p.recipes.length ? "success" : "warning"
                              }
                            >
                              {p.recipes.length ? "Sí" : "No"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={p.active ? "default" : "error"}>
                              {p.active ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ingredientes ({ingredients.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Nombre</th>
                      <th className="px-4 py-3 font-medium">Unidad</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Costo prom.
                      </th>
                      <th className="px-4 py-3 text-right font-medium">Mín.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((i) => (
                      <tr key={i.id} className="border-b border-border/70">
                        <td className="px-4 py-3 font-mono text-xs">{i.sku}</td>
                        <td className="px-4 py-3 font-medium">{i.name}</td>
                        <td className="px-4 py-3">{i.baseUnit.code}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(Number(i.currentAverageCost))}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {Number(i.minimumStock)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

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
