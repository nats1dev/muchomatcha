import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatDisplayCost,
  formatDisplayMoney,
  formatDisplayQuantity,
  type NumberDisplaySettings,
} from "@/lib/number-format";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string, currency = "GTQ", settings?: NumberDisplaySettings) {
  return formatDisplayMoney(value, currency, settings);
}

export function formatCost(value: number | string, currency = "GTQ", settings?: NumberDisplaySettings) {
  return formatDisplayCost(value, currency, settings);
}

export function formatQty(value: number | string, decimals?: number, settings?: NumberDisplaySettings) {
  return formatDisplayQuantity(value, settings, decimals);
}
