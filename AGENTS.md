<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:muchomatcha-docs-first -->
# Docs-first: read before exploring

This repo has traceable Spanish docs in `docs/`. Before walking `src/`:

1. Read `docs/INDEX.md` first, then only what your task needs
   (`docs/MANIFEST.md` tells you which doc to pick).
2. Find code via `docs/MAPA-REPO.md` and requirement evidence via
   `docs/MATRIZ-TRAZABILIDAD.md` (cite REQ-## IDs, not loose descriptions).
3. Respect `docs/DECISIONES.md` (DEC-01…DEC-12 are settled business rules).
4. Skill `muchomatcha-docs` (`.opencode/skills/muchomatcha-docs/SKILL.md`)
   has the full entry protocol.

## Docs are part of the change, never a follow-up

Every code change must update `docs/` in the same unit of work — this is the
repo's "regla de oro" (`docs/MANTENIMIENTO.md`), and the owner asked for it
explicitly. Apply the checklist there according to what you touched:

| You changed… | Update… |
|---|---|
| `prisma/schema.prisma` | `MAPA-REPO.md` (models) + affected matrix rows |
| A service in `src/modules/` | Matrix row for the REQ + `DECISIONES.md` if a rule changed |
| A route, server action or CSV export | `MAPA-REPO.md` + matrix (REQ-12/REQ-13) |
| Integration test or seed | `JOURNEY.md` / matrix (Test column) |
| A new module, route or script | `MAPA-REPO.md`, plus `MANIFEST.md` if a doc is added |
| A business decision | New `DEC-##` in `DECISIONES.md` + matrix |

New documents live inside `docs/`, are registered in `MANIFEST.md` and linked
from `INDEX.md`. Never leave a `⚠️` matrix row without a date and the command
that verifies it.
<!-- END:muchomatcha-docs-first -->
