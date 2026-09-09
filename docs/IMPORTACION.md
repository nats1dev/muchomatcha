# IMPORTACION — formato CSV y plantillas (Fases A–C)

> Alcance: documenta lo que el importador acepta **hoy** (REQ-02, REQ-13):
> ingredientes, productos, proveedores, recetas e inventario inicial.
> Compras sigue solo en UI.

## 1. Lo que el importador acepta hoy

Detección por header en `src/lib/csv-import.ts:parseImportCsv`, por precedencia:
`subproductSku` → recetas de subproducto; `productSku` → recetas de producto;
`salePrice` → productos; `baseUnit` → ingredientes; `unitCost` → inventario;
(`taxId`/`phone`/`email`) → proveedores; resto → error con guía a plantillas.
Tolera BOM y autodetecta delimitador (`,`, `;`, `\t`). Carga en
`src/app/actions/importer.ts` (exige rol ADMIN).
Cada fila se valida con Zod (`schemas.ts`, sección Importador CSV); el SKU
duplicado dentro del archivo y las filas descuadradas van a errores con su
`Fila N` real (las líneas vacías se saltan sin mover la numeración).

**Orden de carga** (dependencias + bloqueo Q0):
`01 → 02 → 03 → 07 → 06 → 05` (04 se crea como ingrediente en 01).

### 1.1 Ingredientes (`parseIngredientRows`, `csv-import.ts:83`)

Headers: `name, sku, baseUnit` obligatorios; `category, minStock, purchaseUnit,
conversionFactor` opcionales. Headers case-insensitive; `sku` se mayusculiza.

| Columna | Regla | Si falla |
|---|---|---|
| `name (≤150), sku (≤50), baseUnit (≤20)` | obligatorios por fila | `Fila N: <motivo>` (p. ej. `El nombre es obligatorio`) |
| `category (≤100)` | opcional; se crea/reutiliza sola (DEC-19) | `Fila N` si excede longitud |
| `minStock` | opcional, número ≥ 0 y finito | `Fila N`, fila rechazada |
| `purchaseUnit` + `conversionFactor` | opcionales, solo juntos; factor > 0; la unidad debe existir | `Fila N`, fila rechazada o aviso `[DB]` |
| `baseUnit` | debe existir como `unit.code` activa; válidos: `g, kg, ml, l, u, pq` | `[DB] Fila N: unidad "X" no encontrada (válidas: …)` |

### 1.2 Productos (`parseProductRows`, `csv-import.ts:130`)

Headers: `name, sku, salePrice` obligatorios; `category` opcional.

| Columna | Regla | Si falla |
|---|---|---|
| `name (≤150), sku (≤50)` | obligatorios | `Fila N: <motivo>` |
| `salePrice` | número > 0 y finito; precio **sin IVA** (DEC-01) | `Fila N`, fila rechazada |
| `category (≤100)` | opcional; se crea/reutiliza sola (DEC-19) | `Fila N` si excede longitud |

## 2. Cómo exportar desde Excel en español

1. Completa la hoja del libro `plantillas/plantillas-mucho-matcha.xlsx`
   que corresponda (ver §4 para columnas y orden de carga).
2. Por hoja: Archivo > Guardar como > `CSV UTF-8 (delimitado por comas)`.
3. Verifica: delimitador coma o punto y coma (ambos se autodetectan),
   decimales con **punto** (`32.50`), sin separador de miles, primera fila =
   headers exactos. Máximo 500 filas y 2 MB por archivo.
4. Sube en `/productos` o `/setup` → Importar CSV (rol ADMIN): se abre la
   revisión del §6 (nada se guarda hasta confirmar). El botón solo
   acepta `.csv` (`src/components/csv-import-button.tsx`).
5. Resultado: `N creados` + lista de omitidos con `Fila N`, motivo y solución.

## 3. Garantías desde Fase B (endurecimiento)

- **Validación Zod por fila (DEC-18):** cada fila se valida con
  `importIngredientRowSchema` / `importProductRowSchema`
  (`schemas.ts`, sección Importador CSV). Longitudes 50/150/100 idénticas a la
  UI; `minStock`/`conversionFactor`/`salePrice` inválidos (`-5`, `abc`,
  `Infinity`) **rechazan la fila** con `Fila N: <motivo>` en vez de ignorarse.
  `purchaseUnit` y `conversionFactor` deben venir juntos o ninguno.
- **Topes:** máximo 500 filas de datos (`MAX_IMPORT_ROWS`,
  `csv-import.ts:18`) y archivo no vacío de máximo 2 MB con extensión `.csv`
  (`importFileSchema`, `importer.ts:35`). Delimitador autodetectado
  (`,`, `;`, `\t`): el CSV de Excel en español con `;` ya importa.
- **SKU duplicado en el archivo:** se importa la primera aparición; la repetida
  va a errores (`Fila N: SKU "X" duplicado… primero en fila M`).
- **Categorías idempotentes (DEC-19):** se reutilizan case-insensitive
  (`bebidas`/`Bebidas` = una sola); el primer nombre conserva su
  capitalización. Ya no hace falta el workaround de "una categoría por archivo".
- **Unidades no se crean:** solo lookup exacto por `code`; si `baseUnit` no
  existe la fila se salta con la lista de válidas, y si `purchaseUnit` no
  existe también avisa (antes se callaba).
- **Solo crea, nunca actualiza:** repetir el archivo da por fila
  `[DB] Fila N (nombre): El SKU "X" ya existe` (código `DUPLICATE_SKU`
  propagado, `importer.ts:123,160`). La importación es parcial: las filas
  válidas se crean y los errores se reportan con `Fila N` exacta.
- **Compras NO se importa:** solo en UI (`receivePurchase`,
  promedio ponderado DEC-02, IVA recalculado). `08-compras-ejemplo.csv` es
  referencia.

## 4. Proveedores, recetas e inventario (Fase C)

Formatos en `scripts/generate-templates.ts` (fuente única). La revisión previa
(§6) aplica igual: nada se escribe hasta confirmar.

### 4.1 Proveedores (`03-proveedores.csv`)

| Columna | Regla | Si falla |
|---|---|---|
| `name (≤150)` | obligatorio | `Fila N`, fila rechazada |
| `taxId/phone (≤50), email (≤200)` | opcionales; formato de email lo valida el servicio | `Fila N`, fila rechazada |
| duplicado | mismo nombre existente (insensible) o repetido en el archivo | se omite con aviso (no se actualiza ni duplica) |

### 4.2 Recetas (`05-recetas-productos.csv`, `06-recetas-subproductos.csv`)

Una fila = una línea; el grupo con igual `productSku`/`subproductSku` es una receta.

| Columna | Regla | Si falla |
|---|---|---|
| `productSku`/`subproductSku`, `ingredientSku` (≤50), `quantity` (>0) | obligatorios | `Fila N`, fila rechazada |
| `wastePercentage` | opcional, entero 0–20 | `Fila N`, fila rechazada |
| `nonInventoriable` | opcional: SI/NO/1/0/TRUE/FALSE (vacío = No) | `Fila N` con otro valor |
| `yieldQuantity`/`notes` | opcionales; **iguales en todo el grupo** | grupo rechazado (`GROUP_CONFLICT`) |
| insumo repetido / auto-referencia / >200 líneas | por grupo | grupo o fila rechazados |

Resolución y ejecución (por grupo, atómico): target e insumos deben existir
(`PRODUCT_NOT_FOUND`/`INGREDIENT_NOT_FOUND`, cargar 01–02 primero); 06 exige
costos > 0 en insumos (`ZERO_COST`, cargar 07 primero) y rechaza ciclos
(`RECIPE_CYCLE`, DEC-10); reimportar crea **nueva versión** (desactiva la
anterior, igual que la UI) y la revisión lo avisa (`Se actualizarán: X (vN→vN+1)`, DEC-21).

### 4.3 Inventario inicial (`07-inventario-inicial.csv`)

| Columna | Regla | Si falla |
|---|---|---|
| `ingredientSku` (≤50) | debe existir (cargar 01 primero) | `Fila N`, fila rechazada |
| `quantity` (>0), `unitCost` (≥0) | obligatorios | `Fila N`, fila rechazada |

**No idempotente por diseño del servicio:** repetir suma stock. Guardia del
importador: lo que ya tiene existencias se omite con aviso (`HAS_STOCK`, nunca
suma en silencio, DEC-21). Más de 200 válidas se registra en lotes de 200.
Carga fundacional: idealmente una sola vez, antes de 06.

### 4.4 No importable: compras

`08-compras-ejemplo.csv` es referencia; las compras siguen en UI (DEC-02).

## 5. Regenerar y verificar
```bash
npx tsx scripts/generate-templates.ts
npx tsx -e "import {readFileSync} from 'node:fs';import {parseImportCsv,groupRecipeLines} from './src/lib/csv-import.ts';for(const f of ['plantillas/csv/01-ingredientes.csv','plantillas/csv/02-productos.csv','plantillas/csv/03-proveedores.csv','plantillas/csv/05-recetas-productos.csv','plantillas/csv/06-recetas-subproductos.csv','plantillas/csv/07-inventario-inicial.csv']){const r=parseImportCsv(readFileSync(f,'utf8'));console.log(f,r.type,r.rows.length,JSON.stringify(r.errors))}"
```

Esperado: `01 → ingredients 10 []`, `02 → products 5 []`,
`03 → suppliers 5 []`, `05 → productRecipes 11 []` (2 grupos),
`06 → subproductRecipes 4 []` (1 grupo), `07 → inventory 5 []`.
`04` se carga vía 01 (mismo formato que ingredientes).

## 6. Flujo de revisión: previsualizar → cancelar o confirmar (Fase B2)

Subir el archivo **no importa nada**: abre un diálogo de revisión
(`src/components/import-preview-dialog.tsx`) con el botón
(`src/components/csv-import-button.tsx`):

1. **Analizar:** `previewCsvAction` valida y resuelve todo sin escribir
   (núcleo `buildImportPlan` en `src/app/actions/importer.ts`).
2. **Revisar:** el diálogo lista solo filas con problema —cada una con motivo y
   cómo solucionarlo (catálogo `src/lib/import-troubleshooting.ts`)— más el
   conteo de válidas y las categorías que se crearían. Sin problemas: muestra
   "todo listo".
3. **Decidir:** **Cancelar todo** descarta el análisis (cero escrituras por
   construcción) o **Importar N (omitir M)** reenvía el archivo a
   `confirmCsvAction`, que revalida en servidor y escribe solo las válidas.

Verificación manual: CSV con errores típicos → diálogo con motivo+solución →
Cancelar deja la BD intacta → Confirmar importa válidas y refresca la tabla.
