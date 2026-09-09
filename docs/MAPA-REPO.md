# MAPA-REPO — dónde vive cada cosa

> Verificado contra el código el 2026-09-09. Si agregas un módulo, ruta o
> script, actualiza este mapa (ver `MANTENIMIENTO.md`).

## Estructura superior

```
src/
  app/
    (auth)/login/          login
    (dashboard)/           resumen, ventas, productos, recetas, inventario,
                           compras, gastos, caja, reportes, produccion,
                           setup, configuracion
    actions/               server actions (puente UI → módulos)
    api/                   route handlers (auth, exports CSV)
  modules/                 lógica de dominio (única fuente de verdad)
  components/              UI (ui/, layout/, production/, …)
  lib/                     db, decimal, dates, csv-import, errors, utils
prisma/                    schema.prisma, migrations/, seed.ts
sql/                       bi-views.sql (10 vistas bi_*), roles.sql
tests/                     unit/decimal.test.ts, integration/strawberry-matcha-flow.test.ts
docs/                      esta documentación
```

## Módulos de dominio (`src/modules/<modulo>/service.ts`)

| Módulo | Archivo | Funciones clave (línea) |
|---|---|---|
| Ventas | `sales/service.ts` | `createSale` (:32), `voidSale` (:261), `listSales` (:345), `createDraftSale` (:393), `confirmDraftSale` (:473). Totales: `sales/totals.ts:calculateSaleTotals` (:11) |
| Recetas | `recipes/service.ts` | `saveRecipe` (:43), `saveSubproductRecipe` (:128), `listRecipes` (:249), `productsWithoutRecipe` (:342). Costo: `recipes/cost.ts:calculateRecipeUnitCost` (:13) |
| Producción | `production/service.ts` | `createProductionOrder` (:86), `startProductionOrder` (:32), `completeProductionOrder` (:202), `cancelProductionOrder` (:373), `listProductionOrders` (:487), `getProductionOrderDetail` (:525) |
| Compras | `purchases/service.ts` | `receivePurchase` (:26), `voidPurchase` (:213) |
| Inventario | `inventory/service.ts`, `inventory/stock.ts` | `createAdjustment` (:8), `confirmInventoryCount` (:82), `createInitialInventory` (:185), `getIngredientStock` (stock.ts:28), `listCurrentInventory` (stock.ts:40) |
| Caja | `cash/service.ts`, `cash/expected.ts` | `openCashSession` (:16), `addCashMovement` (:57), `closeCashSession` (:169), `getOpenCashSession` (:245), `calculateExpectedCash` (expected.ts:4) |
| Catálogo | `catalog/service.ts` | `upsertProduct` (:47), `upsertIngredient` (:185), `upsertSupplier` (:435), `upsertProductCategory` (:7), `upsertIngredientCategory` (:143), `ensureDefaultUnits` (:489) |
| Gastos | `expenses/service.ts` | `createExpense` (:12), `listExpenses` (:99) |
| Dashboard | `dashboard/service.ts` | `getDashboard` (:10) |
| Auditoría | `audit/service.ts` | `writeAudit` (:6) |

**Convención:** la UI nunca calcula ni escribe directo a BD; llama a un
server action (`src/app/actions/`) que valida con Zod y delega al módulo.
Operaciones críticas (venta, compra, anulación, conteo, cierre) usan
transacciones Prisma dentro del servicio.

## Rutas y actions

* Páginas: `src/app/(dashboard)/<modulo>/page.tsx` (ver tabla superior).
* Server actions: `src/app/actions/{catalog,operations,production,importer}.ts`.
* API: `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/exports/[report]/route.ts`.
* Auth/sesión: `src/auth.ts`, `requireSession` en `src/lib/auth/session`.

## Datos y analítica

* Schema: `prisma/schema.prisma` (modelos operativos + `ProductionOrder` :329,
  `ProductionStatus` con IN_PROGRESS :83, `Expense` :530).
* Migraciones: `prisma/migrations/`. Seed demo: `prisma/seed.ts` (+ vistas BI).
* Vistas BI (`sql/bi-views.sql`): `bi_sales_detail` (:4), `bi_daily_sales` (:29),
  `bi_product_profitability` (:40), `bi_purchase_detail` (:57),
  `bi_inventory_current` (:77), `bi_inventory_movements` (:98), `bi_expenses`
  (:113), `bi_cash_closures` (:129), `bi_profit_and_loss_monthly` (:144),
  `bi_production_variance` (:177). Rol de lectura: `sql/roles.sql`.

## Tests y scripts

* Unitarios: `tests/unit/decimal.test.ts` (6 casos, no requieren BD).
* Integración: `tests/integration/strawberry-matcha-flow.test.ts` (12 pasos,
  flujo completo; requiere `DATABASE_URL`; se corre con `run-integration-test.bat`).
* Scripts (`package.json`): `dev`, `build`, `start`, `lint`, `typecheck`,
  `test`, `test:integration`, `db:generate`, `db:migrate`, `db:push`,
  `db:seed`, `db:studio`.
