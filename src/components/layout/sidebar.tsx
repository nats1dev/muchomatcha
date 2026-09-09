"use client";

import Image from "next/image";
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

// `minRole` only controls visibility. Server actions enforce real permissions.
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  minRole: RoleName;
};

const navGroups = [
  {
    id: "operations",
    label: "Operaci\u00f3n diaria",
    items: [
      { href: "/resumen", label: "Resumen", icon: LayoutDashboard, minRole: "VIEWER" },
      { href: "/ventas", label: "Ventas", icon: ShoppingCart, minRole: "VIEWER" },
      { href: "/caja", label: "Caja", icon: Landmark, minRole: "CASHIER" },
    ],
  },
  {
    id: "production",
    label: "Producci\u00f3n e inventario",
    items: [
      { href: "/produccion", label: "Producci\u00f3n", icon: FlaskConical, minRole: "CASHIER" },
      { href: "/recetas", label: "Recetas", icon: BookOpen, minRole: "VIEWER" },
      { href: "/inventario", label: "Inventario", icon: Package, minRole: "VIEWER" },
      { href: "/compras", label: "Compras", icon: Truck, minRole: "VIEWER" },
    ],
  },
  {
    id: "administration",
    label: "Administraci\u00f3n",
    items: [
      { href: "/productos", label: "Productos", icon: Coffee, minRole: "VIEWER" },
      { href: "/gastos", label: "Gastos", icon: Wallet, minRole: "VIEWER" },
      { href: "/reportes", label: "Reportes", icon: FileBarChart, minRole: "VIEWER" },
      { href: "/configuracion", label: "Configuraci\u00f3n", icon: Settings, minRole: "ADMIN" },
    ],
  },
] satisfies Array<{ id: string; label: string; items: NavItem[] }>;

export function Sidebar({ role }: { role: RoleName }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => ROLE_RANK[role] >= ROLE_RANK[item.minRole],
      ),
    }))
    .filter((group) => group.items.length > 0);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-5">
        <Image
          src="/logo-oficial.png"
          alt="Mucho Matcha — Ceremonial Tea House"
          width={190}
          height={69}
          priority
          className="h-auto w-[190px] object-contain"
        />
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen(false)}
          aria-label={"Cerrar men\u00fa"}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto p-3" aria-label={"Navegaci\u00f3n principal"}>
        {visibleGroups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`nav-group-${group.id}`}
            className="rounded-2xl border border-border bg-muted/25 p-1.5"
          >
            <h2
              id={`nav-group-${group.id}`}
              className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground"
            >
              {group.label}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
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
        aria-label={"Abrir men\u00fa"}
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
