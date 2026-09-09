# JOURNEY — flujo punta a punta (resumen operativo)

> Resumen de 1 página. El detalle paso a paso con evidencias vive en
> `../ANALISIS-FLUJO-TEST.md` y el test ejecutable en
> `tests/integration/strawberry-matcha-flow.test.ts` (12 pasos).

```
Setup (1 vez): unidades → ingredientes → presentaciones → inventario inicial
  (/setup, SetupWizard; o CSV con importCsvAction)
   ↓
[Ya se puede vender sin receta] (costo 0, warning, sin descuento de inventario)
   ↓
Comprar insumos ──→ receivePurchase: convierte a base, costo promedio, kardex
   ↓
Crear subproducto (ej. jalea) ──→ saveSubproductRecipe (no anidados)
   ↓
Producir ──→ createProductionOrder (DRAFT) → startProductionOrder (IN_PROGRESS)
          → completeProductionOrder (descuenta insumos, acredita producto)
   ↓
Crear producto + receta ──→ saveRecipe (costo y margen automáticos)
   ↓
Abrir caja (fondo inicial) ──→ openCashSession
   ↓
Vender (efectivo exige caja abierta) ──→ createSale (CONFIRMED, descuenta receta)
   ↓
Cerrar caja ──→ closeCashSession (esperado pre-rellenado, guarda diferencia)
   ↓
Analizar ──→ /resumen (getDashboard) · /reportes (CSV) · vistas bi_* (Power BI)
```

**Reglas que el flujo demuestra:** precios sin IVA + 12% al vender (DEC-01),
promedio ponderado (DEC-02), venta sin stock con advertencia (DEC-03), una caja
abierta (DEC-05), anulación lógica (DEC-07), snapshots (DEC-08).
