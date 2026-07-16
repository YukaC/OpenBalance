"use client";

import { useMemo, useState } from "react";
import { findRecurringExpenseSuggestions } from "@/lib/recurring-expense";
import { useFinanceStore } from "@/store/finance-store";

const REFERENCE_TODAY = new Date("2026-07-16");

export function RecurringExpenseHint() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

  const suggestion = useMemo(() => {
    const suggestions = findRecurringExpenseSuggestions(
      transactions,
      categories,
      { referenceDate: REFERENCE_TODAY },
    );
    return (
      suggestions.find((item) => !dismissedKeys.includes(item.key)) ?? null
    );
  }, [transactions, categories, dismissedKeys]);

  if (!suggestion) return null;

  const cadenceLabel =
    suggestion.cadence === "monthly"
      ? "todos los meses"
      : `los ${suggestion.weekdayLabel}s`;

  return (
    <section
      className="rounded-[16px] border border-[var(--line)] bg-[var(--gold-soft)] px-4 py-4"
      aria-label="Sugerencia de gasto recurrente"
    >
      <p className="text-[13px] font-semibold text-[var(--ink)]">
        {suggestion.categoryIcon ? `${suggestion.categoryIcon} ` : null}
        ¿Marcar «{suggestion.titlePattern}» como fijo?
      </p>
      <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
        Detectamos {suggestion.matchCount} gastos similares {cadenceLabel}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            for (const transactionId of suggestion.transactionIds) {
              updateTransaction(transactionId, { isFixed: true });
            }
          }}
          className="min-h-11 rounded-xl bg-[var(--ink)] px-4 py-2 text-[13px] font-bold text-[var(--ink-contrast)] transition-soft hover:opacity-90 active:scale-[0.98]"
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
