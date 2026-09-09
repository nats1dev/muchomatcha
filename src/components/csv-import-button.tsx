"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmCsvAction, previewCsvAction } from "@/app/actions/importer";
import type { ImportPreview } from "@/lib/import-troubleshooting";
import { ImportPreviewDialog } from "@/components/import-preview-dialog";

export function CsvImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analyzing, startAnalyzing] = useTransition();
  const [confirming, startConfirming] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    if (inputRef.current) inputRef.current.value = "";
    if (!selected) return;
    // El archivo queda en memoria para el paso 2; el servidor revalida al confirmar.
    setFile(selected);
    startAnalyzing(async () => {
      const fd = new FormData();
      fd.set("file", selected);
      const res = await previewCsvAction(null, fd);
      if (!res.ok) {
        toast.error(res.message);
        setFile(null);
        return;
      }
      setPreview(res.data);
      setDialogOpen(true);
    });
  }

  function handleCancel() {
    // Cancelar = descartar el análisis. Nada se escribió: preview no guarda.
    setDialogOpen(false);
    setFile(null);
    setPreview(null);
  }

  function handleConfirm() {
    if (!file) return;
    startConfirming(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await confirmCsvAction(null, fd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.data.summary);
      if (res.data?.errors.length) {
        toast.error(res.data.errors.join("\n"), { duration: 8000 });
      }
      setDialogOpen(false);
      setFile(null);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={analyzing}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 h-4 w-4" />
        {analyzing ? "Analizando..." : "Importar CSV"}
      </Button>
      <ImportPreviewDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
        preview={preview}
        confirming={confirming}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </>
  );
}
