# Auditoría UX / UI — OpenBalance

**Fecha:** 2026-07-16  
**Rol:** Senior UX/UI  
**Alcance:** shell PWA, tokens, tipografía, motion, rendimiento percibido, a11y visual, flujos (onboarding → resumen → form), dark mode.  
**Método:** CodeGraph + revisión CSS/componentes + **QA live** en `http://127.0.0.1:3000/` (Cursor browser). Contraste WCAG aproximado.  
**Evidencia live:** carpeta [`audit-live/`](audit-live/) (capturas 01–06).

**Severidad:** **P0** bloquea confianza · **P1** duele uso diario · **P2** polish · **P3** nit.

---

## Veredicto

**OpenBalance tiene un MVP visual coherente y por encima del promedio de fintech local-first:** tokens claros, lenguaje “ledger” (papel cálido + hairline terracotta), dual nav desktop/móvil, FAB, modal con trap de foco, empty states con CTA, y respeto parcial a `prefers-reduced-motion`.

**Pero la identidad cae en el cluster AI por defecto** (papel crema `#F3EEE6` + serif Fraunces + acento terracotta `#803E2F`). Funciona, se siente “producto”, y a la vez es intercambiable con otras demos de finanzas generadas.

**Live confirma el veredicto de código** y suma hallazgos de pixel: glow fuerte en semana/nav selected, chart vacío sin empty copy, modal alto, y un `ChunkLoadError` tras restart del dev server.

**Nota global UX/UI: 7.2 / 10.**  
Sube a ~8.5 si: (1) tipografía body deja Inter, (2) focus ring no se apaga en ThemeToggle / links, (3) Resumen recorta densidad, (4) contraste de verdes/faints sube a AA, (5) loading / chunk recovery más robusto.

---

## QA Live (browser) — 2026-07-16

**URL:** `http://127.0.0.1:3000/`  
**Perfil de prueba:** onboarding nuevo → Yuka / yuka@test.com / cobro Vie / ARS.  
**Estado de datos:** vacío ($0, semanas “Sin cargar”) — útil para empty-state QA.  
**Capturas:**

| # | Archivo | Vista |
|---|---------|--------|
| 01 | `audit-live/01-onboarding-dark.png` | Onboarding dark |
| 02 | `audit-live/02-shell-loading-dark.png` | Shell + skeleton / carga Resumen |
| 03 | `audit-live/03-resumen-dark-empty.png` | Resumen desktop dark vacío |
| 04 | `audit-live/04-resumen-light-empty.png` | Resumen desktop light vacío |
| 05 | `audit-live/05-form-modal-light.png` | Modal “Nueva transacción” |
| 06 | `audit-live/06-mobile-resumen-light.png` | Resumen mobile ~390px light |

### Lo que se ve bien en pantalla

- **Onboarding dark:** marca “OpenBalance” hero-level, panel ledger centrado, CTA terracotta “Continuar”, chips cobro/moneda claros. Mejor momento de brand.
- **Shell desktop:** sidebar + nav + ThemeToggle (“Según sistema” → “Modo claro”) + card perfil YU. Jerarquía OK.
- **Balance hero:** kicker “TE QUEDA ESTE MES”, `$0` grande, Entró verde / Salió rojo — semántica legible.
- **Semana Hoy:** badge “HOY” + card selected; strip de 5 semanas funciona.
- **Empty copy:** “Sin cargar”, “Todavía no hay gastos…”, CTA “Cargar un gasto” presentes.
- **Form modal:** labels claros, toggle Ingreso/Gasto, fecha default `2026-07-16` (= hoy real del entorno), categorías seed con emoji.
- **Mobile:** top bar OpenBalance + theme + avatar; FAB `+`; dock Resumen / Semanas / Movs. / Categ. — layout PWA correcto.

### Hallazgos live (pixel / runtime)

| Sev | Hallazgo |
|-----|----------|
| **P0** | Tras reinicio del dev server, **Runtime ChunkLoadError** al cargar `ResumenView` (dynamic import). Overlay rojo Next; app inutilizable hasta hard refresh. UX de recuperación: ninguna. |
| **P1** | **Comparativa mensual** poco intuitiva: SVG vacío parece roto; duplica tabla; leyenda gris. Ver sección dedicada + rediseño a 3 filas + Δ. |
| **P1** | **Glow / glass** en nav active + semana selected (sobre todo dark y light selected): sombra terracotta fuerte, vibe “glow AI”. En mobile el selected strip también pesa visualmente. |
| **P1** | **Densidad Resumen** confirmada en viewport: hero + 5 week cards + chart + grid inferior. Primer pantallazo no es una sola composición. |
| **P1** | Labels / ledes (`Cómo vas este mes`, meta de semanas) se leen **bajos de contraste** sobre paper cream y sobre card dark — alineado con cálculo WCAG de `--ink-soft` / faints. |
| **P2** | Loading: skeleton de paneles aparece (bien), pero también hubo flash “Cargando…” / chunk fail — inconsistente. |
| **P2** | Modal form **muy alto** en desktop light: empuja mucho scroll; en mobile debería ser bottom-sheet (código lo contempla; no re-probado tras Escape). |
| **P2** | FAB abre form en **Gasto** (no ingreso) — OK si es default intencional; en empty state semanal el CTA más urgente es ingreso. |
| **P2** | Badge **Next.js Dev Tools** (“N”) se superpone al dock mobile y contamina la lectura del ícono activo. Solo dev, pero enmascara QA. |
| **P3** | ThemeToggle visual: switch “Modo claro” con knob — OK; ciclo system→light verificado. |
| **P3** | Paper cream + terracotta + Fraunces: en light live se confirma el look “stationery kit” genérico. |

### Notas de sesión / infra

1. Primer intento falló: Next arrancado **dentro de Cursor sandbox** (`Network: 1.0.0.127`) → browser no alcanzaba el puerto. Fix: `next dev -H 127.0.0.1 -p 3000` **fuera** de sandbox.
2. Reloj UI: mes **Julio 2026** + semana Lun 13–Vie 17 + form `2026-07-16` coinciden con “hoy” del entorno (16 Jul 2026) — **no** es el bug de fecha congelada demo; seed histórico sí sigue en julio.
3. No se auditó live con datos seed ricos (perfil fresh = $0). Re-correr con `resetToSeed` para QA de chart/insights llenos.

---

## Comparativa mensual — veredicto UX (poco intuitiva)

**Componente:** `MonthComparisonChart` (`src/components/MonthComparisonChart.tsx`)  
**Severidad:** **P1** (intuición + densidad Resumen)  
**Veredicto:** **No quedó bien.** Ocupa mucho, comunica poco, y en vacío parece roto.

### Por qué falla

1. **Chart SVG vs valor real.** Barras agrupadas (mes ant / mes act × Ingresos / Gastos / Balance) piden decodificar leyenda + colores. El ojo termina en la tabla de abajo; el SVG es ruido.
2. **Empty state roto.** Con $0, `height` de barras = 0 → solo queda la línea base. Hueco grande sin copy → “está roto”, no “sin datos”.
3. **Leyenda poco semántica.** Mes anterior = gris genérico (`ink` mezclado con `line`), no verde/rojo. Usuario no asocia color a significado de dinero.
4. **Duplicación.** Misma info en barras *y* en grid de 3 columnas (prev + current). Redundante.
5. **Rompe design system.** Usa `card-surface` en vez de `ledger-panel` (sin hairline terracotta).
6. **Mala prioridad en Resumen.** Compite con balance hero + semanas (lo que importa al cobro semanal). En mobile empuja el CTA de gasto hacia abajo.

### Dirección recomendada (rediseño)

**Sacar el SVG.** Reemplazar por tres filas compactas tipo ledger:

| Métrica | Mes anterior | Mes actual | Δ |
|---------|--------------|------------|---|
| Ingresos | $… | $… | +/− % o “Sin cambio” |
| Gastos | $… | $… | … |
| Balance | $… | $… | … (tono verde/rojo) |

- Copy empty: una línea — *“Todavía no hay datos para comparar con el mes anterior.”* — sin hueco.
- Contenedor: `ledger-panel` (misma firma visual que el resto).
- Opcional: colapsar / below-fold en mobile, o mostrar solo si hay al menos un mes con datos.

**No hacer:** chart más “bonito” con más barras/animación. El problema es el modelo de lectura, no el polish del SVG.

### Criterio de éxito

Usuario entiende en &lt;2 s “vs mes pasado” sin mirar leyenda. Empty no se confunde con bug. Panel no roba el primer viewport a balance + semana.

---

## Scores por eje

| Eje | Nota | Lectura corta |
|-----|------|----------------|
| Paleta / marca | 6.5 | Tokens sólidos; look genérico crema+terracotta |
| Tipografía | 6.0 | Fraunces + mono bien; Inter diluye personalidad |
| Layout / IA | 8.0 | Shell dual, hierarchy clara, FAB + dock OK |
| Motion | 7.5 | Buen kit; blur/glass caro; un hero-in alcanza |
| Rendimiento percibido | 6.5 | Dynamic OK; ChunkLoadError live; blur + 3 fonts |
| A11y visual / foco | 6.5 | Ring global bueno; varios `outline-none` lo matan |
| Dark mode | 8.0 | Mapping cuidadoso; algunos faints al límite |
| Microcopy / empty | 8.5 | Español rioplatense, CTAs útiles |
| Consistencia design system | 7.0 | `ledger-panel` vs `card-surface` mezclados |

---

## 1. Paleta de colores

### Sistema actual (bien documentado)

Brand base en comentario de `globals.css`:

| Token | Light | Dark | Rol |
|-------|-------|------|-----|
| `--ink` | `#1f1d20` | `#d2c4b0` | Texto principal |
| `--bg` | `#f3eee6` | `#1f1d20` | Lienzo |
| `--card` | `#fffcfa` | `#3b3332` | Paneles |
| `--select` | `#803e2f` | `#803e2f` | CTA / selección |
| `--green` / `--red` / `--gold` | semánticos | semánticos | dinero / alerta |

**Lo bueno**

- Separación clara: terracotta = UI, verde/rojo = dinero. Evita el error clásico de “todo verde brand”.
- Sombras tipadas (`--shadow-card`, `--shadow-fab`, `--shadow-sheet`).
- Dark no es “invertir hex”: superficies en escalones (`#1f1d20` → `#3b3332` → `#3e3d38`).
- Gradientes suaves en `body` + hairline en `.ledger-panel` / `.ledger-hero` dan atmósfera sin stock photography.

**Lo flojo / riesgo**

1. **Look template AI (P1 identidad).** Cream paper + terracotta + serif display = cluster #1 de diseños generados. Quitar el nav y el viewport sigue siendo “otra app de finanzas warm paper”.
2. **Contraste WCAG (aprox.) — fallos AA texto normal (4.5:1):**
   - `--ink-faint` light `#8a7f74` sobre `--bg`: **~3.4**
   - `--green` light `#0b8f56` sobre `--bg`: **~3.6** (montos pequeños en riesgo)
   - `--gold` light `#a86b1a` sobre `--bg`: **~3.8**
   - `--ink-faint` dark sobre `--card`: **~3.6**
3. **`--accent` = `--green`** mientras el CTA real es `--select`. Naming confunde a quien extienda el sistema.
4. **Colores de categoría:** alta nueva fija `#7a6f64`; no hay picker. Donut + barras dependen de seed/manual → visual monótono si el user agrega muchas.
5. **Selection glass (`.is-selected`, `.week-card--selected`):** `backdrop-filter` + múltiples inset shadows. Bonito en desktop; en mobile mid-range = jank + batería.

### Recomendación de dirección (sin romper brand)

Mantener charcoal `#1F1D20` + terracotta, pero **alejar el paper del beige genérico**:

- Opción A: paper más frío/gris-cálido (`#ebe6df` → menos “latte”) + un solo acento más seco.
- Opción B: paper casi blanco roto + sidebar más tinta (menos “stationery kit”).
- Subir un punto `--green` / `--gold` light (más oscuros) para AA en montos 13–14px.
- Exponer `--accent-ui` = select y dejar `--accent-money` = green.

---

## 2. Tipografía

| Rol | Fuente | Uso |
|-----|--------|-----|
| Display | **Fraunces** | títulos, balance hero, brand |
| Body | **Inter** | casi todo |
| Números | **IBM Plex Mono** | `Money`, inputs de monto |

**Lo bueno:** trío con roles claros; `tabular-nums` en montos; Fraunces con `preload: false` (bien: no bloquea LCP del body).

**Problemas**

1. **Inter es el default “AI/SaaS” (P1).** Mata la rareza que Fraunces intenta dar. Body debería ser algo con carácter latino (p.ej. Source Serif 4 text, Literata, o un grotesk menos ubicuo: IBM Plex Sans, Satoshi, Geist… — **preguntar antes de agregar deps/fonts**).
2. **Escala ad-hoc:** `text-[11px]` … `text-[52px]` sueltos. No hay scale token (`--text-xs`…`--text-display`). Diffícil mantener ritmo.
3. **`.page-lede` trunca con `nowrap` + ellipsis.** El subtítulo de página puede cortarse en mobile (“Cómo vas este…”) — anti-patrón para copy de apoyo.
4. **Kickers uppercase + tracking** en muchas secciones: OK una vez; en Resumen se acumulan y huele a dashboard template.

---

## 3. Layout, navegación e información architecture

### Shell

- Breakpoint `880px`: sidebar vs top bar + bottom dock — decisión correcta para PWA.
- Skip link “Ir al contenido”: presente.
- FAB `+` terracotta fijo; dock se oculta (`opacity-0`) con form abierto — bueno.
- Nav SPA vía `history.pushState` + `SectionNavContext` — snappy, sin full reload.

### Resumen (pantalla más cargada)

Orden actual:

1. Header + MonthNavigator  
2. MonthBalance (hero)  
3. WeekBreakdown (strip)  
4. MonthComparisonChart  
5. RecurringExpenseHint  
6. Insights (presupuesto / spend / hormiga)  
7. Grid: CategoryBreakdown + gastos de semana  

**Problema UX (P1 densidad):** primer viewport en mobile no es “una composición”. Es hero + semanas + chart + hints. El usuario de cobro semanal necesita **balance + semana actual + CTA ingreso**; el resto es scroll.

**IA sugerida (mobile):**

1. Balance  
2. Semana activa (1 card o strip corto)  
3. Gastos de esa semana  
4. “Para mirar” (si hay)  
5. Comparativa / categorías colapsables o en 2º scroll  

### Otras vistas

| Vista | Veredicto |
|-------|-----------|
| Semanas | Clara: focus semana + empty ingreso con CTA fuerte |
| Transacciones | Filtros chips + empty OK; delete con `confirm` nativo (fricción fea) |
| Categorías | Densidad alta (keywords inline); color no editable; presupuestos útiles |
| Configuración | Larga (~780 líneas UI); se siente “settings dump” — agrupar en secciones sticky / acordeón |
| Onboarding | Brand-first (`OpenBalance` grande), copy local-first honesta — **mejor pantalla de marca** |
| PIN | Simple; no cifra datos (trust copy debería ser más explícita si se vende “seguridad”) |

### Empty / loading

- Empty states: **excelentes** (copy + CTA).
- Loading: solo texto “Cargando…”. Sin skeleton → flash de vacío al cambiar sección (dynamic import). **P1 percibido.**

---

## 4. Animaciones y motion

### Inventario

| Pieza | Comportamiento |
|-------|----------------|
| `.ledger-hero` | `ledger-hero-in` 0.45s (fade + translateY) |
| Modal | backdrop + panel in/out ~150–220ms |
| `.transition-soft` | color/border/transform 150–200ms |
| `.hover-lift` / week cards | translateY −1/−2px |
| FAB | scale 1.05 hover |
| Barras | width 300–500ms |
| Dock | opacity 0.18s al abrir form |
| `prefers-reduced-motion` | corta modal, hero, soft, hover-lift, week transform |

**Lo bueno:** curva `cubic-bezier(0.22, 1, 0.36, 1)` consistente; reduced-motion real (no decorativo).

**Problemas**

1. **Glass + blur en selected week** = motion “cara”. En reduced-motion se quita transform, **no el blur**.
2. **Hero anima en cada mount** de Resumen → si el user vuelve de otra sección, re-entra. Preferir animate solo first paint o `motion-safe` + once.
3. **Micro `active:scale` en casi todos los botones** — bien táctil; exceso = sensación toy. Priorizar FAB, chips, nav.
4. **Sin transición de sección** (swap abrupto). Un crossfade corto 120ms mejoraría sensación de app, no de website.

---

## 5. Rendimiento (percibido + técnico UI)

### Fortalezas

- `dynamic()` por vista en `AppShell` → code-split real.
- Fraunces / Plex Mono sin preload; Inter con swap.
- Lista de transacciones sin libs de charts pesadas (SVG casero).
- `sanitizeCssColor` evita CSS injection vía colores user.

### Costos / riesgos

1. **`backdrop-filter` en dock, header mobile, week selected, `.is-selected`** — compositor expensive en Android.
2. **Tres familias Google Fonts** — peso + CLS potencial; body Inter cargado con `className` en `<body>`.
3. **Resumen monta chart + breakdown + weeks + insights** siempre; no hay lazy below-fold.
4. **Zustand selectores OK**, pero `Money` se suscribe a `defaultCurrency` → muchas hojas re-render al cambiar perfil.
5. **Sin virtualización** en Transacciones: OK MVP; a 500+ txs, scroll jank.
6. **FOUC theme:** script inline mejoró (respeta `system`); ThemeToggle aún puede flash si hydrata tarde — ya mitigado en gran parte.

### Quick wins

- Quitar blur de estados selected en mobile (`@media (max-width: 879px)` → solid fill).
- Lazy-load `MonthComparisonChart` below fold.
- Skeleton de 2–3 paneles en `SectionLoading`.
- `content-visibility` / `contain` en filas largas.

---

## 6. Accesibilidad UX (foco, teclado, semántica)

### Bien

- Ring global `:focus-visible` en `globals.css` con `--select`.
- `TransactionForm`: dialog, Escape, Tab trap, restore focus, `aria-invalid` en monto.
- `TransactionRow`: `role="button"` + Enter/Space cuando hay `onSelect`.
- Chips con `aria-pressed`; meter de gasto con `aria-valuenow`.
- Touch targets ~40–44px en nav/FAB (cumple rough 44×44).

### Fallos / deudas

| Issue | Sev | Dónde |
|-------|-----|--------|
| `focus-visible:outline-none` **sin ring** | **P0** | `ThemeToggle` compact + full |
| `focus-visible:outline-none` sin ring | **P1** | link “Ver todas →” en Resumen |
| `FOCUS_RING` duplicado en N archivos | P2 | AppShell, Form, MonthNav, vistas… |
| Confirm nativo `window.confirm` | P1 | delete txs / reset config — rompe look + a11y |
| Donut `aria-hidden` + solo barras | P2 | desktop: chart no anunciado; mobile: solo listas OK |
| Emoji como único ícono de categoría | P2 | screen readers leen “emoji”; falta texto accesible paralelo en filas |
| Theme `system` sin listener live | P2 | cambio OS mientras app abierta no actualiza |

---

## 7. Dark mode

**Calidad alta.** Select soft `#492427` separado del card; greens/reds recalibrados; shadows más profundas.

**Cuidar**

- `--ink-faint` sobre card (~3.6) en meta de `TransactionRow`.
- FAB shadow terracotta en dark puede leerse “glow” (cluster AI dark+glow) — bajar opacidad.
- `themeColor` viewport OK; status bar Apple `default` en dark puede quedar raro — considerar `black-translucent` / sync.

---

## 8. Componentes y consistencia visual

| Patrón | Estado |
|--------|--------|
| `.ledger-panel` | Sistema signature — usar siempre |
| `.card-surface` en `MonthComparisonChart` | **Rompe** el lenguaje ledger (sin hairline) |
| Insights asides | Mismo molde gold/red — coherente |
| CTA primario | A veces `--ink`, a veces `--select` — **inconsistente** (onboarding select, empty states ink) |
| Radius | 8–20px tokens + muchos `rounded-xl` Tailwind — OK pero unificar |
| Pills `rounded-full` | Delta chip, “Hoy”, FAB — contenido; no cluster excesivo |

**Dead / ruido en Resumen:** `MonthComparisonChart` y `CategorySpendAlert` están vivos (no dead). Si priorizan foco semanal, el chart es el primer candidato a colapsar o mover a Config/insights.

---

## 9. Microcopy y tono

**Excelente.** Voz rioplatense (“Vas en rojo”, “Todavía no cargaste”, “Para mirar”). Empty states invitan acción sin disculparse. Hormiga/presupuesto hablan en humano.

**Mejoras**

- Hormiga hardcodea “más de $100.000” en copy — debería usar umbral dinámico formateado.
- Keywords placeholder “keywords…” en Categorías — jerga de producto; mejor “palabras que detectan el gasto”.
- PIN: aclarar “protege la apertura, no cifra el almacenamiento”.

---

## 10. Prioridad de ataque (UX/UI only)

### P0 — esta semana

1. Restaurar foco en `ThemeToggle` (sacar `outline-none` solo o sumar `FOCUS_RING`).
2. Subir contraste `--green` / `--ink-faint` light (y faint dark sobre card) a ≥4.5:1 para texto ≤14px.
3. Recuperación ante `ChunkLoadError` (reload suave / retry del dynamic import) + skeleton estable.

### P1 — próximo sprint

4. **Rediseñar Comparativa mensual** (sacar SVG → 3 filas + Δ % + empty copy; ver sección dedicada).
5. Reducir densidad mobile de Resumen (comparativa e insights below fold o accordion).
6. Unificar CTA primario (`--select` vs `--ink`).
7. Lazy-load del bloque comparativa si queda en Resumen.
8. Reemplazar `window.confirm` por dialog in-app.
9. Quitar/limitar `backdrop-filter` en mobile selected states.
10. Body font: salir de Inter (decisión de marca).
11. `.page-lede`: permitir wrap (sacar nowrap/ellipsis).

### P2 — polish

12. Scale tipográfica tokenizada.  
13. Color picker simple para categorías.  
14. Listener `matchMedia` para theme `system`.  
15. Transición breve entre secciones.  
16. Configuración en grupos colapsables.  
17. Virtualizar lista de transacciones si crece.

### P3

18. Menos kickers uppercase.  
19. Animación hero solo first visit.  
20. Alinear naming `--accent`.

---

## 11. Lo que no tocar (ya está bien)

- Separación semántica dinero vs UI accent.  
- Shell responsive + FAB + dock.  
- Modal de transacción (trap, escape, monto con error visible).  
- Empty states con CTA.  
- `prefers-reduced-motion` en keyframes principales.  
- Onboarding brand-first.  
- Hairline terracotta como signature de panel.  
- `getAppToday()` vivo (`new Date()`) — reloj demo ya no congela UI.

---

## 12. Veredicto final (una frase)

**Producto usable y con oficio de design system, pero aún “demo warm paper”: arreglá contraste + foco + densidad mobile, y dale una tipografía body propia — ahí OpenBalance deja de parecer template y empieza a parecer marca.**
