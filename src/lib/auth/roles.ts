/**
 * Definicion de roles SIN dependencias de servidor.
 *
 * Vive separado de `session.ts` a proposito: ese modulo importa Prisma y
 * Auth.js, y los componentes cliente (por ejemplo la barra lateral) necesitan
 * la jerarquia de roles sin arrastrar la base de datos al bundle del navegador.
 *
 *  VIEWER  (contador)    solo lectura: paginas y exportaciones.
 *  CASHIER (cajero)      operacion diaria: vender, abrir caja, movimientos.
 *  ADMIN   (encargado)   correcciones y catalogo: anular, comprar, recetas, cerrar caja.
 *  OWNER   (propietario) todo, incluida la gestion de usuarios.
 */
export const ROLE_RANK = {
  VIEWER: 0,
  CASHIER: 1,
  ADMIN: 2,
  OWNER: 3,
} as const;

export type RoleName = keyof typeof ROLE_RANK;

export function isRoleName(value: unknown): value is RoleName {
  return typeof value === "string" && value in ROLE_RANK;
}

/** Etiquetas para mostrar en la interfaz. */
export const ROLE_LABELS: Record<RoleName, string> = {
  OWNER: "Propietario",
  ADMIN: "Encargado",
  CASHIER: "Cajero",
  VIEWER: "Solo lectura",
};

export function hasAtLeast(role: RoleName, min: RoleName): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
