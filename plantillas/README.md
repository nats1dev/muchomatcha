# Plantillas de carga masiva (Fases A–C)

Libro: `plantillas-mucho-matcha.xlsx` + espejos CSV en `csv/`.
Regenerar con: `npx tsx scripts/generate-templates.ts` (fuente única).

## Orden de carga

1. `01-ingredientes.csv` ✅ (`/productos` o `/setup` → Importar CSV, rol ADMIN).
2. `02-productos.csv` ✅.
3. `03-proveedores.csv` ✅ (duplicados se omiten).
4. `07-inventario-inicial.csv` ✅ (lo existente se omite; idealmente una vez).
5. `06-recetas-subproductos.csv` ✅ (exige costos > 0).
6. `05-recetas-productos.csv` ✅ (reimportar crea nueva versión).
7. `04-subproductos.csv` 🔒 sin parser propio: cárgalo vía 01 y su receta en 06.
8. `08-compras-ejemplo.csv` 🔒 referencia: las compras van en la interfaz.

Al subir verás una revisión con motivo y solución por problema: cancela todo
o importa omitiendo errores. Nada se guarda hasta confirmar.

## Reglas que el importador sí exige hoy

Ver detalle en `docs/IMPORTACION.md`. Resumen:

- Archivo `.csv`, UTF-8, delimitador coma o punto y coma, decimales con **punto**.
- Ingredientes: `name, sku, baseUnit` obligatorios; opcionales
  `category, minStock, purchaseUnit, conversionFactor`.
- Productos: `name, sku, salePrice>0` obligatorios; opcional `category`.
- Recetas: una fila por línea; `targetSku, ingredientSku, quantity>0`;
  `wastePercentage` entero 0–20; `nonInventoriable` SI/NO; `yieldQuantity` y
  `notes` iguales en todo el grupo.
- `sku` en MAYÚSCULAS. `baseUnit`/`purchaseUnit` deben existir
  (`g, kg, ml, l, u, pq`). `minStock >= 0`, `conversionFactor > 0`.
- El importador **solo crea** (recetas: nueva versión; lo demás: duplicados
  se omiten con aviso).

## Tips Excel en español

Archivo > Guardar como > `CSV UTF-8 (delimitado por comas)`. Revisa que
`32.50` no quede como `32,50`.
