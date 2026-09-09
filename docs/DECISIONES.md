# DECISIONES — decisiones de negocio tomadas (ADRs cortos)

> Fuente: `MVP.md §7`, `Desarrollo.md §6–7`, `README.md`. Antes de cambiar
> cualquiera de estas reglas, lee su justificación y actualiza la fila
> correspondiente de `MATRIZ-TRAZABILIDAD.md`.

| ID | Decisión | Justificación | Dónde vive en código |
|---|---|---|---|
| DEC-01 | Moneda GTQ, IVA 12%, precios del menú **sin IVA** (el impuesto se cobra al vender) | Definido con contador; caja muestra total cobrado, utilidad se calcula sin impuesto | `Business.taxRate` (`schema.prisma` :95), `calculateSaleTotals` (`sales/totals.ts` :11) |
| DEC-02 | Costo de inventario = **promedio ponderado móvil**, sin lotes ni FIFO | Simplicidad del prototipo; suficiente para el MVP | `receivePurchase` (`purchases/service.ts` :26) |
| DEC-03 | Venta con existencia insuficiente: **se permite con advertencia** (no bloquea) | No frenar la operación; el faltante se ve en inventario crítico | `createSale` (`sales/service.ts` :32) |
| DEC-04 | Producto sin receta: **se vende igual** (warning, costo 0, sin descuento de inventario) | Flexibilidad: vender ya, completar recetas después | `createSale` + badge “sin receta” en `sale-form.tsx` |
| DEC-05 | **Una sola caja abierta por negocio** (índice único parcial) | Un negocio, un turno; evita cuadres duplicados | `cash/service.ts:openCashSession` (:16) |
| DEC-06 | Gastos en efectivo descuentan de la caja abierta | El efectivo esperado debe reflejar salidas reales | `createExpense` (`expenses/service.ts` :12) |
| DEC-07 | Anulación lógica, **nunca borrado físico** (ventas, compras, caja) | Trazabilidad fiscal y de auditoría | `voidSale` (:261), `voidPurchase` (:213) |
| DEC-08 | Congelamiento de precios: venta/compra guardan su **snapshot** de precio y costo | Presupuestos e historial no cambian al editar catálogos | `sale_items`, `purchase_items` en `createSale` / `receivePurchase` |
| DEC-09 | Ajustes de inventario **exigen motivo**; conteo genera movimiento por la diferencia | Kardex auditable | `createAdjustment` (:8), `confirmInventoryCount` (:82) |
| DEC-10 | Subproductos **no anidados** (una receta de subproducto no usa otro subproducto) | Evita recursión de costos | `saveSubproductRecipe` (`recipes/service.ts` :128) |
| DEC-11 | Venta en efectivo **exige caja abierta** | Todo efectivo queda atado a un turno cuadrable | `createSale` + `getOpenCashSession` (`cash/service.ts` :245) |
| DEC-12 | Importes `NUMERIC(14,2)`, cantidades `NUMERIC(14,3)`; **nunca float** en dinero | Precisión monetaria | `schema.prisma`, `src/lib/decimal.ts`, `tests/unit/decimal.test.ts` |
| DEC-13 | **Cuatro roles jerárquicos**: `VIEWER` < `CASHIER` < `ADMIN` < `OWNER`. Cajero opera (vender, abrir caja, producir); encargado corrige (anular, comprar, cerrar caja, catálogo, recetas); contador solo lee y exporta | El piloto tiene dueño, cajeros y contador. Sin esto, cualquier usuario podía anular ventas y borrar recetas | `src/lib/auth/roles.ts`, `requireRole` (`src/lib/auth/session.ts`), aplicado en `src/app/actions/*` |
| DEC-14 | Permisos **fail-closed**: ante un rol ausente o irreconocible se asume el mínimo privilegio (`VIEWER`), nunca `OWNER` | Un valor por defecto permisivo convierte cualquier fallo de propagación del token en escalada a propietario | `session.ts` (`isRoleName`), `auth.ts` (callback `session`), `schema.prisma` (`User.role @default(VIEWER)`) |
| DEC-15 | Los usuarios se crean **desde la aplicación** (Configuración → Usuarios), no desde el seed. Nadie puede asignar un rol superior al suyo, desactivarse a sí mismo, ni desactivar al último propietario activo | El seed hace `TRUNCATE` de toda la base: no era viable dar de alta a un cajero sin destruir los datos | `src/app/actions/users.ts`, `src/app/(dashboard)/configuracion/usuarios/` |
| DEC-16 | Las acciones que el rol actual no puede ejecutar se muestran **apagadas (`disabled`) con la razón**, en vez de dejar pulsar y devolver 403. Aplicado a anular venta y anular compra | Cajero y contador veían un botón activo que siempre fallaba; el control real sigue en `requireRole` del servidor, la UI solo evita el callejón sin salida | `ventas/[id]/void-form.tsx`, `compras/void-purchase-button.tsx` (prop `canVoid`), `hasAtLeast` (`src/lib/auth/roles.ts`) |
| DEC-17 | **5 intentos de login fallidos por (correo, IP) cada 15 minutos**, contados en la tabla `login_attempts`; un login correcto libera el contador. `authorize` verifica **siempre** un hash argon2id (uno *dummy* si el correo no existe o la cuenta está inactiva) | Sin límite, una contraseña débil cae por fuerza bruta; el contador va en la base y no en memoria porque en Vercel cada petición puede caer en otra instancia. Verificar siempre un hash iguala la latencia de "no existe" y "contraseña incorrecta", que si no delata qué correos están registrados | `src/lib/auth/rate-limit.ts`, `authorize` en `src/auth.ts`, `LoginAttempt` (`schema.prisma`), mensaje en `(auth)/login/login-form.tsx` |
| DEC-18 | **Toda server action valida su entrada con Zod** (`src/app/actions/schemas.ts`) antes de llamar al dominio: cantidades > 0, importes ≥ 0, UUID, enums cerrados, fechas `aaaa-mm-dd`, longitudes máximas y ≤ 200 renglones por documento. Los servicios de `src/modules/` confían en sus tipos | Una server action es un endpoint público y los tipos de TypeScript no existen en runtime: sin esto entraban cantidades negativas (que *sumaban* stock), `NaN` hasta Postgres y enums inválidos con error opaco | `src/app/actions/schemas.ts`, `catalog.ts`, `operations.ts`, `production.ts`, `users.ts`; `toActionError` (`src/lib/errors.ts`); `tests/unit/schemas.test.ts` |

**Pendientes de implementación (decisión tomada, código aún no alineado):**

* **DEC-05** declara el índice único parcial de caja abierta, pero hoy solo existe
  un `findFirst` en `openCashSession`: dos peticiones concurrentes pueden abrir dos
  turnos. Falta la migración `cash_sessions (business_id) WHERE status='OPEN'`
  (Fase 2.2 de `IMPLEMENTACION.md`). *Anotado 2026-09-09.*
* **DEC-10** dice que los subproductos no se anidan, pero `calculateRecipeUnitCost`
  (`recipes/cost.ts` :13) resuelve hasta 3 niveles y `createSale` consulta 4.
  Revisar si la decisión cambió o si el código excede lo acordado. *Anotado 2026-09-09.*
