"use client";

import { useEffect, useMemo, useState } from "react";
import { Money } from "@/components/Money";
import { MonthNavigator } from "@/components/MonthNavigator";
import { TransactionRow } from "@/components/TransactionRow";
import { findRecurringIncomeSuggestions } from "@/lib/recurring-income";
import { buildMonthSummary, filterByMonth, filterByWeek } from "@/lib/summaries";
import { useFinanceStore } from "@/store/finance-store";

const REFERENCE_TODAY = new Date("2026-07-16");

export default function SemanasView() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const selectedWeekIso = useFinanceStore((s) => s.selectedWeekIso);
  const setSelectedWeekIso = useFinanceStore((s) => s.setSelectedWeekIso);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const openForm = useFinanceStore((s) => s.openForm);
  const updateIncomeSource = useFinanceStore((s) => s.updateIncomeSource);
  const setViewMode = useFinanceStore((s) => s.setViewMode);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);
  const [dismissedRecurringIds, setDismissedRecurringIds] = useState<string[]>(
    [],
  );

  const summary = useMemo(
    () =>
      buildMonthSummary(
        transactions,
        categories,
        selectedMonth,
        REFERENCE_TODAY,
        paydayWeekday,
      ),
    [transactions, categories, selectedMonth, paydayWeekday],
  );

  const recurringSuggestion = useMemo(() => {
    const suggestions = findRecurringIncomeSuggestions(
      transactions,
      incomeSources,
      { referenceDate: REFERENCE_TODAY },
    );
    return (
      suggestions.find(
        (item) => !dismissedRecurringIds.includes(item.incomeSourceId),
      ) ?? null
    );
  }, [transactions, incomeSources, dismissedRecurringIds]);

  const currentIndex = useMemo(() => {
    const idx = summary.weeks.findIndex((w) => w.isCurrent);
    return idx >= 0 ? idx : 0;
  }, [summary.weeks]);

  const [weekIndex, setWeekIndex] = useState(currentIndex);

  useEffect(() => {
    setViewMode("semana");
  }, [setViewMode]);

  useEffect(() => {
    if (selectedWeekIso) {
      const matchIndex = summary.weeks.findIndex(
        (week) => week.weekIso === selectedWeekIso,
      );
      if (matchIndex >= 0) {
        setWeekIndex(matchIndex);
        return;
      }
    }
    setWeekIndex(currentIndex);
  }, [selectedMonth, currentIndex, selectedWeekIso, summary.weeks]);

  const selectWeekByIndex = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(summary.weeks.length - 1, nextIndex));
    setWeekIndex(clamped);
    const weekIso = summary.weeks[clamped]?.weekIso ?? null;
    setSelectedWeekIso(weekIso);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-[13px] text-[var(--ink-soft)]">Cargando…</p>
      </div>
    );
  }

  const week = summary.weeks[weekIndex] ?? summary.weeks[0];
  const canPrev = weekIndex > 0;
  const canNext = weekIndex < summary.weeks.length - 1;
  const emptyIncome = !week || week.income === 0;

  const weekTransactions = week
    ? filterByWeek(
        filterByMonth(transactions, selectedMonth),
        week.start,
        week.end,
      )
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const movementsHeading = week?.isCurrent
    ? "Movimientos de esta semana"
    : week
      ? `Movimientos · ${week.label}`
      : "Movimientos de esta semana";

  return (
    <div className="flex flex-col gap-5 pb-4 min-[880px]:gap-6">
      <div>
        <MonthNavigator />

        {recurringSuggestion ? (
          <section
            className="mb-5 rounded-[16px] border border-[var(--line)] bg-[var(--gold-soft)] px-4 py-4"
            aria-label="Sugerencia de ingreso recurrente"
          >
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              ¿Marcar «{recurringSuggestion.incomeSourceName}» como recurrente?
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Detectamos {recurringSuggestion.matchCount} ingresos similares los{" "}
              {recurringSuggestion.weekdayLabel}s.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  updateIncomeSource(recurringSuggestion.incomeSourceId, {
                    isRecurring: true,
                  });
                }}
                className="min-h-11 rounded-xl bg-[var(--ink)] px-4 py-2 text-[13px] font-bold text-[var(--ink-contrast)] transition-soft hover:opacity-90 active:scale-[0.98]"
              >
                Sí, marcar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedRecurringIds((prev) =>
                    prev.includes(recurringSuggestion.incomeSourceId)
                      ? prev
                      : [...prev, recurringSuggestion.incomeSourceId],
                  );
                }}
                className="min-h-11 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--ink-soft)] transition-soft hover:text-[var(--ink)]"
              >
                Ahora no
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {!week ? (
        <p className="text-[13px] text-[var(--ink-soft)]">
          No hay semanas en este mes.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <section
            className="space-y-5 rounded-[16px] bg-[var(--card)] px-4 py-5 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] min-[880px]:space-y-6 min-[880px]:rounded-[20px] min-[880px]:px-6 min-[880px]:py-7"
            aria-labelledby="week-focus-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Semana anterior"
                disabled={!canPrev}
                onClick={() => selectWeekByIndex(weekIndex - 1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)] text-[16px] text-[var(--ink-soft)] transition-soft hover:text-[var(--ink)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
              >
                ‹
              </button>

              <div className="min-w-0 text-center">
                <h2
                  id="week-focus-heading"
                  className={`font-display text-[24px] font-semibold ${
                    week.isCurrent ? "text-[var(--green)]" : "text-[var(--ink)]"
                  }`}
                >
                  {week.label}
                </h2>
                <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  {week.rangeLabel}
                </p>
              </div>

              <button
                type="button"
                aria-label="Semana siguiente"
                disabled={!canNext}
                onClick={() => selectWeekByIndex(weekIndex + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)] text-[16px] text-[var(--ink-soft)] transition-soft hover:text-[var(--ink)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
              >
                ›
              </button>
            </div>

            {emptyIncome ? (
              <div className="space-y-5 border-t border-[var(--line)] pt-6 text-center">
                <p className="font-display text-[20px] font-semibold leading-snug text-[var(--ink)]">
                  Todavía no cargaste el ingreso de esta semana
                </p>
                <p className="mx-auto max-w-[28ch] text-[14px] text-[var(--ink-soft)]">
                  Sumá lo que cobraste el día de cobro para ver cuánto te queda
                  realmente.
                </p>
                <button
                  type="button"
                  onClick={() => openForm("ingreso")}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--ink)] px-5 text-[14px] font-bold text-[var(--ink-contrast)] transition-soft hover:opacity-90 active:scale-[0.99]"
                >
                  Agregar ingreso de esta semana
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-6 border-t border-[var(--line)] pt-6">
                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                      Ingreso
                    </p>
                    <p className="leading-none">
                      <Money
                        amount={week.income}
                        tone="income"
                        className="text-[28px] font-semibold text-[var(--green)]"
                      />
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
                      Gastado
                    </p>
                    <p className="leading-none">
                      <Money
                        amount={week.expense}
                        tone="expense"
                        className="text-[28px] font-semibold text-[var(--red)]"
                      />
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openForm("ingreso")}
                  className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-soft hover:bg-[var(--paper-deep)] active:scale-[0.99]"
                >
                  Agregar ingreso de esta semana
                </button>
              </>
            )}
          </section>

          <section
            className="flex flex-col rounded-[16px] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] min-[880px]:rounded-[18px] min-[880px]:p-6"
            aria-labelledby="week-txs-heading"
          >
            <h2
              id="week-txs-heading"
              className="mb-3.5 font-display text-[16.5px] font-semibold text-[var(--ink)]"
            >
              {movementsHeading}
            </h2>

            {weekTransactions.length === 0 ? (
              <p className="text-[13px] text-[var(--ink-soft)]">
                No hay movimientos en esta semana.
              </p>
            ) : (
              <div aria-label={movementsHeading}>
                {weekTransactions.map((tx) => {
                  const category = categories.find((c) => c.id === tx.categoryId);
                  const incomeSource = incomeSources.find(
                    (s) => s.id === tx.incomeSourceId,
                  );
                  return (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      category={category}
                      incomeSourceName={incomeSource?.name}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
