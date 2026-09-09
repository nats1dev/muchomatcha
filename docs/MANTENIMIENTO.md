# MANTENIMIENTO — cómo mantener estos docs vivos

## Regla de oro

Todo cambio en **dominio, schema Prisma, API/actions o tests** actualiza su
fila en `MATRIZ-TRAZABILIDAD.md` en el mismo commit. Los docs de `docs/`
son parte del cambio, no un pendiente.

## Checklist por tipo de cambio (3 líneas)

| Cambiaste… | Actualiza… | Verifica con… |
|---|---|---|
| Lógica de un servicio (`src/modules/`) | Fila del REQ en matriz + `DECISIONES.md` si cambió una regla | `npm run typecheck && npm test` |
| `prisma/schema.prisma` | `MAPA-REPO.md` (modelos) + matriz (filas afectadas) | `npx prisma validate` |
| Ruta, action o export CSV | `MAPA-REPO.md` + matriz (REQ-12/13) | `npm run lint` |
| Test de integración o seed | `JOURNEY.md` / matriz (columna Test) | `run-integration-test.bat` (requiere `DATABASE_URL`) |
| Nuevo módulo, ruta o script | `MAPA-REPO.md` + `MANIFEST.md` si hay doc nuevo | `INDEX.md` sigue resolviendo en ≤3 saltos |
| Nueva decisión de negocio | `DECISIONES.md` (nuevo DEC-##) + matriz | Revisión del dueño |

## Qué NO hacer

* No copiar texto de `MVP.md`/`UserJourney` a `docs/`: enlazar por sección.
* No dejar filas ⚠️ sin fecha: anota `por verificar (aaaa-mm-dd)` y el comando que la verifica.
* No agregar docs nuevos sin registrarlos en `MANIFEST.md` y enlazarlos en `INDEX.md`.
