Ya tengo la especificación. Antes de cerrar el plan, revisaré brevemente la estructura actual del repositorio para distinguir qué debe crearse desde cero y qué puede reutilizarse.

No puedo inspeccionar el repositorio con las herramientas en este turno, así que el plan asume una implementación nueva. Está basado íntegramente en 
MVP.md
.

Plan de implementación del primer prototipo funcional
1. Objetivo del prototipo
Construir una aplicación web desplegable que permita completar el ciclo operativo principal:

Configurar productos, ingredientes, proveedores y recetas.
Abrir una caja.
Registrar compras para ingresar inventario.
Registrar ventas y descontar ingredientes.
Registrar gastos, mermas y ajustes.
Cerrar caja y calcular la diferencia.
Consultar indicadores consistentes.
Exportar reportes y exponer vistas para Power BI.
El prototipo debe priorizar integridad de datos y operación completa sobre funcionalidades secundarias o refinamiento visual exhaustivo.

2. Alcance recomendado del primer corte
Incluido en el prototipo funcional
Autenticación de propietario.
Configuración básica del negocio.
Layout responsivo y sistema visual.
CRUD de categorías, productos, ingredientes y proveedores.
Recetas versionadas y cálculo de costo.
Registro y anulación de ventas.
Registro de compras.
Kardex y existencias teóricas.
Mermas, ajustes y conteos.
Gastos.
Apertura, movimientos y cierre de caja.
Dashboard con filtro de fechas.
CSV de reportes principales.
Vistas analíticas bi_*.
Datos de demostración.
Auditoría de operaciones sensibles.
Despliegue de desarrollo y producción.
Simplificaciones conscientes
Para llegar antes a un prototipo estable:

Un solo negocio y una sola caja operativa, aunque las tablas incluyan business_id.
Un único rol habilitado: OWNER.
Sin carga de comprobantes.
Sin edición compleja de ventas confirmadas; solo anulación.
Sin costos por lotes ni FIFO: costo promedio ponderado móvil.
Modificadores de venta sin impacto en receta en la primera versión, o excluidos hasta definir su modelo.
Exportaciones generadas bajo demanda, sin trabajos en segundo plano.
Dashboard con gráficos esenciales, no todas las visualizaciones deseables.
Unidades y métodos de pago definidos mediante enumeraciones o tablas de configuración simples.
3. Stack técnico propuesto
Capa	Tecnología
Aplicación	Next.js 15+ con App Router
Lenguaje	TypeScript estricto
UI	React, Tailwind CSS y componentes accesibles basados en Radix UI
Formularios	React Hook Form
Validación	Zod, compartido entre servidor y cliente
Base de datos	PostgreSQL 16+
ORM	Prisma
Autenticación	Auth.js con credenciales y sesiones persistentes
Hash de contraseña	Argon2id
Gráficos	Recharts
Tablas	TanStack Table
Fechas	date-fns con zona horaria explícita
Pruebas unitarias	Vitest
Pruebas de componentes	Testing Library
Pruebas E2E	Playwright
Calidad	ESLint, Prettier y TypeScript
Contenedores	Docker y Docker Compose
CI	GitHub Actions
Despliegue	Plataforma Next.js + PostgreSQL administrado, o contenedores
Decisiones importantes
Los cálculos monetarios no se realizarán con number de JavaScript. Se utilizará Prisma.Decimal o una librería decimal.
Las operaciones críticas vivirán en servicios de dominio del servidor, no en componentes React ni directamente en controladores.
Las ventas, compras, anulaciones, conteos y cierres usarán transacciones SQL.
Las existencias se derivarán del kardex, con una vista o consulta agregada como fuente canónica.
La zona horaria del negocio debe guardarse, inicialmente America/Guatemala.
4. Arquitectura interna

Apply
Interfaz Next.js
    ↓
Server Actions / Route Handlers
    ↓
Autenticación + validación Zod
    ↓
Servicios de dominio
    ↓
Transacciones Prisma
    ↓
PostgreSQL
    ├── Tablas operativas
    ├── Vistas de consulta
    └── Vistas bi_*
Separación por capas
Presentación
Páginas.
Formularios.
Tablas.
Gráficos.
Diálogos de confirmación.
Estados vacíos, carga y error.
Aplicación
Casos de uso como createSale, voidSale, receivePurchase o closeCashSession.
Autorización.
Validaciones que involucran varias entidades.
Dominio
Cálculo de impuestos.
Conversión de unidades.
Costo de recetas.
Costo promedio.
Inventario.
Totales de ventas.
Efectivo esperado.
Utilidad y margen.
Infraestructura
Prisma/PostgreSQL.
Sesiones.
Auditoría.
Exportación CSV.
Logging.
5. Estructura sugerida del proyecto

Apply
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── resumen/
│   │   ├── ventas/
│   │   ├── productos/
│   │   ├── recetas/
│   │   ├── inventario/
│   │   ├── compras/
│   │   ├── gastos/
│   │   ├── caja/
│   │   ├── reportes/
│   │   └── configuracion/
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   └── charts/
├── modules/
│   ├── auth/
│   ├── catalog/
│   ├── recipes/
│   ├── sales/
│   ├── purchases/
│   ├── inventory/
│   ├── expenses/
│   ├── cash/
│   ├── dashboard/
│   ├── reports/
│   └── audit/
├── lib/
│   ├── db/
│   ├── auth/
│   ├── decimal/
│   ├── dates/
│   ├── csv/
│   └── errors/
└── styles/
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
sql/
├── bi-views.sql
└── roles.sql
tests/
├── unit/
├── integration/
└── e2e/
Cada módulo debe reunir esquemas Zod, consultas, servicios y tipos relacionados, evitando un directorio global de servicios sin organización.

6. Ajustes necesarios al modelo de datos
La especificación es una buena base, pero requiere completar algunos detalles antes de migrar.

6.1 Consistencia de pertenencia al negocio
Agregar business_id directamente o garantizarlo mediante relaciones en:

products
ingredients
recipes
suppliers
purchases
inventory_movements
expenses
cash_movements
Aunque varias entidades pueden inferirlo desde sus relaciones, incluirlo en entidades operativas mejora seguridad, filtrado y Power BI. Toda consulta debe estar limitada al negocio de la sesión.

6.2 Unidades y conversiones
La compra necesita convertir presentaciones a unidad base. Se recomienda agregar:

units: código, nombre, dimensión y decimales.
ingredient_purchase_units: ingrediente, unidad de compra, factor hacia unidad base y estado.
Ejemplo: un saco de café de 2.5 kg equivale a 2,500 gramos.

La regla debe ser:

base_quantity = purchase_quantity × conversion_factor

No se debe permitir una compra sin una conversión válida.

6.3 Costos de ingredientes
Agregar a ingredients:

current_average_cost, expresado por unidad base.
Opcionalmente last_purchase_cost.
El costo promedio después de una compra será:

(valor previo + valor de entrada) / (existencia previa + cantidad recibida)

Debe definirse qué ocurre con inventario negativo. Para el prototipo se recomienda:

Permitir venta con existencia insuficiente, pero mostrar advertencia.
Al recalcular costo por compra, evitar que existencia negativa distorsione el promedio.
Registrar estos casos como alertas.
6.4 Ventas y caja
Agregar a sales:

cash_session_id, nullable para métodos no efectivos o ventas registradas fuera de caja.
voided_at, voided_by, void_reason.
notes.
Agregar tabla sale_payments si una venta puede usar pago mixto. Si el prototipo no necesita pagos mixtos, conservar payment_method en sales y documentar la limitación.

6.5 Compras
Agregar a purchases:

business_id.
status: borrador, recibida o anulada.
payment_method.
Campos de anulación si las compras podrán corregirse.
Para el prototipo, una compra se crea directamente como RECEIVED; su edición posterior se bloquea. La corrección se realiza con reversión y nuevo registro.

6.6 Inventario
Tipos mínimos de movimiento:

INITIAL
PURCHASE
SALE
SALE_VOID
WASTE
ADJUSTMENT_IN
ADJUSTMENT_OUT
COUNT_ADJUSTMENT
PURCHASE_REVERSAL
Debe existir una restricción única que impida duplicar movimientos para la misma línea y tipo de referencia cuando corresponda.

El conteo físico debe:

Capturar la existencia teórica al iniciar o confirmar.
Guardar la cantidad física.
Calcular diferencia.
Crear un movimiento por la diferencia.
Marcar el conteo como confirmado.
6.7 Caja
Además de cash_movements, las ventas en efectivo forman parte del esperado sin necesidad de duplicarse como movimiento manual.

La fórmula será:


Apply
efectivo esperado =
    fondo inicial
  + ventas en efectivo confirmadas
  + ingresos extraordinarios
  - retiros
  - devoluciones o anulaciones en efectivo
Agregar:

cash_session.sale_cash_total solo si se desea snapshot al cierre.
close_notes.
Restricción de una sola caja abierta por negocio.
6.8 Gastos
Definir si los gastos pagados en efectivo afectan caja. Recomendación:

Si payment_method = CASH y payment_status = PAID, exigir una caja abierta.
Crear automáticamente un cash_movement de salida vinculado al gasto.
Agregar referencia del movimiento al gasto para prevenir duplicados.
6.9 Auditoría y concurrencia
created_at y updated_at en todas las tablas.
created_by y updated_by donde aplique.
version o comparación de updated_at para evitar ediciones perdidas.
audit_log con JSONB.
Índices por business_id, fechas, estados y claves foráneas.
6.10 Restricciones y precisión
CHECK amount >= 0.
CHECK quantity > 0 en líneas.
Correos normalizados y únicos.
SKU único por negocio, preferiblemente insensible a mayúsculas.
Una receta activa por producto mediante índice único parcial de PostgreSQL.
Una caja abierta por negocio mediante índice único parcial.
Documento de compra único por proveedor cuando no sea nulo.
Importes de línea recalculados en servidor, nunca aceptados como autoridad desde el cliente.
7. Contratos y reglas de dominio
7.1 Registro de venta
Dentro de una única transacción:

Validar usuario y negocio.
Validar que todos los productos estén activos.
Recuperar precios actuales y recetas activas.
Recalcular subtotal, descuentos, impuestos y total.
Generar número correlativo seguro.
Crear encabezado y líneas.
Calcular y guardar costo histórico por línea.
Crear salidas de inventario por ingrediente.
Asociar caja abierta si corresponde.
Escribir auditoría.
Confirmar transacción.
El costo unitario histórico del producto debe considerar cantidad, rendimiento y merma de receta:

cantidad efectiva = cantidad receta × (1 + porcentaje merma) / rendimiento

7.2 Anulación de venta
Bloquear la venta.
Verificar que esté confirmada.
Cambiar estado a anulada.
Crear movimientos inversos de inventario.
Ajustar el efectivo esperado mediante el estado de la venta o movimiento de reversión.
Registrar motivo, usuario y fecha.
Escribir auditoría.
La operación debe ser idempotente: un segundo intento no puede duplicar reversiones.

7.3 Recepción de compra
Validar proveedor y conversiones.
Recalcular importes.
Crear compra y líneas.
Convertir a unidad base.
Calcular nuevo costo promedio.
Actualizar costo actual del ingrediente.
Crear entradas de inventario.
Registrar auditoría.
7.4 Cierre de caja
Bloquear sesión abierta.
Calcular esperado desde operaciones confirmadas.
Recibir efectivo contado.
Calcular diferencia.
Guardar snapshot de totales.
Marcar caja como cerrada.
Impedir nuevas operaciones vinculadas.
Registrar auditoría.
7.5 Dashboard
Todas las métricas deben excluir anulaciones y usar el mismo período y zona horaria:

Ventas netas: suma de ventas confirmadas.
Costo: suma de snapshots de líneas.
Utilidad bruta: ventas netas sin impuesto, según política, menos costo.
Margen: utilidad / venta neta.
Ticket promedio: ventas / número de tickets.
Inventario: existencia agregada × costo promedio.
Caja esperada: cálculo de la sesión abierta.
Se debe definir formalmente si “ventas netas” incluyen o excluyen impuestos. Recomendación: ingresos y utilidad se muestran sin impuesto; caja muestra total cobrado.

8. Diseño de API
Mantener las rutas propuestas, pero estructurarlas por recursos y acciones.

Respuestas
Formato consistente:

Datos en caso de éxito.
Error con code, message y errores por campo.
Códigos HTTP correctos.
Nunca exponer mensajes internos de PostgreSQL.
Endpoints adicionales necesarios
Categorías de producto e ingrediente.
Proveedores.
Detalle de receta y activación de versión.
Detalle de venta, compra y conteo.
Caja actualmente abierta.
Historial de caja.
Historial de inventario.
Métodos de pago y unidades/configuración.
Consulta de recetas sin configurar.
Protección
Todas las rutas operativas requieren sesión.
Toda consulta limita por business_id.
Verificación CSRF donde corresponda.
Rate limiting básico para login.
Validación estricta de parámetros, cuerpo y filtros.
Límites de paginación y exportación.
9. Plan de interfaz
9.1 Sistema visual inicial
Construir primero:

Variables CSS con los tokens del documento.
Tipografía Inter o Geist.
Botones, campos, selectores y diálogos.
Tarjetas de métricas.
Tabla responsiva.
Badge de estado.
Toast y errores en línea.
Skeletons.
Estado vacío.
Confirmación destructiva.
Selector de período.
La navegación lateral será fija en escritorio y drawer en tableta/pantallas pequeñas.

9.2 Pantallas por prioridad
Prioridad 1: operación
Login.
Productos.
Ingredientes.
Proveedores.
Recetas.
Registrar compra.
Registrar venta.
Caja.
Prioridad 2: control
Inventario actual.
Historial de movimientos.
Conteos.
Mermas y ajustes.
Gastos.
Prioridad 3: análisis
Dashboard.
Reportes.
Exportaciones.
Configuración.
9.3 Flujo de venta rápido
Para aproximarse a menos de 30 segundos:

Búsqueda con foco automático.
Navegación completa con teclado.
Enter agrega producto.
Atajos para aumentar y reducir cantidad.
Lista de productos frecuentes.
Total siempre visible.
Método de pago preseleccionado configurable.
Confirmación con prevención de doble envío.
Pantalla de éxito con opción “Nueva venta”.
10. Plan por fases y entregables
Fase 0 — Descubrimiento y decisiones
Actividades
Confirmar impuestos, precios con/sin impuesto y redondeos.
Definir métodos de pago.
Definir unidades y conversiones.
Decidir política de inventario negativo.
Decidir relación de gastos en efectivo con caja.
Confirmar anulaciones y descuentos.
Elegir hosting.
Diseñar un conjunto de operaciones de prueba con resultados esperados.
Entregable
Documento corto de decisiones de negocio y ejemplos numéricos aprobados.

Salida obligatoria
No iniciar ventas ni costos hasta aprobar los ejemplos de cálculo.

Fase 1 — Fundación técnica
Actividades
Inicializar Next.js y TypeScript estricto.
Configurar lint, formato, pruebas y CI.
Configurar Docker Compose con PostgreSQL.
Definir variables de entorno y archivo de ejemplo.
Implementar Prisma y primera migración.
Crear manejo común de errores.
Configurar logging.
Crear shell visual responsivo.
Implementar autenticación y sesión.
Crear negocio y propietario mediante seed.
Añadir middleware de autorización.
Criterios de salida
El propietario inicia y cierra sesión.
Las rutas privadas están protegidas.
La aplicación conecta a PostgreSQL.
Migraciones y seed se ejecutan desde cero.
CI verifica tipos, lint y pruebas.
Secretos no están en el repositorio.
Fase 2 — Catálogos y configuración
Actividades
Categorías de productos.
Productos.
Categorías de ingredientes.
Ingredientes.
Unidades y conversiones.
Proveedores.
Métodos de pago.
Formularios, búsquedas, filtros y desactivación.
Auditoría de cambios.
Criterios de salida
Se pueden crear y editar todos los cat