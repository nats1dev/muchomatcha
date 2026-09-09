# REQUISITOS — IDs estables del sistema

> Fuente: criterios de aceptación `MVP.md §13` (REQ-01…REQ-16) + roadmap de
> producción `UserJourney-v0001.md §5` (REQ-17…REQ-22). Cada requisito enlaza a
> su evidencia en `MATRIZ-TRAZABILIDAD.md`. No se duplica la especificación:
> el texto completo vive en `MVP.md`.

## Operación (MVP)

| ID | Requisito | Fuente |
|---|---|---|
| REQ-01 | El propietario inicia sesión con correo y contraseña | MVP §5, §13.1 |
| REQ-02 | CRUD de categorías, productos, ingredientes, proveedores y recetas | MVP §13.2 |
| REQ-03 | El costo de receta se calcula desde los costos de ingredientes (con merma y rendimiento) | MVP §13.3, §7.1 |
| REQ-04 | Registrar venta con varios productos; confirma directo a CONFIRMED | MVP §6.2, §13.4 |
| REQ-05 | La venta descuenta ingredientes según receta; sin receta solo advierte (no bloquea) | MVP §13.5, regla 7 |
| REQ-06 | Registrar compra convierte a unidad base, actualiza costo promedio e inventario | MVP §6.3, §13.6, §7.3 |
| REQ-07 | Registrar gastos (fijos/variables); en efectivo exigen caja abierta | MVP §6.5, §13.7 |
| REQ-08 | Registrar merma, ajuste con motivo obligatorio y conteo físico | MVP §6.4, §13.8, regla 8 |
| REQ-09 | Abrir/cerrar caja con diferencia `contado − esperado`; cerrada no se edita | MVP §6.6, §13.9, regla 10 |
| REQ-10 | El panel filtra por fechas y sus totales coinciden con lo registrado | MVP §13.10, §13.11, §7.5 |
| REQ-11 | Ventas anuladas (lógicas, nunca borrado) se excluyen de ventas netas | MVP §13.12, regla 9 |

## Analítica (MVP)

| ID | Requisito | Fuente |
|---|---|---|
| REQ-12 | Vistas `bi_*` consistentes, legibles por Power BI con usuario de solo lectura | MVP §9, §13.13, §13.14 |
| REQ-13 | Exportes CSV de reportes principales | MVP §13.15 |
| REQ-14 | Interfaz usable en computadora y tableta, con estados vacíos y validaciones | MVP §4, §12, §13.16 |
| REQ-15 | Auditoría de quién creó/modificó/anuló operaciones sensibles | MVP §5 |
| REQ-16 | Precios y costos históricos congelados en venta/compra (no cambian al editar catálogos) | MVP regla 3–4, §7.1 |

## Producción — realismo (roadmap, ya implementado en código)

| ID | Requisito | Fuente | Estado en código |
|---|---|---|---|
| REQ-17 | Orden con estado IN_PROGRESS: DRAFT → IN_PROGRESS → COMPLETED | Journey §5.1–5.2 | Implementado (`ProductionStatus`, `startProductionOrder`) |
| REQ-18 | Cantidad real (`actualQuantity`) puede diferir de la planificada | Journey Gap 2 | Implementado (`completeProductionOrder` acepta `actualQuantity`) |
| REQ-19 | Costo estimado persiste (`estimatedUnitCost`) para varianza estimado vs real | Journey Gap 4 | Implementado (columnas + vista `bi_production_variance`) |
| REQ-20 | Tiempo real de producción (`startedAt → completedAt`), no tiempo en borrador | Journey Gap 6 | Implementado (`startedAt`, `startedById`) |
| REQ-21 | Merma real por insumo para calibrar % de recetas | Journey Gap 3 | Parcial: se usa % de receta; sin captura de merma real por insumo |
| REQ-22 | Producción visible en analítica (BI + CSV + dashboard) | Journey Gap 5 | Parcial: vista `bi_production_variance` existe; CSV/dashboard por verificar |
