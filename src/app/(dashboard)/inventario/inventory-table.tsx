"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useNumberFormatter } from "@/components/number-format-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EditIngredientDialog } from "./edit-ingredient-dialog";

type Row = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitDecimals: number;
  quantityNum: number;
  minimumStock: string;
  averageCost: string;
  value: string;
  belowMin: boolean;
  purchaseUnits?: Array<{ unitCode: string; conversionFactor: number }>;
};

type PurchaseUnit = {
  id: string;
  unitId: string;
  unitCode: string;
  conversionFactor: number;
};

type IngredientData = {
  id: string;
  sku: string;
  name: string;
  baseUnitId: string;
  categoryId: string | null;
  minimumStock: number;
  currentAverageCost: number;
  purchaseUnits: PurchaseUnit[];
};

export function InventoryTable({
  rows,
  ingredients,
  units,
  categories,
}: {
  rows: Row[];
  ingredients: IngredientData[];
  units: Array<{ id: string; code: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}) {
  const { formatCost, formatQty } = useNumberFormatter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingIngredient = editingId
    ? ingredients.find((i) => i.id === editingId) ?? null
    : null;

  if (!rows.length) {
    return (
      <Card className="mb-4">
        <CardContent className="p-5">
          <EmptyState title="Registra una compra o un inventario inicial"
            action={
              <Button asChild variant="secondary">
                <Link href="/setup">Setup guiado</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Ingrediente</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Existencia
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Mín.</th>
                  <th className="px-4 py-3 text-right font-medium">Costo</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.sku} · {row.category}
                      </p>
                      {row.purchaseUnits && row.purchaseUnits.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.purchaseUnits.map((pu, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {pu.unitCode} ×{pu.conversionFactor} {row.unit}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatQty(row.quantityNum, row.unitDecimals)} {row.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatQty(row.minimumStock, row.unitDecimals)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCost(Number(row.averageCost))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCost(Number(row.value))}
                    </td>
                    <td className="px-4 py-3">
                      {row.belowMin ? (
                        <Badge variant="warning">Bajo mínimo</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingId(row.id)}
                        title="Editar ingrediente"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editingIngredient ? (
        <EditIngredientDialog
          ingredient={editingIngredient}
          units={units}
          categories={categories}
          open={!!editingId}
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
        />
      ) : null}
    </>
  );
}
