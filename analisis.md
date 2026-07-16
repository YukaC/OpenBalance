# Análisis — Rinde

Auditoría de **responsive**, **performance** y **seguridad** sobre `http://localhost:3000` (Next.js 15 + Zustand, app client-only).

Fecha: 2026-07-15

---

## Responsive

```
Responsive Test Results:
  375px (mobile):   PASS — dock inferior, header, FAB OK; sin scroll horizontal
  428px (mobile):   PASS — mismo layout, touch targets ≥44px
  768px (tablet):   PASS — sigue chrome móvil (breakpoint 880px); sin overflow
  1280px (desktop): PASS — sidebar + contenido; dock oculto
  1536px (ultrawide): PASS — shell centrado (max-width 1320px, ~108px de margen)
```

**Nota:** entre 768–879px el layout es “móvil ancho” a propósito (`min-[880px]`). No es rotura; si se quiere tablet con sidebar, habría que bajar ese breakpoint.

### Viewports probados

| Nombre | Width | Resultado |
|--------|-------|-----------|
| Mobile (small) | 375px | PASS |
| Mobile (large) | 428px | PASS |
| Tablet | 768px | PASS |
| Desktop | 1280px | PASS |
| Ultrawide | 1536px | PASS |

### Comprobaciones

- Sin scroll horizontal en ningún viewport
- Aside oculto en móvil (`display: none`); dock móvil visible
- Sidebar + dock oculto en desktop (≥880px)
- Touch targets del dock y FAB ≥44px
- Shell centrado en ultrawide (`--shell-max: 1320px`)

---

## Performance

| Prioridad | Hallazgo | Esfuerzo |
|-----------|----------|----------|
| **High** | `AppShell` importa las 5 views de forma eager → todo el JS de la app en el primer paint (`layout.js` ~1.5 MB en dev) | Medio — `next/dynamic` por sección |
| **Medium** | 3 fuentes Google (Inter + Fraunces + IBM Plex Mono); solo Inter con preload | Bajo — limitar pesos/subsets o self-host |
| **Medium** | Listas hacen `.find()` por fila (`categories` / `incomeSources`) en cada render | Bajo — `Map` por id |
| **Low** | Sin paginación; hoy ~16 txs de seed, OK hasta cientos | Bajo cuando escale |
| **OK** | `date-fns` con imports nombrados; `useMemo` en summaries; `font-display: swap`; casi sin imágenes | — |

**Nota:** no se corrió Lighthouse ni bundle-analyzer de producción. Los números de `.next/static` son de **dev** y no representan el bundle real. Para medir en serio: `next build` + analyzer.

### Detalle técnico

- `src/components/AppShell.tsx` importa eager: `ResumenView`, `SemanasView`, `TransaccionesView`, `CategoriasView`, `ConfiguracionView`
- Fuentes en `src/app/layout.tsx`: Fraunces y IBM Plex Mono con `preload: false`; Inter con preload por defecto
- Store: Zustand + `persist` (`rinde-finance-v2`)
- Seed: ~16 transacciones de demo

---

## Security

| Severidad | Hallazgo | Ubicación / fix |
|-----------|----------|-----------------|
| **High** | Finanzas + perfil (email) en `localStorage` (`rinde-finance-v2`) sin cifrado; cualquier XSS los lee | Endurecer CSP; a futuro IndexedDB cifrada o backend |
| **Medium** | Sin CSP / `X-Frame-Options` / `X-Content-Type-Options` / HSTS | `next.config.ts` → `headers()` |
| **Medium** | `npm audit`: PostCSS XSS (moderate) vía Next 15.5.20; `audit fix --force` propone Next 9 (no usar) | Esperar patch de Next o override de `postcss` con cuidado |
| **Medium** | `category.color` inyectado en `style` / SVG stroke (hoy fijo en UI, pero `updateCategory` permite cualquier string) | Validar hex/`#rrggbb` |
| **Low** | `dangerouslySetInnerHTML` del tema — string estático, riesgo bajo | OK |
| **Low** | Borrar movimiento sin confirmación (reset sí pide `confirm`) | Confirm en delete |
| **Low** | `X-Powered-By: Next.js` | `poweredByHeader: false` |
| **Info** | Sin API/auth: modelo local-first; superficie de ataque es XSS + dispositivo compartido | Esperado para el scope actual |
| **OK** | `.env*` en `.gitignore`; sin secrets hardcodeados; CSV escapa comillas | — |

### Detalle técnico

- Persistencia: `src/store/finance-store.ts` → `persist` / `partialize` (profile, categories, incomeSources, transactions, userRules, selectedMonth, viewMode)
- Theme boot script: `src/app/layout.tsx` (`dangerouslySetInnerHTML` estático)
- Color en UI: `TransactionRow` / `CategoryBreakdown` usan `category.color` en estilos inline
- Reset demo: `ConfiguracionView` → `window.confirm` antes de `resetToSeed`
- Delete: `TransaccionesView` llama `deleteTransaction` sin confirmación
- Headers observados en dev: `X-Powered-By: Next.js`, sin CSP

---

## Top 5 acciones

1. Headers de seguridad (CSP estricta + `X-Frame-Options` / `nosniff`).
2. Code-split de views con `dynamic()`.
3. Validar colores de categoría antes de meterlos en CSS.
4. Confirmación al eliminar transacciones.
5. Actualizar Next cuando exista fix limpio del advisory de PostCSS (no forzar downgrade).
