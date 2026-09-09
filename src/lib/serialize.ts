import { Prisma } from "@prisma/client";
import { Decimal } from "@/lib/decimal";

/**
 * Los `Decimal` (de Prisma o de decimal.js) no son objetos planos, así que React
 * no puede pasarlos de un Server Component a un Client Component. Este helper los
 * convierte a `string` de forma recursiva, conservando la precisión exacta.
 *
 * Se preservan `Date`, `null` y los tipos primitivos tal cual (Next sí los serializa).
 */
export type Serialized<T> = T extends Prisma.Decimal | Decimal
  ? string
  : T extends Date | null | undefined
    ? T
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

function isDecimal(value: object): boolean {
  return Prisma.Decimal.isDecimal(value) || value instanceof Decimal;
}

export function serializeDecimals<T>(value: T): Serialized<T> {
  if (value === null || typeof value !== "object") {
    return value as Serialized<T>;
  }
  if (isDecimal(value)) {
    return value.toString() as Serialized<T>;
  }
  if (value instanceof Date) {
    return value as Serialized<T>;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeDecimals(item)) as Serialized<T>;
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = serializeDecimals(item);
  }
  return out as Serialized<T>;
}
