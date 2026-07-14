"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { MonthBalance } from "@/components/MonthBalance";
import { MonthNavigator } from "@/components/MonthNavigator";
import { TransactionRow } from "@/components/TransactionRow";
import { WeekBreakdown } from "@/components/WeekBreakdown";
import { filterByMonth, buildMonthSummary } from "@/lib/summaries";
import { useFinanceStore } from "@/store/finance-store";

const REFERENCE_TODAY = new Date("2026-07-16");

export default function ResumenPage() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);

  const summary = useMemo(
    () =>
      buildMonthSummary(
        transactions,
        categories,
        selectedMonth,
        REFERENCE_TODAY,
      ),
    [transactions, categories, selectedMonth],
  );

  const recent = useMemo(() => {
    return filterByMonth(transactions, selectedMonth)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [transactions, selectedMonth]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[13px] text-[var(--ink-muted)]">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-8">
      <MonthNavigator />
      <MonthBalance summary={summary} />
      <WeekBreakdown summary={summary} />
      <CategoryBreakdown summary={summary} />

      <section className="space-y-3" aria-labelledby="recent-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="recent-heading"
            className="font-display text-[22px] text-[var(--ink)]"
          >
            Últimas transacciones
          </h2>
          <Link
            href="/transacciones"
            className="shrink-0 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Ver todas →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-muted)]">
            No hay movimientos este mes.
          </p>
        ) : (
          <div>
            {recent.map((tx) => {
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
  );
}
