"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Search } from "lucide-react";
import { saveRecipeAction } from "@/app/actions/operations";
import {
  calculateRecipeLineCost,
  calculateRecipeUnitCost,
} from "@/modules/recipes/cost";
import { d } from "@/lib/decimal";
import { WASTE_OPTIONS, normalizeWastePercentage } from "@/lib/waste";
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

type InitialData = {
  recipeId?: string;
  productId?: string | null;
  productName?: string;
  yieldQuantity?: number;
  notes?: string;
  items?: Array<{
    ingredientId: string;
    quantity: number;
    wastePercentage: number;
    isNonInventoriable?: boolean;
  }>;
};

export function RecipeForm({
  products,
  ingredients,
  initialData,
  productsWithRecipeIds,
  onSaved,
}: {
  products: Array<{ id: string; name: string; salePrice: number }>;
  // cost = costo promedio por unidad base (currentAverageCost). Solo lectura en Recetas.
  ingredients: Array<{ id: string; name: string; unit: string; cost: number }>;
  initialData?: InitialData;
  productsWithRecipeIds?: Set<string>;
  onSaved?: () => void;
}) {
  const { formatMoney } = useNumberFormatter();
  const editing = !!initialData?.recipeId;
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [productId, setProductId] = useState(
    initialData?.productId ?? "",
  );
  const [searchQuery, setSearchQuery] = useState(
    initialData?.productName ?? "",
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [yieldQuantity, setYieldQuantity] = useState(
    initialData?.yieldQuantity ?? 1,
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [items, setItems] = useState<Item[]>(
    initialData?.items?.length
      ? initialData.items.map((i) => ({
          ingredientId: i.ingredientId,
          quantity: i.quantity,
          wastePercentage: normalizeWastePercentage(i.wastePercentage),
          isNonInventoriable: i.isNonInventoriable ?? false,
        }))
      : [
          {
            ingredientId: ingredients[0]?.id ?? "",
            quantity: 1,
            wastePercentage: 0,
            isNonInventoriable: false,
          },
        ],
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

  const productHasRecipe = productsWithRecipeIds?.has(productId) ?? false;

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

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

  const lineDetails = useMemo(
    () =>
      items.map((item, idx) => {
        const ing = ingredients.find((i) => i.id === item.ingredientId);
        const averageCost = ing?.cost ?? 0;
        const unit = ing?.unit ?? "unidad";
        let contribution: string | null = null;
        if (yieldQuantity > 0) {
          try {
            const line = calculateRecipeLineCost({
              quantity: item.quantity,
              wastePercentage: item.wastePercentage,
              averageCost,
              yieldQuantity,
            });
            contribution = formatMoney(Number(line.unitContribution));
          } catch {
            contribution = null;
          }
        }
        return {
          averageCost,
          unit,
          contribution,
          hasZeroCost: Number(averageCost) === 0,
          selectId: `recipe-ingredient-${idx}`,
          qtyId: `recipe-qty-${idx}`,
          wasteId: `recipe-waste-${idx}`,
        };
      }),
    [items, ingredients, yieldQuantity, formatMoney],
  );

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

  const validationErrors: string[] = [];
  if (!productId) validationErrors.push("Selecciona un producto");
  if (!filledItems.length)
    validationErrors.push("Agrega al menos un ingrediente con cantidad > 0");
  if (yieldQuantity <= 0)
    validationErrors.push("El rendimiento debe ser mayor a 0");
  if (duplicateIngredients.size > 0)
    validationErrors.push("Hay ingredientes duplicados");

  function resetForm() {
    setProductId("");
    setSearchQuery("");
    setYieldQuantity(1);
    setNotes("");
    setItems([
      {
        ingredientId: ingredients[0]?.id ?? "",
        quantity: 1,
        wastePercentage: 0,
        isNonInventoriable: false,
      },
    ]);
  }

  function submit() {
    if (validationErrors.length) return;
    startTransition(async () => {
      const res = await saveRecipeAction({
        productId,
        yieldQuantity,
        notes: notes || undefined,
        items: filledItems,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Receta guardada. Costo unitario Q ${res.data.unitCost}`);
      if (editing) {
        onSaved?.();
      } else {
        resetForm();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Producto</Label>
        {editing ? (
          <p className="text-sm font-medium">{initialData?.productName}</p>
        ) : (
          <div ref={dropdownRef} className="relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) {
                    setProductId("");
                  }
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Buscar producto..."
              />
            </div>
            {showDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-[10px] border border-border bg-card shadow-lg">
                {filteredProducts.map((p) => {
                  const hasRecipe = productsWithRecipeIds?.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                        p.id === productId ? "bg-muted/60" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setProductId(p.id);
                        setSearchQuery(p.name);
                        setShowDropdown(false);
                      }}
                    >
                      <span>{p.name}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {hasRecipe && (
                          <Badge variant="warning" className="text-[10px]">
                            ya tiene receta
                          </Badge>
                        )}
                        {formatMoney(p.salePrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {showDropdown && searchQuery.trim() && !filteredProducts.length && (
              <div className="absolute z-10 mt-1 w-full rounded-[10px] border border-border bg-card p-3 text-sm text-muted-foreground shadow-lg">
                Sin resultados para &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>
        )}
        {productHasRecipe && !editing && (
          <p className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3 w-3" />
            Ya tiene receta activa. Se creará una nueva versión.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Rendimiento</Label>
        <Input
          type="number"
          min="0.001"
          step="0.001"
          value={yieldQuantity}
          onChange={(e) => setYieldQuantity(Number(e.target.value))}
        />
      </div>
      <div className="space-y-2">
        <Label>Ingredientes</Label>
        {items.map((item, idx) => {
          const detail = lineDetails[idx];
          return (
            <div
              key={idx}
              className={`space-y-2 rounded-[10px] border p-2.5 ${
                detail.hasZeroCost
                  ? "border-warning/40 bg-warning/5"
                  : "border-border"
              }`}
            >
              <div className="space-y-1">
                <Label htmlFor={detail.selectId}>Ingrediente</Label>
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <Select
                      id={detail.selectId}
                      value={item.ingredientId}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? { ...x, ingredientId: e.target.value }
                              : x,
                          ),
                        )
                      }
                      className="min-w-0 max-w-full truncate"
                    >
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    title="Eliminar ingrediente"
                    aria-label={`Eliminar ingrediente ${idx + 1}`}
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={detail.qtyId}>
                    Cantidad ({detail.unit})
                  </Label>
                  <Input
                    id={detail.qtyId}
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
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={detail.wasteId}>Merma</Label>
                  <Select
                    id={detail.wasteId}
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
                  >
                    {WASTE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-muted-foreground">
                    Costo promedio:
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatMoney(detail.averageCost)}/{detail.unit}
                  </span>
                </p>
                <p className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-muted-foreground">
                    Aporte por unidad producida:
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {detail.contribution ?? "—"}
                  </span>
                </p>
              </div>
              {detail.hasZeroCost && (
                <p className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Sin costo promedio registrado; el cálculo puede quedar
                    incompleto.{" "}
                    <a
                      href="/inventario"
                      className="underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40"
                    >
                      Revisar en Inventario
                    </a>
                  </span>
                </p>
              )}
              <div className="space-y-0.5">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
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
                  <span>No descontar del inventario</span>
                </label>
                <p className="pl-5 text-[11px] leading-snug text-muted-foreground">
                  Este ingrediente sí suma al costo, pero no genera salida de
                  inventario.
                </p>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setItems((prev) => [
              ...prev,
              {
                ingredientId: ingredients[0]?.id ?? "",
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
          placeholder="Ej: receta para porción individual"
          rows={2}
        />
      </div>
      {costSummary && (
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
            Calculado con el costo promedio actual de Inventario.
          </p>
        </div>
      )}
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
        {pending
          ? "Guardando..."
          : editing
            ? "Actualizar receta"
            : "Guardar receta"}
      </Button>
      {editing && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={onSaved}
        >
          Cancelar edición
        </Button>
      )}
    </div>
  );
}
