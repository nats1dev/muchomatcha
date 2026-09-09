"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Search } from "lucide-react";
import { saveSubproductRecipeAction } from "@/app/actions/production";
import { calculateRecipeUnitCost } from "@/modules/recipes/cost";
import { d } from "@/lib/decimal";
import { WASTE_OPTIONS } from "@/lib/waste";
import { useNumberFormatter } from "@/components/number-format-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Item = {
  ingredientId: string;
  quantity: number;
  wastePercentage: number;
  isNonInventoriable: boolean;
};

export type SubproductRecipeInitialData = {
  ingredientId: string;
  ingredientName: string;
  yieldQuantity: number;
  notes?: string;
  items: Item[];
};

export function SubproductRecipeForm({
  ingredients,
  manufacturedIds,
  initialData,
  onSaved,
}: {
  ingredients: Array<{ id: string; name: string; unit: string; cost: number }>;
  manufacturedIds?: Set<string>;
  initialData?: SubproductRecipeInitialData;
  onSaved?: () => void;
}) {
  const { formatMoney } = useNumberFormatter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [ingredientId, setIngredientId] = useState(initialData?.ingredientId ?? "");
  const [searchQuery, setSearchQuery] = useState(initialData?.ingredientName ?? "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [yieldQuantity, setYieldQuantity] = useState(initialData?.yieldQuantity ?? 1);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [items, setItems] = useState<Item[]>(
    initialData?.items.length
      ? initialData.items
      : [{ ingredientId: "", quantity: 1, wastePercentage: 0, isNonInventoriable: false }],
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const targetHasRecipe = manufacturedIds?.has(ingredientId) ?? false;

  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return ingredients;
    const q = searchQuery.toLowerCase();
    return ingredients.filter((ing) =>
      ing.name.toLowerCase().includes(q) || ing.unit.toLowerCase().includes(q),
    );
  }, [ingredients, searchQuery]);

  const filledItems = useMemo(
    () => items.filter((i) => i.ingredientId && i.quantity > 0),
    [items],
  );

  const duplicateIngredients = useMemo(() => {
    const seen = new Map<string, number>();
    const dups = new Set<number>();
    filledItems.forEach((item, idx) => {
      const prev = seen.get(item.ingredientId);
      if (prev !== undefined) {
        dups.add(prev);
        dups.add(idx);
      }
      seen.set(item.ingredientId, idx);
    });
    return dups;
  }, [filledItems]);

  // Resumen de lote (solo lectura): misma fuente que Recetas —
  // `calculateRecipeUnitCost` para el unitario, lote = unitario × rendimiento.
  const costSummary = useMemo(() => {
    if (!filledItems.length || yieldQuantity <= 0) return null;
    try {
      const unit = calculateRecipeUnitCost(
        filledItems.map((i) => ({
          quantity: i.quantity,
          wastePercentage: i.wastePercentage,
          averageCost:
            ingredients.find((ing) => ing.id === i.ingredientId)?.cost ?? 0,
        })),
        yieldQuantity,
      );
      const batch = d(unit).mul(d(yieldQuantity));
      return {
        unit: formatMoney(Number(unit)),
        batch: formatMoney(Number(batch)),
        yield: yieldQuantity,
      };
    } catch {
      return null;
    }
  }, [filledItems, yieldQuantity, ingredients, formatMoney]);

  const selfReferencing = filledItems.some(
    (i) => i.ingredientId === ingredientId,
  );

  // Bloqueo Q0 (decisión del dueño 2026-09-09): como el costo estimado se
  // persiste en `currentAverageCost`, el subproducto no puede nacer en cero.
  // El servidor lo revalida porque la UI se puede saltear.
  const hasZeroCostInput = filledItems.some(
    (i) =>
      Number(ingredients.find((ing) => ing.id === i.ingredientId)?.cost ?? 0) <=
      0,
  );

  const validationErrors: string[] = [];
  if (!ingredientId) validationErrors.push("Selecciona un ingrediente objetivo");
  if (!filledItems.length)
    validationErrors.push("Agrega al menos un ingrediente con cantidad > 0");
  if (yieldQuantity <= 0)
    validationErrors.push("El rendimiento debe ser mayor a 0");
  if (duplicateIngredients.size > 0)
    validationErrors.push("Hay ingredientes duplicados");
  if (selfReferencing)
    validationErrors.push("El ingrediente objetivo no puede ser parte de su propia receta");
  if (hasZeroCostInput)
    validationErrors.push(
      "Todos los ingredientes deben tener costo promedio mayor a cero para guardar el subproducto",
    );

  function resetForm() {
    setIngredientId("");
    setSearchQuery("");
    setYieldQuantity(1);
    setNotes("");
    setItems([
      {
        ingredientId: "",
        quantity: 1,
        wastePercentage: 0,
        isNonInventoriable: false,
      },
    ]);
  }

  function submit() {
    if (validationErrors.length) return;
    startTransition(async () => {
      const res = await saveSubproductRecipeAction({
        ingredientId,
        yieldQuantity,
        notes: notes || undefined,
        items: filledItems,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        `Receta guardada. Costo unitario Q ${res.data?.unitCost ?? "0"}`,
      );
      resetForm();
      onSaved?.();
    });
  }

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Ingrediente a producir (subproducto)</Label>
        <div ref={dropdownRef} className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) {
                  setIngredientId("");
                }
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar ingrediente..."
            />
          </div>
          {showDropdown && filteredIngredients.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-[10px] border border-border bg-card shadow-lg">
              {filteredIngredients.map((ing) => {
                const hasRecipe = manufacturedIds?.has(ing.id);
                return (
                  <button
                    key={ing.id}
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                      ing.id === ingredientId ? "bg-muted/60" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIngredientId(ing.id);
                      setSearchQuery(ing.name);
                      setShowDropdown(false);
                    }}
                  >
                    <span>{ing.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {hasRecipe && (
                        <Badge variant="warning" className="text-[10px]">
                          ya tiene receta
                        </Badge>
                      )}
                      {ing.unit}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {showDropdown && searchQuery.trim() && !filteredIngredients.length && (
            <div className="absolute z-10 mt-1 w-full rounded-[10px] border border-border bg-card p-3 text-sm text-muted-foreground shadow-lg">
              Sin resultados para &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
        {targetHasRecipe && (
          <p className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3 w-3" />
            Ya tiene receta activa. Se creará una nueva versión.
          </p>
        )}
      </div>

      {selectedIngredient ? (
        <p className="text-xs text-muted-foreground">
          Unidad base: {selectedIngredient.unit}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label>Rendimiento (por lote)</Label>
        <Input
          type="number"
          min="0.001"
          step="0.001"
          value={yieldQuantity}
          onChange={(e) => setYieldQuantity(Number(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <Label>Ingredientes constituyentes</Label>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_100px_120px_36px] gap-1">
            <Select
              value={item.ingredientId}
              onChange={(e) =>
                  setItems((prev) =>
                  prev.map((x, i) =>
                    i === idx ? { ...x, ingredientId: e.target.value } : x,
                  ),
                )
              }
            >
              <option value="">Seleccionar...</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.unit})
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={item.quantity}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((x, i) =>
                    i === idx
                      ? { ...x, quantity: Number(e.target.value) }
                      : x,
                  ),
                )
              }
              title="Cantidad"
            />
            <Select
              value={String(item.wastePercentage)}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((x, i) =>
                    i === idx
                      ? { ...x, wastePercentage: Number(e.target.value) }
                      : x,
                  ),
                )
              }
              title="Merma"
            >
              {WASTE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() =>
                setItems((prev) => prev.filter((_, i) => i !== idx))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <label className="col-span-full flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={item.isNonInventoriable}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((x, i) =>
                      i === idx
                        ? { ...x, isNonInventoriable: e.target.checked }
                        : x,
                    ),
                  )
                }
                className="h-3.5 w-3.5 rounded border-border"
              />
              Costo fijo (no descuenta inventario)
            </label>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setItems((prev) => [
              ...prev,
              {
                ingredientId: "",
                quantity: 1,
                wastePercentage: 0,
                isNonInventoriable: false,
              },
            ])
          }
        >
          <Plus className="h-4 w-4" />
          Línea
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Notas (opcional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej: receta para lote de 1kg"
          rows={2}
        />
      </div>

      {costSummary ? (
        <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Costo total del lote:</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {costSummary.batch}
            </span>
          </p>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Rendimiento:</span>
            <span className="shrink-0 tabular-nums">{costSummary.yield}</span>
          </p>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">
              Costo estimado por unidad:
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {costSummary.unit}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Calculado con el costo promedio actual de Inventario. Al guardar se
            actualiza el costo del subproducto.
          </p>
        </div>
      ) : null}

      {validationErrors.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
          {validationErrors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      <Button
        className="w-full"
        onClick={submit}
        disabled={pending || validationErrors.length > 0}
      >
        {pending ? "Guardando..." : "Guardar receta de subproducto"}
      </Button>
    </div>
  );
}
