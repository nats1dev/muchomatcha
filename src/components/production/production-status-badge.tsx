import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "warning" | "success" | "error" | "info" }> = {
  DRAFT: { label: "Borrador", variant: "warning" },
  IN_PROGRESS: { label: "En progreso", variant: "info" },
  COMPLETED: { label: "Completada", variant: "success" },
  CANCELLED: { label: "Cancelada", variant: "error" },
};

export function ProductionStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
