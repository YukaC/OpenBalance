# Auditoría de lógica de cálculo — OpenBalance (AppFinanzas)

Fecha: 2026-07-16
Alcance: toda la lógica de cálculo/agregación (`src/lib`, `src/store`) y su consumo en vistas/componentes (`src/views`, `src/components`). Se aplicó lectura completa de los módulos de negocio + `codegraph` como índice para ubicar todos los call-sites de cada función.

Criterio de prioridad:
- 🔴 **Crítico**: pérdida de datos o número incorrecto visible al usuario.
- 🟠 **Medio**: inconsistencia real entre partes del sistema, deuda técnica que puede convertirse en bug.
- 🟡 **Menor**: mejora de robustez, código muerto, violación de DRY/KISS sin impacto funcional actual.

---

## 0. Resumen ejecutivo

La app tiene **dos definiciones distintas de "mes" y de "semana"** convivendo en el mismo código, y un **mecanismo de deduplicación por contenido (payload) demasiado agresivo** que se ejecuta en cada alta, baja y rehidratación. Estos dos ejes explican tanto el bug de duplicados que ya se parchó parcialmente como riesgos nuevos que introdujo ese mismo parche:

1. 🔴 El dedupe por payload puede **borrar transacciones legítimas** que son casualmente idénticas (dos cafés de $500 el mismo día, dos viajes de colectivo, etc.), tanto al crear como al eliminar, restaurar backup o simplemente abrir la app.
2. 🔴 El botón "Deshacer" tras eliminar **no restaura los clones que el propio `deleteTransaction` barre** junto con el original.
3. 🔴 `filterByMonth` (mes calendario) y `filterByMonthPayWeeks` (semana de pago, con días que se corren de mes) son **dos particiones distintas de las transacciones** y se usan mezcladas: el balance mensual, `TransaccionesView` y el comparador usan la semana de pago; las alertas de presupuesto, de categoría y de "gasto hormiga", y la vista de Categorías, usan el mes calendario. Los números pueden no coincidir entre pantallas.
4. 🔴 Los montos siempre se redondean a entero (`Math.round`) **sin mirar la moneda**, así que USD pierde centavos siempre.
5. 🟠 El campo `Transaction.weekIso` es la semana ISO de calendario (lunes a domingo), **no** la semana de pago del usuario (domingo→día de cobro configurable). Se guarda, se compara y hasta decide un reminder, pero es un concepto distinto al que usa el resto de la app.

El resto del documento detalla cada hallazgo con evidencia, impacto y una propuesta de fix mínima (DRY/KISS: una sola fuente de verdad por concepto, sin ramas muertas ni heurísticas redundantes).

---

## 1. Hallazgos críticos 🔴

### H1. El dedupe por "payload idéntico" puede borrar transacciones legítimas

**Dónde:** `src/store/finance-store.ts` — `transactionPayloadKey`, `dedupeIdenticalPayloadTransactions`, `sanitizeStoredTransactions`.

```151:205:src/store/finance-store.ts
function transactionPayloadKey(transaction: {
  type: Transaction["type"];
  amount: number;
  date: string;
  title: string;
  method: Transaction["method"];
  categoryId: string | null;
  incomeSourceId: string | null;
  note?: string;
}): string {
  return [
    transaction.type,
    transaction.amount,
    transaction.date,
    transaction.title,
    transaction.method,
    transaction.categoryId ?? "",
    transaction.incomeSourceId ?? "",
    (transaction.note ?? "").trim(),
  ].join("|");
}
```

`sanitizeStoredTransactions` se ejecuta en **cada** `addTransaction`, `deleteTransaction`, `restoreBackup`, `partialize` (cada escritura a localStorage) y `onRehydrateStorage` (cada carga de la app). En todos esos casos borra cualquier transacción cuyo "payload" (tipo + monto + fecha + título + método + categoría + fuente + nota) ya exista en la lista, **sin importar si son dos hechos reales distintos**.

Esto es incorrecto porque el payload no incluye ningún identificador temporal de creación ni un contador de "cuántas veces pasó esto": dos compras idénticas el mismo día (dos cafés de $500, dos viajes de colectivo de $300, un mismo Excel bancario con dos líneas iguales importado por CSV) son un caso real y común, y quedan reducidas a una sola.

**Impacto:** pérdida silenciosa de datos financieros reales. El usuario ve un total más bajo que el real y no hay ningún indicio de que algo se borró.

**Por qué se llegó a este punto:** el problema original era el *doble submit accidental* (mismo clic disparado dos veces). Para eso ya existe un guard correcto y acotado:

```358:365:src/store/finance-store.ts
          const latestTransaction = get().transactions[0];
          if (
            latestTransaction &&
            isSameTransactionPayload(latestTransaction, transaction)
          ) {
            // Ignore accidental double-submit (same payload twice in a row).
            return;
          }
```

Este guard (comparar solo contra la **última** transacción insertada) es el fix correcto y suficiente para el doble submit. El problema es que además, en la misma operación, se llama a `sanitizeStoredTransactions` sobre **toda** la lista, lo que vuelve a aplicar el mismo criterio de forma global y sin acotar por tiempo.

**Fix propuesto (KISS: un solo mecanismo, acotado a lo que realmente hay que resolver):**
- Quitar `dedupeIdenticalPayloadTransactions` de `addTransaction`, `deleteTransaction`, `restoreBackup` y `onRehydrateStorage`. El guard contra el último elemento (`isSameTransactionPayload` vs `transactions[0]`) ya cubre el doble submit.
- Si se quiere seguir defendiendo contra duplicados "fantasma" ya persistidos (datos viejos corruptos), acotar la comparación por **proximidad temporal real**, no por contenido puro: agregar un campo `createdAt` (timestamp) a `Transaction` y solo tratar como duplicado un payload idéntico creado dentro de, por ejemplo, 5 segundos del anterior. Sin `createdAt` no hay forma de distinguir "doble clic" de "dos hechos reales iguales".
- Mantener `dedupeTransactionsById` (eso sí es siempre seguro: dos filas con el mismo `id` son por definición el mismo registro corrupto).

---

### H2. "Deshacer" tras eliminar no restaura los clones que `deleteTransaction` también borró

**Dónde:** `src/store/finance-store.ts` (`deleteTransaction`) + `src/views/ResumenView.tsx` (botón "Deshacer").

```442:452:src/store/finance-store.ts
          const payloadKey = transactionPayloadKey(target);
          return {
            transactions: sanitizeStoredTransactions(
              state.transactions.filter((item) => {
                if (item.id === id) return false;
                // Also drop ghost clones (same payload, different id).
                return transactionPayloadKey(item) !== payloadKey;
              }),
            ),
          };
```

`deleteTransaction(id)` no solo borra `id`: borra **todas** las transacciones con el mismo payload (mismo monto/fecha/título/etc.), asumiendo que son "clones fantasma". Pero en la UI, el snapshot para poder deshacer solo guarda la transacción que el usuario tocó:

```289:299:src/views/ResumenView.tsx
        onConfirm={() => {
          if (!pendingDelete) return;
          const snapshot = [pendingDelete];
          deleteTransaction(pendingDelete.id);
          showToast({
            message: "Movimiento eliminado",
            actionLabel: "Deshacer",
            onAction: () => restoreTransactions(snapshot),
            durationMs: 5000,
          });
          setPendingDelete(null);
        }}
```

**Impacto:** si existían dos gastos idénticos ("Café $500", tarjeta débito, mismo día) y el usuario elimina uno, `deleteTransaction` borra **ambos**; "Deshacer" solo trae de vuelta **uno**. El usuario pierde una transacción real sin ninguna acción explícita sobre ella.

**Fix propuesto:** una vez resuelto H1 (que `deleteTransaction` deje de borrar por payload y solo borre por `id`, salvo el caso explícito de `deleteInstallmentGroup`), este bug desaparece solo, porque el snapshot de un único elemento vuelve a ser exacto.

---

### H3. Dos particiones incompatibles de "mes" convivendo en el sistema

**Dónde:** `src/lib/summaries.ts`.

- `filterByMonth(transactions, monthKey)`: filtra por el campo calendario `item.month === monthKey` (más la proyección de gastos fijos). Una transacción del 29 de junio queda en junio, siempre.
- `filterByMonthPayWeeks(transactions, monthKey, ...)`: agrupa por **semana de pago** (domingo → día de cobro configurable) y asigna cada semana al mes en el que cae su día de cobro. Una transacción del 29 de junio puede terminar contando para **julio** si esa semana cobra en julio (caso de test explícito: "includes spillover-day income from the first pay week in month balance").

Uso real, confirmado por búsqueda de todos los call-sites:

| Consumidor | Función usada |
|---|---|
| `buildMonthSummary` (balance del mes, `ResumenView`) | `filterByMonthPayWeeks` / `filterByPayWeek` |
| `TransaccionesView` (listado + filtro por mes) | `filterByMonthPayWeeks` |
| `MonthComparisonChart` (mes actual vs anterior) | `filterByMonthPayWeeks` |
| `getHormigaDrainAlert` | `filterByMonth` |
| `findCategorySpendAlerts` (alerta "gastaste 25% más en X") | `filterByMonth` (vía `sumExpenseByCategory`) |
| `findBudgetAlerts` (alerta de presupuesto 80%/100%) | `filterByMonth` (vía `sumExpenseByCategory`) |
| `CategoriasView` (gastado por categoría / contra presupuesto) | `filterByMonth` (reimplementado a mano, ver M4) |
| `averageWeeklyIncome` (no se usa, ver M2) | `filterByMonth` |

**Impacto real:** cualquier transacción cargada en los últimos días de un mes cuya semana de pago cae en el mes siguiente **se contabiliza distinto según la pantalla**. Ejemplos concretos con `paydayWeekday = "sabado"` (el que usan los tests):
- El balance de julio en `ResumenView` incluye el ingreso del 28 de junio (spillover), pero la alerta de presupuesto de julio en `CategoriasView`/`findBudgetAlerts` **no lo ve** (para ellas sigue siendo de junio).
- Un gasto de "Salidas" cargado el 30 de junio puede disparar la alerta de "gasto hormiga" de junio (`filterByMonth`) mientras que el usuario lo está viendo mostrado como parte de la primera semana de julio en `ResumenView`/`TransaccionesView`.
- El presupuesto que el usuario fija para "julio" en `CategoriasView` se compara contra un conjunto de transacciones distinto al que realmente ve en el resumen de julio.

**Fix propuesto (DRY: una sola fuente de verdad para "qué transacciones son de este mes"):**
- Decidir una sola semántica de mes (recomendado: la de semana de pago, ya que es la que ve el usuario en el resumen principal) y que **todas** las funciones de `summaries.ts` (`getHormigaDrainAlert`, `sumExpenseByCategory`, `findCategorySpendAlerts`, `findBudgetAlerts`) reciban `paydayWeekday` y usen `filterByMonthPayWeeks` en vez de `filterByMonth`.
- Actualizar `CategoriasView` para llamar a `sumExpenseByCategory`/una función exportada de `summaries.ts` en lugar de reimplementar el loop a mano (ver M4), así el cambio de semántica se propaga en un solo lugar.
- Dejar `filterByMonth` solo como building-block interno de `filterByMonthPayWeeks` (para el caso `weeks.length === 0`, hoy inalcanzable, ver M6) y no como API pública consumida por vistas.

---

### H4. Redondeo de montos sin distinguir moneda: USD pierde centavos siempre

**Dónde:** `src/store/finance-store.ts` (`addTransaction`) y `src/components/TransactionForm.tsx`.

```306:319:src/store/finance-store.ts
        const currency = input.currency ?? get().profile.defaultCurrency;
        const origin = input.origin ?? "manual";
        const isAutoCategorized =
          input.type === "gasto" && !input.categoryId && suggestion.isAuto;
        const isFixed = Boolean(input.isFixed) && input.type === "gasto";
        const canUseInstallments =
          input.type === "gasto" &&
          input.method === "tarjeta_credito" &&
          !isFixed;
        const installmentCount = canUseInstallments && input.installmentCount
          ? Math.max(1, Math.min(24, Math.round(input.installmentCount)))
          : 1;
        const startDate = input.date || todayIso();
        const totalAmount = Math.round(input.amount);
```

`parseMoneyInput` (usado en el formulario) sí soporta decimales (`49656,39`), pero el monto se redondea a entero **siempre**, sin mirar `currency`. Lo mismo en `TransactionForm.tsx`:

```288:291:src/components/TransactionForm.tsx
    const payload = {
      type,
      amount: Math.round(amountNumber),
      date,
```

**Impacto:** un gasto en USD de `19.99` se guarda como `20`. Como el balance en USD se calcula sumando estos montos ya truncados (`sumByType(..., "USD")`), el error se acumula transacción tras transacción. Para ARS (que en el uso cotidiano de la app no maneja centavos) el redondeo es intencional y correcto; para USD no lo es.

**Fix propuesto:** redondear a 2 decimales cuando `currency === "USD"` y a entero cuando `currency === "ARS"` (un solo helper, p. ej. `roundAmountForCurrency(amount, currency)` en `format.ts`, usado tanto en `TransactionForm` como en `finance-store.addTransaction`/`updateTransaction`/`csv-io.ts`, en vez de tres `Math.round` sueltos).

---

## 2. Hallazgos medios 🟠

### M1. `restoreTransactions` es la única mutación que no pasa por `sanitizeStoredTransactions`

**Dónde:** `src/store/finance-store.ts`.

```457:467:src/store/finance-store.ts
      restoreTransactions: (restored) =>
        set((state) => {
          if (restored.length === 0) return state;
          const restoredIds = new Set(restored.map((item) => item.id));
          const withoutDuplicates = state.transactions.filter(
            (item) => !restoredIds.has(item.id),
          );
          return {
            transactions: [...restored, ...withoutDuplicates],
          };
        }),
```

Todas las demás mutaciones (`addTransaction`, `deleteTransaction`, `restoreBackup`, `onRehydrateStorage`, `partialize`) sanean con `sanitizeStoredTransactions`; esta no. Es una inconsistencia de DRY (una regla que debería cumplirse siempre, tiene una excepción no documentada). Una vez resuelto H1 esto deja de ser peligroso, pero conviene mantener el mismo pipeline en todos los puntos de entrada para que no dependa de que cada desarrollador se acuerde de llamarlo.

**Fix:** que `restoreTransactions` construya el array igual y listo (`[...restored, ...withoutDuplicates]`) — ya no hace falta sanear si H1 elimina el dedupe por payload; solo mantener `dedupeTransactionsById` como red de seguridad universal en un único punto (por ejemplo, como paso final dentro del propio `set`, no once por función).

### M2. Código muerto: `filterByWeek` y `averageWeeklyIncome`

**Dónde:** `src/lib/summaries.ts`.

Búsqueda de usos en todo `src/`: ninguna vista ni componente llama a `filterByWeek` ni a `averageWeeklyIncome` (quedaron de la época de `SemanasView`, ya eliminada). Además, `averageWeeklyIncome` tiene el mismo problema que H3 (usa `filterByMonth`) y agrupa por `item.weekIso`, que es semana ISO, no semana de pago (ver M3) — o sea que además de no usarse, si se reactivara daría un número poco confiable.

**Fix (KISS):** eliminar ambas funciones. Si se necesita "promedio semanal" en el futuro, se puede derivar de `buildMonthSummary(...).weeks` (que ya son semanas de pago reales), dividiendo `income` total por `weeks.length`.

### M3. `Transaction.weekIso` es semana ISO de calendario, no la "semana de pago" del resto de la app

**Dónde:** `src/lib/dates.ts` (`toWeekIso`), `src/store/finance-store.ts`, `src/lib/payday-reminder.ts`.

```32:37:src/lib/dates.ts
export function toWeekIso(date: Date | string): string {
  const value = typeof date === "string" ? parseISO(date) : date;
  const year = getISOWeekYear(value);
  const week = String(getISOWeek(value)).padStart(2, "0");
  return `${year}-W${week}`;
}
```

`toWeekIso` usa semana ISO 8601 (lunes a domingo, fija). El resto de la app (`getPayWeekBounds`, `getMonthWorkWeeks`, `filterByPayWeek`) define "semana" como **domingo → día de cobro configurable por el usuario** (`paydayWeekday`, que puede ser cualquier día). Son dos calendarios de semana distintos que no coinciden salvo que el día de cobro sea domingo.

Sin embargo, `Transaction.weekIso` (calculado con `toWeekIso` al crear/editar) se sigue usando para lógica real en `payday-reminder.ts`:

```36:43:src/lib/payday-reminder.ts
  const { start, end } = getPayWeekBounds(referenceDate, paydayWeekday);
  const weekIso = toWeekIso(start);

  const hasIncomeThisWeek = transactions.some((item) => {
    if (item.type !== "ingreso") return false;
    if (item.weekIso === weekIso) return true;
    const date = parseISO(item.date);
    return date >= start && date <= end;
  });
```

La condición real y correcta es la segunda (`date >= start && date <= end`, rango de la semana de pago). La primera (`item.weekIso === weekIso`) compara dos "semanas ISO" — la del inicio de la semana de pago actual contra la semana ISO de la fecha del ingreso — y puede dar **falsos positivos**: un ingreso de una semana ISO que coincide numéricamente pero cuya fecha real cae fuera de `[start, end]` haría que `.some()` devuelva `true` por la primera rama, y el aviso de "cargá tu sueldo" **no se muestre** aunque no haya ingreso real en la semana de pago.

**Fix (KISS):** borrar la primera condición (`if (item.weekIso === weekIso) return true;`) y dejar solo la comprobación por rango de fechas, que ya es correcta y suficiente por sí sola. A nivel de modelo, documentar en `types.ts` que `weekIso` es "semana ISO de calendario, no la semana de pago" (o directamente evaluar eliminarlo del modelo si nada depende realmente de él más que exportación CSV informativa).

### M4. `CategoriasView` reimplementa a mano lo que ya existe en `summaries.ts`

**Dónde:** `src/views/CategoriasView.tsx`.

```73:80:src/views/CategoriasView.tsx
  const spentByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filterByMonth(transactions, selectedMonth, currency)) {
      if (tx.type !== "gasto" || !tx.categoryId) continue;
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
    }
    return map;
  }, [transactions, selectedMonth, currency]);
```

Esto es exactamente lo que hace `sumExpenseByCategory` en `summaries.ts` (usada internamente por `findBudgetAlerts`/`findCategorySpendAlerts`), solo que no está exportada. DRY: dos implementaciones del mismo cálculo que pueden divergir con el tiempo (de hecho ya divergen en la semántica de "mes", ver H3).

**Fix:** exportar `sumExpenseByCategory` desde `summaries.ts` y que `CategoriasView` la consuma, en vez de reimplementar el loop.

### M5. Rama muerta en `getPayWeekBounds`

**Dónde:** `src/lib/dates.ts`.

```102:107:src/lib/dates.ts
  const end =
    daysSincePayday === 0
      ? startOfDay(reference)
      : startOfDay(addDays(reference, daysUntilPayday));
  const start = startOfDay(addDays(end, -6));
```

Cuando `daysSincePayday === 0` (hoy es el día de cobro), `daysUntilPayday` también es `0` (ambos son `(x) % 7` con el mismo `x` en valor absoluto), así que `addDays(reference, daysUntilPayday)` da exactamente `reference`. Las dos ramas del ternario producen el mismo resultado; la rama especial no aporta nada distinto, solo confunde a quien lea el código pensando que hay un caso especial real.

**Fix:** `const end = startOfDay(addDays(reference, daysUntilPayday));` sin condicional.

### M6. Fallback inalcanzable en `inferFixedPayWeekIndex` (y `getPayWeekPaydayIso`)

**Dónde:** `src/lib/dates.ts`.

```220:239:src/lib/dates.ts
export function inferFixedPayWeekIndex(
  dateIso: string,
  paydayWeekday: Weekday = "viernes",
): number {
  const monthKey = toMonthKey(dateIso);
  const weeks = getMonthWorkWeeks(monthKey, parseISO(dateIso), paydayWeekday);
  if (weeks.length === 0) return 1;
  const date = startOfDay(parseISO(dateIso));
  const matchIndex = weeks.findIndex(
    (week) => date >= week.start && date <= week.end,
  );
  if (matchIndex >= 0) {
    // Prefer "cuarta" over a 5th spillover week for late-month dates.
    if (matchIndex + 1 >= 5 && weeks.length >= 4) return 4;
    return matchIndex + 1;
  }
  const day = getDate(date);
  if (day <= 15) return 1;
  return Math.min(4, weeks.length);
}
```

`getMonthWorkWeeks` construye siempre semanas contiguas (cada semana empieza el día siguiente al fin de la anterior) que cubren el mes completo — nunca puede dar `weeks.length === 0` (todo mes de al menos 28 días tiene al menos 4 ocurrencias de cualquier día de la semana), y como las semanas son contiguas y `monthKey` se deriva de la propia `dateIso`, `matchIndex` siempre se encuentra. Es decir: **el fallback `day <= 15 ? 1 : 4` y el `if (weeks.length === 0) return 1` nunca se ejecutan** con las invariantes actuales del sistema. No es un bug, pero es complejidad accidental (KISS): código defensivo que enmascararía silenciosamente un bug real en `getMonthWorkWeeks` en vez de fallar de forma visible.

**Fix sugerido:** documentar explícitamente la invariante ("`getMonthWorkWeeks` siempre cubre el mes completo sin huecos") con un test que lo verifique, y simplificar estas dos funciones quitando las ramas muertas, o —si se prefiere mantenerlas como red de seguridad— agregar un comentario explícito de que son defensivas e "no deberían" alcanzarse nunca, no una heurística real.

### M7. `normalizeIncomeSources` ignora su primer parámetro

**Dónde:** `src/lib/seed.ts`.

```146:161:src/lib/seed.ts
export function normalizeIncomeSources(
  incomeSources: IncomeSource[],
  transactions: Transaction[],
): { incomeSources: IncomeSource[]; transactions: Transaction[] } {
  void incomeSources;
  return {
    incomeSources: DEFAULT_INCOME_SOURCES.map((source) => ({ ...source })),
    ...
```

Es intencional (la app fija los 3 motivos de ingreso por diseño), pero el `void incomeSources;` es una señal de que la firma no debería seguir recibiendo ese parámetro. Mantenerlo invita a que alguien en el futuro asuma que la función respeta las fuentes existentes.

**Fix:** quitar el parámetro `incomeSources` de la firma (no se usa) y renombrar la función o agregar un comentario en la declaración (no solo en el cuerpo) aclarando que los motivos de ingreso son fijos por diseño.

---

## 3. Hallazgos menores 🟡

### m1. `parseMoneyInput`: ambigüedad real en `"1.234"` (`src/lib/format.ts:62-74`)

Con un solo punto y exactamente 3 dígitos después, siempre se interpreta como separador de miles (`1.234` → `1234`), incluso si el usuario quiso escribir un decimal. En el contexto de ARS (sin centavos en el uso diario) es razonable, pero si `currency === "USD"` un monto como `1.234` (mil doscientos treinta y cuatro) vs `1.234` (uno con 234 milésimos, inusual pero posible si alguien pega un dato con formato en-US de 3 decimales) es indistinguible. Documentar la limitación es suficiente; no amerita más heurística (KISS: no vale la pena resolver una ambigüedad que el propio input humano ya trae).

### m2. `parseTransactionsCsv` descarta la fila entera si el método de pago no matchea exactamente (`src/lib/csv-io.ts:57-62, 134-138`)

```57:62:src/lib/csv-io.ts
function parseMethod(raw: string): PaymentMethod | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "otro";
  if (normalized in METHOD_LABELS) return normalized as PaymentMethod;
  return METHOD_FROM_LABEL[normalized] ?? null;
}
```

Un CSV con un método mal tipeado (`"Tarjeta Debito"` sin tilde, por ejemplo) hace que toda la fila se cuente en `skippedCount` y se pierda, cuando podría defaultear a `"otro"` y avisar en el resumen de importación en vez de perder el registro completo.

### m3. `formatWeekRangeLabel`/`formatDayMonth` no incluyen el año (`src/lib/dates.ts:75-87`)

Una semana de pago que cruza fin de año (ej. 29 dic – 4 ene) se muestra como "29 Dic — 4 Ene" sin distinguir años. Es un caso de borde poco frecuente (una vez al año) pero puede confundir en el selector de meses/semanas cerca de diciembre/enero.

### m4. `updateTransaction` no re-sanea ni re-clasifica tras un edit (`src/store/finance-store.ts:413-425`)

Al editar una transacción para que quede con el mismo payload que otra ya existente, no hay ningún chequeo (a diferencia de `addTransaction`). Tampoco se recalcula `isAutoCategorized`/sugerencia de categoría si cambian `title`/`note` desde afuera del formulario. Hoy `TransactionForm` sí recalcula `isAutoCategorized` a mano antes de llamar a `updateTransaction`, así que no es un bug activo, pero es lógica que vive en el componente en vez de estar centralizada en el store (menos DRY: cualquier otro caller de `updateTransaction` tendría que reimplementarla).

### m5. Condición duplicada en `addTransaction` (`src/store/finance-store.ts:286-310`)

`input.type === "gasto" && !input.categoryId` se evalúa dos veces (una para pedir la sugerencia, otra para `isAutoCategorized`). No es un bug, pero se puede extraer a una constante (`const shouldSuggestCategory = ...`) para que ambas lecturas queden atadas a una sola expresión.

### m6. Doble implementación de "clamp de día a fin de mes"

`shiftIsoDateByMonths` (usa el auto-clamp interno de `date-fns#addMonths`) y `projectIsoDateToMonth` (clamp manual con `Math.min(day, getDate(endOfMonth(...)))`) resuelven el mismo problema (31 ene + 1 mes → 28/29 feb) por dos caminos distintos. Ambos son correctos hoy, pero es lógica duplicada que conviene unificar en un solo helper para que un futuro cambio de comportamiento (por ejemplo, elegir "primer día del mes siguiente" en vez de clamear) no requiera tocar dos lugares.

---

## 4. Lo que funciona bien (validado explícitamente)

- `buildInstallmentAmounts` reparte el resto de la división entre las primeras cuotas sin perder ni un peso: la suma de las cuotas generadas es siempre exactamente el monto total. ✅
- El particionado de `getMonthWorkWeeks` en semanas de pago es contiguo y sin huecos (cada semana empieza el día siguiente al fin de la anterior), por lo que cualquier fecha del mes cae en exactamente una semana. ✅
- La regla de "gasto fijo en 1ª y 4ª semana, incluso en meses con 5 cobros" (`resolveFixedPayWeekIndex` + `fixedPayWeekIndex` pineado por transacción) está bien resuelta: son dos transacciones fijas independientes, no una sola proyectándose dos veces — no hay doble conteo. ✅ (ver test `places recurring fixed expenses on 1st and 4th pay weeks`).
- `sumByType`/`filterByMonth`/`filterByPayWeek` deduplican por `id` dentro de sí mismos, protegiendo los totales contra el caso de que igual queden ids repetidos en el storage. ✅
- `parseFinanceBackup` valida estructuralmente cada transacción/categoría/cuenta antes de aceptarlas, y rechaza versiones de backup futuras desconocidas. ✅

---

## 5. Plan de acción sugerido (orden de prioridad)

1. **H1 + H2** (mismo fix): quitar `dedupeIdenticalPayloadTransactions` de las rutas de mutación; dejar solo el guard "vs. última transacción" para el doble submit, y `dedupeTransactionsById` como única red de seguridad estructural. Esto también arregla el Deshacer (H2) sin tocar la UI.
2. **H3**: unificar la semántica de "mes" en `summaries.ts` para que `findBudgetAlerts`, `findCategorySpendAlerts`, `getHormigaDrainAlert` y `CategoriasView` usen semana de pago igual que `buildMonthSummary`/`TransaccionesView`.
3. **H4**: redondeo de monto dependiente de moneda (ARS entero, USD 2 decimales) en un solo helper reusado por `TransactionForm`, `finance-store` y `csv-io`.
4. **M1–M7**: limpieza de código muerto y de rutas de mutación inconsistentes (`restoreTransactions`), documentar/eliminar `weekIso` mal usado, extraer `sumExpenseByCategory` para que `CategoriasView` la reuse.
5. **m1–m6**: mejoras de robustez de baja prioridad, se pueden ir tomando de forma incremental.

Ningún hallazgo de este documento requiere agregar dependencias nuevas; todos los fixes son reorganización/eliminación de lógica ya existente (consistente con DRY/KISS: menos código, una sola fuente de verdad por concepto).
