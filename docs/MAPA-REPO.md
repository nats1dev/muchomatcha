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
  lib/                     db, decimal, serialize, dates, csv-import,
                           import-troubleshooting (catálogo motivo/solución), errors, utils,
                           waste (`waste.ts`: `WASTE_OPTIONS` 0–20 + `normalizeWastePercentage`)
prisma/                    schema.prisma, migrations/, seed.ts
sql/                       bi-views.sql (10 vistas bi_*), roles.sql
tests/                     unit/{decimal,schemas}.test.ts, integration/strawberry-matcha-flow.test.ts
docs/                      esta documentación
public/                    logo-oficial.png y recursos estáticos
```

## Módulos de dominio (`src/modules/<modulo>/service.ts`)

| Módulo | Archivo | Funciones clave (línea) |
|---|---|---|
| Ventas | `sales/service.ts` | `createSale` (:32), `voidSale` (:261), `listSales` (:345), `createDraftSale` (:393), `confirmDraftSale` (:473). Totales: `sales/totals.ts:calculateSaleTotals` (:11) |
| Recetas | `recipes/service.ts` | `saveRecipe` (:43), `saveSubproductRecipe` (:128), `listRecipes` (:249), `productsWithoutRecipe` (:342). Costo: `recipes/cost.ts:calculateRecipeUnitCost` (:13) |
| Producción | `production/service.ts` | `createProductionOrder` (crea borrador o inicia inmediatamente), `startProductionOrder`, `completeProductionOrder` (transición idempotente), `cancelProductionOrder` (reversa controlada), `listProductionOrders`, `getProductionOrderDetail`, `listManufacturedIngredients` (preview serializado de costo/stock) |
| Compras | `purchases/service.ts` | `receivePurchase` (:26), `voidPurchase` (:213) |
| Inventario | `inventory/service.ts`, `inventory/stock.ts` | `createAdjustment` (:8), `confirmInventoryCount` (:82), `createInitialInventory` (:185), `getIngredientStock` (stock.ts:28), `listCurrentInventory` (stock.ts:40) |
| Caja | `cash/service.ts`, `cash/expected.ts` | `openCashSession` (:16), `addCashMovement` (:57), `closeCashSession` (:169), `getOpenCashSession` (:245), `calculateExpectedCash` (expected.ts:4) |
| Catálogo | `catalog/service.ts` | `upsertProduct` (:47), `upsertIngredient` (:185), `upsertSupplier` (:435), `upsertProductCategory` (:7), `upsertIngredientCategory` (:143), `ensureDefaultUnits` (:489) |
| Gastos | `expenses/service.ts` | `createExpense` (:12), `listExpenses` (:99) |
| Dashboard | `dashboard/service.ts` | `getDashboard` (:10) |
| Auditoría | `audit/service.ts` | `writeAudit` (:6) |

**Convención de serialización (2026-09-09):** un `Decimal` de Prisma no es un
objeto plano, así que React no puede pasarlo de un Server Component a un Client
Component (`Only plain objects can be passed to Client Components`). Toda lectura
que cruce esa frontera debe entregar `string`/`number`:
`src/lib/serialize.ts:serializeDecimals` (:25) convierte `Decimal → string` de
forma recursiva preservando `Date`. Lo aplican `listProductionOrders` (:488),
`getProductionOrderDetail` (:526) y `listManufacturedIngredients` (:580) de
`production/service.ts`; el resto de páginas mapea los campos a mano en su
`page.tsx`. Verificar con: `npm run typecheck` (los componentes cliente declaran
esos campos como `string`/`number`, así que un `Decimal` filtrado falla el build
salvo que se enmascare con un cast — no usar `as never`).

**Convención:** la UI nunca calcula ni escribe directo a BD; llama a un
server action (`src/app/actions/`) que valida la entrada y delega al módulo.
Operaciones críticas (venta, compra, anulación, conteo, cierre) usan
transacciones Prisma dentro del servicio.

**Validación con Zod: completa desde 2026-09-09 (DEC-18).** Cada server action
parsea su entrada con un esquema de `src/app/actions/schemas.ts` antes de llamar
al dominio; los formularios pasan por `formValues(formData)`. `toActionError`
convierte el `ZodError` en `fieldErrors` por campo. Verificar con:
`grep -rl 'from "./schemas"' src/app/actions/` y `npm test`.

## Rutas y actions

* Páginas: `src/app/(dashboard)/<modulo>/page.tsx` (ver tabla superior).
  Gestión de usuarios en `(dashboard)/configuracion/usuarios/`.
* Server actions: `src/app/actions/{catalog,operations,production,importer,users}.ts`.
  `importer.ts` expone `previewCsvAction` (dry-run) + `confirmCsvAction`
  (escribe solo válidas); UI en `src/components/csv-import-button.tsx` +
  `src/components/import-preview-dialog.tsx`.
  Sus contratos de entrada viven en `src/app/actions/schemas.ts` (un esquema Zod
  por acción + los primitivos `uuid`, `quantity`, `amount`, `isoDate`,
  `formValues`). Al escribir una acción nueva: añade su esquema ahí y parsea
  `payload: unknown` antes de llamar al servicio (DEC-18).
* API: `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/exports/[report]/route.ts`.
* Auth/sesión: `src/auth.ts`; `requireSession`, `requireRole(min)`,
  `requirePageRole(min)` y `requireBusinessContext(min)` en
  `src/lib/auth/session.ts`.
* Acciones apagadas por rol (DEC-16): las páginas calculan `canVoid` con
  `hasAtLeast(role, "ADMIN")` y se lo pasan a `ventas/[id]/void-form.tsx` y
  `compras/void-purchase-button.tsx`, que renderizan el botón `disabled` con la
  razón. El permiso real lo sigue exigiendo `requireRole` en la server action.
* Límite de intentos de login (DEC-17): `src/lib/auth/rate-limit.ts`
  (`isLoginBlocked`, `recordFailedLogin`, `clearLoginAttempts`, `clientIpFrom`,
  `dummyPasswordHash`), consumido por `authorize` en `src/auth.ts`. El contador
  se persiste en el modelo `LoginAttempt` → tabla `login_attempts`.
* Roles: `src/lib/auth/roles.ts` (`ROLE_RANK`, `RoleName`, `ROLE_LABELS`, `hasAtLeast`).
  **Vive separado de `session.ts` a propósito**: ese módulo importa Prisma y
  Auth.js, y los componentes cliente (p. ej. `layout/sidebar.tsx`) necesitan la
  jerarquía sin arrastrar la base de datos al bundle del navegador.

## Datos y analítica

* Schema: `prisma/schema.prisma` (modelos operativos + `ProductionOrder` :329,
  `ProductionStatus` con IN_PROGRESS :83, `Expense` :530, `LoginAttempt` al
  final del archivo → tabla `login_attempts`). El bloque `datasource`
  declara `url` (pooler :6543, runtime) y `directUrl` (:5432, para `migrate`).
* Configuración de Prisma: `prisma.config.ts` (sustituye a `package.json#prisma`,
  deprecado en Prisma 7). Al usar archivo de config, Prisma **ya no carga `.env`**:
  lo cargan explícitamente `prisma.config.ts` y `prisma/seed.ts`.
* Migraciones: `prisma/migrations/` — historial versionado desde 2026-09-09.
  `20260909105703_init` (baseline completa),
  `20260909183800_user_role_default_viewer` y `20260909210000_login_attempts`
  (tabla `login_attempts`, DEC-17). **No usar `prisma db push`**: el
  esquema se cambia con `prisma migrate dev --name <descripcion>`.
* Seed: `prisma/seed.ts`. Exige `SEED_OWNER_PASSWORD`, usa `DIRECT_URL` y aborta
  si `NODE_ENV=production` sin `--force` (hace `TRUNCATE` de todas las tablas).
  Modo demo con `--demo`; sin el flag crea solo negocio, usuario y unidades.
* Vistas BI (`sql/bi-views.sql`): `bi_sales_detail` (:4), `bi_daily_sales` (:29),
  `bi_product_profitability` (:40), `bi_purchase_detail` (:57),
  `bi_inventory_current` (:77), `bi_inventory_movements` (:98), `bi_expenses`
  (:113), `bi_cash_closures` (:129), `bi_profit_and_loss_monthly` (:144),
  `bi_production_variance` (:177). Rol de lectura: `sql/roles.sql`.

## Navegacion lateral agrupada (REQ-14)

`src/components/layout/sidebar.tsx` organiza las rutas visibles por rol en tres
grupos siempre abiertos: Operacion diaria, Produccion e inventario, y
Administracion. El mismo contenido se usa en escritorio y menu movil; los
grupos sin enlaces autorizados no se renderizan.

## Formato numerico y unidades (DEC-20)

Preferencias en `Business`; formato/parser en `src/lib/number-format.ts`;
formularios en `/configuracion`; creacion y estado reversible de unidades en
`modules/catalog/service.ts`. Migracion: `20260909223000_number_display_settings`.

## Tests y scripts

* Unitarios: `tests/unit/decimal.test.ts`, `tests/unit/recipe-cost.test.ts`,
  `tests/unit/schemas.test.ts`, `tests/unit/csv-import.test.ts`,
  `tests/unit/csv-import-phase-c.test.ts` y
  `tests/unit/import-troubleshooting.test.ts` (validación de la frontera,
  importador CSV y `startImmediately`). Ninguno requiere BD: `npm test`.
* Integración: `tests/integration/strawberry-matcha-flow.test.ts` (17 pasos,
  incluye concurrencia, idempotencia, reversa y stock insuficiente; requiere
  `DATABASE_URL`; se corre con `run-integration-test.bat`).
* Scripts (`package.json`): `dev`, `build`, `start`, `lint`, `typecheck`,
  `test`, `test:integration`, `db:generate`, `db:migrate`,
  `db:migrate:deploy`, `db:push`, `db:seed`, `db:studio`. Railway usa
  `db:migrate:deploy` como comando pre-deploy y `start` ejecuta `next start`.

## Plantillas de carga masiva (Fases A–C)

* Libro y CSVs: `plantillas/plantillas-mucho-matcha.xlsx`,
  `plantillas/csv/01-ingredientes.csv` … `08-compras-ejemplo.csv`,
  instrucciones en `plantillas/README.md`. Importables: 01–02 (catálogo),
  03 (proveedores), 05–06 (recetas, columna opcional `nonInventoriable`),
  07 (inventario inicial con guardia de stock); 04 vía 01, 08 referencia
  (`src/lib/csv-import.ts`, `src/app/actions/importer.ts` con
  `previewCsvAction`/`confirmCsvAction`).
* Generador (fuente única): `scripts/generate-templates.ts`
  (`npx tsx scripts/generate-templates.ts`). Formato documentado en
  `docs/IMPORTACION.md` (DOC-11).
