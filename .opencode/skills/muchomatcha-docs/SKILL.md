---
name: muchomatcha-docs
description: Use ONLY when working on the Mucho Matcha cafe-control repo. Guides agents to read docs/INDEX.md, MAPA-REPO.md and MATRIZ-TRAZABILIDAD.md before exploring src, so requirements, code locations and tests resolve in a few jumps.
---

# Mucho Matcha Docs-First

Este repo tiene documentación trazable en `docs/`. Úsala como guía inicial
en vez de recorrer `src/` a ciegas.

## Protocolo de entrada (obligatorio)

1. Lee `docs/INDEX.md` primero. Es la puerta de entrada (<2 min).
2. Según tu tarea, lee solo lo indicado en “Atajos por tipo de tarea”:
   - Tocar código → `docs/MAPA-REPO.md` (ubicaciones exactas archivo:línea).
   - Comportamiento/regla de negocio → `docs/REQUISITOS.md` (ID del REQ) +
     `docs/MATRIZ-TRAZABILIDAD.md` (fila del REQ: implementación + test).
   - Impuestos, costos, caja, inventario, recetas → `docs/DECISIONES.md`
     (DEC-01…DEC-12 ya decididas, no las re-debatas).
   - Vocabulario (merma, kardex, subproducto…) → `docs/GLOSARIO.md`.
   - Contexto operativo → `docs/JOURNEY.md` (12 pasos).
3. Solo después abre los archivos de código enlazados en la matriz.

## Reglas

- Cita requisitos por ID (`REQ-07`), no por descripción suelta.
- La UI nunca calcula ni escribe directo a BD: todo pasa por server actions
  (`src/app/actions/`) → servicios (`src/modules/`) con transacciones.
- Dinero siempre con `NUMERIC`/Decimal (`src/lib/decimal.ts`), nunca float.
- Las filas ⚠️ de la matriz son puntos por verificar, no fallas confirmadas:
  verifícalos con el comando que indica `docs/MANTENIMIENTO.md`.
- Al terminar un cambio en dominio, schema, API o tests, actualiza la fila
  de la matriz en el mismo commit (ver `docs/MANTENIMIENTO.md`).

## Referencia rápida

- Mapa de código: `docs/MAPA-REPO.md`
- Matriz REQ → código:línea → test: `docs/MATRIZ-TRAZABILIDAD.md`
- Decisiones: `docs/DECISIONES.md`
- Comandos: `npm run typecheck`, `npm run lint`, `npm test`
  (integración requiere `DATABASE_URL`, ver `run-integration-test.bat`)
