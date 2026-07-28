"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/dates";
import { formatCost, formatQty } from "@/lib/utils";
import {
  startProductionOrderAction,
  completeProductionOrderAction,
  cancelProductionOrderAction,
} from "@/app/actions/production";

type Detail = {
  order: {
    id: string;
    orderNumber: number;
    quantity: string;
    actualQuantity: string | null;
    unitCost: string;
    totalCost: string;
    estimatedUnitCost: string | null;
    estimatedTotalCost: string | null;
    status: string;
    notes: string | null;
    occurredAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    ingredient: { name: string; sku: string; baseUnit: { code: string; name: string } };
    recipe: {
      yieldQuantity: string;
      items: Array<{
        quantity: string;
        wastePercentage: string;
        ingredient: { name: string; sku: string; currentAverageCost: string; baseUnit: { code: string } };
      }>;
    };
    user: { name: string };
    startedBy: { name: string } | null;
    completedBy: { name: string } | null;
  };
  movements: Array<{
    id: string;
    movementType: string;
    quantityDelta: string;
    unitCost: string;
    occurredAt: Date;
    ingredient: { name: string; sku: string };
  }>;
};

export function ProductionDetailCard({ detail }: { detail: Detail }) {
  const router = useRouter();
  const order = detail.order;
  const [showComplete, setShowComplete] = useState(false);
  const [actualQty, setActualQty] = useState(Number(order.quantity));
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (!confirm("¿Iniciar esta producción?")) return;
    setStarting(true);
    const result = await startProductionOrderAction(order.id);
    setStarting(false);
    if (!result.ok) {
      alert(result.message);
      return;
    }
    router.refresh();
  }

  async function handleComplete() {
    if (actualQty <= 0) {
      alert("El rendimiento real debe ser mayor a 0");
      return;
    }
    setCompleting(true);
    const actual = actualQty !== Number(order.quantity) ? actualQty : undefined;
    const result = await completeProductionOrderAction(order.id, actual);
    setCompleting(false);
    if (!result.ok) {
      alert(result.message);
      return;
    }
    setShowComplete(false);
    router.refresh();
  }

  async function handleCancel() {
    const reason = prompt("Motivo de cancelación:");
    if (!reason?.trim()) return;
    const result = await cancelProductionOrderAction(order.id, reason.trim());
    if (!result.ok) {
      alert(result.message);
      return;
    }
    router.refresh();
  }

  const isDraft = order.status === "DRAFT";
  const isInProgress = order.status === "IN_PROGRESS";
  const isCompleted = order.status === "COMPLETED";
  const isCancelled = order.status === "CANCELLED";
  const hasYieldVariance = isCompleted && order.actualQuantity != null && Number(order.actualQuantity) !== Number(order.quantity);
  const hasCostVariance = isCompleted && order.estimatedUnitCost != null && Number(order.estimatedUnitCost) > 0;
  const yieldPct = hasYieldVariance
    ? ((Number(order.actualQuantity!) - Number(order.quantity)) / Number(order.quantity)) * 100
    : 0;
  const costVariancePct = hasCostVariance
    ? ((Number(order.unitCost) - Number(order.estimatedUnitCost!)) / Number(order.estimatedUnitCost!)) * 100
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                Orden de Producción #{order.orderNumber}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.ingredient.name} ({order.ingredient.sku})
              </p>
            </div>
            <Badge
              variant={
                isCompleted ? "success" : isCancelled ? "error" : isInProgress ? "info" : "warning"
              }
            >
              {isCompleted ? "Completada" : isCancelled ? "Cancelada" : isInProgress ? "En progreso" : "Borrador"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Cantidad
              </span>
              <p className="mt-1 font-medium">
                {isCompleted && order.actualQuantity
                  ? `${formatQty(order.actualQuantity)} ${order.ingredient.baseUnit.code}`
                  : `${formatQty(order.quantity)} ${order.ingredient.baseUnit.code}`}
              </p>
              {hasYieldVariance ? (
                <p className="text-xs text-muted-foreground">
                  Plan: {formatQty(order.quantity)} {order.ingredient.baseUnit.code}
                  <span className={yieldPct < 0 ? "ml-1 text-error" : "ml-1 text-success"}>
                    ({yieldPct > 0 ? "+" : ""}{yieldPct.toFixed(1)}%)
                  </span>
                </p>
              ) : null}
            </div>
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Costo Unitario
              </span>
              <p className="mt-1 font-medium">{formatCost(order.unitCost)}</p>
              {hasCostVariance ? (
                <p className="text-xs text-muted-foreground">
                  Est: {formatCost(order.estimatedUnitCost!)}
                  <span className={costVariancePct > 0 ? "ml-1 text-error" : "ml-1 text-success"}>
                    ({costVariancePct > 0 ? "+" : ""}{costVariancePct.toFixed(1)}%)
                  </span>
                </p>
              ) : null}
            </div>
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Costo Total
              </span>
              <p className="mt-1 font-medium">{formatCost(order.totalCost)}</p>
              {order.estimatedTotalCost ? (
                <p className="text-xs text-muted-foreground">
                  Est: {formatCost(order.estimatedTotalCost)}
                </p>
              ) : null}
            </div>
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Creada por
              </span>
              <p className="mt-1">{order.user.name}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Creada
              </span>
              <p className="mt-1">{formatDateTime(order.occurredAt)}</p>
            </div>
            {order.startedAt ? (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  Iniciada
                </span>
                <p className="mt-1">
                  {formatDateTime(order.startedAt)}
                  {order.startedBy ? ` por ${order.startedBy.name}` : ""}
                </p>
              </div>
            ) : null}
            {order.completedAt ? (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  Completada
                </span>
                <p className="mt-1">
                  {formatDateTime(order.completedAt)}
                  {order.completedBy ? ` por ${order.completedBy.name}` : ""}
                </p>
              </div>
            ) : null}
            {order.cancelledAt ? (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  Cancelada
                </span>
                <p className="mt-1">{formatDateTime(order.cancelledAt)}</p>
              </div>
            ) : null}
          </div>
          {order.notes ? (
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Notas
              </span>
              <p className="mt-1">{order.notes}</p>
            </div>
          ) : null}
          {order.cancelReason ? (
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Motivo de cancelación
              </span>
              <p className="mt-1 text-error">{order.cancelReason}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ingredientes Consumidos</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="pb-2">Ingrediente</th>
                <th className="pb-2">Cantidad</th>
                <th className="pb-2">% Merma</th>
                <th className="pb-2">Costo Unit.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.recipe.items.map((item, i) => {
                const yieldQty = Number(order.recipe.yieldQuantity);
                const itemQty = Number(item.quantity);
                const waste = Number(item.wastePercentage);
                const effectivePerUnit = yieldQty > 0
                  ? (itemQty * (1 + waste / 100)) / yieldQty
                  : 0;
                const totalNeeded = effectivePerUnit * Number(order.quantity);
                return (
                  <tr key={i}>
                    <td className="py-2">{item.ingredient.name}</td>
                    <td className="py-2">
                      {formatQty(totalNeeded)} {item.ingredient.baseUnit.code}
                    </td>
                    <td className="py-2">{Number(item.wastePercentage) > 0 ? `${item.wastePercentage}%` : "—"}</td>
                    <td className="py-2">
                      {formatCost(item.ingredient.currentAverageCost)} / {item.ingredient.baseUnit.code}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {detail.movements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Movimientos de Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="pb-2">Ingrediente</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Cantidad</th>
                  <th className="pb-2">Costo</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.movements.map((mov) => (
                  <tr key={mov.id}>
                    <td className="py-2">{mov.ingredient.name}</td>
                    <td className="py-2">
                      <Badge
                        variant={
                          mov.movementType === "PRODUCTION_IN"
                            ? "success"
                            : mov.movementType === "PRODUCTION_OUT"
                              ? "warning"
                              : "default"
                        }
                      >
                        {mov.movementType === "PRODUCTION_IN"
                          ? "Entrada"
                          : mov.movementType === "PRODUCTION_OUT"
                            ? "Salida"
                            : mov.movementType}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <span
                        className={
                          Number(mov.quantityDelta) >= 0
                            ? "text-success"
                            : "text-error"
                        }
                      >
                        {Number(mov.quantityDelta) >= 0 ? "+" : ""}
                        {formatQty(mov.quantityDelta)}
                      </span>
                    </td>
                    <td className="py-2">{formatCost(mov.unitCost)}</td>
                    <td className="py-2 text-muted-foreground">
                      {formatDateTime(mov.occurredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {isDraft ? (
        <div className="flex gap-3">
          <Button onClick={handleStart} disabled={starting}>
            {starting ? "Iniciando..." : "Iniciar Producción"}
          </Button>
          <Button variant="danger" onClick={handleCancel}>
            Cancelar Orden
          </Button>
        </div>
      ) : null}

      {isInProgress ? (
        <div>
          {!showComplete ? (
            <div className="flex gap-3">
              <Button onClick={() => { setActualQty(Number(order.quantity)); setShowComplete(true); }}>
                Completar Producción
              </Button>
              <Button variant="danger" onClick={handleCancel}>
                Cancelar Orden
              </Button>
            </div>
          ) : (
            <div className="rounded-[12px] border border-border p-4 space-y-3">
              <div>
                <h3 className="font-semibold">Completar producción</h3>
                <p className="text-sm text-muted-foreground">
                  Si el rendimiento real fue diferente al planificado, ajústalo aquí.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Rendimiento real ({order.ingredient.baseUnit.code})</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={actualQty}
                    onChange={(e) => setActualQty(Number(e.target.value))}
                    placeholder={order.quantity}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => setActualQty(Number(order.quantity))}
                  >
                    Igual al plan
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Planificado: {formatQty(order.quantity)} {order.ingredient.baseUnit.code}
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleComplete} disabled={completing}>
                  {completing ? "Completando..." : "Confirmar"}
                </Button>
                <Button variant="ghost" onClick={() => setShowComplete(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
