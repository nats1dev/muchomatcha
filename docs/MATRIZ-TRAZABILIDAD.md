# MATRIZ-TRAZABILIDAD — requisito → código → test

> Verificada contra el código el 2026-09-09 (`línea` = primera línea de la
> función/modelo/vista). Estados: ✅ implementado con evidencia, ⚠️ parcial o
> por verificar en este repo. Al cambiar un REQ, actualiza su fila
> (ver `MANTENIMIENTO.md`).

| REQ | Implementación (archivo:línea) | Test | Estado |
|---|---|---|---|
| REQ-01 | `src/auth.ts`, `src/app/(auth)/login/page.tsx`; `requireSession` / `requireRole` / `requirePageRole` (`src/lib/auth/session.ts`), jerarquía en `src/lib/auth/roles.ts`; 36 llamadas protegidas en `src/app/actions/*`; alta de usuarios en `src/app/actions/users.ts`; límite de intentos de login en `src/lib/auth/rate-limit.ts` + `authorize` (`src/auth.ts`), tabla `login_attempts` (DEC-17) | Alta de cajero y contador desde Configuración → Usuarios **verificada en runtime (2026-09-09)** (`npm run dev` → owner → Configuración → Usuarios). UI de anulación (venta y compra) apagada para CASHIER/VIEWER vía `canVoid` (DEC-16); verificado con `npm run typecheck` (2026-09-09). Pendiente: comprobar en runtime que el botón aparece apagado con cuenta CASHIER (`npm run dev`). Límite de login verificado con `npm run typecheck` + `npm run lint` (0 errores) y `npx prisma migrate deploy` (migración `20260909210000_login_attempts` aplicada, 2026-09-09); ⚠️ por verificar (2026-09-09) el bloqueo en runtime: `npm run dev` → `/login` → 6 intentos fallidos con el mismo correo | ⚠️ |
| REQ-02 | `src/modules/catalog/service.ts` (`upsertProduct` :47, `upsertIngredient` :185, `upsertSupplier` :435); páginas `productos`, `inventario`, `configuracion`; `src/app/(dashboard)/recetas/page.tsx` mapea `missing` a `{ id, name }` (2026-09-09) — `productsWithoutRecipe` devuelve el `Product` completo con `salePrice: Decimal`, no serializable a Client Components; edición de receta de subproducto en `/produccion` (botón lápiz por fila en `subproduct-section.tsx` que precarga `SubproductRecipeForm` vía `initialData`, 2026-09-09; guardar crea nueva versión con `saveSubproductRecipe`, `notes` incluido en `listManufacturedIngredients`); categorías idempotentes case-insensitive + red P2002 (`upsertProductCategory`, `upsertIngredientCategory`, DEC-19, 2026-09-09); importación masiva 03/05/06/07 (`importer.ts` preview/confirm, `groupRecipeLines`, `upsertSupplier` mapea P2002, DEC-21) | Seed (`prisma/seed.ts`); serialización verificada con `npm run typecheck` + `npx vitest run tests/unit` + `npm run lint` (0 errores, 2026-09-09). Pendiente `npm run dev` → `/recetas` y `/produccion` (probar editar la Jalea de fresa) | ✅ |
| REQ-03 | `src/modules/recipes/cost.ts:calculateRecipeLineCost` (:32, lote + aporte por línea con merma y rendimiento) y `calculateRecipeUnitCost` (:51, fuente autoritativa del total), `saveRecipe` (`recipes/service.ts` :43); `saveSubproductRecipe` (`recipes/service.ts` :128) persiste el estimado en `currentAverageCost` y bloquea insumos Q0 en servidor + UI (2026-09-09, sobrescribe directo sin kardex por decisión del dueño); UI por línea + resumen de lote en `src/app/(dashboard)/recetas/recipe-form.tsx`, solo resumen en `subproduct-recipe-form.tsx`; captura de merma como lista entera 0–20 (`src/lib/waste.ts:WASTE_OPTIONS`, `normalizeWastePercentage` redondea valores históricos con decimales; `Select` en `recipe-form.tsx` y `subproduct-recipe-form.tsx`, 2026-09-09) validada en servidor como entero 0–20 (`src/app/actions/schemas.ts:wastePercentage`) | Unit: `tests/unit/recipe-cost.test.ts` (10 casos, 2026-09-09: línea con merma/rendimiento, costo cero, decimales, suma de aportes vs total y resumen lote = unitario × rendimiento; `npx vitest run tests/unit`); `tests/unit/schemas.test.ts` (merma entera 0–20 acepta 0/5/20 y rechaza 21/2.5/-1, 2026-09-09; `npm test`); integración paso 8 | ✅ |
| REQ-04 | `src/modules/sales/service.ts:createSale` (:32); UI `ventas/nueva/sale-form.tsx` | Integración paso 10 | ✅ |
| REQ-05 | `createSale` (:32, solo warning sin receta) + `inventory/stock.ts:getIngredientStock` (:28); badge “sin receta” en UI | Integración paso 10 (7 movimientos) | ✅ |
| REQ-06 | `src/modules/purchases/service.ts:receivePurchase` (:26); conversión `purchase_quantity × factor`; promedio ponderado | Integración paso 3 | ✅ |
| REQ-07 | `src/modules/expenses/service.ts:createExpense` (:12); UI `gastos/expense-form.tsx` | Seed (25 gastos demo) | ✅ |
| REQ-08 | `inventory/service.ts:createAdjustment` (:8), `confirmInventoryCount` (:82); motivo obligatorio | Integración (conteos en seed) | ✅ |
| REQ-09 | `cash/service.ts:openCashSession` (:16), `closeCashSession` (:169), `calculateExpectedCash` (`cash/expected.ts` :4); UI `caja/` | Integración pasos 9, 12 | ✅ |
| REQ-10 | `dashboard/service.ts:getDashboard` (:10); UI `resumen/page.tsx` con filtro de fechas | Por verificar: comparar panel vs operaciones | ⚠️ |
| REQ-11 | `sales/service.ts:voidSale` (:261), `purchases/service.ts:voidPurchase` (:213); anulación lógica | Integración (idempotencia declarada en `Desarrollo.md §7.2`) | ✅ |
| REQ-12 | `sql/bi-views.sql` (10 vistas, :4–:177); `sql/roles.sql` (rol lectura) | Por verificar: conexión Power BI | ⚠️ |
| REQ-13 | `src/app/api/exports/[report]/route.ts` (exige rol `VIEWER` desde 2026-09-09); UI `reportes/page.tsx` (5 CSV); `previewCsvAction`/`confirmCsvAction` (`actions/importer.ts`, Fase B: Zod por fila + topes 500/2 MB + `Fila N`, categorías idempotentes DEC-19; Fase B2: preview dry-run + diálogo con motivo+solución por fila y cancelar/importar-omitir; Fase C: ramas 03/05/06/07 (recetas agrupadas con versionado, proveedores, inventario con guardia de stock y lotes de 200, DEC-21)) | `tests/unit/csv-import.test.ts` (20 casos) + `tests/unit/csv-import-phase-c.test.ts` + `tests/unit/import-troubleshooting.test.ts` (catálogo, `npm test`, 2026-09-09) + manual: preview con errores → cancelar intacto → confirmar parcial | ✅ |
| REQ-14 | Tokens en `MVP.md §4.2`; layout `src/app/(dashboard)/layout.tsx`; páginas de producción protegidas por rol; formulario con creación+inicio, borrador secundario, preview de cantidades/merma/stock/costo y diálogos accesibles (`production-form.tsx`, `production-detail-card.tsx`, `production-filters.tsx`, 2026-09-09) | `npm run typecheck` + `npm run lint` sin errores; pendiente prueba visual runtime en 320/375/768/1280 px | ⚠️ |
| REQ-15 | `src/modules/audit/service.ts:writeAudit` (:6); tabla `audit_log` | Por verificar: cobertura por operación | ⚠️ |
| REQ-16 | `sale_items.unit_cost_snapshot` y precio guardados en `createSale`; `purchase_items.unit_cost` en `receivePurchase` | Integración pasos 3, 10 | ✅ |
| REQ-17 | `prisma/schema.prisma:ProductionStatus`; `production/service.ts:createProductionOrder` (DRAFT o IN_PROGRESS), `startProductionOrder` (transición condicionada), `completeProductionOrder`; UI `produccion/` serializada | Integración pasos 6, 13–17; `npm test` (unitarias) + `npm run typecheck` | ✅ |
| REQ-18 | `schema.prisma:ProductionOrder.actualQuantity`; `completeProductionOrder` acepta rendimiento real y la UI muestra plan vs resultado | Integración pasos 6 y 14; pendiente ejecución con BD disponible | ✅ |
| REQ-19 | `estimatedUnitCost` + `estimatedTotalCost`; preview de costo en `listManufacturedIngredients`; promedio de salida usa stock previo al crédito | Integración pasos 6 y 14; pendiente ejecución con BD disponible | ✅ |
| REQ-20 | `startedAt`, `startedById`, creación inmediata opcional y timestamps de finalización | Integración pasos 6 y 13; pendiente ejecución con BD disponible | ✅ |
| REQ-21 | Merma de receta (`wastePercentage`) aplicada en `production/service.ts` (:169, :262); sin captura de merma real por insumo | — | ⚠️ parcial |
| REQ-22 | Vista `bi_production_variance`; CSV existente; list/detail muestran costo estimado, real, rendimiento y movimientos | `npm run typecheck`; pendiente descargar CSV y verificar dashboard en runtime | ⚠️ parcial |

**Nota transversal (2026-09-09, DEC-18):** la entrada de todos los REQ que
escriben datos (REQ-02, REQ-04 a REQ-09, REQ-11, REQ-16 a REQ-22) pasa antes por
`src/app/actions/schemas.ts`: cantidades > 0, importes ≥ 0, UUID, enums cerrados
y fechas `aaaa-mm-dd`. Evidencia: `tests/unit/schemas.test.ts` (18 casos,
`npm test`, 34 unitarias actuales). ⚠️ por verificar (2026-09-09) el recorrido
en runtime de un formulario de cada tipo: `npm run dev` → venta, compra, gasto
y ajuste.

**REQ-14 (2026-09-09):** sidebar agrupado por flujo y filtrado por rol en
`src/components/layout/sidebar.tsx`; comparte estructura entre escritorio y
movil. Verificar con `npm run typecheck`, `npm run lint`, `npm run build` y
prueba visual a 320/375/768/1280 px.

**REQ-02 / REQ-14 (2026-09-09, DEC-20):** unidades configurables y formato
US/EU con perfiles 0-6. Tests: `tests/unit/number-format.test.ts` y
`tests/unit/schemas.test.ts`; verificar con `npm test`, `npm run typecheck`,
`npm run lint` y `npx prisma validate`.

**Notas:**
* Las filas ⚠️ no son fallas confirmadas: son puntos donde la evidencia en este
  repo aún no se verificó de extremo a extremo.
* `Desarrollo.md §7` documenta los contratos de dominio (venta, anulación,
  compra, cierre) que estos servicios implementan.
