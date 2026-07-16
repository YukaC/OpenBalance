# Rinde

App de finanzas personales pensada para quien cobra **por semana** y decide **por mes**.

## Stack (MVP)

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Zustand (estado + persistencia local)
- Clasificador de gastos por keywords (reglas)

## Cómo correr

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Pantallas

| Ruta | Qué hace |
|---|---|
| `/` | Resumen del mes: balance, semanas, categorías, últimos movimientos |
| `/semanas` | Vista semanal + CTA de ingreso |
| `/transacciones` | Listado filtrable |
| `/categorias` | Categorías y keywords del clasificador |
| `/configuracion` | Perfil (nombre/email), día de cobro, PIN opcional, export CSV, reset demo |

## Modelo

Cada transacción guarda fecha real y campos derivados `semana_iso` / `mes` para resumir con el mismo dataset.

Primera visita: onboarding local (nombre, email, cobro, moneda). El seed demo (Mariano J., julio 2026, `isSetupComplete: true`) se carga con **Restablecer datos demo** y no vuelve a pedir onboarding. PIN opcional en Configuración (hash local `rinde-lock`).
