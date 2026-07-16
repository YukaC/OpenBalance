# Rinde

App de finanzas personales pensada para quien cobra **por semana** y decide **por mes**.

Cargá ingresos y gastos con poca fricción, clasificá por keywords y mirá el resumen del mes en segundos.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4
- **Zustand** (estado local + `localStorage`, local-first)
- **Auth.js** (email/contraseña) + **Drizzle** + **Postgres** (Neon) para sync ocasional multiusuario
- **Capacitor** (opcional) para empaquetar Android/iOS
- Shell PWA (`manifest.webmanifest`)

## Modos de uso

| Modo | Cómo | Datos |
|------|------|--------|
| Local-first (default) | Sin `NEXT_PUBLIC_AUTH_ENABLED` | Solo navegador |
| Con cuenta + sync | `DATABASE_URL` + auth env + `NEXT_PUBLIC_AUTH_ENABLED=true` | Local + Postgres (push/pull) |

La lógica de cálculo vive en el cliente (`src/lib`). El backend es un almacén (CRUD/sync), no recalcula balances.

## Scripts

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # producción web (Vercel)
npm run lint
npm run typecheck
npm test

# Database (requires DATABASE_URL in .env.local)
npm run db:push      # apply schema to Neon (dev)
npm run db:generate  # SQL migrations under ./drizzle
npm run db:migrate

# Mobile
npm run build:mobile
npm run cap:sync
```

## Setup rápido (local + Neon)

Ver la guía completa: **[docs/DEPLOY.md](./docs/DEPLOY.md)**.

Resumen:

```bash
cp .env.example .env.local
# DATABASE_URL (Neon pooled), AUTH_SECRET, AUTH_URL=http://localhost:3000
# NEXT_PUBLIC_AUTH_ENABLED=true

npm run db:push
npm run dev
```

## Pantallas

| Ruta | Qué hace |
|------|----------|
| `/` | Resumen del mes: balance, semanas de cobro, movimientos de la semana |
| `/transacciones` | Listado filtrable |
| `/categorias` | Categorías, keywords y presupuestos |
| `/configuracion` | Perfil, cuentas, cobro, PIN, sync, backup/CSV, descargar app (mobile web) |

La ruta `/semanas` redirige a `/` (unificada en el resumen).

## Modelo

Cada transacción guarda fecha real y campos derivados (`weekIso`, `month`). Los totales del mes usan **semanas de pago** (día de cobro configurable), no solo el mes calendario.

Onboarding local en la primera visita. PIN opcional (hash local). Con auth activado: registro/login antes de usar sync.

## Documentación

- [docs/DEPLOY.md](./docs/DEPLOY.md) — Neon, Auth.js, Vercel, env vars
- [docs/MOBILE.md](./docs/MOBILE.md) — Capacitor / static export
- [AuditLogic.md](./AuditLogic.md) — auditoría de lógica de cálculo
- [implementacion.md](./implementacion.md) — plan original
- [analisis.md](./analisis.md) — análisis de producto
