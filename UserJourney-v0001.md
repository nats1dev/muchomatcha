# User Journey v0001 — Análisis y Roadmap de Mejora

## 1. Resumen Ejecutivo

Este documento analiza el journey completo de la app **Café Control / Mucho Matcha** desde la perspectiva del usuario final, identifica los gaps actuales (priorizando producción), y propone un roadmap con diseño explícito de schema, servicios y UI.

### Lo que ya funciona bien (no se repropone)

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Asistente de configuración (3 pasos) | ✅ Implementado | `setup/setup-wizard.tsx` — ingredientes → presentaciones → inventario inicial |
| Vender sin receta | ✅ Implementado | `sales/service.ts:165` solo emite warning; badge "sin receta" en UI (`sale-form.tsx:176`) |
| Cierre de caja con monto esperado | ✅ Implementado | `cash/service.ts:204-212` calcula expected; `close-form.tsx:16,29` pre-rellena campo |
| Dashboard con margen bruto | ✅ Implementado | `resumen/page.tsx` — ventas netas, utilidad bruta + margen %, ticket promedio |
| 9 vistas BI para Power BI | ✅ Implementado | `sql/bi-views.sql` — ventas, compras, inventario, gastos, caja, P&L mensual, rentabilidad por producto |
| 5 exports CSV | ✅ Implementado | `reportes/page.tsx` — ventas, compras, inventario, gastos, cierre de caja |
| Recetas con margen | ✅ Implementado | `recipes-view.tsx:166` — badge de margen % en cards; costo unitario visible |

### Capacidades de la app (vistas desde el journey de usuario)

```
Registro
  ↓
Setup guiado (opcional, se puede saltar)
  ├── Ingredientes (quick-add por nombre + SKU auto)
  ├── Presentaciones (factor "1 kg = ? g" sugerido por UI)
  └── Inventario inicial (cantidad + costo total = costo unitario)
  ↓
[Vender YA] ←─────────────── ya soportado sin receta
  ↓
[Completar después] ←─────── recetas, producción, compras
```

### Los 6 gaps de producción

| # | Gap | Bloquea | Evidencia |
|---|---|---|---|
| 1 | Sin estado IN_PROGRESS | Medir tiempo real de producción | `schema.prisma:81-85`: solo DRAFT/COMPLETED/CANCELLED |
| 2 | Sin actualQuantity (rendimiento real) | Saber si se produjo lo planeado | `schema.prisma:330-336`: solo `quantity` (planificada) |
| 3 | Sin merma real por insumo | Calibrar % de merma en recetas | `production/service.ts:CompleteProductionOrderInput`: solo 3 campos |
| 4 | estimatedUnitCost no persiste | Varianza histórica de costo | `schema.prisma:324-355`: no hay campo `estimated_*` |
| 5 | Producción invisible en analytics | Sin reportes ni dashboard de producción | `bi-views.sql`: 9 vistas, ninguna de producción; `reportes/page.tsx`: 5 exports, ninguno de producción; `resumen/page.tsx`: 0 cards de producción |
| 6 | occurredAt = creación, no inicio | Tiempo de producción = tiempo en borrador | `schema.prisma:335`: `occurredAt` default `now()` al crear; no hay `startedAt` |

---

## 2. Journey Actual Verificado

### Setup (1 sola vez)

```
/setup ────── Wizard de 3 pasos
               1. Ingredientes (escribir nombre → Enter → SKU auto)
               2. Presentaciones (unidad de compra + factor "1 kg = ? g")
               3. Inventario inicial (cantidad + costo total)
               → "Saltar setup" disponible
               → "Finalizar setup" registra inventario inicial
```

El wizard crea ingredientes vía `saveIngredientAction` y registra inventario vía `createInitialInventoryAction`.

### Catálogo y recetas

```
/productos ──→ Crear producto (SKU, nombre, precio, categoría)
    ↓
/recetas ────→ Asignar receta a un producto
               · Rendimiento (default 1)
               · Agregar insumos (ingredientes del inventario)
               · % merma por insumo (inline, no oculto)
               · Costo y margen se calculan automáticamente
               · Versión se auto-incrementa
```

Para subproductos:
```
/inventario → Ingrediente → Marcar como subproducto (recipeId)
    ↓
/recetas ───→ saveSubproductRecipe()
               · Rendimiento > 0
               · NO permite subproductos anidados (NESTED_SUBPRODUCT)
               · Al menos 1 insumo
```

### Producción

```
/produccion ──→ Nueva orden
                 1. Seleccionar subproducto (ingrediente con recipeId)
                 2. Cantidad a producir
                 3. Estado: DRAFT (se crea con costos estimados transitorios)
                 4. Botón "Completar" → DRAFT → COMPLETED (directo)
                 5. Descarga insumos, acredita producto, actualiza costos promedio
```

### Compras

```
/compras ───→ Nueva compra
               · Proveedor + método de pago + estado de pago
               · Líneas: ingrediente + unidad de compra + cantidad + precio unitario
               · Registra movimientos de inventario, actualiza costos promedio
```

### Ventas

```
/ventas ───→ Nueva venta
              · Seleccionar productos (listado con badge "sin receta")
              · Cantidad
              · Método de pago (efectivo requiere caja abierta)
              · Confirmar → CONFIRMED (sin borrador/cotización)
              · Si el producto no tiene receta: descuento de inventario SKIP,
                unitCostSnapshot=0, warning toast
```

### Caja

```
/caja ─────→ Abrir sesión (monto inicial)
              ↓
             Vender en efectivo (automático)
              ↓
             Cerrar sesión
               · Muestra "Efectivo esperado: Q594.08"
               · Pre-rellena el campo con ese valor
               · Guarda expectedAmount, countedAmount, differenceAmount
```

### Dashboard

```
/resumen ───→ KPIs: ventas netas, utilidad bruta + margen %, ticket promedio,
               efectivo esperado, valor de inventario
               · Gráfico ventas por día (barras)
               · Gráfico por categoría (pastel)
               · Ventas recientes (tabla)
               · Inventario crítico (bajo mínimo)
               · Compras del período, gastos del período
               · Top productos por ingresos
```

### Reportes (CSV + Power BI)

```
/reportes ──→ 5 exports CSV: ventas, compras, inventario, gastos, caja
               · Power BI: 9 vistas bi_* en PostgreSQL
                 · bi_sales_detail · bi_daily_sales · bi_product_profitability
                 · bi_purchase_detail · bi_inventory_current · bi_inventory_movements
                 · bi_expenses · bi_cash_closures · bi_profit_and_loss_monthly
```

---

## 3. Los 6 Gaps de Producción (detalle)

### Gap 1 — Sin estado IN_PROGRESS

**Archivo:** `prisma/schema.prisma:81-85`
```prisma
enum ProductionStatus {
  DRAFT
  COMPLETED
  CANCELLED
}
```

**Impacto:**
- No se puede distinguir entre "orden creada" y "orden en proceso"
- No se puede medir tiempo en producción vs. tiempo en borrador
- Riesgo de que alguien "complete" una orden que nunca se empezó

**Estadística bloqueada:** Tiempo de ciclo de producción (`startedAt → completedAt`)

### Gap 2 — Sin actualQuantity (rendimiento real)

**Archivo:** `prisma/schema.prisma:324-355`
```prisma
model ProductionOrder {
  quantity     Decimal   // cantidad PLANIFICADA
  unitCost     Decimal   // costo unitario al completar
  totalCost    Decimal   // costo total al completar
  // NO HAY: actualQuantity
}
```

**Impacto:**
- No se sabe si realmente se produjo lo planeado
- `unitCost = totalCost / plannedQuantity` aunque se hayan producido 1920g de 2000g planificados → costo unitario SUBestimado
- El sobrante planificado (80g "perdidos") queda invisible

**Estadística bloqueada:** Varianza de rendimiento por receta (`actualQty / plannedQty - 1`)

### Gap 3 — Sin merma real por insumo (derivada)

**Archivo:** `src/modules/production/service.ts` — `CompleteProductionOrderInput`
```typescript
type CompleteProductionOrderInput = {
  businessId: string;
  userId: string;
  orderId: string;
  // NO HAY: actualQuantity, ni merma por insumo
};
```

**Impacto:**
- Merma = la planeada en la receta (5% en fresas = 5% siempre, sin importar la realidad)
- No se puede detectar si una receta tiene merma irrelevante (0.5% real) o subestimada (12% real)
- No se puede optimizar procesos de producción

**Estadística bloqueada:** Costo real de merma en Q por período

### Gap 4 — estimatedUnitCost no se persiste

**Archivo:** `src/modules/production/service.ts:119-142` (creación) y `prisma/schema.prisma:324-355`

El `estimatedUnitCost` se calcula al crear la orden:
```typescript
const estimatedCost = calculateRecipeUnitCost(recipe.items, quantity);
```
Pero **no se guarda en la base de datos**. Solo se devuelve en la respuesta del `createProductionOrder()`.

**Impacto:**
- Al completar la orden, `unitCost` se recalcula con costos actuales de insumos
- No se puede comparar históricamente "¿cuánto pensé que iba a costar vs. cuánto costó?"
- Imposible analizar si las variaciones son por precio de insumos o por rendimiento

**Estadística bloqueada:** Varianza de costo (`unitCost / estimatedUnitCost - 1`)

### Gap 5 — Producción invisible en analytics

**Archivos:** `sql/bi-views.sql` (9 vistas), `reportes/page.tsx` (5 exports), `resumen/page.tsx` (dashboard)

| Analytics | Ventas | Compras | Inventario | Gastos | Caja | **Producción** |
|---|---|---|---|---|---|---|
| Vista BI | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** |
| CSV export | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** |
| Dashboard KPIs | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** |

**Impacto:**
- El dueño del negocio no puede ver cuánto se produjo en el período
- No hay tendencias de rendimiento por receta
- No hay reporte de eficiencia de producción

### Gap 6 — occurredAt = creación, no inicio

**Archivo:** `prisma/schema.prisma:335`
```prisma
occurredAt     DateTime   @default(now())  // ← se setea al CREAR la orden
completedAt    DateTime?                     // ← se setea al COMPLETAR
// NO HAY: startedAt
```

**Impacto:**
- `completedAt - occurredAt` mide "cuánto tiempo existió la orden", no "cuánto se tardó en producir"
- Una orden creada un lunes y completada el viernes pudo tener 4 días en borrador y 1 hora de producción real
- No se puede comparar eficiencia entre lotes

**Estadística bloqueada:** Tiempo real de producción (`startedAt → completedAt`)

---

## 4. Decisiones de Negocio Bloqueadas Hoy

| Pregunta del dueño | Respuesta hoy | Respuesta con Fase 1+2 |
|---|---|---|
| "Mi receta de Jalea de Fresa usa 600g de fresas con 5% de merma. ¿Es realista?" | ❌ No se sabe — la merma real nunca se registra | ✅ Varianza de rendimiento por receta, recalibración sugerida |
| "¿Cuánto estoy perdiendo en merma real cada mes?" | ❌ Imposible de calcular | ✅ Costo de merma real = (plan - real) × unitCost |
| "¿Mis costos estimados son confiables para poner precio?" | ❌ El estimado no se persiste, no hay histórico | ✅ % de desviación entre estimado y real por orden |
| "¿Estoy siendo más eficiente que el mes pasado?" | ❌ No hay métricas de producción en dashboard | ✅ Tendencias de rendimiento y tiempo de ciclo |
| "¿Cuánto tiempo toma producir un lote de Jalea?" | ❌ `completedAt - occurredAt` incluye tiempo en borrador | ✅ Tiempo real = `completedAt - startedAt` |
| "Qué recetas tienen más desperdicio?" | ❌ Sin dato de merma real | ✅ Top N recetas por desviación de rendimiento |

---

## 5. Roadmap

### Fase 1 — Realismo de Producción

#### 5.1. Migración de Schema

**`prisma/schema.prisma` — Cambio en enum:**
```prisma
enum ProductionStatus {
  DRAFT
  IN_PROGRESS      // ← NUEVO
  COMPLETED
  CANCELLED
}
```

**`prisma/schema.prisma` — Cambio en model ProductionOrder:**
```prisma
model ProductionOrder {
  id                String           @id @default(uuid()) @db.Uuid
  businessId        String           @map("business_id") @db.Uuid
  orderNumber       Int              @map("order_number")
  ingredientId      String           @map("ingredient_id") @db.Uuid
  recipeId          String           @map("recipe_id") @db.Uuid
  quantity          Decimal          @db.Decimal(14, 3)

  // NUEVOS CAMPOS:
  actualQuantity    Decimal?         @map("actual_quantity") @db.Decimal(14, 3)
  estimatedUnitCost Decimal?         @map("estimated_unit_cost") @db.Decimal(14, 4)
  estimatedTotalCost Decimal?        @map("estimated_total_cost") @db.Decimal(14, 2)

  status            ProductionStatus @default(DRAFT)
  notes             String?

  // NUEVO: startedAt — momento en que se inicia la producción real
  occurredAt        DateTime         @default(now()) @map("occurred_at") @db.Timestamptz
  startedAt         DateTime?        @map("started_at") @db.Timestamptz
  completedAt       DateTime?        @map("completed_at") @db.Timestamptz
  cancelledAt       DateTime?        @map("cancelled_at") @db.Timestamptz
  cancelReason      String?          @map("cancel_reason")

  userId            String           @map("user_id") @db.Uuid
  // NUEVO: quién inició la producción
  startedById       String?          @map("started_by") @db.Uuid
  completedById     String?          @map("completed_by") @db.Uuid

  createdAt         DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime         @updatedAt @map("updated_at") @db.Timestamptz

  // Relaciones existentes + NUEVA:
  business    Business    @relation(fields: [businessId], references: [id])
  ingredient  Ingredient  @relation(fields: [ingredientId], references: [id])
  recipe      Recipe      @relation(fields: [recipeId], references: [id])
  user        User        @relation(fields: [userId], references: [id])
  completedBy User?       @relation("ProductionCompletedBy", fields: [completedById], references: [id])
  startedBy   User?       @relation("ProductionStartedBy", fields: [startedById], references: [id]) // NUEVA

  @@unique([businessId, orderNumber])
  @@index([businessId, occurredAt])
  @@index([businessId, status])
  @@index([ingredientId])
  @@map("production_orders")
}
```

**SQL de migración (PostgreSQL):**
```sql
ALTER TYPE "ProductionStatus" ADD VALUE 'IN_PROGRESS';

ALTER TABLE "production_orders"
  ADD COLUMN "actual_quantity" DECIMAL(14,3),
  ADD COLUMN "estimated_unit_cost" DECIMAL(14,4),
  ADD COLUMN "estimated_total_cost" DECIMAL(14,2),
  ADD COLUMN "started_at" TIMESTAMPTZ,
  ADD COLUMN "started_by" UUID REFERENCES "users"("id"),
  ADD COLUMN "verified_estimated_cost" BOOLEAN DEFAULT FALSE;
```

#### 5.2. Servicios (src/modules/production/service.ts)

**Nueva función: `startProductionOrder`**
```typescript
export async function startProductionOrder(params: {
  businessId: string;
  userId: string;
  orderId: string;
}) {
  // Validar que existe y está en DRAFT
  // Transición: DRAFT → IN_PROGRESS
  // Setear: startedAt = now(), startedById = userId
  // Requiere: orden en estado DRAFT
  // Previene: completar sin iniciar primero
}
```

**Cambios en `completeProductionOrder`:**
```typescript
export async function completeProductionOrder(params: {
  businessId: string;
  userId: string;
  orderId: string;
  actualQuantity?: number;     // ← NUEVO (opcional, default = quantity)
}) {
  // Validar: orden debe estar en IN_PROGRESS (o DRAFT? Decisión: solo IN_PROGRESS)
  // Si actualQuantity no se provee: usar quantity (comportamiento actual)
  // Cálculos:
  //   actual = actualQuantity ?? quantity
  //   unitCost = totalInputCost / actual  (en vez de totalInputCost / quantity)
  //   totalCost = totalInputCost
  //   inMovement = actual (PRODUCTION_IN)
  //   outMovements = según receta (PRODUCTION_OUT, consumos exactos)
  // Setear: completedAt = now(), completedById = userId
  // Transición: IN_PROGRESS → COMPLETED
}
```

**Cambios en `cancelProductionOrder`:**
```typescript
// Extender para permitir cancelación desde IN_PROGRESS también
// (hoy solo permite DRAFT → CANCELLED y COMPLETED → CANCELLED con reversión)
// IN_PROGRESS → CANCELLED: NO revierte inventario (nunca se consumieron insumos)
```

**Cambios en `createProductionOrder`:**
```typescript
// Al crear la orden, PERSISTIR estimatedUnitCost y estimatedTotalCost:
//   estimatedUnitCost = calculateRecipeUnitCost(items, quantity)
//   estimatedTotalCost = estimatedUnitCost × quantity
//   Guardar en los nuevos campos de ProductionOrder
```

#### 5.3. UI Cambios

**`src/components/production/production-detail-card.tsx`** (nuevos elementos):

- Si estado = DRAFT:
  - Botón **"Iniciar producción"** (llama a `startProductionOrder`)
  - Botón "Completar" deshabilitado, tooltip: "Debe iniciar la producción primero"

- Si estado = IN_PROGRESS:
  - Badge de estado "En progreso" (color amarillo/naranja)
  - Botón **"Completar producción"** → modal/dialog
  - En el modal: campo opcional "Rendimiento real ({unidad})" pre-rellenado con la cantidad planificada
  - Texto: "Si el rendimiento real fue diferente al planificado, ajústalo aquí"
  - Botón secundario: "Completar sin cambios" (usa quantity)

- Si estado = COMPLETED (nuevo):
  - Si `actualQuantity ≠ quantity`:
    - Sección "Varianza de rendimiento"
    - Badge rojo o verde según si produjo más o menos
    - Texto: "Plan: {qty} → Real: {actualQty} ({diff}%)"

- Comparativa de costos:
  - Si `estimatedUnitCost` existe:
    - Mostrar "Costo estimado: QX.XX" vs "Costo real: QY.YY"
    - Badge de varianza: "↑ +5.2%" (rojo) o "↓ -2.1%" (verde)

**`src/app/(dashboard)/produccion/page.tsx`** (tabla):

- Nueva columna: estado con badge IN_PROGRESS
- Nueva columna: rendimiento (% de cumplimiento si completed)
- Filtro rápido: "Borrador | En progreso | Completadas | Canceladas"

**`src/app/(dashboard)/produccion/nueva/page.tsx`** (creación):

- Sin cambios mayores (la creación sigue igual)
- El estimado se persistirá automáticamente al crear

#### 5.4. Costos derivados del actualQuantity

**Sin actualQuantity (hoy):**
```
totalInputCost = Σ (cantidad_insumo × costo_promedio_unitario)
unitCost = totalInputCost / plannedQuantity     ← subestimado si hubo pérdida
```

**Con actualQuantity (Fase 1):**
```
totalInputCost = Σ (cantidad_insumo × costo_promedio_unitario)  ← igual
actualQuantity = lo que rindió realmente
unitCost = totalInputCost / actualQuantity                       ← real
mermaReal = plannedQuantity - actualQuantity                     ← cuanto faltó
costoMerma = mermaReal × unitCost                                ← costo de lo perdido
```

Ejemplo: Jalea de Fresa, plan 2000g, real 1920g:
```
totalInputCost = (1260g fresas × Q0.03) + (600g azúcar × Q0.008) + ... = Q52.80
unitCost (hoy)   = Q52.80 / 2000g = Q0.0264/g  ← ignora pérdida
unitCost (fase1) = Q52.80 / 1920g = Q0.0275/g  ← costo real más alto
mermaReal = 80g × Q0.0275 = Q2.20 de insumos perdidos en el lote
```

---

### Fase 2 — Estadísticas de Producción

#### 5.5. Vista BI: `bi_production_variance`

**Archivo:** `sql/bi-views.sql` — agregar al final

```sql
CREATE OR REPLACE VIEW bi_production_variance AS
SELECT
  po.id                                                        AS order_id,
  po.order_number                                               AS order_number,
  b.name                                                        AS business_name,
  i.name                                                        AS ingredient_name,
  i.sku                                                         AS ingredient_sku,
  i.base_unit_id                                                AS base_unit_id,
  u.code                                                        AS base_unit_code,
  po.quantity                                                    AS planned_quantity,
  COALESCE(po.actual_quantity, po.quantity)                      AS actual_quantity,
  ROUND(
    ((COALESCE(po.actual_quantity, po.quantity) - po.quantity)
      / NULLIF(po.quantity, 0)) * 100, 2
  )                                                              AS yield_variance_pct,
  po.estimated_unit_cost                                          AS estimated_unit_cost,
  po.unit_cost                                                    AS actual_unit_cost,
  CASE
    WHEN po.estimated_unit_cost IS NOT NULL
     AND po.estimated_unit_cost > 0
    THEN ROUND(
      ((po.unit_cost - po.estimated_unit_cost)
        / po.estimated_unit_cost) * 100, 2
    )
  END                                                             AS cost_variance_pct,
  po.estimated_total_cost                                          AS estimated_total_cost,
  po.total_cost                                                    AS actual_total_cost,
  po.total_cost - COALESCE(po.estimated_total_cost, 0)             AS cost_variance_abs,
  CASE
    WHEN po.quantity > COALESCE(po.actual_quantity, po.quantity)
    THEN (po.quantity - COALESCE(po.actual_quantity, po.quantity))
         * po.unit_cost
    ELSE 0
  END                                                              AS waste_cost,
  po.status                                                        AS status,
  po.occurred_at                                                   AS occurred_at,
  po.started_at                                                    AS started_at,
  po.completed_at                                                  AS completed_at,
  CASE
    WHEN po.completed_at IS NOT NULL
     AND po.started_at IS NOT NULL
    THEN ROUND(
      EXTRACT(EPOCH FROM (po.completed_at - po.started_at)) / 3600, 2
    )
  END                                                              AS cycle_time_hours,
  po.quantity * COALESCE(po.estimated_unit_cost, 0)                AS planned_cost_total,
  po.total_cost - po.quantity * COALESCE(po.estimated_unit_cost, 0) AS total_variance_abs,
  po.created_at                                                    AS created_at
FROM production_orders po
JOIN businesses b    ON b.id = po.business_id
JOIN ingredients i   ON i.id = po.ingredient_id
LEFT JOIN units u    ON u.id = i.base_unit_id;
```

**Roles:**
```sql
-- Agregar a la GRANT existente en sql/roles.sql
GRANT SELECT ON bi_production_variance TO bi_readonly;
```

#### 5.6. Export CSV de producción

**Archivo:** `src/app/(dashboard)/reportes/page.tsx`

Agregar a `reports[]`:
```typescript
{
  id: "production",
  title: "Producción",
  description: "Órdenes de producción con varianza de rendimiento y costo",
}
```

**Archivo:** `src/app/api/exports/[report]/route.ts`

Agregar handler para `produccion.csv`:
- Columnas: orden, ingrediente, plan, real, varianza %, costo estimado, costo real, varianza costo %, costo merma, tiempo ciclo, estado, fechas

#### 5.7. Dashboard — Métricas de producción en Resumen

**Archivo:** `src/app/(dashboard)/resumen/page.tsx`

Agregar al módulo de dashboard (`src/modules/dashboard/service.ts`) nuevos KPIs:
- `productionOutput` — cantidad total producida en el período (suma de actualQuantity)
- `avgYieldVariance` — varianza de rendimiento promedio del período
- `wasteCost` — costo total de merma real en el período
- `productionOrderCount` — órdenes completadas en el período

Nuevo card en el dashboard:
```
┌─────────────────────────────────────┐
│ Producción del período               │
│                                      │
│ Jalea producida: 15,240g  (8 órdenes)│
│ Rendimiento promedio: 97.3%          │
│ Costo merma real: Q18.50             │
│ Tiempo ciclo promedio: 1.5h          │
└─────────────────────────────────────┘
```

#### 5.8. Estados y transiciones (diagrama)

```
                  ┌──────────┐
                  │  DRAFT   │
                  │ (creada) │
                  └────┬─────┘
                       │
                 Botón "Iniciar"
                       │
                  ┌────▼──────┐
                  │ IN_PROGRESS│ ◄── NUEVO
                  │ (trabajo)  │
                  └────┬───────┘
                       │
                 Botón "Completar"
                  (actualQuantity opcional)
                       │
                  ┌────▼────────┐
                  │  COMPLETED  │
                  │ (terminada) │
                  └─────────────┘

Cancelar: DRAFT → CANCELLED (sin reversión)
          IN_PROGRESS → CANCELLED (sin reversión, nunca se consumió inventario)
          COMPLETED → CANCELLED (con reversión de inventario — ya existe hoy)
```

---

### Fase 3 — Soporte a Decisiones

#### 5.9. Alertas de calibración de recetas

Cuando una receta tiene 3+ órdenes completadas con varianza de rendimiento consistentemente < 0 (produjo menos de lo planeado), mostrar alerta:

> "La receta 'Jalea de Fresa' ha tenido un rendimiento real de 95.2% en promedio en las últimas 5 órdenes. El rendimiento planificado es 100%. ¿Deseas recalibrar la receta?"

Acción sugerida: ajustar `yieldQuantity` de la receta al promedio real observado.

**Estadística base:** `bi_production_variance` → `yield_variance_pct` agrupado por `ingredient_id` con `COUNT(*) >= 3`.

#### 5.10. Tendencia de costo de subproductos

```sql
-- Consulta habilitada por Fase 1+2
SELECT
  i.name,
  date_trunc('month', po.completed_at) AS mes,
  AVG(po.unit_cost) AS costo_promedio,
  AVG(po.estimated_unit_cost) AS costo_estimado_promedio,
  COUNT(*) AS ordenes
FROM bi_production_variance
WHERE status = 'COMPLETED'
GROUP BY i.name, mes
ORDER BY i.name, mes;
```

Gráfico en Resumen: línea de costo unitario real de cada subproducto por mes.

#### 5.11. Reporte de eficiencia mensual

Export CSV o sección en dashboard:
- Ingrediente producido
- Cantidad planificada total
- Cantidad real total
- Varianza de rendimiento %
- Costo de merma total (Q)
- Tiempo de ciclo promedio (horas)
- Órdenes completadas

---

### Backlog (no producción, prioridad secundaria)

| Ítem | Descripción | Dependencia |
|---|---|---|
| Import CSV de ingredientes | Subir archivo para crear múltiples ingredientes de una vez | — |
| Plantillas por tipo de negocio | "Cafetería", "Restaurant", "Bubble Tea" → ingredientes pre-cargados | — |
| Cotización / borrador de venta | `SaleStatus.DRAFT` o entidad `Quote` separada | — |
| Costos fijos no inventariables en receta | Tipo de insumo que no descuenta inventario (gas, electricidad, servicio) | — |
| Margen visible en POS | Mostrar costo y margen al seleccionar producto en `sale-form.tsx` | — |
| Subproductos anidados | Permitir que un subproducto use otro subproducto (remover `NESTED_SUBPRODUCT`) | Fase 1+2 (requiere resolver cálculo de costos recursivo) |
| Auto-cálculo factor de conversión | kg→g = 1000 automático cuando unidad base y compra son del mismo grupo | — |

---

## 6. Métricas de Éxito

| # | Métrica | Cómo se calcula | Dato de entrada habilitado por |
|---|---|---|---|
| 1 | **Varianza de rendimiento por receta** | `actualQuantity / quantity - 1` (promedio por receta) | Fase 1: `actualQuantity` |
| 2 | **Costo de merma real (Q/período)** | `SUM((quantity - actualQuantity) × unitCost)` por período | Fase 1: `actualQuantity` |
| 3 | **Varianza de costo estimado vs. real** | `unitCost / estimatedUnitCost - 1` (promedio por período) | Fase 1: `estimatedUnitCost` persistido |
| 4 | **Tiempo de ciclo de producción** | `completedAt - startedAt` (promedio, mediana) | Fase 1: `startedAt` |
| 5 | **% de órdenes con desviación > 10%** | `COUNT(variance > 10%) / COUNT(*)` por período | Fase 1 + Fase 2 (BI view) |

---

## 7. Apéndice — Matriz de Verificación Propuesta vs. Realidad

Propuestas del borrador original que **NO se incluyen** en este documento porque ya están implementadas:

| Propuesta descartada | Estado real |
|---|---|
| Asistente de configuración guiada | ✅ Ya existe en `/setup` con 3 pasos + "Saltar setup" |
| Unidades base pre-cargadas | ✅ El wizard las recibe como props (seed existe) |
| Framing "1 kg = ? g" para factor de conversión | ✅ Wizard paso 2: "1 {purchaseUnit} = ? {baseUnit}" |
| Vender sin receta (¡Vende primero!) | ✅ Servicio + UI badge + toast warnings |
| Sistema sugiere monto esperado al cerrar caja | ✅ Pre-rellena campo + desglose en página |
| Dashboard con utilidad bruta y margen | ✅ Cards en resumen: Ventas netas, Utilidad bruta + Margen % |
| Dashboard con efectivo esperado | ✅ Card en resumen |
| Dashboard con ventas recientes | ✅ Tabla en resumen |
| Dashboard con inventario crítico | ✅ Card en resumen |
| Dashboard con top productos | ✅ Lista en resumen |
| Dashboard con compras y gastos del período | ✅ Cards en resumen |
| Reportes de ventas, compras, inventario, gastos, caja | ✅ 5 exports CSV + 9 vistas BI para Power BI |
| Costo unitario visible en recetas y producción | ✅ En recipes-view, production-detail-card, sales detail |
| Margen % en recetas | ✅ Badge "Margen {X}%" en recipes-view |
