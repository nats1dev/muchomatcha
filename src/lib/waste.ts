/**
 * Opciones de merma para los formularios de recetas (REQ-03).
 *
 * Regla de captura: enteros de 0 a 20. El 0 significa "Sin merma" y es el
 * valor por defecto; del 1 al 20 se muestra como "N%".
 * El servidor lo revalida en `src/app/actions/schemas.ts` (entero 0-20).
 */

export const WASTE_MIN = 0;
export const WASTE_MAX = 20;

export type WasteOption = { value: number; label: string };

export const WASTE_OPTIONS: WasteOption[] = Array.from(
  { length: WASTE_MAX - WASTE_MIN + 1 },
  (_, i) => {
    const value = WASTE_MIN + i;
    return {
      value,
      label: value === 0 ? "0% — Sin merma" : `${value}%`,
    };
  },
);

/**
 * Normaliza un valor heredado (p. ej. 2.5 o "5.00") al entero 0-20 mas
 * cercano. Los datos historicos con decimales siguen calculandose igual en
 * el dominio; solo la edicion los redondea a la lista.
 */
export function normalizeWastePercentage(value: unknown): number {
  const n = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(WASTE_MAX, Math.max(WASTE_MIN, Math.round(n)));
}
