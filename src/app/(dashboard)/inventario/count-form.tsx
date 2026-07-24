"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmCountAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CountForm({
  ingredients,
}: {
  ingredients: Array<{
    id: string;
    name: string;
    unit: string;
    theoretical: number;
  }>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ingredients.slice(0, 8).map((i) => [i.id, String(i.theoretical)]),
    ),
  );
  const [pending, startTransition] = useTransition();
  const subset = ingredients.slice(0, 8);

  function submit() {
    startTransition(async () => {
      const items = subset.map((i) => ({
        ingredientId: i.id,
        physicalQuantity: Number(values[i.id] ?? i.theoretical),
      }));
      const res = await confirmCountAction({ items });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Conteo confirmado");
    });
  }

  if (!subset.length) {
    return <p className="text-sm text-muted-foreground">Sin ingredientes</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Primeros 8 ingredientes. Teórica vs física.
      </p>
      {subset.map((i) => (
        <div key={i.id} className="grid grid-cols-[1fr_90px] items-center gap-2">
          <div>
            <p className="text-sm font-medium">{i.name}</p>
            <p className="text-xs text-muted-foreground">
              Teórica: {i.theoretical} {i.unit}
            </p>
          </div>
          <Input
            type="number"
            step="0.001"
            value={values[i.id] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [i.id]: e.target.value }))
            }
          />
        </div>
      ))}
      <Button className="w-full" onClick={submit} disabled={pending}>
        {pending ? "Confirmando..." : "Confirmar conteo"}
      </Button>
    </div>
  );
}
