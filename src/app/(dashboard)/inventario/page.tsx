import Link from "next/link";
import { auth } from "@/auth";
import { listCurrentInventory } from "@/modules/inventory/stock";
import { listMovements } from "@/modules/inventory/service";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatCost as baseFormatCost, formatQty as baseFormatQty } from "@/lib/utils";
import { getNumberDisplaySettings } from "@/lib/number-format-server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdjustmentForm } from "./adjustment-form";
import { CountForm } from "./count-form";
import { InventorySearch } from "./inventory-search";
import { InventoryTable } from "./inventory-table";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ low?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const sp = await searchParams;
  const businessId = session.user.businessId;
  const numberSettings = await getNumberDisplaySettings(businessId);
  const formatCost = (value: number | string) => baseFormatCost(value, "GTQ", numberSettings);
  const formatQty = (value: number | string, decimals?: number) => baseFormatQty(value, decimals, numberSettings);

  const [inventory, movements, ingredients, units, ingredientCategories] =
    await Promise.all([
      listCurrentInventory(businessId),
      listMovements(businessId, { take: 30 }),
      prisma.ingredient.findMany({
        where: { businessId, active: true },
        include: {
          baseUnit: true,
          category: true,
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
    ]);

  const rows = inventory.filter((i) => {
    if (sp.low === "1" && !i.belowMin) return false;
    if (sp.q) {
      const q = sp.q.toLowerCase();
      if (
        !i.name.toLowerCase().includes(q) &&
        !i.sku.toLowerCase().includes(q) &&
        !i.category.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const ingredientData = ingredients.map((i) => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    baseUnitId: i.baseUnitId,
    categoryId: i.categoryId,
    minimumStock: Number(i.minimumStock),
    currentAverageCost: Number(i.currentAverageCost),
    purchaseUnits: i.purchaseUnits.map((pu) => ({
      id: pu.id,
      unitId: pu.unitId,
      unitCode: pu.unit.code,
      conversionFactor: Number(pu.conversionFactor),
    })),
  }));

  const lowHref = `/inventario?low=1${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;
  const allHref = `/inventario${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ""}`;

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Existencias teóricas, movimientos, mermas y conteos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InventorySearch />
            <Button asChild variant={sp.low === "1" ? "default" : "secondary"}>
              <Link href={lowHref}>Bajo mínimo</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={allHref}>Todos</Link>
            </Button>
          </div>
        }
      />

      <InventoryTable
        rows={rows}
        ingredients={ingredientData}
        units={units}
        categories={ingredientCategories}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Merma / ajuste</CardTitle>
          </CardHeader>
          <CardContent>
            <AdjustmentForm
              ingredients={ingredients.map((i) => ({
                id: i.id,
                name: i.name,
                unit: i.baseUnit.code,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conteo físico</CardTitle>
          </CardHeader>
          <CardContent>
            <CountForm
              ingredients={inventory.map((i) => ({
                id: i.id,
                name: i.name,
                unit: i.unit,
                theoretical: i.quantityNum,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Movimientos recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {movements.map((m) => (
                <li
                  key={m.id}
                  className="rounded-[10px] border border-border px-3 py-2"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{m.ingredient.name}</span>
                    {m.movementType === "COST_ADJUSTMENT" ? (
                      <span className="tabular-nums text-muted-foreground">
                        {formatCost(Number(m.unitCost))}
                      </span>
                    ) : (
                      <span
                        className={
                          Number(m.quantityDelta) < 0
                            ? "text-error tabular-nums"
                            : "text-success tabular-nums"
                        }
                      >
                        {Number(m.quantityDelta) > 0 ? "+" : ""}
                        {formatQty(Number(m.quantityDelta))}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.movementType === "COST_ADJUSTMENT" ? "Ajuste de costo" : m.movementType} · {formatDateTime(m.occurredAt)}
                  </p>
                </li>
              ))}
              {!movements.length ? (
                <li className="text-muted-foreground">Sin movimientos</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
