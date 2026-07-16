"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BudgetAlertBanner } from "@/components/BudgetAlertBanner";
import { CategorySpendAlert } from "@/components/CategorySpendAlert";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HormigaDrainNote } from "@/components/HormigaDrainNote";
import { MonthBalance } from "@/components/MonthBalance";
import { MonthNavigator } from "@/components/MonthNavigator";
import { TransactionRow } from "@/components/TransactionRow";
import { ViewSkeleton } from "@/components/ViewSkeleton";
import { WeekBreakdown } from "@/components/WeekBreakdown";
import { getAppToday } from "@/lib/dates";
import { FOCUS_RING } from "@/lib/focus-ring";
import { useNavigateToSection } from "@/lib/section-nav";
import {
  filterByPayWeek,
  buildMonthSummary,
  findBudgetAlerts,
  findCategorySpendAlerts,
  getHormigaDrainAlert,
} from "@/lib/summaries";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";
import { useToastStore } from "@/store/toast-store";

const MonthComparisonChart = dynamic(
  () =>
    import("@/components/MonthComparisonChart").then(
      (m) => m.MonthComparisonChart,
    ),
  { loading: () => null },
);

const CategoryBreakdown = dynamic(
  () =>
    import("@/components/CategoryBreakdown").then((m) => m.CategoryBreakdown),
  { loading: () => null },
);

const RecurringExpenseHint = dynamic(
  () =>
    import("@/components/RecurringExpenseHint").then(
      (m) => m.RecurringExpenseHint,
    ),
  { loading: () => null },
);

export default function ResumenView() {
  const navigateToSection = useNavigateToSection();
  const hydrated = useFinanceStore((s) => s.hydrated);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const selectedWeekIso = useFinanceStore((s) => s.selectedWeekIso);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const budgets = useFinanceStore((s) => s.budgets);
  const openForm = useFinanceStore((s) => s.openForm);
  const openFormForEdit = useFinanceStore((s) => s.openFormForEdit);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const restoreTransactions = useFinanceStore((s) => s.restoreTransactions);
  const repairTransactions = useFinanceStore((s) => s.repairTransactions);
  const setViewMode = useFinanceStore((s) => s.setViewMode);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);
  const defaultCurrency = useFinanceStore((s) => s.profile.defaultCurrency);
  const showToast = useToastStore((s) => s.showToast);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  useEffect(() => {
    setViewMode("mes");
  }, [setViewMode]);

  useEffect(() => {
    if (!hydrated) return;
    repairTransactions();
  }, [hydrated, repairTransactions]);

  const summary = useMemo(
    () =>
      buildMonthSummary(
        transactions,
        categories,
        selectedMonth,
        getAppToday(),
        paydayWeekday,
        defaultCurrency,
      ),
    [transactions, categories, selectedMonth, paydayWeekday, defaultCurrency],
  );

  const weeklyAverageIncome = useMemo(() => {
    const weeksWithIncome = summary.weeks.filter((week) => week.income > 0);
    if (weeksWithIncome.length === 0) return 0;
    return summary.income / weeksWithIncome.length;
  }, [summary.income, summary.weeks]);

  const hormigaDrain = useMemo(
    () =>
      getHormigaDrainAlert(transactions, categories, selectedMonth, {
        currency: defaultCurrency,
      }),
    [transactions, categories, selectedMonth, defaultCurrency],
  );

  const budgetAlerts = useMemo(
    () =>
      findBudgetAlerts(
        transactions,
        categories,
        budgets,
        selectedMonth,
        defaultCurrency,
      ),
    [transactions, categories, budgets, selectedMonth, defaultCurrency],
  );

  const categorySpendAlerts = useMemo(
    () =>
      findCategorySpendAlerts(
        transactions,
        categories,
        selectedMonth,
        0.2,
        defaultCurrency,
      ),
    [transactions, categories, selectedMonth, defaultCurrency],
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
    return filterByPayWeek(
      transactions,
      focusedWeek.start,
      focusedWeek.end,
      defaultCurrency,
      paydayWeekday,
    )
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, focusedWeek, defaultCurrency, paydayWeekday]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const incomeSourcesById = useMemo(
    () =>
      new Map(incomeSources.map((incomeSource) => [incomeSource.id, incomeSource])),
    [incomeSources],
  );

  const listHeading = focusedWeek
    ? focusedWeek.isCurrent
      ? "Movimientos de esta semana"
      : `Movimientos · ${focusedWeek.label}`
    : "Movimientos de esta semana";

  const listSubheading = focusedWeek ? focusedWeek.rangeLabel : null;

  const hasInsights =
    budgetAlerts.length > 0 ||
    categorySpendAlerts.length > 0 ||
    hormigaDrain !== null;

  if (!hydrated) {
    return <ViewSkeleton />;
  }

  return (
    <div className="view-stack">
      <header className="page-header">
        <h1 className="page-title">Resumen</h1>
        <p className="page-lede">Cómo vas este mes</p>
      </header>

      <section aria-label="Resumen del mes">
        <MonthNavigator />
        <MonthBalance
          summary={summary}
          weeklyAverageIncome={weeklyAverageIncome}
        />
      </section>

      <WeekBreakdown summary={summary} />

      <section
        className="ledger-panel flex flex-col p-4 min-[880px]:p-5"
        aria-labelledby="recent-heading"
      >
        <div className="relative mb-3 flex min-h-11 items-center justify-center px-16">
          <div className="min-w-0 text-center">
            <h2 id="recent-heading" className="section-heading">
              {listHeading}
            </h2>
            {listSubheading ? (
              <p className="section-lede">{listSubheading}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => navigateToSection("/transacciones")}
            className={`absolute right-0 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] ${FOCUS_RING}`}
          >
            Ver todas →
          </button>
        </div>

        {weekTransactions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
            <p className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
              {focusedWeek
                ? "Esta semana todavía no tiene movimientos."
                : "No hay movimientos este mes."}
            </p>
            <button
              type="button"
              onClick={() => openForm("ingreso")}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--select)] px-4 text-[13px] font-bold text-[var(--chip-active-text)] transition-soft hover:opacity-90"
            >
              Cargar un ingreso
            </button>
            <button
              type="button"
              onClick={() => openForm("gasto")}
              className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-[13px] font-semibold text-[var(--ink-soft)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] ${FOCUS_RING}`}
            >
              También un gasto
            </button>
          </div>
        ) : (
          <div className="pr-1" aria-label={listHeading}>
            {weekTransactions.map((tx, index) => {
              const category = tx.categoryId
                ? categoriesById.get(tx.categoryId)
                : undefined;
              const incomeSource = tx.incomeSourceId
                ? incomeSourcesById.get(tx.incomeSourceId)
                : undefined;
              return (
                <div
                  key={`${tx.id}-${index}`}
                  className="row-contain flex items-stretch gap-1"
                >
                  <div className="min-w-0 flex-1">
                    <TransactionRow
                      transaction={tx}
                      category={category}
                      incomeSourceName={incomeSource?.name}
                      onSelect={() => openFormForEdit(tx.id)}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar ${tx.title}`}
                    onClick={() => setPendingDelete(tx)}
                    className={`mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[20px] text-[var(--ink-faint)] transition-soft hover:bg-[var(--red-soft)] hover:text-[var(--red)] ${FOCUS_RING}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Eliminar movimiento"
        message={
          pendingDelete
            ? `¿Eliminar «${pendingDelete.title}»?`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        isDestructive
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
        onCancel={() => setPendingDelete(null)}
      />

      {hasInsights ? (
        <section className="space-y-3" aria-labelledby="insights-heading">
          <div className="section-intro">
            <h2 id="insights-heading" className="section-heading">
              Para mirar
            </h2>
            <p className="section-lede">
              Señales del mes — no tenés que actuar en todas
            </p>
          </div>
          <div className="mx-auto flex max-w-xl flex-col gap-3">
            <BudgetAlertBanner alerts={budgetAlerts} />
            <CategorySpendAlert alerts={categorySpendAlerts} />
            <HormigaDrainNote hormigaDrain={hormigaDrain} />
          </div>
        </section>
      ) : null}

      <RecurringExpenseHint />

      <section aria-label="Más del mes" className="space-y-5">
        <MonthComparisonChart
          transactions={transactions}
          monthKey={selectedMonth}
        />

        <div className="ledger-panel p-4 min-[880px]:p-5">
          <CategoryBreakdown summary={summary} />
        </div>
      </section>
    </div>
  );
}
