import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { SaleForm } from "./sale-form";

export default async function NuevaVentaPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;

  const [products, business, openCash] = await Promise.all([
    prisma.product.findMany({
      where: { businessId: session.user.businessId, active: true },
      include: {
        category: true,
        recipes: { where: { active: true }, select: { id: true } },
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
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          salePrice: Number(p.salePrice),
          category: p.category?.name ?? "Sin categoría",
          hasRecipe: p.recipes.length > 0,
        }))}
        taxRate={Number(business.taxRate)}
        cashOpen={!!openCash}
      />
    </div>
  );
}
