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

2. Edita `.env` y coloca tu `DATABASE_URL`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/cafe_control?sslmode=require"
AUTH_SECRET="genera-un-secreto-largo"
AUTH_URL="http://localhost:3000"
```

3. Instala, migra y siembra datos demo:

```bash
npm install
npx prisma db push
npm run db:seed
```

4. Arranca:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### Credenciales demo

- Correo: `owner@muchomatcha.gt`
- Contraseña: `Matcha2026!`

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
