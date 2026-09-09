"use client";

import * as React from "react";
import { useNumberFormat } from "@/components/number-format-provider";
import { canonicalLocalizedNumber, formatNumber } from "@/lib/number-format";
import { Input } from "@/components/ui/input";

export const LocalizedNumberInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    decimals?: number;
  }
>(({ name, defaultValue, decimals, onBlur, onChange, ...props }, ref) => {
  const settings = useNumberFormat();
  const visibleName = name ? `${name}__localized` : undefined;
  const hiddenRef = React.useRef<HTMLInputElement>(null);
  const places = decimals ?? settings.quantityDecimals;

  return (
    <>
      <Input
        {...props}
        ref={ref}
        name={visibleName}
        type="text"
        inputMode="decimal"
        defaultValue={
          defaultValue === undefined || defaultValue === ""
            ? defaultValue
            : formatNumber(String(defaultValue), places, settings, 0)
        }
        onBlur={(event) => {
          const canonical = canonicalLocalizedNumber(
            event.currentTarget.value,
            settings.numberFormat,
          );
          if (hiddenRef.current) hiddenRef.current.value = canonical ?? "";
          onBlur?.(event);
        }}
        onChange={(event) => {
          const canonical = canonicalLocalizedNumber(event.currentTarget.value, settings.numberFormat);
          if (hiddenRef.current) hiddenRef.current.value = canonical ?? "";
          onChange?.(event);
        }}
      />
      {name ? (
        <input
          ref={hiddenRef}
          type="hidden"
          name={name}
          defaultValue={defaultValue == null ? "" : String(defaultValue)}
        />
      ) : null}
    </>
  );
});
LocalizedNumberInput.displayName = "LocalizedNumberInput";
