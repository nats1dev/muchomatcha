"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { createSaleAction, createDraftSaleAction } from "@/app/actions/operations";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useNumberFormatter } from "@/components/number-format-provider";

type Product = {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  category: string;
  hasRecipe: boolean;
  unitCost: number | null;
};

type Line = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  hasRecipe: boolean;
  unitCost: number | null;
};

export function SaleForm({
  products,
  taxRate,
  cashOpen,
}: {
  products: Product[];
  taxRate: number;
  cashOpen: boolean;
}) {
  const { formatMoney } = useNumberFormatter();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    cashOpen ? "CASH" : "CARD",
  );
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 12);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [products, query]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (acc, l) => acc + l.unitPrice * l.quantity,
      0,
    );
    const tax = subtotal * (taxRate / 100);
    return {
      subtotal,
      tax,
      total: subtotal + tax,
    };
  }, [lines, taxRate]);

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unitPrice: p.salePrice,
          quantity: 1,
          hasRecipe: p.hasRecipe,
          unitCost: p.unitCost,
        },
      ];
    });
    setQuery("");
    searchRef.current?.focus();
  }

  function updateQty(productId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.max(0, l.quantity + delta) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  function submit() {
    if (!lines.length) {
      toast.error("Agrega al menos un producto");
      return;
    }
    startTransition(async () => {
      const res = await createSaleAction({
        paymentMethod,
        notes,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (res.data.warnings.length) {
        toast.warning(res.data.warnings.join(" · "));
      }
      toast.success(`Venta #${res.data.saleNumber} registrada`);
      router.push(`/ventas/${res.data.saleId}`);
      router.refresh();
    });
  }

  function handleDraft() {
    if (!lines.length) {
      toast.error("Agrega al menos un producto");
      return;
    }
    startTransition(async () => {
      const res = await createDraftSaleAction({
        notes,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Borrador D-${res.data.saleNumber} guardado`);
      router.push("/ventas");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <Label htmlFor="search">Buscar producto</Label>
            <Input
              ref={searchRef}
              id="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered[0]) {
                  e.preventDefault();
                  addProduct(filtered[0]);
                }
              }}
              placeholder="Nombre, SKU o categoría — Enter para agregar"
              className="mt-1.5"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="rounded-[10px] border border-border bg-card px-3 py-3 text-left hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sku} · {p.category}
                      {!p.hasRecipe ? " · sin receta" : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatMoney(p.salePrice)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardContent className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Ticket</h2>
          {!lines.length ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay productos en la venta.
            </p>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => (
                <li
                  key={l.productId}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatMoney(l.unitPrice)}
                      {l.unitCost && l.unitCost > 0
                        ? ` · ${((l.unitPrice - l.unitCost) / l.unitPrice * 100).toFixed(0)}% margen`
                        : l.hasRecipe
                          ? ""
                          : " · sin receta"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={() => updateQty(l.productId, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-sm tabular-nums">
                      {l.quantity}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={() => updateQty(l.productId, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setLines((prev) =>
                          prev.filter((x) => x.productId !== l.productId),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal (sin IVA)</span>
              <span className="tabular-nums">
                {formatMoney(totals.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA {taxRate}%</span>
              <span className="tabular-nums">{formatMoney(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(totals.total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment">Método de pago</Label>
            <Select
              id="payment"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
            >
              <option value="CASH" disabled={!cashOpen}>
                Efectivo {!cashOpen ? "(caja cerrada)" : ""}
              </option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={submit}
              disabled={pending || !lines.length}
            >
              {pending ? "Guardando..." : "Confirmar venta"}
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={handleDraft}
              disabled={pending || !lines.length}
            >
              {pending ? "Guardando..." : "Guardar borrador"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
