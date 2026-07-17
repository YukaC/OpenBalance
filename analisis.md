# Auditoría frontend / UX — OpenBalance

**Estado: CERRADA** · 2026-07-16  
Verificación final: `typecheck` OK · `lint` OK · `test` 10/10

Auditoría full (CodeGraph + UX) + remediación completa de must/should.  
Fuera de alcance explícito (épicas de producto, no bugs abiertos): cifrado de datos con PIN, Service Worker offline.

---

## Resumen ejecutivo

OpenBalance pasó de MVP con reloj demo congelado y huecos de consistencia a app usable con fecha real, totales por moneda, a11y básica, toasts con undo, config modular y tests de dominio.  
Identidad tipográfica: Fraunces (display) + Source Sans 3 (body) + IBM Plex Mono (números).

---

## Must fix — resuelto

| # | Hallazgo | Fix |
|---|----------|-----|
| 1 | Reloj demo `2026-07-16` | `getAppToday()` / `todayIso()`; `selectedMonth` al mes actual |
| 2 | Presupuestos sin fijos proyectados | `CategoriasView` → `filterByMonth` |
| 3 | Semanas vs fijos | Path `filterByMonth` → `filterByWeek` + tests |
| 4 | Sumas ARS+USD mezcladas | Filtro por `defaultCurrency` en summaries |
| 5 | Delete cuota huérfana | `deleteInstallmentGroup` + ConfirmDialog |
| 6 | Form silencio si monto inválido | Alert + `aria-invalid` |
| 7 | PIN parece cifrado | Copy: no cifra datos locales |
| 8 | Rehydrate pisaba colores | Solo `sanitizeCssColor` |
| 9 | Backup sin schema | Validación/filtro en `parseFinanceBackup` |
| 10 | Rows sin teclado | `onSelect` + roles en `TransactionRow` |

---

## Should fix — resuelto

| ID | Fix |
|----|-----|
| S1 | Búsqueda en Transacciones |
| S2 | Rename + `removeCategory` |
| S3 | Color picker por categoría |
| S4 | Confirm quitar cuenta |
| S5 | Dedup import CSV |
| S6 | Toast undo post-delete |
| S7 | Dismiss payday/recurring en `sessionStorage` |
| S8 | Método `otro` |
| S9 | Aviso editar cuota (no propaga serie) |
| S10 | Chart + CategorySpendAlert en Resumen |
| S12–S14 | Onboarding local/backup + email regex + “Por defecto” |
| S15 | `ConfirmDialog` (delete tx / quitar categoría) |
| S16 | Toast “Movimiento guardado” |
| S17 | PIN rate-limit 5 / 30s |
| S18 | Theme light / dark / system |
| S19 | `ViewSkeleton` en vistas |
| S20 | FAB clearance vía `--fab-clearance` en `main` |
| S21–S23 | Focus calendario; restore foco form; helper moneda cuenta |
| S24 | Icon maskable en manifest (SW = épica aparte) |
| A1–A3 | Focus rings; skip link; `aria-pressed` filtros |
| D1 | Body Source Sans 3 (sin Inter) |
| D3 | Config split → `src/views/configuracion/*` |
| M1, M3, M6–M9 | Tests; WEEKDAYS centralizados; dead code; viewMode; scripts; keywords ≥3 |

---

## Fuera de alcance (épicas)

| Tema | Por qué no es bug abierto |
|------|---------------------------|
| Cifrado localStorage con PIN | Feature de seguridad dedicada; copy ya honestiza el gate |
| Service Worker / offline PWA | Cambio de runtime + política de cache; pedir explícito |
| Virtualización de listas | Solo relevante con miles de movimientos |

---

## Entregables técnicos

**Nuevos:** `getAppToday`, `toast-store`, `AppToast`, `ConfirmDialog`, `ViewSkeleton`, `restoreTransactions`, secciones config, tests `summaries` / `backup` / `classifier`, `scripts/ts-resolve.mjs`

**Scripts:** `npm run typecheck` · `npm test` · `npm run lint`

---

## Checklist de aceptación

```bash
npm run typecheck && npm test && npm run lint
```

1. Mes/semana “Hoy” = fecha del sistema  
2. Fijo de mes anterior cuenta en presupuesto actual  
3. Totales solo moneda del perfil  
4. Borrar cuota → serie o solo esa + undo toast  
5. Monto inválido → error visible  
6. PIN disclaimer + lockout tras 5 fallos  
7. Theme ciclo claro/oscuro/sistema  
8. Buscar / color categoría / quitar categoría  
9. CSV re-import sin duplicados  
10. Config modular; body Source Sans 3  

---

## Cierre

No quedan ítems must/should abiertos de la auditoría.  
Épicas (cifrado, SW) viven como backlog de producto, no como deuda de esta auditoría.
