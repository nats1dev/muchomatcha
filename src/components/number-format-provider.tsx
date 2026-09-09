"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_NUMBER_SETTINGS,
  formatDisplayCost,
  formatDisplayMoney,
  formatDisplayQuantity,
  type NumberDisplaySettings,
} from "@/lib/number-format";

const NumberFormatContext = createContext(DEFAULT_NUMBER_SETTINGS);

export function NumberFormatProvider({
  settings,
  children,
}: {
  settings: NumberDisplaySettings;
  children: React.ReactNode;
}) {
  return (
    <NumberFormatContext.Provider value={settings}>
      <div lang={settings.numberFormat === "EU" ? "es" : "en-US"} className="contents">
        {children}
      </div>
    </NumberFormatContext.Provider>
  );
}

export function useNumberFormat() {
  return useContext(NumberFormatContext);
}

export function useNumberFormatter() {
  const settings = useNumberFormat();
  return {
    formatMoney: (value: number | string, currency = "GTQ") => formatDisplayMoney(value, currency, settings),
    formatCost: (value: number | string, currency = "GTQ") => formatDisplayCost(value, currency, settings),
    formatQty: (value: number | string, decimals?: number) => formatDisplayQuantity(value, settings, decimals),
  };
}
