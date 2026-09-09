"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Coffee,
  BookOpen,
  FlaskConical,
  Package,
  Truck,
  Wallet,
  Landmark,
  FileBarChart,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ROLE_RANK, type RoleName } from "@/lib/auth/roles";

// `minRole` solo decide que se muestra. El permiso real lo aplica cada Server
// Action con requireRole: ocultar un enlace no impide invocar la accion.
const nav = [
  { href: "/resumen", label: "Resumen", icon: LayoutDashboard, minRole: "VIEWER" },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart, minRole: "VIEWER" },
  { href: "/productos", label: "Productos", icon: Coffee, minRole: "VIEWER" },
  { href: "/recetas", label: "Recetas", icon: BookOpen, minRole: "VIEWER" },
  { href: "/produccion", label: "Producción", icon: FlaskConical, minRole: "CASHIER" },
  { href: "/inventario", label: "Inventario", icon: Package, minRole: "VIEWER" },
  { href: "/compras", label: "Compras", icon: Truck, minRole: "VIEWER" },
  { href: "/gastos", label: "Gastos", icon: Wallet, minRole: "VIEWER" },
  { href: "/caja", label: "Caja", icon: Landmark, minRole: "CASHIER" },
  { href: "/reportes", label: "Reportes", icon: FileBarChart, minRole: "VIEWER" },
  { href: "/configuracion", label: "Configuración", icon: Settings, minRole: "ADMIN" },
] satisfies Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  minRole: RoleName;
}>;

export function Sidebar({ role }: { role: RoleName }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNav = nav.filter(
    (item) => ROLE_RANK[role] >= ROLE_RANK[item.minRole],
  );

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Café Control
          </p>
          <p className="mt-1 text-lg font-semibold">Mucho Matcha</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className="fixed left-4 top-4 z-40 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        {content}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/30"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card shadow-xl">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}
