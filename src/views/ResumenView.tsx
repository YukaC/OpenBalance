"use client";

import { useMemo } from "react";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { ExtraordinaryExpenseNote } from "@/components/ExtraordinaryExpenseNote";
import { MonthBalance } from "@/components/MonthBalance";
import { MonthNavigator } from "@/components/MonthNavigator";
import { TransactionRow } from "@/components/TransactionRow";
import { WeekBreakdown } from "@/components/WeekBreakdown";
import { useNavigateToSection } from "@/lib/section-nav";
import {
  filterByMonth,
  filterByWeek,
  buildMonthSummary,
  getExtraordinaryExpense,
  getHormigaDrainAlert,
} from "@/lib/summaries";
import { useFinanceStore } from "@/store/finance-store";

const REFERENCE_TODAY = new Date("2026-07-16");

export default function ResumenView() {
  const navigateToSection = useNavigateToSection();
  const hydrated = useFinanceStore((s) => s.hydrated);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const selectedWeekIso = useFinanceStore((s) => s.selectedWeekIso);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const openFormForEdit = useFinanceStore((s) => s.openFormForEdit);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);

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

  const extraordinaryExpense = useMemo(
    () => getExtraordinaryExpense(transactions, categories, selectedMonth),
    [transactions, categories, selectedMonth],
  );

  const hormigaDrain = useMemo(
    () => getHormigaDrainAlert(transactions, categories, selectedMonth),
    [transactions, categories, selectedMonth],
  );

  const focusedWeek = useMemo(() => {
    if (summary.weeks.length === 0) return null;
    if (selectedWeekIso) {
      const match = summary.weeks.find((week) => week.weekIso === selectedWeekIso);
      if (match) return match;
    }
    return summary.weeks.find((week) => week.isCurrent) ?? summary.weeks[0];
  }, [summary.weeks, selectedWeekIso]);

  const weekTransactions = useMemo(() => {
    if (!focusedWeek) return [];
    const monthTx = filterByMonth(transactions, selectedMonth);
    return filterByWeek(monthTx, focusedWeek.start, focusedWeek.end)
      .filter((tx) => tx.type === "gasto")
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, selectedMonth, focusedWeek]);

  const listHeading = focusedWeek
    ? focusedWeek.isCurrent
      ? "Gastos de esta semana"
      : `Gastos · ${focusedWeek.label}`
    : "Gastos de esta semana";

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center">
        <p className="text-[13px] text-[var(--ink-soft)]">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 min-[880px]:gap-6">
      <div>
        <MonthNavigator />
        <MonthBalance summary={summary} />
        <WeekBreakdown summary={summary} />
      </div>

      <section className="grid grid-cols-1 gap-6 min-[880px]:grid-cols-2 min-[880px]:gap-8">
        <div className="flex flex-col gap-4">
          <CategoryBreakdown summary={summary} />
          <ExtraordinaryExpenseNote
            expense={extraordinaryExpense}
            hormigaDrain={hormigaDrain}
          />
        </div>

        <section
          className="flex flex-col border-t border-[var(--line)] pt-5 min-[880px]:border-l min-[880px]:border-t-0 min-[880px]:pl-8 min-[880px]:pt-0"
          aria-labelledby="recent-heading"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2
              id="recent-heading"
              className="font-display text-[16px] font-semibold text-[var(--ink)] min-[880px]:text-[17px]"
            >
              {listHeading}
            </h2>
            <a
              href="/transacciones"
              onClick={(event) => {
                event.preventDefault();
                navigateToSection("/transacciones");
              }}
              className="shrink-0 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] focus-visible:outline-none"
            >
              Ver todas →
            </a>
          </div>

          {weekTransactions.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-soft)]">
              {focusedWeek
                ? "No hay gastos en esta semana."
                : "No hay gastos este mes."}
            </p>
          ) : (
            <div className="pr-1" aria-label={listHeading}>
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
                    onSelect={() => openFormForEdit(tx.id)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
