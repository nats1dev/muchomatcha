"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { receivePurchaseAction } from "@/app/actions/operations";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

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
  lineTotal: number;
};

export function PurchaseForm({
  suppliers,
  ingredients,
}: {
  suppliers: Array<{ id: string; name: string }>;
  ingredients: Ingredient[];
}) {
  const router = useRouter();
  const usable = ingredients.filter((i) => i.purchaseUnits.length > 0);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [documentNumber, setDocumentNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("TRANSFER");
  const [taxTotal, setTaxTotal] = useState(0);
  const [lines, setLines] = useState<Line[]>(() => {
    const first = usable[0];
    return first
      ? [
          {
            ingredientId: first.id,
            purchaseUnitId: first.purchaseUnits[0].id,
            purchaseQuantity: 1,
            lineTotal: 0,
          },
        ]
      : [];
  });
  const [pending, startTransition] = useTransition();

  const subtotal = useMemo(
    () => lines.reduce((a, l) => a + (l.lineTotal || 0), 0),
    [lines],
  );

  function submit() {
    startTransition(async () => {
      const res = await receivePurchaseAction({
        supplierId,
        documentNumber,
        paymentMethod,
        taxTotal,
        items: lines,
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

  if (!usable.length) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          No hay ingredientes con unidad de compra configurada. Ejecuta el seed
          o agrega conversiones en configuración.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
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
            <Label>Pago</Label>
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
        </div>

        <div className="space-y-2">
          <Label>Líneas</Label>
          {lines.map((line, idx) => {
            const ing =
              usable.find((i) => i.id === line.ingredientId) ?? usable[0];
            return (
              <div
                key={idx}
                className="grid gap-2 rounded-[10px] border border-border p-3 md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_36px]"
              >
                <Select
                  value={line.ingredientId}
                  onChange={(e) => {
                    const next = usable.find((i) => i.id === e.target.value)!;
                    setLines((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              ingredientId: next.id,
                              purchaseUnitId: next.purchaseUnits[0].id,
                            }
                          : x,
                      ),
                    );
                  }}
                >
                  {usable.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
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
                      {pu.unitCode} (×{pu.conversionFactor})
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.purchaseQuantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              purchaseQuantity: Number(e.target.value),
                            }
                          : x,
                      ),
                    )
                  }
                  placeholder="Cant."
                />
                <Input
                  type="number"
                  min="0"
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
              const first = usable[0];
              setLines((prev) => [
                ...prev,
                {
                  ingredientId: first.id,
                  purchaseUnitId: first.purchaseUnits[0].id,
                  purchaseQuantity: 1,
                  lineTotal: 0,
                },
              ]);
            }}
          >
            <Plus className="h-4 w-4" />
            Línea
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>IVA compra</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={taxTotal}
              onChange={(e) => setTaxTotal(Number(e.target.value))}
            />
          </div>
          <div className="rounded-[10px] bg-muted p-3 text-sm">
            <p className="text-muted-foreground">Subtotal</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(subtotal)}
            </p>
          </div>
          <div className="rounded-[10px] bg-primary p-3 text-sm text-primary-foreground">
            <p className="text-white/70">Total</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(subtotal + taxTotal)}
            </p>
          </div>
        </div>

        <Button onClick={submit} disabled={pending || !lines.length}>
          {pending ? "Guardando..." : "Confirmar recepción"}
        </Button>
      </CardContent>
    </Card>
  );
}
