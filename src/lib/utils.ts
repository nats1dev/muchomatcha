import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string, currency = "GTQ") {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatCost(value: number | string, currency = "GTQ") {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatQty(value: number | string, decimals = 3) {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0);
}
