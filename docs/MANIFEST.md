# MANIFEST — inventario de documentación

Tabla maestra: qué documento existe, qué cubre, cuándo leerlo y cuándo
actualizarlo. Los agents deben consultar esta tabla para elegir lecturas sin
recorrer el proyecto entero.

| ID | Archivo | Cubre | Leer cuando… | Actualizar cuando… |
|---|---|---|---|---|
| DOC-01 | `docs/INDEX.md` | Puerta de entrada y atajos por tarea | Siempre primero | Cambia la estructura de `docs/` o los atajos |
| DOC-02 | `docs/MANIFEST.md` | Este inventario | Necesitas elegir qué leer | Se agrega, elimina o renombra un doc |
| DOC-03 | `docs/MAPA-REPO.md` | Árbol de código, módulos, rutas, scripts | Vas a tocar código | Se agrega un módulo, ruta o script |
| DOC-04 | `docs/REQUISITOS.md` | Requisitos REQ-01…REQ-22 con fuente | Implementas, corriges o validas comportamiento | Cambia el alcance (nuevo MVP o fase) |
| DOC-05 | `docs/MATRIZ-TRAZABILIDAD.md` | REQ → código:línea → test → estado | Necesitas evidencia sin buscar en todo el repo | Cambia implementación o tests de un REQ |
| DOC-06 | `docs/DECISIONES.md` | Decisiones DEC-01… del negocio | Tu cambio toca impuestos, costos, caja, inventario o recetas | Se toma o revierte una decisión |
| DOC-07 | `docs/GLOSARIO.md` | Términos del dominio | Vocabulario desconocido | Aparece un término nuevo o cambia su sentido |
| DOC-08 | `docs/JOURNEY.md` | Flujo punta a punta en 12 pasos | Necesitas contexto operativo | Cambia el flujo (ej. nuevo estado de orden) |
| DOC-09 | `docs/MANTENIMIENTO.md` | Regla de actualización de docs | Terminaste un cambio | Cambia el proceso de trabajo |
| DOC-10 | `docs/IMPLEMENTACION.md` | Plan de puesta en producción por fases, con estado y bitácora | Vas a trabajar en el piloto o quieres saber qué falta para producción | **Cada vez que avanzas una subfase**: marca la casilla y añade línea en la bitácora |
| DOC-11 | `docs/IMPORTACION.md` | Formato CSV aceptado hoy + plantillas `plantillas/` (Fase A) | Vas a cargar datos masivos o generar plantillas | Cambia el importador (`csv-import.ts`, `importer.ts`) o las plantillas |
| EXT-01 | `MVP.md` (raíz) | Especificación fuente del MVP | Necesitas el texto original | Solo con cambio de alcance aprobado |
| EXT-02 | `Desarrollo.md` (raíz) | Plan inicial por fases | Contexto histórico | No se actualiza (histórico) |
| EXT-03 | `UserJourney-v0001.md` (raíz) | Journey + roadmap producción | Detalle de gaps/roadmap | Se completa una fase del roadmap |
| EXT-04 | `ANALISIS-FLUJO-TEST.md` (raíz) | Análisis del test de integración | Tocas el flujo completo | Cambia el test de integración |
| EXT-05 | `README.md` (raíz) | Setup, scripts, credenciales demo | Instalas o arrancas el proyecto | Cambia setup, scripts o seed demo |

**Regla:** `docs/` enlaza a `EXT-*` por sección, nunca copia su contenido.
La única información nueva vive en `docs/` (IDs, matriz, decisiones, mapa).
