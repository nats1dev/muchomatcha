"use client";

import { useActionState, useState } from "react";
import { saveNumberSettingsAction } from "@/app/actions/catalog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDisplayCost, formatDisplayMoney, formatDisplayQuantity, type NumberDisplaySettings } from "@/lib/number-format";

export function NumberSettingsForm({ initial }: { initial: NumberDisplaySettings }) {
  const [state, action, pending] = useActionState(saveNumberSettingsAction, null);
  const [settings, setSettings] = useState(initial);
  const choices = Array.from({ length: 7 }, (_, value) => value);
  const decimalSelect = (key: "moneyDecimals" | "costDecimals" | "quantityDecimals", label: string) => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Select id={key} name={key} value={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}>
        {choices.map((value) => <option key={value} value={value}>{value}</option>)}
      </Select>
    </div>
  );
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="numberFormat">Separadores</Label>
        <Select id="numberFormat" name="numberFormat" value={settings.numberFormat} onChange={(event) => setSettings({ ...settings, numberFormat: event.target.value as "US" | "EU" })}>
          <option value="US">1,000.00</option>
          <option value="EU">1.000,00</option>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {decimalSelect("moneyDecimals", "Dinero")}
        {decimalSelect("costDecimals", "Costos")}
        {decimalSelect("quantityDecimals", "Cantidades")}
      </div>
      <div className="rounded-[10px] border border-border bg-muted/40 p-3 text-sm">
        <p>Dinero: {formatDisplayMoney(1234.5, "GTQ", settings)}</p>
        <p>Costo: {formatDisplayCost(12.345678, "GTQ", settings)}</p>
        <p>Cantidad: {formatDisplayQuantity(1234.56789, settings)}</p>
      </div>
      {state && !state.ok ? <p className="text-sm text-error">{state.message}</p> : null}
      {state?.ok ? <p className="text-sm text-success">Configuraci&oacute;n guardada.</p> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Guardando..." : "Guardar formato"}</Button>
    </form>
  );
}
