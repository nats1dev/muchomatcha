# Plan de implementación — Puesta en producción

> Documento vivo. Marca las casillas conforme avances y añade una línea en la
> **Bitácora** al cerrar cada subfase.
>
> Leyenda de estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecho y verificado

**Última actualización:** 2026-09-09
**Objetivo:** dejar el software listo para el primer despliegue en producción y
entregarlo a los usuarios de prueba.

## Cómo se registra el avance (obligatorio)

Al cerrar cualquier subfase, en el **mismo** trabajo:

1. Marca la casilla aquí y añade una línea en la **Bitácora** (al final).
2. Aplica el checklist de `MANTENIMIENTO.md` según lo que tocaste:
   schema → `MAPA-REPO.md` + matriz · action/ruta/export → `MAPA-REPO.md` + matriz ·
   regla de negocio → nuevo `DEC-##` en `DECISIONES.md` · doc nuevo →
   `MANIFEST.md` + enlace en `INDEX.md`.
3. Si dejas algo sin verificar, márcalo `⚠️ por verificar (aaaa-mm-dd)` **con el
   comando** que lo verifica. Nunca una fila `⚠️` sin fecha.

Los documentos son parte del cambio, no un pendiente posterior.

---

## Resumen de avance

| Fase | Descripción | Estado | Bloqueante |
|---|---|---|---|
| 0 | Base desplegable (migraciones, conexión) | ✅ Completa | Sí |
| 1 | Acceso y autorización | ✅ Completa (1.1–1.4; queda verificar el bloqueo en runtime) | Sí |
| 2 | Integridad del dinero | 🚧 En curso (2.1 hecha; faltan 2.2–2.4) | Sí |
| 3 | Corrección de cálculos y datos demo | ⬜ Pendiente | Sí |
| 4 | Almacenamiento y endurecimiento | ⬜ Pendiente | Sí (imágenes) |
| 5 | Operación del piloto | ⬜ Pendiente | Sí |

### Decisiones tomadas

| Decisión | Valor | Consecuencia |
|---|---|---|
| Despliegue | Vercel + Supabase | Imágenes fuera de `public/`; hace falta `DIRECT_URL` |
| Tenancy | Un solo negocio | Aislamiento multi-tenant se difiere a post-piloto |
| Roles | Dueño + cajeros + solo lectura | `requireRole` con 3 niveles es bloqueante |
| Datos | De cero + demo verificable | Sin backfill; caso testigo = Cappuccino (BEB-006) |

### Principio rector

Cada corrección debe mover la invariante **del código a la base de datos o al
sistema de tipos** siempre que sea posible. Un `if` que alguien puede olvidar
copiar no es una garantía; un índice único sí lo es.

---

## Fase 0 — Base desplegable ✅

### 0.1 Historial de migraciones — `[x]`
- [x] Eliminar `prisma/migrations/manual_in_progress.sql` (volcado UTF-16 de un error de PowerShell)
- [x] Eliminar directorios manuales `add_unit_price_to_purchase_item/` y `manual_add_in_progress/`
- [x] Generar migración baseline `20260909105703_init` con `migrate diff --from-empty`
- [x] Crear `migration_lock.toml` (lo exige `migrate deploy`)
- [x] Verificar que la baseline incluye lo que solo existía vía `db push`:
      enum `IN_PROGRESS`, `purchase_items.unit_price`, columnas de `production_orders`
- [x] Retirar `db push` del flujo (documentado en README)

### 0.2 Conexión Supabase — `[x]`
- [x] `directUrl = env("DIRECT_URL")` en `schema.prisma`
- [x] `.env.example` con placeholders (se retiró el host real del proyecto)
- [x] `seed.ts`: usa `DIRECT_URL`, sin el `replace(":5432", ":6543")` frágil
- [x] Migrar `package.json#prisma` → `prisma.config.ts`
- [x] `seed.ts` carga `.env` (Prisma ya no lo hace al usar archivo de config)

### 0.3 Arranque — `[~]`
- [x] `next build` correcto; todas las rutas del dashboard son dinámicas
- [x] Proxy (`src/proxy.ts`) reconocido por el build
- [x] `migrate reset` + `migrate deploy` aplicados contra Supabase real
- [x] Seed demo ejecutado (79 s): 1 negocio, usuario OWNER, Cappuccino presente
- [ ] **Pendiente:** desplegar en Vercel y configurar variables de entorno allí
      (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` nuevo, `AUTH_URL`)

**Criterio de salida:** ✅ desde base vacía, `migrate deploy` + `build` producen una app que arranca.

---

## Fase 1 — Acceso y autorización 🚧

### 1.1 Cerrar la puerta abierta — `[x]`
- [x] Quitar `defaultValue` con credenciales del formulario de login
- [x] Quitar el texto "Demo: owner@muchomatcha.gt / Matcha2026!"
- [x] `safeCallbackUrl()`: solo rutas internas (cierra el open redirect)
- [x] Seed exige `SEED_OWNER_PASSWORD`; sin valor por defecto
- [x] Limpiar credenciales del README y de los `console.log` del seed
- [ ] **Diferido a la fase 5.3 (decisión del propietario, 2026-09-09):** rotar la
      contraseña de la base en Supabase. Lo que quedó en el historial de git fue el
      host (`.env.example`), no la contraseña: `.env` nunca se committeó y sigue en
      `.gitignore`. Con datos de solo demo y sin usuarios reales, el riesgo es bajo.
      **Debe hacerse antes de cargar el catálogo real y de repartir accesos del
      piloto** — al hacerlo en 5.3 se actualizan `.env` y las variables de Vercel de
      una sola vez. Ver el procedimiento en 5.3.

### 1.2 Roles — `[x]`
- [x] `src/lib/auth/roles.ts`: `ROLE_RANK`, `RoleName`, `ROLE_LABELS` sin
      dependencias de servidor (evita arrastrar Prisma al bundle del cliente)
- [x] `requireRole(min)` en `src/lib/auth/session.ts`
- [x] Aplicado a **36 llamadas** en las 4 acciones: 23 ADMIN, 8 CASHIER, 4 VIEWER, 1 contexto de negocio
- [x] `/api/exports/[report]` exige rol VIEWER (antes bastaba con tener sesión)
- [x] Sidebar filtra por rol (`minRole` por elemento)
- [x] **Fail-closed en 3 puntos** que estaban abiertos:
      `session.ts` (`?? "OWNER"` → `"VIEWER"`), `auth.ts` (ídem),
      `schema.prisma` (`role @default(OWNER)` → `@default(VIEWER)`)
- [x] Migración `20260909183800_user_role_default_viewer` aplicada y verificada
      en la base (`users.role DEFAULT 'VIEWER'`)

### 1.3 Gestión de usuarios — `[x]`
> Bloqueante descubierto al planificar: hoy la única forma de crear un usuario
> es el seed, que empieza con `TRUNCATE` de toda la base.

- [x] `src/app/actions/users.ts`: crear, activar/desactivar, restablecer
      contraseña y cambio de contraseña propia
- [x] Reglas anti-escalada: nadie asigna un rol superior al suyo; no puedes
      desactivarte a ti mismo; no se puede desactivar al último propietario activo
- [x] `requirePageRole()` para proteger páginas redirigiendo (adelanto de 4.3)
- [x] `user-form.tsx` (alta de usuario, con roles asignables filtrados por el rol del actor)
- [x] `usuarios/page.tsx`: listado + acciones por fila + tabla explicativa de roles
- [x] `user-row-actions.tsx`: activar/desactivar y restablecer contraseña
- [x] Enlace desde Configuración (botón "Usuarios")
- [x] `change-password-form.tsx`: cambio de contraseña propia (cualquier rol)
- [x] **verificado en runtime (2026-09-09)**: creación de cajero y contador
      desde la UI. Comando: `npm run dev` → entrar como owner → Configuración →
      Usuarios

### 1.4 Límite de intentos de login — `[x]`
- [x] Throttling por email+IP (5 intentos / 15 min) en `src/auth.ts`, con la
      lógica en `src/lib/auth/rate-limit.ts`
- [x] Contador **persistido** en la tabla `login_attempts` (migración
      `20260909210000_login_attempts`, aplicada con `prisma migrate deploy`):
      en Vercel un contador en memoria no limita nada, cada petición puede caer
      en otra instancia
- [x] Verificar siempre un hash (dummy si el usuario no existe o está inactivo)
      para no filtrar qué cuentas existen por diferencia de latencia
- [x] Un login correcto libera el contador de esa combinación email+IP
- [x] Purga oportunista de intentos fuera de la ventana (la tabla no crece sin límite)
- [x] `RateLimitedSignin` (`code = "rate_limited"`) → el formulario muestra
      "Demasiados intentos fallidos…"; el mensaje se activa igual con correos
      inexistentes, así que no revela qué cuentas existen
- [ ] ⚠️ por verificar (2026-09-09): bloqueo en runtime tras 5 intentos.
      Comando: `npm run dev` → `/login`, 6 intentos fallidos con el mismo correo

**Criterio de salida:** el owner crea cajero y contador; el cajero recibe 403 al
anular una venta; nadie entra sin credenciales propias.

---

## Fase 2 — Integridad del dinero ⬜

### 2.1 Validación en la frontera — `[x]`
- [x] `src/app/actions/schemas.ts` con un esquema Zod por acción (33 esquemas)
- [x] Acciones reciben `payload: unknown` y parsean antes de llamar al dominio
      (`catalog.ts`, `operations.ts`, `production.ts`; `users.ts` ya validaba)
- [x] Los formularios `FormData` pasan por `formValues(formData)` + esquema
      (descarta los `File`, que los procesa `saveUpload`, no Zod)
- [x] `toActionError` mapea `ZodError` → `fieldErrors` por campo + código
      `VALIDATION_ERROR`
- [x] Reglas: cantidades `positive().finite()`, importes y descuentos
      `nonnegative()`, UUID validados, enums cerrados, fechas ISO, longitudes
      máximas y tope de 200 renglones por documento
- [x] `tests/unit/schemas.test.ts` (14 casos): cantidad negativa, `NaN`, enum
      inválido, fecha no ISO, ajuste de cero, campos ajenos descartados
- [x] Verificado: `npm test` (20 casos), `npm run typecheck`, `npm run lint`
      (0 errores) y `npm run build`
- [ ] ⚠️ por verificar (2026-09-09): recorrido en runtime de un formulario de
      cada tipo. Comando: `npm run dev` → venta, compra, gasto y ajuste

> Dos trampas de Zod v4 encontradas aquí: `.default(0)` y `.optional()` miran el
> valor de **entrada**, y un formulario envía `""`, no `undefined`. Por eso hay
> `amountOr(fallback)` y `emptyToUndefined` antes del esquema numérico.

> Cierra: cantidades negativas que **suman** stock, `NaN` propagado hasta
> Postgres, enums inválidos con error opaco.

### 2.2 Invariantes en la base de datos — `[ ]`
- [ ] Índice único parcial: `cash_sessions (business_id) WHERE status='OPEN'`
- [ ] Tabla `sale_counters` con `INSERT … ON CONFLICT DO UPDATE … RETURNING`
      (sustituye el `MAX+1` de ventas y órdenes de producción)
- [ ] Anulación de compra idempotente vía `updateMany` condicional por estado

### 2.3 Confirmación de borradores — `[ ]`
- [ ] Sustituir `if (!product) continue` por error explícito
- [ ] Reutilizar la sesión de caja ya consultada; asignar `null`, nunca `undefined`

### 2.4 Transaccionalidad — `[ ]`
- [ ] Envolver `upsertIngredient` en `prisma.$transaction` (hoy escribe 5 tablas sin ella)

**Criterio de salida:** dos ventas concurrentes obtienen números distintos;
abrir caja dos veces falla con mensaje claro; doble anulación no duplica reversión.

---

## Fase 3 — Cálculos y datos demo ⬜

### 3.1 Fechas — `[ ]`
- [ ] `toCivilDate()` en `src/lib/dates.ts` + uso en dashboard y gastos
      ⚠️ *Hoy los gastos del primer día de cualquier período no aparecen: la
      utilidad se muestra inflada.*
- [ ] `formatDate` no debe desplazar un día las cadenas `YYYY-MM-DD`
- [ ] Validar fechas antes de pasarlas a Prisma

### 3.2 Costos — `[ ]`
- [ ] Promedio ponderado tras anulación: calcular del neto del libro de movimientos
- [ ] Impuesto por línea: asignar el residuo a la última línea
- [ ] Unificar el costo de receta (`src/modules/recipes/query.ts`)
- [ ] `NaN` en varianzas de rendimiento
- [ ] Inventario inicial no repetible

### 3.3 Datos demo verificables — `[ ]`
- [x] Guarda de `TRUNCATE`: aborta si `NODE_ENV=production` sin `--force`
- [ ] Separar modos `--pilot` (sin ventas ficticias) y `--demo`
- [ ] Caso testigo Cappuccino (BEB-006) con valores calculados a mano

### 3.4 Pruebas — `[ ]`
- [ ] `tests/unit/totals.test.ts`, `cash.test.ts`, `purchases.test.ts`, `dates.test.ts`
- [ ] Poner en verde `tests/integration/strawberry-matcha-flow.test.ts`

---

## Fase 4 — Almacenamiento y endurecimiento ⬜

### 4.1 Imágenes a Supabase Storage — `[ ]`
- [ ] Reescribir `saveUpload` sobre Supabase Storage (en Vercel `public/` no persiste)
- [ ] Extensión derivada del MIME real, nunca de `file.name` (hoy: XSS almacenado)
- [ ] `catalog.ts`: `findUnique({id})` → filtrar también por `businessId`

### 4.2 Entrada/salida — `[ ]`
- [ ] Inyección de fórmulas CSV en exportaciones
- [ ] Límite de tamaño en importación de CSV
- [ ] Importación que descarta filas (categorías duplicadas → `P2002` tragado)
- [ ] Exportaciones: `take: 5000` truncando en silencio → devolver 413

### 4.3 UX de errores — `[ ]`
- [x] `requirePageRole()` disponible
- [ ] Sustituir `return null` por redirección en ~13 páginas
- [ ] `key={idx}` → key estable en listas editables de ingredientes
- [ ] Mensajes claros para `P2002`/`P2003`
- [x] `suppressHydrationWarning` en `<html>`/`<body>` del layout raíz: evita que
      las extensiones del navegador de los usuarios rompan la hidratación

---

## Fase 5 — Operación del piloto ⬜

### 5.1 Observabilidad — `[ ]`
- [ ] Log estructurado en `toActionError` (usuario, acción, código)
- [ ] Sentry o logging de Vercel
- [ ] Verificar que `audit_log` se puebla en los flujos críticos

### 5.2 Respaldos — `[ ]`
- [ ] Confirmar backups automáticos de Supabase
- [ ] **Probar una restauración** (un backup sin probar no es un backup)
- [ ] Documentar cómo revertir un despliegue

### 5.3 Puesta en marcha — `[ ]`
- [ ] **Rotar la contraseña de la base** (viene diferida de la fase 1.1). Hacerlo
      **antes** de cargar datos reales y de repartir accesos, con la app parada:
      1. Supabase → Settings → Database → *Reset database password*. Guardar la
         contraseña nueva en un gestor: no se vuelve a mostrar.
      2. Copiar las dos cadenas de conexión ya con la clave nueva:
         transaction pooler (`:6543`) → `DATABASE_URL`; session pooler (`:5432`)
         → `DIRECT_URL`. Codificar en URL los caracteres especiales (`@` → `%40`).
      3. Actualizar `.env` local **y** las variables de entorno en Vercel; redeploy.
      4. Verificar con `npx prisma migrate status` → "Database schema is up to date!".
- [ ] Reset limpio (sin datos demo) antes de entregar
- [ ] Cargar catálogo y precios reales
- [ ] Registrar inventario inicial real
- [ ] Crear cuentas de los usuarios de prueba

### 5.4 Documentación — `[ ]`
- [x] README: variables de entorno y flujo de migraciones
- [ ] Guía para usuarios de prueba (abrir caja → vender → cerrar caja → comprar)
- [ ] Canal de incidencias y qué datos pedir

---

## Diferido a post-piloto

Decisiones conscientes, no olvidos:

- **Aislamiento multi-tenant.** `upsertProductCategory` sin filtro de `businessId`;
  ingredientes de otro negocio admitidos en recetas; `supplierId`/`unitId` sin validar.
  Irrelevante con un solo negocio; **bloqueante absoluto antes del segundo**.
  Al abordarlo, usar un helper `assertOwned(model, id, businessId)` en lugar de
  repetir el `if` — el bug original fue exactamente una omisión de esa copia manual.
- **Rendimiento del dashboard.** Carga todas las ventas del período con sus líneas
  para agregar en JS; `getRecipesWithYieldIssues` escanea el histórico completo.
  Atacar antes de escalar a varias sucursales. `sql/bi-views.sql` ya apunta ahí.
- **Escrituras N+1 en transacciones** (compras, ventas, producción) → `createMany`.
- **Paginación real** en listados y exportaciones.
- Refactors: dispatch por mapa en exports, `deactivateProduct` que en realidad
  alterna, arqueo duplicado en `cash/service.ts`.

---

## Verificación end-to-end (antes de entregar la URL)

| # | Prueba | Estado |
|---|---|---|
| 1 | Desde base vacía: `migrate deploy` + `build` → arranca | ✅ |
| 2 | Login sin credenciales precargadas; `callbackUrl` externo no sale del sitio | ⬜ |
| 3 | Owner crea cajero y contador; cajero recibe 403 al anular | ⬜ |
| 4 | Segunda apertura de caja simultánea falla con mensaje claro | ⬜ |
| 5 | Dos ventas en paralelo → números correlativos distintos | ⬜ |
| 6 | Caso Cappuccino: costo de receta y descuento de inventario cuadran | ⬜ |
| 7 | Gasto de hoy aparece en el dashboard de "hoy" | ⬜ |
| 8 | Dos anulaciones de compra → costo promedio correcto | ⬜ |
| 9 | CSV de 20 productos en 3 categorías → se importan 20 | ⬜ |
| 10 | Imagen subida sobrevive a un redeploy | ⬜ |
| 11 | Cierre de caja cuadra con las ventas en efectivo del turno | ⬜ |
| 12 | `npm run typecheck && npm run lint && npm test` en verde | ⬜ |

---

## Bitácora

| Fecha | Fase | Nota |
|---|---|---|
| 2026-09-09 | 0.1 | Historial de migraciones reconstruido. Se eliminó `manual_in_progress.sql`, que era un volcado UTF-16 de un error de PowerShell committeado por accidente. Baseline `20260909105703_init` (702 líneas) generada con `migrate diff --from-empty`. |
| 2026-09-09 | 0.2 | `prisma.config.ts` sustituye a `package.json#prisma` (deprecado en Prisma 7). El seed pasa a `DIRECT_URL`: hace `TRUNCATE` y transacciones largas, que pgbouncer no maneja bien. |
| 2026-09-09 | 0.3 | Reset autorizado por el usuario y ejecutado contra Supabase (se perdieron 2 negocios y 3 ventas de prueba). Migración aplicada; seed demo en 79 s. `migrate status` → "Database schema is up to date". |
| 2026-09-09 | 1.1 | Retiradas las credenciales de OWNER que venían precargadas en el login y publicadas bajo el formulario. Open redirect cerrado. |
| 2026-09-09 | 1.2 | Roles aplicados a 36 llamadas. Se separó `roles.ts` de `session.ts` al detectar que la sidebar (componente cliente) habría arrastrado Prisma al bundle del navegador. Corregidos 3 *fail-open* que daban rol OWNER por defecto. |
| 2026-09-09 | 1.3 | Acciones de usuarios escritas con validación Zod desde el inicio, incluidas reglas anti-escalada de privilegios. Pendiente la página de listado. |
| 2026-09-09 | 1.2 | Migración `20260909183800_user_role_default_viewer`: la baseline se generó antes de cambiar el `@default`, así que la base había quedado con `DEFAULT 'OWNER'`. Corregido y verificado en BD. |
| 2026-09-09 | docs | Este plan se movió a `docs/` y se registró como DOC-10 en `MANIFEST.md` + `INDEX.md`. Añadidas **DEC-13** (jerarquía de roles), **DEC-14** (permisos fail-closed) y **DEC-15** (alta de usuarios desde la app). Actualizados `MAPA-REPO.md` (roles, migraciones, prisma.config) y matriz (REQ-01, REQ-13). Regla de documentación añadida a `AGENTS.md`. |
| 2026-09-09 | 1.3 | Gestión de usuarios terminada: página, alta, activar/desactivar, restablecer contraseña y cambio propio. Build correcto con la ruta `/configuracion/usuarios`. Cierra el bloqueante de no poder dar de alta cuentas sin ejecutar el seed (que borra la base). |
| 2026-09-09 | 4.3 | Aviso de hidratación en `/login` resuelto con `suppressHydrationWarning` en `<html>` y `<body>` (`src/app/layout.tsx`). No era un fallo de la app: una extensión del navegador inyectaba `hentry`, `entry-content` y `data-rm-theme` y cambiaba `lang` a `en` antes de que React hidratara. El atributo solo afecta a esas dos etiquetas, no a sus hijos. |
| 2026-09-09 | 1.4 | Límite de intentos de login: 5 por (correo, IP) cada 15 min, persistido en `login_attempts` (migración `20260909210000_login_attempts` aplicada en Supabase). Se descartó el contador en memoria: en serverless cada petición puede caer en otra instancia. Añadida la verificación de un hash *dummy* cuando el correo no existe, que cierra la fuga por latencia. Nueva **DEC-17**. `npm run typecheck` → 0 errores; `npm run lint` → 0 errores. |
| 2026-09-09 | 2.1 | Validación de la frontera: `src/app/actions/schemas.ts` (33 esquemas) y las tres actions restantes parsean `payload: unknown` antes de llamar al dominio. `toActionError` traduce `ZodError` a `fieldErrors`. Efecto lateral útil: Zod descarta los campos ajenos al esquema, que antes se propagaban al servicio por *spread*. Nueva **DEC-18** y `tests/unit/schemas.test.ts` (14 casos). `npm test` 20 ✅, typecheck, lint y build correctos. |
| 2026-09-09 | docs | Detectadas dos divergencias doc↔código, anotadas en `DECISIONES.md`: **DEC-05** declara un índice único parcial de caja que no existe (lo crea la Fase 2.2), y **DEC-10** dice que los subproductos no se anidan mientras el código resuelve hasta 3–4 niveles. `MAPA-REPO.md` afirmaba que las actions validan con Zod: hoy solo lo hacen 2 de 5 (lo completa la Fase 2.1). |
