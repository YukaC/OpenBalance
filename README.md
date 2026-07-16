# Rinde

App de finanzas personales pensada para quien cobra **por semana** y decide **por mes**.

Cargá ingresos y gastos con poca fricción, clasificá por keywords y mirá el resumen del mes en segundos.

## Stack (MVP)

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4
- **Zustand** (estado + persistencia en el navegador)
- Clasificador de gastos por keywords (reglas)
- Shell PWA liviano (`manifest.webmanifest`) para instalar como app

## Local-first

Rinde corre **sin backend**: los datos viven en el navegador (Zustand + `localStorage`). No hace falta cuenta ni servidor para usar el MVP.

## Scripts

```bash
npm install   # o npm ci en CI
npm run dev   # desarrollo en http://localhost:3000
npm run build # build de producción
npm run lint  # ESLint
```

Typecheck (sin script npm dedicado):

```bash
npx tsc --noEmit
```

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/` | Resumen del mes: balance, semanas, categorías, últimos movimientos |
| `/semanas` | Vista semanal + CTA de ingreso |
| `/transacciones` | Listado filtrable |
| `/categorias` | Categorías y keywords del clasificador |
| `/configuracion` | Día de cobro, export CSV, reset demo |

## Modelo

Cada transacción guarda fecha real y campos derivados `semana_iso` / `mes` para resumir con el mismo dataset.

Datos demo: julio 2026 (perfil Mariano J., cobro viernes).

## Documentación

- [implementacion.md](./implementacion.md) — plan de implementación original
- [analisis.md](./analisis.md) — análisis y decisiones del producto
