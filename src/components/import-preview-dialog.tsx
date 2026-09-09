"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportPreview, PreviewRow } from "@/lib/import-troubleshooting";

/** Tope visual: el plan completo sigue valiendo para confirmar. */
const MAX_SHOWN_ROWS = 100;

function StatusBadge({ status }: { status: PreviewRow["status"] }) {
  if (status === "error") return <Badge variant="error">Error</Badge>;
  if (status === "warning") return <Badge variant="warning">Aviso</Badge>;
  return <Badge variant="info">Info</Badge>;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ImportPreview | null;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ImportPreviewDialog({
  open,
  onOpenChange,
  preview,
  confirming,
  onCancel,
  onConfirm,
}: Props) {
  const issueCount = preview?.rows.length ?? 0;
  const validCount = preview?.validCount ?? 0;
  const shown = preview?.rows.slice(0, MAX_SHOWN_ROWS) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Revisar importación{preview ? ` — ${preview.fileName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Nada se ha guardado todavía. Corrige el archivo y vuelve a subirlo,
            cancela todo, o importa solo las filas válidas.
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{validCount} válidas</Badge>
              <Badge variant="error">{issueCount} con problema</Badge>
              {preview.newCategories.length > 0 && (
                <Badge variant="info">
                  Se crearán {preview.newCategories.length} categorías:{" "}
                  {preview.newCategories.join(", ")}
                </Badge>
              )}
              {preview.updatedRecipes.length > 0 && (
                <Badge variant="info">
                  Se actualizarán a nueva versión: {preview.updatedRecipes.join(", ")}
                </Badge>
              )}
            </div>

            {issueCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todo listo: las {validCount} filas se importarán al confirmar.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-3 text-left font-medium">Registro</th>
                        <th className="px-4 py-3 text-left font-medium">Estado</th>
                        <th className="px-4 py-3 text-left font-medium">Motivo</th>
                        <th className="px-4 py-3 text-left font-medium">Cómo solucionarlo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((row, i) => (
                        <tr key={`${row.line}-${i}`} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-mono text-xs tabular-nums">
                            {row.label}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-2.5">{row.reason}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{row.fix}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {issueCount > MAX_SHOWN_ROWS && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando las primeras {MAX_SHOWN_ROWS} de {issueCount}. Al
                    confirmar se omiten todas.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={confirming}>
            Cancelar todo
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={confirming || !preview || validCount === 0}
          >
            {confirming
              ? "Importando..."
              : `Importar ${validCount} (omitir ${issueCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
