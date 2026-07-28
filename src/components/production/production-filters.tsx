"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProductionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(formData: FormData) {
    const params = new URLSearchParams();
    const status = formData.get("status");
    if (status) params.set("status", String(status));
    router.push(`/produccion?${params.toString()}`);
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap gap-2">
      <select
        name="status"
        defaultValue={searchParams.get("status") ?? ""}
        className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm text-foreground"
      >
        <option value="">Todos los estados</option>
        <option value="DRAFT">Borrador</option>
        <option value="COMPLETED">Completada</option>
        <option value="CANCELLED">Cancelada</option>
      </select>
      <Button type="submit" variant="secondary" size="sm">
        Filtrar
      </Button>
    </form>
  );
}
