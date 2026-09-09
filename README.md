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
# Pooler (:6543) — la usa la app en runtime. Obligatorio en Vercel/serverless.
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
# Conexion directa (:5432) — la exige `prisma migrate`, que no pasa por pgbouncer.
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
