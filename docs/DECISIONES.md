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
