"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importCsvAction } from "@/app/actions/importer";

export function CsvImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await importCsvAction(null, fd);
      if (!res.ok) {
        toast.error(res.message);
      } else {
        toast.success(res.message);
        if (res.data?.errors.length) {
          toast.error(res.data.errors.join("\n"), { duration: 8000 });
        }
      }
      if (inputRef.current) inputRef.current.value = "";
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
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 h-4 w-4" />
        {pending ? "Importando..." : "Importar CSV"}
      </Button>
    </>
  );
}
