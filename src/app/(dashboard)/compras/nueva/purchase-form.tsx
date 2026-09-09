"use client";

import { useMemo, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, HelpCircle } from "lucide-react";
import {
  receivePurchaseAction,
  quickAddIngredientAction,
  quickAddCategoryAction,
} from "@/app/actions/operations";
import { saveSupplierAction, toggleIngredientActiveAction } from "@/app/actions/catalog";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
type PaymentStatus = "PAID" | "PENDING" | "PARTIAL";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatCost, formatMoney } from "@/lib/utils";

function LabelWithTooltip({
  label,
  tooltip,
  example,
}: {
  label: string;
  tooltip: string;
  example: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Label>{label}</Label>
      <Tooltip>
        <TooltipTrigger type="button" className="inline-flex items-center cursor-help">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <p>{tooltip}</p>
          <p className="mt-1 text-muted-foreground">Ej: {example}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

type Ingredient = {
  id: string;
  name: string;
  baseUnit: string;
  purchaseUnits: Array<{
    id: string;
    unitId: string;
    unitCode: string;
    conversionFactor: number;
  }>;
};

type Line = {
  ingredientId: string;
  purchaseUnitId: string;
  purchaseQuantity: number;
  unitPrice: number;
  lineTotal: number;
  expiresAt: string;
};

export function PurchaseForm({
  suppliers,
  ingredients,
  units,
  ingredientCategories,
  taxRate,
  lastUnitPrices,
}: {
  suppliers: Array<{ id: string; name: string }>;
  ingredients: Ingredient[];
  units: Array<{ id: string; code: string; name: string }>;
  ingredientCategories: Array<{ id: string; name: string }>;
  taxRate: number;
  lastUnitPrices: Record<string, number>;
}) {
  const router = useRouter();
  const usable = ingredients.filter((i) => i.purchaseUnits.length > 0);

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [documentNumber, setDocumentNumber] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("TRANSFER");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PAID");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>(() => {
    const first = usable[0];
    return first
      ? [
          {
          ingredientId: first.id,
          purchaseUnitId: first.purchaseUnits[0].id,
          purchaseQuantity: 1,
          unitPrice: 0,
          lineTotal: 0,
          expiresAt: "",
        }]
      : [];
  });
  const [pending, startTransition] = useTransition();

  const [newSupplierDialogOpen, setNewSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierTaxId, setNewSupplierTaxId] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [newIngredientDialogOpen, setNewIngredientDialogOpen] = useState(false);
  const [newIngSku, setNewIngSku] = useState("");
  const [newIngName, setNewIngName] = useState("");
  const [newIngBaseUnitId, setNewIngBaseUnitId] = useState(units[0]?.id ?? "");
  const [newIngCategoryId, setNewIngCategoryId] = useState("");
  const [newIngPurchaseUnitId, setNewIngPurchaseUnitId] = useState(
    units[0]?.id ?? "",
  );
  const [newIngConversionFactor, setNewIngConversionFactor] = useState(1);
  const [newIngUnitPrice, setNewIngUnitPrice] = useState(0);

  const [ingredientsList, setIngredientsList] = useState(ingredients);
  const [suppliersList, setSuppliersList] = useState(suppliers);
  const [categoriesList, setCategoriesList] = useState(ingredientCategories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  const taxMultiplier = 1 + taxRate / 100;

  const grossTotal = useMemo(
    () => lines.reduce((a, l) => a + (l.lineTotal || 0), 0),
    [lines],
  );

  const subtotal = useMemo(
    () => grossTotal / taxMultiplier,
    [grossTotal, taxMultiplier],
  );

  const taxTotal = useMemo(
    () => grossTotal - subtotal,
    [grossTotal, subtotal],
  );

  function addSupplier() {
    if (!newSupplierName.trim()) {
      toast.error("El nombre del proveedor es obligatorio");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", newSupplierName.trim());
      fd.set("taxId", newSupplierTaxId.trim());
      fd.set("phone", newSupplierPhone.trim());
      const res = await saveSupplierAction(null, fd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setSuppliersList((prev) => [
        ...prev,
        { id: res.data.id, name: res.data.name },
      ]);
      setSupplierId(res.data.id);
      setNewSupplierName("");
      setNewSupplierTaxId("");
      setNewSupplierPhone("");
      setNewSupplierDialogOpen(false);
      toast.success("Proveedor creado");
      router.refresh();
    });
  }

  const addIngredient = useCallback(() => {
    if (!newIngSku.trim() || !newIngName.trim()) {
      toast.error("SKU y nombre son obligatorios");
      return;
    }
    if (newIngConversionFactor <= 0) {
      toast.error("El factor de conversión debe ser mayor a 0");
      return;
    }
    startTransition(async () => {
      const res = await quickAddIngredientAction({
        sku: newIngSku.trim().toUpperCase(),
        name: newIngName.trim(),
        baseUnitId: newIngBaseUnitId,
        categoryId: newIngCategoryId || null,
        purchaseUnitId: newIngPurchaseUnitId,
        conversionFactor: newIngConversionFactor,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const newIngredient: Ingredient = {
        id: res.data.ingredientId,
        name: newIngName.trim(),
        baseUnit: units.find((u) => u.id === newIngBaseUnitId)?.code ?? "",
        purchaseUnits: [
          {
            id: res.data.purchaseUnitId,
            unitId: newIngPurchaseUnitId,
            unitCode:
              units.find((u) => u.id === newIngPurchaseUnitId)?.code ?? "",
            conversionFactor: newIngConversionFactor,
          },
        ],
      };
      setIngredientsList((prev) => [...prev, newIngredient]);
      setLines((prev) => [
        ...prev,
        {
          ingredientId: res.data.ingredientId,
          purchaseUnitId: res.data.purchaseUnitId,
          purchaseQuantity: 1,
          unitPrice: newIngUnitPrice,
          lineTotal: newIngUnitPrice,
          expiresAt: "",
        },
      ]);
      setNewIngSku("");
      setNewIngName("");
      setNewIngConversionFactor(1);
      setNewIngUnitPrice(0);
      setNewIngredientDialogOpen(false);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      toast.success("Ingrediente creado");
      router.refresh();
    });
  }, [
    newIngSku,
    newIngName,
    newIngBaseUnitId,
    newIngCategoryId,
    newIngPurchaseUnitId,
    newIngConversionFactor,
    units,
    router,
  ]);

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    const existing = categoriesList.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      toast.error(`Ya existe una categoría similar: "${existing.name}"`);
      setNewIngCategoryId(existing.id);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      return;
    }

    startTransition(async () => {
      const res = await quickAddCategoryAction({ name });
      if (!res.ok) {
        toast.error(res.message);
        const match = categoriesList.find(
          (c) => c.name.toLowerCase() === name.toLowerCase(),
        );
        if (match) setNewIngCategoryId(match.id);
        return;
      }
      setCategoriesList((prev) => [...prev, res.data]);
      setNewIngCategoryId(res.data.id);
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      toast.success("Categoría creada");
    });
  }, [newCategoryName, categoriesList]);

  const handleDeleteIngredient = useCallback(
    async (ingredientId: string, ingredientName: string) => {
      if (!confirm(`¿Desactivar "${ingredientName}"?`)) return;
      const fd = new FormData();
      fd.set("id", ingredientId);
      const res = await toggleIngredientActiveAction(null, fd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setIngredientsList((prev) =>
        prev.filter((i) => i.id !== ingredientId),
      );
      setLines((prev) =>
        prev.filter((l) => l.ingredientId !== ingredientId),
      );
      toast.success(`"${ingredientName}" desactivado`);
    },
    [],
  );

  function submit() {
    for (const line of lines) {
      if (line.lineTotal <= 0) {
        toast.error("El total de cada línea debe ser mayor a 0");
        return;
      }
      if (line.purchaseQuantity <= 0) {
        toast.error("La cantidad de cada línea debe ser mayor a 0");
        return;
      }
    }
    startTransition(async () => {
      const res = await receivePurchaseAction({
        supplierId,
        documentNumber,
        paymentMethod,
        paymentStatus,
        purchasedAt,
        taxTotal: 0,
        notes: notes || undefined,
        items: lines.map(({ expiresAt, unitPrice, ...rest }) => ({
          ...rest,
          unitPrice,
          expiresAt: expiresAt || null,
        })),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Compra recibida");
      router.push("/compras");
      router.refresh();
    });
  }

  const allIngredients = ingredientsList;
  const allUsable = allIngredients.filter((i) => i.purchaseUnits.length > 0);

  return (
    <TooltipProvider>
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <div className="flex gap-1.5">
              <Select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex-1"
              >
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => setNewSupplierDialogOpen(true)}
                title="Nuevo proveedor"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Documento</Label>
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="FAC-001"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <Select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
            >
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado de pago</Label>
            <Select
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(e.target.value as PaymentStatus)
              }
            >
              <option value="PAID">Pagado</option>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIAL">Parcial</option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Líneas</Label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setNewIngredientDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Nuevo ingrediente
            </Button>
          </div>
          <div className="hidden md:grid md:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.7fr_0.9fr_36px] md:gap-2 md:px-3">
            <span className="flex items-center gap-1 text-sm font-medium text-foreground">
              Ingrediente
              <Tooltip>
                <TooltipTrigger type="button" className="inline-flex items-center cursor-help">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px]">
                  <p>Selecciona el ingrediente que compraste.</p>
                  <p className="mt-1 text-muted-foreground">Ej: Matcha Premium, Fresa Extra, Leche Entera</p>
                </TooltipContent>
              </Tooltip>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-foreground">
              Unidad de compra
              <Tooltip>
                <TooltipTrigger type="button" className="inline-flex items-center cursor-help">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px]">
                  <p>Presentación en la que compras. El número (×N) indica a cuántas unidades base equivale.</p>
                  <p className="mt-1 text-muted-foreground">Ej: &ldquo;kg × 1000 g&rdquo; = 1 kg equivale a 1000 gramos</p>
                </TooltipContent>
              </Tooltip>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-foreground">
              Vencimiento
              <Tooltip>
                <TooltipTrigger type="button" className="inline-flex items-center cursor-help">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px]">
                  <p>Fecha de vencimiento del lote (opcional).</p>
                  <p className="mt-1 text-muted-foreground">Ej: 2026-12-31</p>
                </TooltipContent>
              </Tooltip>
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-foreground">
              Cantidad
              <Tooltip>
                <TooltipTrigger type="button" className="inline-flex items-center cursor-help">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px]">
                  <p>Cuántas unidades de compra recibiste. No confundas con el peso del paquete.</p>
                  <p className="mt-1 text-muted-foreground">Ej: 2 bolsas de 907g = cantidad 2, no 1.814</p>
                </TooltipContent>
              </Tooltip>
            </span>
            <span className="text-sm font-medium text-foreground">
              Precio unit.
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-foreground">
              Total línea (IVA incl.)
              <Tooltip>
                <TooltipTrigger type="button" className="inline-flex items-center cursor-help">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px]">
                  <p>Total de esta línea CON IVA, tal como aparece en tu factura. El sistema resta el IVA automáticamente para calcular el costo unitario.</p>
                  <p className="mt-1 text-muted-foreground">Ej: Si pagaste Q49.95 con IVA, el sistema usa Q44.60 sin IVA</p>
                </TooltipContent>
              </Tooltip>
            </span>
            <span />
          </div>

          {allUsable.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-muted p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No hay ingredientes disponibles para comprar</p>
              <p className="mt-1">
                {ingredientsList.length > 0
                  ? `Tienes ${ingredientsList.length} ingrediente(s) pero ninguno tiene unidad de compra definida. Edítalos desde Inventario para agregar una presentación de compra, o crea uno nuevo aquí.`
                  : "Aún no has creado ingredientes. Usa el botón \"Nuevo ingrediente\" para empezar."}
              </p>
            </div>
          ) : (
            <>
              {lines.map((line, idx) => {
                const ing =
                  allUsable.find((i) => i.id === line.ingredientId) ??
                  allUsable[0];
                return (
                  <div
                    key={idx}
                    className="grid gap-2 rounded-[10px] border border-border p-3 md:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.7fr_0.9fr_36px]"
                  >
                    <div className="flex items-center gap-1">
                      <Select
                        value={line.ingredientId}
                        onChange={(e) => {
                          const next = allUsable.find(
                            (i) => i.id === e.target.value,
                          )!;
                          const prevUnitPrice = lastUnitPrices[next.id] ?? 0;
                          setLines((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    ingredientId: next.id,
                                    purchaseUnitId: next.purchaseUnits[0].id,
                                    unitPrice: prevUnitPrice,
                                    lineTotal: prevUnitPrice * x.purchaseQuantity,
                                  }
                                : x,
                            ),
                          );
                        }}
                        className="flex-1 min-w-0"
                      >
                        {allUsable.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-error"
                        onClick={() =>
                          handleDeleteIngredient(
                            line.ingredientId,
                            allUsable.find((i) => i.id === line.ingredientId)
                              ?.name ?? "",
                          )
                        }
                        title="Desactivar ingrediente"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Select
                      value={line.purchaseUnitId}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? { ...x, purchaseUnitId: e.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      {ing.purchaseUnits.map((pu) => (
                        <option key={pu.id} value={pu.id}>
                          {pu.unitCode} × {pu.conversionFactor} {ing.baseUnit}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="date"
                      value={line.expiresAt}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? { ...x, expiresAt: e.target.value }
                              : x,
                          ),
                        )
                      }
                      placeholder="Vence"
                    />
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={line.purchaseQuantity}
                      onChange={(e) => {
                        const q = Number(e.target.value);
                        setLines((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? {
                                  ...x,
                                  purchaseQuantity: q,
                                  lineTotal: x.unitPrice > 0 ? x.unitPrice * q : x.lineTotal,
                                }
                              : x,
                          ),
                        );
                      }}
                      placeholder="Cant."
                    />
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => {
                        const up = Number(e.target.value);
                        setLines((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? { ...x, unitPrice: up, lineTotal: up * x.purchaseQuantity }
                              : x,
                          ),
                        );
                      }}
                      placeholder="Precio unit."
                    />
                    <div className="flex flex-col">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.lineTotal}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, lineTotal: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                        placeholder="Total línea"
                      />
                      {line.lineTotal > 0 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums leading-tight">
                          {formatMoney(line.lineTotal / taxMultiplier)} sin IVA
                        </span>
                      )}
                      {(() => {
                        const pu = ing.purchaseUnits.find((p) => p.id === line.purchaseUnitId);
                        if (!pu || line.lineTotal <= 0 || line.purchaseQuantity <= 0) return null;
                        const baseQty = line.purchaseQuantity * pu.conversionFactor;
                        const est = (line.lineTotal / taxMultiplier) / baseQty;
                        const suspicious = est > 100 || (est < 0.0001 && est > 0);
                        return (
                          <>
                            <span className="text-[10px] text-muted-foreground tabular-nums leading-tight">
                              ≈ {formatCost(est)} / {ing.baseUnit}
                            </span>
                            {suspicious ? (
                              <span className="text-[10px] text-warning tabular-nums leading-tight font-medium">
                                ⚠️ Este costo parece inusual. Revisa la cantidad o el factor de conversión.
                              </span>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const first = allUsable[0];
                  setLines((prev) => [
                    ...prev,
                    {
                      ingredientId: first.id,
                      purchaseUnitId: first.purchaseUnits[0].id,
                      purchaseQuantity: 1,
                      unitPrice: 0,
                      lineTotal: 0,
                      expiresAt: "",
                    },
                  ]);
                }}
              >
                <Plus className="h-4 w-4" />
                Línea
              </Button>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Notas</Label>
          <textarea
            className="flex min-h-[60px] w-full rounded-[10px] border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas opcionales sobre la compra..."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[10px] bg-muted p-3 text-sm">
            <p className="text-muted-foreground">Subtotal (sin IVA)</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(subtotal)}
            </p>
          </div>
          <div className="rounded-[10px] bg-muted p-3 text-sm">
            <p className="text-muted-foreground">IVA ({taxRate}%)</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(taxTotal)}
            </p>
          </div>
          <div className="rounded-[10px] bg-primary p-3 text-sm text-primary-foreground">
            <p className="text-white/70">Total (con IVA)</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(grossTotal)}
            </p>
          </div>
        </div>

        <Button onClick={submit} disabled={pending || !lines.length}>
          {pending ? "Guardando..." : "Confirmar recepción"}
        </Button>
      </CardContent>

      <Dialog open={newSupplierDialogOpen} onOpenChange={setNewSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
            <DialogDescription>
              Agrega un proveedor sin salir del formulario de compra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Distribuidora del Sur S.A."
              />
            </div>
            <div className="space-y-1.5">
              <Label>NIT (opcional)</Label>
              <Input
                value={newSupplierTaxId}
                onChange={(e) => setNewSupplierTaxId(e.target.value)}
                placeholder="12345678-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono (opcional)</Label>
              <Input
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="555-1234"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancelar</Button>
            </DialogClose>
            <Button onClick={addSupplier} disabled={pending}>
              {pending ? "Guardando..." : "Guardar proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newIngredientDialogOpen}
        onOpenChange={(open) => {
          setNewIngredientDialogOpen(open);
          if (open) {
            setShowNewCategoryInput(false);
            setNewCategoryName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Ingrediente</DialogTitle>
            <DialogDescription>
              Crea un ingrediente sin salir del formulario de compra.
            </DialogDescription>
          </DialogHeader>

          {units.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-muted p-4 text-center text-sm text-muted-foreground">
              No hay unidades de medida disponibles. Debes crear al menos una unidad antes de agregar ingredientes.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <LabelWithTooltip
                  label="SKU"
                  tooltip="Código único para identificar el ingrediente."
                  example="MAT-PRE-001"
                />
                <Input
                  value={newIngSku}
                  onChange={(e) => setNewIngSku(e.target.value)}
                  placeholder="MAT-PRE-001"
                />
              </div>
              <div className="space-y-1.5">
                <LabelWithTooltip
                  label="Nombre"
                  tooltip="Nombre descriptivo del ingrediente."
                  example="Matcha Premium Grado Ceremonial"
                />
                <Input
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  placeholder="Matcha Premium"
                />
              </div>
              <div className="space-y-1.5">
                <LabelWithTooltip
                  label="Unidad base"
                  tooltip="Unidad de medida base para inventario."
                  example="KG, L, Unidad"
                />
                <Select
                  value={newIngBaseUnitId}
                  onChange={(e) => setNewIngBaseUnitId(e.target.value)}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <LabelWithTooltip
                  label="Categoría"
                  tooltip="Categoría opcional del ingrediente."
                  example="Tés, Lácteos"
                />
                <Select
                  value={newIngCategoryId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__NEW__") {
                      setShowNewCategoryInput(true);
                      setNewIngCategoryId("");
                    } else {
                      setNewIngCategoryId(val);
                      setShowNewCategoryInput(false);
                      setNewCategoryName("");
                    }
                  }}
                >
                  <option value="">Sin categoría</option>
                  {categoriesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__NEW__">+ Nueva categoría...</option>
                </Select>
                {showNewCategoryInput && (
                  <div className="flex gap-1.5 pt-1">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nombre de la categoría"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateCategory();
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={handleCreateCategory}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <LabelWithTooltip
                  label="Unidad de compra"
                  tooltip="Unidad en la que compras este ingrediente."
                  example="KG"
                />
                <Select
                  value={newIngPurchaseUnitId}
                  onChange={(e) => setNewIngPurchaseUnitId(e.target.value)}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <LabelWithTooltip
                  label="Precio unit. (IVA incl.)"
                  tooltip="Precio por unidad de compra con IVA. Se usará como valor inicial en la línea de compra."
                  example="50.00"
                />
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={newIngUnitPrice}
                  onChange={(e) => setNewIngUnitPrice(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              {newIngBaseUnitId && newIngPurchaseUnitId && newIngBaseUnitId !== newIngPurchaseUnitId ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <LabelWithTooltip
                    label="Contenido del empaque"
                    tooltip="¿Cuántas unidades base tiene cada empaque? El factor de conversión se calcula automáticamente."
                    example='Si compras bolsas de 907g y tu unidad base es "g", escribe 907'
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      1 {units.find((u) => u.id === newIngPurchaseUnitId)?.code ?? "?"} =
                    </span>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={newIngConversionFactor}
                      onChange={(e) =>
                        setNewIngConversionFactor(Number(e.target.value))
                      }
                      placeholder="907"
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">
                      {units.find((u) => u.id === newIngBaseUnitId)?.code ?? "?"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (factor: {newIngConversionFactor})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Factor de conversión</Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={newIngConversionFactor}
                    onChange={(e) =>
                      setNewIngConversionFactor(Number(e.target.value))
                    }
                    placeholder="1"
                  />
                  {newIngBaseUnitId && newIngPurchaseUnitId && newIngBaseUnitId === newIngPurchaseUnitId ? (
                    <p className="text-xs text-muted-foreground">
                      Misma unidad que la base — 1:1
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancelar</Button>
            </DialogClose>
            <Button onClick={addIngredient} disabled={pending || units.length === 0}>
              {pending ? "Guardando..." : "Crear ingrediente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </TooltipProvider>
  );
}
