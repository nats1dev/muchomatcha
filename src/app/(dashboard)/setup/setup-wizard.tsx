"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Plus, Package } from "lucide-react";
import { saveIngredientAction } from "@/app/actions/catalog";
import { createInitialInventoryAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { formatCost } from "@/lib/utils";
import { CsvImportButton } from "@/components/csv-import-button";

const steps = [
  { id: 1, label: "Ingredientes" },
  { id: 2, label: "Presentaciones" },
  { id: 3, label: "Inventario inicial" },
];

type IngredientRow = {
  id: string;
  name: string;
  sku: string;
  baseUnitId: string;
  baseUnitCode: string;
  currentAverageCost: number;
  purchaseUnitId?: string;
  purchaseUnitCode?: string;
  conversionFactor?: number;
  initialQty?: number;
  initialCost?: number;
};

export function SetupWizard({
  initialIngredients,
  units,
}: {
  initialIngredients: IngredientRow[];
  units: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(initialIngredients.length > 0 ? 2 : 1);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initialIngredients.length > 0
      ? initialIngredients.map((i) => ({
          ...i,
          purchaseUnitId: i.baseUnitId,
          purchaseUnitCode: i.baseUnitCode,
          conversionFactor: 1,
          initialQty: 0,
          initialCost: 0,
        }))
      : [],
  );
  const [newIngName, setNewIngName] = useState("");

  // Step 1: create ingredients
  function addIngredient() {
    const name = newIngName.trim();
    if (!name) {
      toast.error("Escribe el nombre del ingrediente");
      return;
    }
    const sku = `ING-${name.toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "").slice(0, 20)}`;
    const baseUnitId = units[0]?.id ?? "";
    const baseUnitCode = units.find((u) => u.id === baseUnitId)?.code ?? "g";

    startTransition(async () => {
      const fd = new FormData();
      fd.set("sku", sku);
      fd.set("name", name);
      fd.set("baseUnitId", baseUnitId);
      fd.set("minimumStock", "0");
      const res = await saveIngredientAction(null, fd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setIngredients((prev) => [
        ...prev,
        {
          id: `new-${Date.now()}`,
          name,
          sku,
          baseUnitId,
          baseUnitCode,
          currentAverageCost: 0,
          purchaseUnitId: baseUnitId,
          purchaseUnitCode: baseUnitCode,
          conversionFactor: 1,
          initialQty: 0,
          initialCost: 0,
        },
      ]);
      setNewIngName("");
      toast.success(`"${name}" creado`);
    });
  }

  function updateIngredient(id: string, field: string, value: unknown) {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing)),
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step > s.id
                  ? "bg-success text-white"
                  : step === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            <span
              className={`text-sm ${step === s.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-6 ${
                  step > s.id ? "bg-success" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Step 1: Ingredients */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">¿Qué ingredientes usas?</h2>
                <p className="text-sm text-muted-foreground">
                  Agrega los insumos que compras para tu negocio. Luego definiremos cómo los compras.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  O importa desde un archivo CSV
                </p>
                <CsvImportButton />
              </div>

              <div className="flex gap-2">
                <Input
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  placeholder="Ej: Leche entera, Harina, Matcha..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addIngredient();
                    }
                  }}
                />
                <Button type="button" onClick={addIngredient} disabled={pending}>
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </div>

              {ingredients.length > 0 ? (
                <ul className="space-y-2">
                  {ingredients.map((ing) => (
                    <li
                      key={ing.id}
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{ing.name}</p>
                        <p className="text-xs text-muted-foreground">{ing.sku} · {ing.baseUnitCode}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No has agregado ingredientes aún.
                </p>
              )}
            </div>
          )}

          {/* Step 2: Purchase units */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Presentaciones de compra</h2>
                <p className="text-sm text-muted-foreground">
                  ¿En qué presentación compras cada ingrediente? Ej: bolsa de 907g, caja de 12 unidades, etc.
                </p>
              </div>

              <div className="space-y-3">
                {ingredients.map((ing) => (
                  <div key={ing.id} className="rounded-lg border border-border p-4">
                    <p className="mb-2 text-sm font-medium">{ing.name}</p>
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Unidad de compra</Label>
                        <Select
                          value={ing.purchaseUnitId ?? ing.baseUnitId}
                          onChange={(e) => {
                            const u = units.find((u) => u.id === e.target.value);
                            updateIngredient(ing.id, "purchaseUnitId", e.target.value);
                            updateIngredient(ing.id, "purchaseUnitCode", u?.code ?? ing.baseUnitCode);
                            if (e.target.value === ing.baseUnitId) {
                              updateIngredient(ing.id, "conversionFactor", 1);
                            }
                          }}
                        >
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.code} — {u.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {ing.purchaseUnitId && ing.purchaseUnitId !== ing.baseUnitId ? (
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">
                            1 {ing.purchaseUnitCode} = ? {ing.baseUnitCode}
                          </Label>
                          <Input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={ing.conversionFactor ?? ""}
                            onChange={(e) =>
                              updateIngredient(ing.id, "conversionFactor", Number(e.target.value))
                            }
                            placeholder="Ej: 907"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Factor</Label>
                          <div className="flex h-9 items-center rounded-[10px] border border-border px-3 text-sm text-muted-foreground">
                            1:1 — misma unidad
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Initial inventory */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Inventario inicial</h2>
                <p className="text-sm text-muted-foreground">
                  ¿Cuánto tienes en existencia de cada ingrediente y cuánto te costó?
                </p>
              </div>

              <div className="space-y-3">
                {ingredients.map((ing) => (
                  <div key={ing.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{ing.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({ing.baseUnitCode})
                      </span>
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Cantidad en existencia</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={ing.initialQty ?? ""}
                          onChange={(e) =>
                            updateIngredient(ing.id, "initialQty", Number(e.target.value))
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Costo total (Q)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ing.initialCost ?? ""}
                          onChange={(e) =>
                            updateIngredient(ing.id, "initialCost", Number(e.target.value))
                          }
                          placeholder="0.00"
                        />
                      </div>
                      {ing.initialQty && ing.initialCost && ing.initialQty > 0 ? (
                        <div className="text-xs text-muted-foreground tabular-nums pb-1">
                          ≈ {formatCost(ing.initialCost / ing.initialQty)} / {ing.baseUnitCode}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              {step > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {steps[step - 2].label}
                </Button>
              ) : (
                <span />
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/inventario")}
              >
                Saltar setup
              </Button>
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (step === 1 && ingredients.length === 0) {
                      toast.error("Agrega al menos un ingrediente");
                      return;
                    }
                    if (step === 2) {
                      const missing = ingredients.filter(
                        (ing) =>
                          ing.purchaseUnitId &&
                          ing.purchaseUnitId !== ing.baseUnitId &&
                          (!ing.conversionFactor || ing.conversionFactor <= 0),
                      );
                      if (missing.length > 0) {
                        toast.error(
                          `Completa el factor de conversión de: ${missing.map((m) => m.name).join(", ")}`,
                        );
                        return;
                      }
                    }
                    setStep((s) => s + 1);
                  }}
                >
                  {steps[step].label}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const items = ingredients.filter(
                      (ing) => ing.initialQty && ing.initialQty > 0,
                    );
                    if (items.length === 0) {
                      toast.error("Ingresa al menos un ingrediente con cantidad > 0");
                      return;
                    }
                    startTransition(async () => {
                      const res = await createInitialInventoryAction({
                        items: items.map((ing) => ({
                          ingredientId: ing.id,
                          quantity: ing.initialQty!,
                          unitCost: ing.initialQty! > 0
                            ? (ing.initialCost ?? 0) / ing.initialQty!
                            : 0,
                        })),
                      });
                      if (!res.ok) {
                        toast.error(res.message);
                        return;
                      }
                      toast.success(`Inventario inicial registrado (${items.length} ingredientes)`);
                      router.push("/inventario");
                      router.refresh();
                    });
                  }}
                >
                  {pending ? "Guardando..." : "Finalizar setup"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
