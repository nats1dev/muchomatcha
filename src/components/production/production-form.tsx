"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatQty } from "@/lib/utils";
import { createProductionOrderAction } from "@/app/actions/production";

type Subproduct = {
  id: string;
  name: string;
  sku: string;
  baseUnit: { code: string; name: string };
  recipe: {
    id: string;
    version: number;
    yieldQuantity: string;
    items: Array<{
      ingredient: { id: string; name: string; sku: string; baseUnit: { code: string } };
    }>;
  } | null;
};

export function ProductionForm({ subproducts }: { subproducts: Subproduct[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = subproducts.find((s) => s.id === selectedId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !quantity || Number(quantity) <= 0) return;
    setLoading(true);
    setError("");

    const result = await createProductionOrderAction({
      ingredientId: selectedId,
      quantity: Number(quantity),
      notes: notes || undefined,
    });

    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    router.push(`/produccion/${result.data.orderId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-[10px] border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Subproducto</label>
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setQuantity(""); }}
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-foreground"
            required
          >
            <option value="">Seleccionar...</option>
            {subproducts.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name} ({sp.sku})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Cantidad a producir ({selected?.baseUnit.code ?? "unidad"})
          </label>
          <Input
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
        <label className="text-sm font-medium">Notas</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="pb-2">Ingrediente</th>
                  <th className="pb-2">Cantidad por lote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selected.recipe!.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2">{item.ingredient.name}</td>
                    <td className="py-2 text-muted-foreground">
                      {item.ingredient.baseUnit.code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : selected ? (
        <p className="text-sm text-muted-foreground">
          Este subproducto no tiene una receta activa.
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || !selectedId || !quantity}>
          {loading ? "Creando..." : "Guardar como Borrador"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
