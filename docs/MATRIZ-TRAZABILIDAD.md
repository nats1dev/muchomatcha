# MATRIZ-TRAZABILIDAD — requisito → código → test

> Verificada contra el código el 2026-09-09 (`línea` = primera línea de la
> función/modelo/vista). Estados: ✅ implementado con evidencia, ⚠️ parcial o
> por verificar en este repo. Al cambiar un REQ, actualiza su fila
> (ver `MANTENIMIENTO.md`).

| REQ | Implementación (archivo:línea) | Test | Estado |
|---|---|---|---|
| REQ-01 | `src/auth.ts`, `src/app/(auth)/login/page.tsx`, `requireSession` (`src/lib/auth/session`) | Manual (login + rutas protegidas) | ✅ |
| REQ-02 | `src/modules/catalog/service.ts` (`upsertProduct` :47, `upsertIngredient` :185, `upsertSupplier` :435); páginas `productos`, `inventario`, `configuracion` | Seed (`prisma/seed.ts`) | ✅ |
| REQ-03 | `src/modules/recipes/cost.ts:calculateRecipeUnitCost` (:13), `saveRecipe` (`recipes/service.ts` :43) | Unit: cálculo vía UI; integración paso 8 | ✅ |
| REQ-04 | `src/modules/sales/service.ts:createSale` (:32); UI `ventas/nueva/sale-form.tsx` | Integración paso 10 | ✅ |
| REQ-05 | `createSale` (:32, solo warning sin receta) + `inventory/stock.ts:getIngredientStock` (:28); badge “sin receta” en UI | Integración paso 10 (7 movimientos) | ✅ |
| REQ-06 | `src/modules/purchases/service.ts:receivePurchase` (:26); conversión `purchase_quantity × factor`; promedio ponderado | Integración paso 3 | ✅ |
| REQ-07 | `src/modules/expenses/service.ts:createExpense` (:12); UI `gastos/expense-form.tsx` | Seed (25 gastos demo) | ✅ |
| REQ-08 | `inventory/service.ts:createAdjustment` (:8), `confirmInventoryCount` (:82); motivo obligatorio | Integración (conteos en seed) | ✅ |
| REQ-09 | `cash/service.ts:openCashSession` (:16), `closeCashSession` (:169), `calculateExpectedCash` (`cash/expected.ts` :4); UI `caja/` | Integración pasos 9, 12 | ✅ |
| REQ-10 | `dashboard/service.ts:getDashboard` (:10); UI `resumen/page.tsx` con filtro de fechas | Por verificar: comparar panel vs operaciones | ⚠️ |
| REQ-11 | `sales/service.ts:voidSale` (:261), `purchases/service.ts:voidPurchase` (:213); anulación lógica | Integración (idempotencia declarada en `Desarrollo.md §7.2`) | ✅ |
| REQ-12 | `sql/bi-views.sql` (10 vistas, :4–:177); `sql/roles.sql` (rol lectura) | Por verificar: conexión Power BI | ⚠️ |
| REQ-13 | `src/app/api/exports/[report]/route.ts`; UI `reportes/page.tsx` (5 CSV); `importCsvAction` (`actions/importer.ts`) | Manual (descarga CSV) | ✅ |
| REQ-14 | Tokens en `MVP.md §4.2`; layout `src/app/(dashboard)/layout.tsx`; estados vacíos por módulo | Manual (desktop/tableta) | ⚠️ |
| REQ-15 | `src/modules/audit/service.ts:writeAudit` (:6); tabla `audit_log` | Por verificar: cobertura por operación | ⚠️ |
| REQ-16 | `sale_items.unit_cost_snapshot` y precio guardados en `createSale`; `purchase_items.unit_cost` en `receivePurchase` | Integración pasos 3, 10 | ✅ |
| REQ-17 | `prisma/schema.prisma:ProductionStatus` (:83, con IN_PROGRESS); `production/service.ts:startProductionOrder` (:32) | Integración (start → complete) | ✅ |
| REQ-18 | `schema.prisma:ProductionOrder.actualQuantity` (:336); `completeProductionOrder` (:202, `actualQuantity?` :76) | Integración paso 6 | ✅ |
| REQ-19 | `estimatedUnitCost` (:339) + `estimatedTotalCost`; `bi_production_variance` (`bi-views.sql` :177) | Integración paso 6 (`estimatedUnitCost > 0`) | ✅ |
| REQ-20 | `startedAt` (:344), `startedById` (:349) en `ProductionOrder` | Integración (start → complete) | ✅ |
| REQ-21 | Merma de receta (`wastePercentage`) aplicada en `production/service.ts` (:169, :262); sin captura de merma real por insumo | — | ⚠️ parcial |
| REQ-22 | Vista `bi_production_variance` (:177, otorgada en `roles.sql` :24) | — (CSV/dashboard producción por verificar) | ⚠️ parcial |

**Notas:**
* Las filas ⚠️ no son fallas confirmadas: son puntos donde la evidencia en este
  repo aún no se verificó de extremo a extremo.
* `Desarrollo.md §7` documenta los contratos de dominio (venta, anulación,
  compra, cierre) que estos servicios implementan.
