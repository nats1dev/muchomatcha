"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { savePurchaseUnitAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type PurchaseUnit = {
  id: string;
  unitId: string;
  unitCode: string;
  conversionFactor: number;
};

export function PurchaseUnitEditor({
  ingredientId,
  purchaseUnits,
  units,
}: {
  ingredientId: string;
  purchaseUnits: PurchaseUnit[];
  units: Array<{ id: string; code: string; name: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newUnitId, setNewUnitId] = useState(units[0]?.id ?? "");
  const [newFactor, setNewFactor] = useState(1);
  const [items, setItems] = useState(purchaseUnits);

  function handleAdd() {
    if (newFactor <= 0) {
      toast.error("El factor de conversión debe ser mayor a 0");
      return;
    }
    const existing = items.find((pu) => pu.unitId === newUnitId);
    if (existing) {
      toast.error(`Ya existe una presentación en "${units.find((u) => u.id === newUnitId)?.code}"`);
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("ingredientId", ingredientId);
      fd.set("unitId", newUnitId);
      fd.set("conversionFactor", String(newFactor));
      const res = await savePurchaseUnitAction(null, fd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const unitCode = units.find((u) => u.id === newUnitId)?.code ?? "?";
      setItems((prev) => [
        ...prev,
        { id: `new-${Date.now()}`, unitId: newUnitId, unitCode, conversionFactor: newFactor },
      ]);
      setAdding(false);
      setNewFactor(1);
      toast.success("Presentación de compra agregada");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Presentaciones de compra</Label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>

      {items.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">
          Sin presentaciones de compra. El ingrediente usará su unidad base (1:1).
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((pu) => (
            <li
              key={pu.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="tabular-nums">
                {pu.unitCode} <span className="text-muted-foreground">×{pu.conversionFactor.toFixed(3)}</span>
              </span>
              <span className="text-[10px] text-muted-foreground">{units.find((u) => u.id === pu.unitId)?.name ?? ""}</span>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex items-end gap-2 rounded-lg border border-border p-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Unidad</Label>
            <Select value={newUnitId} onChange={(e) => setNewUnitId(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Factor</Label>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={newFactor}
              onChange={(e) => setNewFactor(Number(e.target.value))}
              placeholder="Factor"
            />
          </div>
          <Button type="button" size="sm" onClick={handleAdd} disabled={pending}>
            {pending ? "..." : "Guardar"}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={() => setAdding(false)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
