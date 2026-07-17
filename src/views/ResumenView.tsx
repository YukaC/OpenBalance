"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BudgetAlertBanner } from "@/components/BudgetAlertBanner";
import { CategorySpendAlert } from "@/components/CategorySpendAlert";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HormigaDrainNote } from "@/components/HormigaDrainNote";
import { Money } from "@/components/Money";
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
  computeInstallmentDebt,
  findBudgetAlerts,
  findCategorySpendAlerts,
  getHormigaDrainAlert,
} from "@/lib/summaries";
import {
  hasRepairedTransactionsThisSession,
  markTransactionsRepairedThisSession,
} from "@/lib/repair-session";
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
  const monthlySavingsGoal = useFinanceStore(
    (s) => s.profile.monthlySavingsGoal,
  );
  const showToast = useToastStore((s) => s.showToast);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  useEffect(() => {
    setViewMode("mes");
  }, [setViewMode]);

  useEffect(() => {
    if (!hydrated || hasRepairedTransactionsThisSession) return;
    repairTransactions();
    markTransactionsRepairedThisSession();
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
      getHormigaDrainAlert(
        transactions,
        categories,
        selectedMonth,
        paydayWeekday,
        { currency: defaultCurrency },
      ),
    [transactions, categories, selectedMonth, paydayWeekday, defaultCurrency],
  );

  const budgetAlerts = useMemo(
    () =>
      findBudgetAlerts(
        transactions,
        categories,
        budgets,
        selectedMonth,
        paydayWeekday,
        defaultCurrency,
      ),
    [
      transactions,
      categories,
      budgets,
      selectedMonth,
      paydayWeekday,
      defaultCurrency,
    ],
  );

  const categorySpendAlerts = useMemo(
    () =>
      findCategorySpendAlerts(
        transactions,
        categories,
        selectedMonth,
        paydayWeekday,
        0.2,
        defaultCurrency,
      ),
    [transactions, categories, selectedMonth, paydayWeekday, defaultCurrency],
  );

  const installmentDebt = useMemo(
    () => computeInstallmentDebt(transactions, getAppToday()),
    [transactions],
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

  const savingsGoal =
    monthlySavingsGoal != null && monthlySavingsGoal > 0
      ? monthlySavingsGoal
      : null;
  const savingsProgressRatio =
    savingsGoal != null
      ? Math.max(0, Math.min(1, summary.balance / savingsGoal))
      : 0;

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
        {savingsGoal != null ? (
          <div
            className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-3"
            aria-label="Meta de ahorro mensual"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Meta de ahorro
              </p>
              <p className="text-[12.5px] font-semibold tabular-nums text-[var(--ink)]">
                <Money amount={summary.balance} currency={defaultCurrency} />
                {" / "}
                <Money amount={savingsGoal} currency={defaultCurrency} />
              </p>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[var(--bg)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(savingsProgressRatio * 100)}
              aria-label="Progreso de meta de ahorro"
            >
              <div
                className="h-full rounded-full bg-[var(--green)] transition-[width] duration-300"
                style={{ width: `${savingsProgressRatio * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--ink-faint)]">
              {summary.balance >= savingsGoal
                ? "Meta alcanzada este mes"
                : `${Math.round(savingsProgressRatio * 100)}% del balance del mes`}
            </p>
          </div>
        ) : null}
      </section>

      <WeekBreakdown summary={summary} />

      {installmentDebt.length > 0 ? (
        <section
          className="ledger-panel p-4 min-[880px]:p-5"
          aria-labelledby="installment-debt-heading"
        >
          <div className="section-intro mb-3">
            <h2 id="installment-debt-heading" className="section-heading">
              Cuotas pendientes
            </h2>
            <p className="section-lede">Lo que queda por pagar en cuotas</p>
          </div>
          <ul className="space-y-2">
            {installmentDebt.map((group) => (
              <li
                key={group.installmentGroupId}
                className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
                    {group.title}
                  </p>
                  <p className="text-[12px] text-[var(--ink-soft)]">
                    {group.remainingCount} de {group.installmentCount} cuotas
                  </p>
                </div>
                <Money
                  amount={group.remainingAmount}
                  tone="expense"
                  currency={group.currency}
                  className="shrink-0 text-[14px] font-semibold"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
