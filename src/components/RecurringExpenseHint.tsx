"use client";

import { useMemo, useState } from "react";
import { getAppToday } from "@/lib/dates";
import { findRecurringExpenseSuggestions } from "@/lib/recurring-expense";
import { useFinanceStore } from "@/store/finance-store";

export function RecurringExpenseHint() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

  const suggestion = useMemo(() => {
    const suggestions = findRecurringExpenseSuggestions(
      transactions,
      categories,
      { referenceDate: getAppToday() },
    );
    return (
      suggestions.find((item) => !dismissedKeys.includes(item.key)) ?? null
    );
  }, [transactions, categories, dismissedKeys]);

  if (!suggestion) return null;

  const cadenceLabel =
    suggestion.cadence === "monthly"
      ? "todos los meses"
      : suggestion.cadence === "biweekly"
        ? suggestion.weekdayLabel
          ? `cada dos semanas los ${suggestion.weekdayLabel}s`
          : "cada dos semanas"
        : `los ${suggestion.weekdayLabel}s`;

  return (
    <section
      className="ledger-panel bg-[var(--gold-soft)] px-4 py-4 text-center"
      aria-label="Sugerencia de gasto recurrente"
    >
      <p className="text-[13px] font-semibold text-[var(--ink)]">
        {suggestion.categoryIcon ? `${suggestion.categoryIcon} ` : null}
        ¿Marcar «{suggestion.titlePattern}» como fijo?
      </p>
      <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
        Detectamos {suggestion.matchCount} gastos similares {cadenceLabel}.
        Si lo marcás, se cuenta en todos los meses hasta que lo edites o
        elimines.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            // One template only — marking all would stack the same expense each month.
            const templateId = suggestion.transactionIds[0];
            if (templateId) {
              updateTransaction(templateId, { isFixed: true });
            }
          }}
          className="min-h-11 rounded-xl bg-[var(--select)] px-4 py-2 text-[13px] font-bold text-[var(--chip-active-text)] transition-soft hover:opacity-90"
        >
          Sí, marcar fijo
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissedKeys((prev) =>
              prev.includes(suggestion.key) ? prev : [...prev, suggestion.key],
            );
          }}
          className="min-h-11 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--ink-soft)] transition-soft hover:text-[var(--ink)]"
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}
