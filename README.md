# Café Control — Mucho Matcha

Aplicación web para el control operativo y financiero de una cafetería (MVP).

## Stack

- Next.js 16 (App Router) + TypeScript
- PostgreSQL + Prisma
- Auth.js (credenciales) + Argon2id
- Tailwind CSS, Recharts, Zod

## Requisitos

- Node.js 20+
- PostgreSQL 16+ (URL en la nube o local)

## Configuración

1. Copia variables de entorno:

```bash
cp .env.example .env
```

2. Edita `.env`. Son necesarias **dos** URLs de base de datos:

```env
# Pooler transaccional (:6543) — la usa la app en runtime en Railway.
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
# Pooler de sesion (:5432) — la usa `prisma migrate deploy`.
# En Railway usa el Session pooler de Supabase para no depender de IPv6.
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"

AUTH_SECRET="genera uno con: openssl rand -base64 32"
AUTH_URL="http://localhost:3000"

# Contrasena del propietario que crea el seed. Sin valor por defecto.
SEED_OWNER_PASSWORD="una-contrasena-fuerte"
```

3. Instala, migra y siembra:

```bash
npm install
npx prisma migrate deploy   # aplica el historial versionado de prisma/migrations
npm run db:seed             # catalogo base; anade --demo para historial de ejemplo
```

> No uses `prisma db push`: el esquema se gestiona con migraciones versionadas.
> Para cambiarlo, usa `npx prisma migrate dev --name <descripcion>`.

4. Arranca:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### Acceso

El seed crea el usuario propietario `owner@muchomatcha.gt` con la contraseña que
hayas puesto en `SEED_OWNER_PASSWORD`. El resto de cuentas (cajeros, contador) se
crean desde la aplicación, en **Configuración → Usuarios**.

## Deploy en Railway + Supabase

La aplicacion se despliega en Railway como servidor Node de Next.js y usa una
base PostgreSQL de Supabase. El repositorio ya incluye el comando de inicio y
el script `db:migrate:deploy`.

1. En Supabase, abre **Connect** y copia las dos cadenas:
   - Transaction pooler, puerto `6543` → `DATABASE_URL`.
   - Session pooler, puerto `5432` → `DIRECT_URL`.

   Conserva `pgbouncer=true&connection_limit=1&sslmode=require` en
   `DATABASE_URL`. Codifica caracteres especiales de la contrasena en la URL
   (por ejemplo, `@` como `%40`).

2. En Railway crea un proyecto nuevo y selecciona **Deploy from GitHub repo**.
   Elige este repositorio y espera el primer build. Railway detectara el
   `package.json` y ejecutara `npm run build` / `npm run start`.

3. En el servicio de Railway, agrega estas variables:

   ```env
   DATABASE_URL=...
   DIRECT_URL=...
   AUTH_SECRET=un-secreto-aleatorio-largo
   AUTH_URL=https://tu-dominio.up.railway.app
   NODE_ENV=production
   ```

   Genera `AUTH_SECRET` con `openssl rand -base64 32` o un generador seguro.
   No subas `.env` al repositorio.

4. En **Settings → Deploy**, define el **Pre-deploy Command** como:

   ```text
   npm run db:migrate:deploy
   ```

   Esto aplica unicamente las migraciones versionadas antes de iniciar la
   aplicacion. No uses `prisma db push` ni ejecutes el seed automaticamente en
   produccion.

5. Si la base de Supabase es nueva, ejecuta el seed una sola vez desde tu
   equipo, con `.env` apuntando a esa base y una `SEED_OWNER_PASSWORD` fuerte:

   ```bash
   npm run db:seed
   # o npm run db:seed -- --demo para cargar datos de demostracion
   ```

   No configures el seed como comando automatico de Railway: puede truncar la
   base y el propio script bloquea esa operacion cuando `NODE_ENV=production`.

6. En **Settings → Networking**, pulsa **Generate Domain**. Copia esa URL en
   `AUTH_URL` y redeploya. Luego entra con el propietario creado por el seed y
   crea los usuarios desde **Configuracion → Usuarios**.

### Imagenes subidas

Los archivos de `public/uploads` viven en el disco del servicio. Para que
persistan entre deploys, crea un **Volume** en Railway montado exactamente en
`/app/public/uploads` y agrega `UPLOAD_DIR=/app/public/uploads`. Sin ese volumen,
las imagenes cargadas pueden perderse al desplegar una nueva version.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | Verificación TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Tests unitarios (Vitest) |
| `npm run db:seed` | Datos de demostración |
| `npm run db:studio` | Prisma Studio |

## Módulos

Resumen · Ventas · Productos · Recetas · Inventario · Compras · Gastos · Caja · Reportes CSV · Configuración

## Power BI

Las vistas `bi_*` están en `sql/bi-views.sql` (también se aplican en el seed).  
Usuario de solo lectura: ver `sql/roles.sql`.

## Decisiones de negocio del prototipo

- Moneda: GTQ · TZ: America/Guatemala · IVA: 12%
- Precios del menú **sin IVA** (el impuesto se cobra al vender)
- Costo de inventario: promedio ponderado móvil
- Una sola caja abierta por negocio
- Gastos en efectivo descuentan de la caja abierta
