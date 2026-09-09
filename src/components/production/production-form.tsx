"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNumberFormatter } from "@/components/number-format-provider";
import { createProductionOrderAction } from "@/app/actions/production";

type Subproduct = {
  id: string;
  name: string;
  sku: string;
  baseUnit: { code: string; name: string };
  estimatedUnitCost: string;
  recipe: {
    id: string;
    version: number;
    yieldQuantity: string;
    items: Array<{
      quantity: string;
      wastePercentage: string;
      isNonInventoriable: boolean;
      ingredient: {
        id: string;
        name: string;
        sku: string;
        currentAverageCost: string;
        stockQuantity: string;
        baseUnit: { code: string };
      };
    }>;
  } | null;
};

export function ProductionForm({ subproducts }: { subproducts: Subproduct[] }) {
  const { formatCost, formatQty } = useNumberFormatter();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = subproducts.find((s) => s.id === selectedId);
  const plannedLines = useMemo(() => {
    if (!selected?.recipe || !quantity || Number(quantity) <= 0) return [];
    const requested = Number(quantity);
    const yieldQuantity = Number(selected.recipe.yieldQuantity);
    return selected.recipe.items.map((item) => {
      const required = yieldQuantity > 0
        ? (Number(item.quantity) * (1 + Number(item.wastePercentage) / 100) / yieldQuantity) * requested
        : 0;
      const stock = Number(item.ingredient.stockQuantity ?? 0);
      return { ...item, required, stock, shortage: !item.isNonInventoriable && required > stock };
    });
  }, [selected, quantity]);
  const hasShortage = plannedLines.some((line) => line.shortage);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId || !quantity || Number(quantity) <= 0 || loading) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const startImmediately = submitter?.value !== "draft";
    setLoading(true);
    setError("");

    try {
      const result = await createProductionOrderAction({
        ingredientId: selectedId,
        quantity: Number(quantity),
        notes: notes || undefined,
        startImmediately,
      });

      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }

      router.push(`/produccion/${result.data.orderId}`);
      router.refresh();
    } catch {
      setError("No se pudo crear la orden. Intenta de nuevo.");
      toast.error("No se pudo crear la orden. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div role="alert" className="rounded-[10px] border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="production-subproduct" className="text-sm font-medium">Subproducto</label>
          <select
            id="production-subproduct"
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setQuantity(""); }}
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-foreground"
            required
          >
            <option value="">Seleccionar...</option>
            {subproducts.map((sp) => (
              <option key={sp.id} value={sp.id}>{sp.name} ({sp.sku})</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="production-quantity" className="text-sm font-medium">
            Cantidad a producir ({selected?.baseUnit.code ?? "unidad"})
          </label>
          <Input
            id="production-quantity"
            type="number"
            step="0.001"
            min="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="production-notes" className="text-sm font-medium">Notas</label>
        <Textarea id="production-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      {selected?.recipe ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Receta: {selected.name} v{selected.recipe.version}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (Rendimiento: {formatQty(selected.recipe.yieldQuantity)} {selected.baseUnit.code})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="pb-2">Ingrediente</th>
                    <th className="pb-2">Cantidad por lote</th>
                    <th className="pb-2">Existencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plannedLines.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2">{item.ingredient.name}</td>
                      <td className="py-2 text-muted-foreground">
                        {formatQty(item.quantity)} {item.ingredient.baseUnit.code}
                        {Number(item.wastePercentage) > 0 ? ` + ${item.wastePercentage}% merma` : ""}
                        <span className="block text-xs">Orden: {formatQty(item.required)} {item.ingredient.baseUnit.code}</span>
                      </td>
                      <td className={item.shortage ? "py-2 text-error" : "py-2 text-muted-foreground"}>
                        {item.isNonInventoriable
                          ? "Costo fijo"
                          : `${formatQty(item.stock)} ${item.ingredient.baseUnit.code}${item.shortage ? ` · faltan ${formatQty(item.required - item.stock)}` : ""}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : selected ? (
        <p className="text-sm text-muted-foreground">Este subproducto no tiene una receta activa.</p>
      ) : null}

      {selected?.recipe ? (
        <div className="rounded-[10px] border border-border bg-muted/30 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Costo unitario estimado</span>
            <span className="font-semibold tabular-nums">{formatCost(selected.estimatedUnitCost)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Se calcula con el costo promedio actual de cada insumo. El costo real se fija al completar.
          </p>
          {hasShortage ? (
            <p className="mt-2 text-xs text-warning">
              Hay insumos por debajo de lo requerido. Puedes guardar la orden, pero no se podrá completar hasta corregir el inventario.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" value="start" disabled={loading || !selectedId || !quantity}>
          {loading ? "Guardando..." : "Crear e iniciar producción"}
        </Button>
        <Button type="submit" value="draft" variant="secondary" disabled={loading || !selectedId || !quantity}>
          Guardar borrador
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>Cancelar</Button>
      </div>
    </form>
  );
}
