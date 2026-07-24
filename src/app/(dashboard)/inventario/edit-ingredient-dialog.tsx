"use client";

import { useTransition, useRef } from "react";
import { toast } from "sonner";
import { saveIngredientAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PurchaseUnitEditor } from "./purchase-unit-editor";

type PurchaseUnit = {
  id: string;
  unitId: string;
  unitCode: string;
  conversionFactor: number;
};

export function EditIngredientDialog({
  ingredient,
  units,
  categories,
  open,
  onOpenChange,
}: {
  ingredient: {
    id: string;
    sku: string;
    name: string;
    baseUnitId: string;
    categoryId: string | null;
    minimumStock: number;
    currentAverageCost: number;
    purchaseUnits: PurchaseUnit[];
  };
  units: Array<{ id: string; code: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveIngredientAction(null, formData);
      if (result.ok) {
        toast.success("Ingrediente actualizado");
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar ingrediente</DialogTitle>
          <DialogDescription>
            Actualiza los datos del ingrediente
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <input type="hidden" name="id" value={ingredient.id} />
          <div className="space-y-1.5">
            <Label htmlFor="edit-sku">SKU</Label>
            <Input
              id="edit-sku"
              name="sku"
              defaultValue={ingredient.sku}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nombre</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={ingredient.name}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-unit">Unidad base</Label>
            <Select
              id="edit-unit"
              name="baseUnitId"
              required
              defaultValue={ingredient.baseUnitId}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cat">Categoría</Label>
            <Select
              id="edit-cat"
              name="categoryId"
              defaultValue={ingredient.categoryId ?? ""}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-minimum">Stock mínimo</Label>
            <Input
              id="edit-minimum"
              name="minimumStock"
              type="number"
              step="0.001"
              min="0"
              defaultValue={String(ingredient.minimumStock)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cost">Costo promedio (por unidad base)</Label>
            <Input
              id="edit-cost"
              name="currentAverageCost"
              type="number"
              step="0.0001"
              min="0"
              defaultValue={String(ingredient.currentAverageCost)}
            />
          </div>
          <hr className="border-border" />
          <PurchaseUnitEditor
            ingredientId={ingredient.id}
            purchaseUnits={ingredient.purchaseUnits}
            units={units}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
