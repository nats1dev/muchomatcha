# Análisis de Flujo: Test de Integración Strawberry Matcha

## Vista General

El test simula el **journey completo de un negocio de bebidas** desde cero: compra insumos, produce un subproducto (jalea), define un producto final, lo vende y cierra caja.

Cada `it()` es un paso del flujo. El test crea un negocio + usuario temporales y al final borra todo.

---

## Setup: Creación del negocio

```
Business: strawberry-flow-{timestamp}
Usuario:  Test User (test-{timestamp}@test.gt, rol OWNER)
Divisa:   GTQ (Quetzales)
Impuesto: 12%
```

Se crean las unidades por defecto: `g, kg, ml, l, u` y una categoría "Matcha".

---

## Paso 1 — Crear proveedor

**Qué hizo el test:** Creó un proveedor llamado "Distribuidora Test".

**Como usuario sería:** Entrar a Catálogo > Proveedores > Nuevo proveedor > Nombre: "Distribuidora Test" > Guardar.

**Observación:** Solo se crea un proveedor general para todas las compras. En la realidad un negocio puede tener múltiples proveedores especializados.

---

## Paso 2 — Crear 9 ingredientes de materia prima

**Qué hizo el test:** Creó 9 ingredientes, cada uno con su unidad base y unidad de compra:

| Ingrediente | SKU | Unidad base | Compra en | Factor |
|---|---|---|---|---|
| Matcha ceremonial | ING-MATCHA | g | kg | 1000 |
| Leche entera | ING-LECHE | ml | l | 1000 |
| Hielo | ING-HIELO | g | kg | 1000 |
| Fresas | ING-FRESAS | g | kg | 1000 |
| Azúcar | ING-AZUCAR | g | kg | 1000 |
| Agua purificada | ING-AGUA | ml | l | 1000 |
| Gas propano | ING-GAS | kg | kg | 1 |
| Vaso 16oz | ING-VASO16 | u | u | 1 |
| Pajilla | ING-PAJILLA | u | u | 1 |

**Como usuario sería:** Ir a Inventario > Ingredientes > Nuevo ingrediente > llenar formulario (nombre, SKU, unidad base, unidad de compra, factor de conversión) > Guardar. Repetir 9 veces.

**Puntos a analizar:**
- Crear 9 ingredientes uno por uno es tedioso. ¿Debería haber una opción "carga masiva" o "duplicar ingrediente"?
- La relación unidad base / unidad de compra con factor de conversión es poderosa pero puede confundir. Un usuario nuevo podría pensar "compro en kg, uso en g" sin entender el factor 1000.
- Gas propano con unidad base = kg y compra en kg con factor 1. ¿Tiene sentido pesar gas? Tal vez debería ser "unidad" o "tanque".
- Vaso y pajilla usan "u" (unidad). Tiene sentido.

---

## Paso 3 — Registrar compra de materia prima

**Qué hizo el test:** Registró una compra con 9 líneas (una por ingrediente) al proveedor "Distribuidora Test", pagada por TRANSFER, estado PAID. Luego verificó que cada ingrediente tenga stock > 0 y que el matcha tenga un costo promedio calculado.

| Ingrediente | Cantidad | Precio unitario | Total |
|---|---|---|---|
| Matcha | 1 kg | Q450 | Q450 |
| Leche | 10 l | Q12 | Q120 |
| Hielo | 5 kg | Q2 | Q10 |
| Fresas | 2 kg | Q30 | Q60 |
| Azúcar | 5 kg | Q8 | Q40 |
| Agua | 20 l | Q0.75 | Q15 |
| Vaso 16oz | 100 u | Q1.50 | Q150 |
| Pajilla | 100 u | Q0.25 | Q25 |
| Gas | 10 kg | Q4 | Q40 |

**Total gastado en insumos: Q910**

**Como usuario sería:** Ir a Compras > Nueva compra > Seleccionar proveedor > Agregar productos (9 líneas) > Ingresar cantidades y precios > Método de pago: Transferencia > Estado: Pagado > Guardar.

**Puntos a analizar:**
- La compra tiene 9 líneas distintas. En la vida real, rara vez se compra todo al mismo proveedor el mismo día. Sería más realista tener 2-3 órdenes de compra separadas.
- El pago es "TRANSFER" con estado "PAID". No hay diferencia entre "Pagado" y "Transferencia" como método — parecen ser conceptos mezclados.
- La pausa de 300ms entre cada ítem sugiere que el sistema necesita "respirar". Posible problema de concurrencia o eventos encadenados.

---

## Paso 4 — Crear ingrediente "Jalea de Fresa" (subproducto)

**Qué hizo el test:** Creó un ingrediente tipo subproducto: "Jalea de Fresa" (SKU: SUB-JALEA), con unidad base = g y stock mínimo = 500g. Verificó que NO tenga receta asignada todavía.

**Como usuario sería:** Ir a Inventario > Ingredientes > Nuevo ingrediente > Nombre: "Jalea de Fresa", Marcar como "Subproducto"/"Producido internamente", Stock mínimo: 500g > Guardar.

**Observación:** En este punto el usuario crea un ingrediente que aún no tiene receta. La app lo permite (recipeId = null). Esto es lógico porque primero se define qué se va a producir y luego cómo se produce.

---

## Paso 5 — Crear receta para Jalea de Fresa (rendimiento 1000g)

**Qué hizo el test:** Asignó una receta al ingrediente Jalea de Fresa con rendimiento de 1000g:

| Insumo | Cantidad | % merma |
|---|---|---|
| Fresas | 600g | 5% |
| Azúcar | 300g | 0% |
| Agua | 100ml | 0% |
| Gas | 0.1kg | 0% |

**Total rendimiento: 1000g** (1100g de insumos - mermas)

**Como usuario sería:** Ir al ingrediente "Jalea de Fresa" > click en "Agregar receta" > Rendimiento: 1000g > Agregar insumos (fresas 600g, azúcar 300g, agua 100ml, gas 0.1kg) > Estimar costos > Guardar.

**Puntos a analizar:**
- La suma de insumos es 1100g (antes de merma) para producir 1000g. ¿El usuario entiende que el rendimiento es la salida y los insumos son la entrada?
- El gas aparece como insumo en kg para hervir la jalea. Tiene sentido conceptual pero en la práctica el gas no se mide por kg consumido por lote. Sería mejor modelarlo como costo fijo de la receta, no como ingrediente medible.
- El porcentaje de merma (5% en fresas) es un concepto avanzado. Un usuario nuevo probablemente no sabe qué merma poner.
- El test verifica que `unitCost > 0`, confirmando que el sistema calculó el costo automáticamente.

---

## Paso 6 — Orden de producción de 2000g de Jalea de Fresa

**Qué hizo el test:**
1. Creó una orden de producción de 2000g de Jalea de Fresa → estado DRAFT
2. Verificó `estimatedUnitCost > 0`
3. Completó la orden → estado COMPLETED
4. Verificó consumos de inventario:
   - Jalea producida: **2000g**
   - Fresas: 2000 - (1200 * 1.05) = **740g** restantes
   - Azúcar: 5000 - 600 = **4400g** restantes
   - Agua: 20000 - 200 = **19800ml** restantes
   - Gas: 10 - 0.2 = **9.8kg** restantes

**Como usuario sería:**
1. Ir a Producción > Nueva orden > Seleccionar "Jalea de Fresa" > Cantidad: 2000g > Crear (estado: Borrador)
2. Revisar la orden > "Completar producción" (confirma que se produjo)
3. El sistema descuenta automáticamente los insumos y suma el producto terminado al inventario.

**Puntos a analizar:**
- La orden pasa de DRAFT a COMPLETED directamente. ¿No hay un estado intermedio "IN_PROGRESS" o "EN_PRODUCCION"? En la vida real hay un tiempo de producción.
- El sistema descuenta insumos y acredita producto al completar. Esto asume que TODO el lote se produce exitosamente. No hay opción de "merma en producción" (ej. se evaporó agua, se quemó un lote).
- La jalea producida (2000g) entra al inventario como ingrediente con su nuevo costo promedio calculado.

---

## Paso 7 — Crear producto Strawberry Matcha

**Qué hizo el test:** Creó el producto final "Strawberry Matcha" (SKU: BEB-013) con precio de venta Q42, categoría "Matcha".

**Como usuario sería:** Ir a Catálogo > Productos > Nuevo producto > Nombre: "Strawberry Matcha", SKU: "BEB-013", Precio: Q42, Categoría: Matcha > Guardar.

**Observación:** En este punto el producto existe pero no tiene receta (no sabe cómo se prepara). Primero se define el producto, luego su receta.

---

## Paso 8 — Crear receta de Strawberry Matcha

**Qué hizo el test:** Asignó una receta al producto Strawberry Matcha (rendimiento: 1 unidad):

| Insumo | Cantidad | % merma |
|---|---|---|
| Matcha ceremonial | 3g | 5% |
| Leche entera | 250ml | 0% |
| Hielo | 120g | 0% |
| Agua purificada | 50ml | 0% |
| Jalea de Fresa (subproducto) | 40g | 0% |
| Vaso 16oz | 1u | 0% |
| Pajilla | 1u | 0% |

**7 insumos por unidad de producto.**

**Como usuario sería:** Ir al producto "Strawberry Matcha" > "Agregar receta" > Rendimiento: 1 unidad > Agregar insumos (seleccionar ingredientes del inventario, incluyendo el subproducto "Jalea de Fresa") > Guardar.

**Puntos a analizar:**
- El matcha tiene 5% de merma. Conceptualmente la merma aquí es "lo que se pierde al preparar" (rebalse, lo que queda en el batidor, etc.). Es otro concepto avanzado.
- La receta incluye 7 insumos. En una interfaz real, agregar 7 líneas uno por uno es lento.
- La receta usa el subproducto "Jalea de Fresa" como insumo. Esto es correcto: la jalea ya se produjo y está en inventario. El sistema calcula su costo desde la receta anterior.
- El sistema calcula `unitCost` automáticamente basado en el costo de los insumos (matcha + leche + hielo + agua + jalea + vaso + pajilla).

---

## Paso 9 — Abrir sesión de caja

**Qué hizo el test:** Abrió una sesión de caja con Q500 de apertura.

**Como usuario sería:** Ir a Caja > "Abrir caja" > Monto inicial: Q500 > Abrir.

**Observación:** El sistema asume que el usuario tiene una caja física con efectivo. La sesión queda en estado OPEN.

---

## Paso 10 — Vender 2 Strawberry Matcha en efectivo

**Qué hizo el test:** Registró una venta de 2 Strawberry Matcha (2 x Q42 = Q84) pagada en efectivo. Verificó:
- Estado: CONFIRMED
- Número de venta: 1 (primera venta)
- Sin advertencias (stock suficiente)
- Total = Q84 + 12% IVA = Q94.08

**¿Cómo se calcula?**
- Subtotal: 2 × Q42 = Q84
- IVA (12%): Q84 × 0.12 = Q10.08
- Total: Q94.08

**Como usuario sería:** Ir a Caja/POS > Seleccionar "Strawberry Matcha" > Cantidad: 2 > Cobrar > Método: Efectivo > Confirmar venta.

**Puntos a analizar:**
- La venta descontó inventario automáticamente: se registraron 7 movimientos de inventario (uno por cada insumo × 2 unidades = en realidad 7 movimientos con quantityDelta negativo, no 14 — parece que agrupa o es un total de 7 para toda la venta).
- El sistema no pregunta "confirmar venta" vs "solo cotizar". La venta se confirma inmediatamente.
- Se vendió a Q42 cuando el costo unitario (unitCost) es un valor calculado que el test no imprime. ¿Cuál es el margen de ganancia? Sería interesante saberlo.

---

## Paso 11 — Verificar inventario final

**Qué hizo el test:** Verificó matemáticamente que cada ingrediente tenga el stock esperado después de todo el flujo:

| Ingrediente | Stock inicial | Consumido | Stock final esperado |
|---|---|---|---|
| Matcha | 1000g | 3g × 1.05 × 2 = 6.3g | 993.7g |
| Leche | 10000ml | 250ml × 2 = 500ml | 9500ml |
| Hielo | 5000g | 120g × 2 = 240g | 4760g |
| Fresas | 2000g | 600g × 1.05 × 2 = 1260g | 740g |
| Azúcar | 5000g | 300g × 2 = 600g | 4400g |
| Agua | 20000ml | (100 + 50)ml × 2 = 300ml | 19700ml |
| Gas | 10kg | 0.1kg × 2 = 0.2kg | 9.8kg |
| Vaso 16oz | 100u | 1u × 2 = 2u | 98u |
| Pajilla | 100u | 1u × 2 = 2u | 98u |
| Jalea de Fresa | 2000g | 40g × 2 = 80g | 1920g |

**Observación:** Este paso es solo una verificación interna para el test. Como usuario no verías esto explícitamente, pero el sistema debería mostrar el inventario actualizado automáticamente después de cada operación.

---

## Paso 12 — Cerrar sesión de caja

**Qué hizo el test:** Cerró la sesión de caja con:
- `countedAmount = 500 + Q94.08 = Q594.08`
- Verificó estado: CLOSED

**Como usuario sería:** Ir a Caja > "Cerrar caja" > Ingresar monto contado: Q594.08 > Cerrar. El sistema debería mostrar un resumen: Q500 inicial + Q94.08 ventas = Q594.08.

**Observación:** El test asume que no hubo otros gastos ni retiros de caja. En un negocio real, podrías haber pagado algo en efectivo, etc.

---

## Cleanup: Eliminar datos de prueba

Al final, el test borra TODO lo creado: desde las tablas hijas hasta el negocio mismo. En la BD no queda rastro.

---

## User Journey Map (resumen visual)

```
Registrarse
  ↓
Crear unidades de medida ──────────────────── (setup, 1 vez)
  ↓
Crear categoría "Matcha" ──────────────────── (setup, 1 vez)
  ↓
[1] Crear proveedor
  ↓
[2] Crear 9 ingredientes raw ──── tedioso, 9x formulario
  ↓
[3] Compra masiva (9 líneas, 1 proveedor)
  ↓
[4] Crear subproducto "Jalea de Fresa"
  ↓
[5] Definir receta de jalea (4 insumos)
  ↓
[6] Producir 2000g de jalea (orden → completar)
  ↓
[7] Crear producto "Strawberry Matcha"
  ↓
[8] Definir receta del producto (7 insumos)
  ↓
[9] Abrir caja (Q500)
  ↓
[10] Vender 2 unidades (efectivo)
  ↓
[11] Verificar inventario (solo test)
  ↓
[12] Cerrar caja (Q594.08)
```

---

## Hallazgos y oportunidades de mejora

### 1. Carga de datos inicial (Setup y Pasos 1-2)
- **Problema:** Crear 9 ingredientes uno por uno es tedioso.
- **Sugerencia:** Implementar carga masiva (CSV, Excel) al menos para la configuración inicial del negocio.
- **Sugerencia:** Ofrecer plantillas/paquetes de ingredientes precargados por tipo de negocio (cafetería, restaurant, etc.).

### 2. Unidades y conversiones (Paso 2)
- **Problema:** El factor de conversión (ej. kg → g = 1000) es confuso para usuarios no técnicos.
- **Sugerencia:** Si unidad base y unidad de compra son del mismo "grupo" (masa, volumen, unidad), el factor debería calcularse automáticamente o mostrar ejemplos ("1 kg = 1000 g").
- **Sugerencia:** Separar visualmente las unidades en grupos (Masa, Volumen, Unidad).

### 3. Compra vs múltiples compras (Paso 3)
- **Problema:** Una sola compra con 9 líneas de distintos proveedores no es realista.
- **Sugerencia:** Permitir dividir una compra grande en varias órdenes. O al menos diseñar la UI para que agregar múltiples líneas sea rápido (autocomplete, búsqueda por SKU, escáner de código de barras).

### 4. Modelado de subproductos (Pasos 4-6)
- **Problema:** El gas como insumo medible en kg no es intuitivo.
- **Sugerencia:** Agregar un tipo de insumo "Costo fijo" o "Insumo no inventariable" para cosas como gas, electricidad, agua de servicio (no la que va en el producto).
- **Problema:** La orden de producción salta de DRAFT a COMPLETED sin estados intermedios.
- **Sugerencia:** Agregar estado "IN_PROGRESS" con opción de registrar mermas reales durante la producción.

### 5. Recetas (Pasos 5 y 8)
- **Problema:** La merma (%) es un concepto avanzado. Muchos usuarios no sabrán qué valor poner.
- **Sugerencia:** Ocultar el campo de merma en una sección "Avanzado" o dar valores sugeridos por tipo de ingrediente.
- **Problema:** Agregar 7 insumos a una receta requiere muchos clics.
- **Sugerencia:** Permitir "duplicar receta", arrastrar y soltar, o buscar por categoría.

### 6. Proceso de venta (Paso 10)
- **Problema:** La venta se confirma inmediatamente sin confirmación.
- **Sugerencia:** Separar "Cotizar" de "Vender" (confirmar). Permitir ver el total con impuestos antes de confirmar.
- **Problema:** No se muestra el margen de ganancia en tiempo real.
- **Sugerencia:** Mostrar "Costo: QX.XX | Margen: XX%" al seleccionar el producto en el POS.

### 7. Cierre de caja (Paso 12)
- **Problema:** El usuario debe calcular manualmente el monto contado.
- **Sugerencia:** El sistema debería sugerir: "Apertura: Q500 + Ventas: Q94.08 = Q594.08" y dejar que el usuario confirme o ajuste si hubo gastos.

### 8. Experiencia general
- **Problema:** El flujo es muy lineal: no se puede vender sin antes comprar, producir, definir recetas, abrir caja. En la práctica, un negocio puede querer registrar una venta hoy y la receta mañana.
- **Sugerencia:** Flexibilizar el orden de las operaciones. Por ejemplo, permitir registrar una venta "genérica" sin receta si el producto ya existe y tiene precio, y asignar la receta después.
- **Problema:** El test asume que el usuario sabe exactamente qué hacer en cada paso (proveedor, categoría, unidades, etc.). En un onboarding real, esto sería abrumador.
- **Sugerencia:** Implementar un "asistente de configuración rápida" que guíe al usuario paso a paso los primeros días.
