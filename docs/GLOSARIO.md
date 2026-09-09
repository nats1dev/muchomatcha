# GLOSARIO — términos del dominio

| Término | Significado en este proyecto |
|---|---|
| Receta (APU) | Lista de ingredientes + cantidades + % merma + rendimiento que define cuánto cuesta producir una unidad de un producto o subproducto |
| Subproducto | Ingrediente producido internamente (ej. jalea de fresa) con su propia receta; luego se usa como insumo de un producto final |
| Merma | % que se pierde al preparar (rebalse, evaporación, recorte); se aplica como `cantidad × (1 + merma)` |
| Rendimiento | Salida esperada de una receta (ej. 1000 g de jalea, 1 unidad de bebida) |
| Kardex | Historial de movimientos de inventario (`inventory_movements`): entradas, salidas, mermas, ajustes, conteos |
| Costo promedio | Costo vigente por unidad base de un ingrediente; se recalcula con cada compra (promedio ponderado móvil) |
| Costo snapshot | Copia del costo/precio guardada en la venta o compra para que el historial no cambie |
| Caja / turno | Sesión de efectivo: apertura con fondo inicial, movimientos, cierre con diferencia `contado − esperado` |
| Efectivo esperado | Fondo inicial + ventas en efectivo + ingresos − retiros − gastos en efectivo |
| Anulación lógica | Marcar como anulado (con motivo, usuario y fecha) en vez de borrar; genera movimientos inversos |
| Unidad base | Unidad en que se controla el inventario (g, ml, u); distinta de la unidad de compra (kg, l) |
| Factor de conversión | Cuántas unidades base equivale 1 unidad de compra (ej. 1 kg = 1000 g) |
| Vista `bi_*` | Vista SQL de solo lectura para Power BI/CSV (nunca se escribe en ella) |
| Borrador de venta | Venta en estado DRAFT (`createDraftSale`); solo afecta inventario/caja al confirmarse |
| Orden de producción | DRAFT → IN_PROGRESS → COMPLETED (o CANCELLED); al completarse descuenta insumos y acredita el subproducto |
