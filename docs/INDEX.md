# Mucho Matcha — Índice de documentación para agents

> **Regla de entrada:** antes de explorar el proyecto, lee este archivo y luego
> solo los documentos que tu tarea necesite (columna “Lee esto si…”).
> No recorras `src/` a ciegas: el mapa está en `MAPA-REPO.md` y cada requisito
> está enlazado a su código en `MATRIZ-TRAZABILIDAD.md`.

## Qué es este proyecto (30 segundos)

Aplicación web para el control operativo y financiero de una cafetería
(“Café Control / Mucho Matcha”). Stack: Next.js 16 + TypeScript + PostgreSQL +
Prisma + Auth.js (credenciales, Argon2id). Moneda GTQ, IVA 12%, zona horaria
America/Guatemala. Detalle de setup en `../README.md`.

## Dónde está cada cosa

| Pregunta | Documento | Lee esto si… |
|---|---|---|
| ¿Por dónde empiezo? | `INDEX.md` (este archivo) | Siempre primero |
| ¿Qué archivos de docs existen y cuándo leerlos? | `MANIFEST.md` | Necesitas elegir qué leer |
| ¿Dónde vive cada módulo/ruta/servicio? | `MAPA-REPO.md` | Vas a leer o modificar código |
| ¿Qué debe hacer el sistema? (requisitos con ID) | `REQUISITOS.md` | Vas a implementar, corregir o validar comportamiento |
| ¿En qué archivo:línea se cumple cada requisito y con qué test? | `MATRIZ-TRAZABILIDAD.md` | Necesitas evidencia código ↔ test sin buscar en todo el repo |
| ¿Qué decisiones de negocio ya están tomadas? | `DECISIONES.md` | Tu cambio toca impuestos, costos, caja, inventario o recetas |
| ¿Qué significa cada término (merma, kardex, subproducto…)? | `GLOSARIO.md` | Encuentras vocabulario del dominio |
| ¿Cuál es el flujo punta a punta? | `JOURNEY.md` | Necesitas contexto operativo (comprar → producir → vender → caja) |
| ¿Qué falta para poner esto en producción? | `IMPLEMENTACION.md` | Trabajas en el piloto: fases, estado, bitácora |
| ¿Cómo mantengo estos docs actualizados? | `MANTENIMIENTO.md` | Terminaste un cambio en dominio, schema o API |
| Especificación original completa | `../MVP.md` | Necesitas el texto fuente de un requisito |
| Plan de implementación por fases | `../Desarrollo.md` | Necesitas contexto histórico del plan inicial |
| Análisis del test de integración | `../ANALISIS-FLUJO-TEST.md` | Vas a tocar el flujo compra → producción → venta → caja |

## Atajos por tipo de tarea

| Tarea | Lectura mínima |
|---|---|
| Corregir un cálculo (costo, IVA, total, caja) | `REQUISITOS.md` (REQ afectado) + `MATRIZ-TRAZABILIDAD.md` (fila del REQ) + `DECISIONES.md` |
| Agregar un campo a una tabla Prisma | `MAPA-REPO.md` (schema + migraciones) + `MANTENIMIENTO.md` |
| Tocar producción (órdenes, recetas de subproducto) | `JOURNEY.md` (pasos 4–6) + matriz filas REQ-17…REQ-22 |
| Tocar ventas o caja | `JOURNEY.md` (pasos 9–12) + matriz filas REQ-04, REQ-05, REQ-09 |
| Exportes CSV / vistas `bi_*` para Power BI | `MAPA-REPO.md` (sección Analítica) + matriz REQ-13, REQ-14, REQ-15 |
| Onboarding a un agent nuevo | Este archivo + `JOURNEY.md` + `GLOSARIO.md` |

## Estado de salud conocido (2026-09-09)

* `npm run typecheck` → 0 errores. `npm run lint` → 0 errores, 3 warnings diferidos
  (`exhaustive-deps` en `purchase-form.tsx`, 2× `<img>` vs `next/image`).
* Tests unitarios: 20 pasan (`decimal`, `schemas`). Integración (12 casos, flujo Strawberry Matcha):
  requiere `DATABASE_URL`, se ejecuta con `run-integration-test.bat`.
* Producción Fase 1 (IN_PROGRESS, cantidad real, costo estimado persistido,
  `startedAt`, vista `bi_production_variance`) ya está implementada en código.

### Puesta en producción — en curso (ver `IMPLEMENTACION.md`)

* **Esquema versionado desde 2026-09-09.** El historial de migraciones se
  reconstruyó y la base se reseteó. **No usar `prisma db push`.**
* **Se requieren dos URLs de base**: `DATABASE_URL` (pooler :6543) y
  `DIRECT_URL` (:5432, para migrar). Ver `../README.md`.
* **Control de acceso por roles activo** (DEC-13/DEC-14): toda server action
  exige un rol mínimo. Si escribes una acción nueva, protégela con `requireRole`.
* El seed ya no trae contraseña por defecto: exige `SEED_OWNER_PASSWORD`.
* **Toda server action valida con Zod** (DEC-18): si escribes una acción nueva,
  añade su esquema en `src/app/actions/schemas.ts` y parsea `payload: unknown`.
* **Límite de intentos de login activo** (DEC-17): 5 fallos por (correo, IP) cada
  15 min, contados en la tabla `login_attempts`.
