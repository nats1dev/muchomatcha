import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { SetupWizard } from "./setup-wizard";

export default async function SetupPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const businessId = session.user.businessId;

  const [ingredients, units, ingredientCategories] = await Promise.all([
    prisma.ingredient.findMany({
      where: { businessId, active: true },
      include: { baseUnit: true },
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
  ]);

  if (ingredients.length === 0 && units.length === 0) {
    redirect("/configuracion");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <SetupWizard
        initialIngredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          sku: i.sku,
          baseUnitId: i.baseUnitId,
          baseUnitCode: i.baseUnit.code,
          currentAverageCost: Number(i.currentAverageCost),
        }))}
        units={units.map((u) => ({ id: u.id, code: u.code, name: u.name }))}
        categories={ingredientCategories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
