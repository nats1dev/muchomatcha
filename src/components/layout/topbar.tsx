"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { signOut } from "next-auth/react";

export function Topbar({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = searchParams.get("period") ?? "today";
  const q = searchParams.get("q") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex flex-1 items-center gap-2 pl-12 lg:pl-0">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar..."
              defaultValue={q}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setParam("q", (e.target as HTMLInputElement).value);
                }
              }}
            />
          </div>
          <Select
            className="w-[140px]"
            value={period}
            onChange={(e) => setParam("period", e.target.value)}
            aria-label="Período"
          >
            <option value="today">Hoy</option>
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
            <option value="month">Mes</option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/ventas/nueva">
              <Plus className="h-4 w-4" />
              Registrar venta
            </Link>
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-sm text-muted-foreground">
              {userName ?? "Propietario"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Salir
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
