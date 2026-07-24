"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { voidPurchaseAction } from "@/app/actions/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VoidPurchaseButton({
  purchaseId,
}: {
  purchaseId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleVoid() {
    startTransition(async () => {
      const res = await voidPurchaseAction({ purchaseId, reason: reason || undefined });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Compra anulada");
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-error"
        onClick={() => setOpen(true)}
        title="Anular compra"
      >
        <Ban className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-[10px] border border-border bg-card p-5 shadow-xl">
        <Label>Motivo de anulación</Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Opcional"
          className="mt-1.5"
        />
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={handleVoid}
          >
            {pending ? "Anulando..." : "Anular compra"}
          </Button>
        </div>
      </div>
    </div>
  );
}
