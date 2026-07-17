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
import { isActive } from "@/lib/entity-lifecycle";
import { FOCUS_RING } from "@/lib/focus-ring";
import { buildManualFxSnapshot } from "@/lib/manual-fx";
import { getMonthTransactions } from "@/lib/month-index";
import { useNavigateToSection } from "@/lib/section-nav";
import {
  filterByPayWeek,
  buildMonthSummary,
  computeInstallmentDebt,
  findBudgetAlerts,
  findCategorySpendAlerts,
  getHormigaDrainAlert,
  isTransferLeg,
  sumByType,
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

const RecurringIncomeProjectionHint = dynamic(
  () =>
    import("@/components/RecurringIncomeProjectionHint").then(
      (m) => m.RecurringIncomeProjectionHint,
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
  const accounts = useFinanceStore((s) => s.accounts);
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
  const manualExchangeRate = useFinanceStore(
    (s) => s.profile.manualExchangeRate,
  );
  const showToast = useToastStore((s) => s.showToast);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [accountFilter, setAccountFilter] = useState("all");

  useEffect(() => {
    setViewMode("mes");
  }, [setViewMode]);

  useEffect(() => {
    if (!hydrated || hasRepairedTransactionsThisSession) return;
    repairTransactions();
    markTransactionsRepairedThisSession();
  }, [hydrated, repairTransactions]);

  useEffect(() => {
    setAccountFilter("all");
  }, [selectedMonth]);

  const activeAccounts = useMemo(
    () => accounts.filter(isActive),
    [accounts],
  );

  const summaryCurrency = useMemo(() => {
    if (accountFilter === "all") return defaultCurrency;
    const account = activeAccounts.find((item) => item.id === accountFilter);
    return account?.currency ?? defaultCurrency;
  }, [accountFilter, activeAccounts, defaultCurrency]);

  const monthReferenceToday = useMemo(() => getAppToday(), []);

  const prefilteredMonthTransactions = useMemo(() => {
    const monthTx = getMonthTransactions(transactions, selectedMonth, {
      referenceToday: monthReferenceToday,
      paydayWeekday,
      currency: summaryCurrency,
    });
    if (accountFilter === "all") return monthTx;
    return monthTx.filter((tx) => tx.accountId === accountFilter);
  }, [
    transactions,
    selectedMonth,
    monthReferenceToday,
    paydayWeekday,
    summaryCurrency,
    accountFilter,
  ]);

  const summary = useMemo(
    () =>
      buildMonthSummary(
        transactions,
        categories,
        selectedMonth,
        monthReferenceToday,
        paydayWeekday,
        summaryCurrency,
        prefilteredMonthTransactions,
      ),
    [
      transactions,
      categories,
      selectedMonth,
      monthReferenceToday,
      paydayWeekday,
      summaryCurrency,
      prefilteredMonthTransactions,
    ],
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
        {
          currency: summaryCurrency,
          referenceToday: monthReferenceToday,
          prefilteredMonthTransactions,
        },
      ),
    [
      transactions,
      categories,
      selectedMonth,
      paydayWeekday,
      summaryCurrency,
      monthReferenceToday,
      prefilteredMonthTransactions,
    ],
  );

  const budgetAlerts = useMemo(
    () =>
      findBudgetAlerts(
        transactions,
        categories,
        budgets,
        selectedMonth,
        paydayWeekday,
        summaryCurrency,
        prefilteredMonthTransactions,
      ),
    [
      transactions,
      categories,
      budgets,
      selectedMonth,
      paydayWeekday,
      summaryCurrency,
      prefilteredMonthTransactions,
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
        summaryCurrency,
        prefilteredMonthTransactions,
      ),
    [
      transactions,
      categories,
      selectedMonth,
      paydayWeekday,
      summaryCurrency,
      prefilteredMonthTransactions,
    ],
  );

  const installmentDebt = useMemo(
    () => computeInstallmentDebt(transactions, monthReferenceToday),
    [transactions, monthReferenceToday],
  );

  const fxSnapshot = useMemo(() => {
    const otherCurrency: "ARS" | "USD" =
      defaultCurrency === "ARS" ? "USD" : "ARS";
    const otherMonthTx = getMonthTransactions(transactions, selectedMonth, {
      referenceToday: monthReferenceToday,
      paydayWeekday,
      currency: otherCurrency,
    }).filter((tx) => !isTransferLeg(tx));

    const otherIncome = sumByType(otherMonthTx, "ingreso", otherCurrency);
    const otherExpense = sumByType(otherMonthTx, "gasto", otherCurrency);

    return buildManualFxSnapshot({
      defaultCurrency,
      manualExchangeRate,
      otherIncome,
      otherExpense,
    });
  }, [
    manualExchangeRate,
    defaultCurrency,
    transactions,
    selectedMonth,
    monthReferenceToday,
    paydayWeekday,
  ]);

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
      summaryCurrency,
      paydayWeekday,
    )
      .filter((tx) =>
        accountFilter === "all" ? true : tx.accountId === accountFilter,
      )
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    transactions,
    focusedWeek,
    summaryCurrency,
    paydayWeekday,
    accountFilter,
  ]);

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
        {activeAccounts.length > 1 ? (
          <label className="mb-3 mt-2 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
              Cuenta
            </span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              aria-label="Filtrar resumen por cuenta"
              className={`w-full max-w-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition-soft focus:border-[var(--select)] ${FOCUS_RING}`}
            >
              <option value="all">Todas las cuentas</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <MonthBalance
          summary={summary}
          weeklyAverageIncome={weeklyAverageIncome}
        />
        {fxSnapshot && fxSnapshot.rate != null && fxSnapshot.equivalentBalance != null ? (
          <div
            className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-3"
            aria-label="Equivalente en moneda por defecto"
          >
            <p className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Equivalente en {defaultCurrency}
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-[var(--ink)]">
              Balance {fxSnapshot.otherCurrency}:{" "}
              <Money
                amount={fxSnapshot.otherBalance}
                currency={fxSnapshot.otherCurrency}
                withSign
              />
              {" → "}
              <Money
                amount={fxSnapshot.equivalentBalance}
                currency={defaultCurrency}
                withSign
              />
            </p>
            <p className="mt-1.5 text-[11.5px] text-[var(--ink-faint)]">
              Tasa manual: 1 USD = {fxSnapshot.rate.toLocaleString("es-AR")}{" "}
              ARS. No es cotización oficial ni en tiempo real.
            </p>
          </div>
        ) : null}
        {fxSnapshot && fxSnapshot.rate == null ? (
          <div
            className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-3"
            aria-label="Tipo de cambio no configurado"
          >
            <p className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Movimientos en {fxSnapshot.otherCurrency} sin equivalente
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-[var(--ink)]">
              Balance {fxSnapshot.otherCurrency}:{" "}
              <Money
                amount={fxSnapshot.otherBalance}
                currency={fxSnapshot.otherCurrency}
                withSign
              />
            </p>
            <p className="mt-1.5 text-[11.5px] text-[var(--ink-faint)]">
              Configurá un tipo de cambio manual en Configuración para ver el
              equivalente en {defaultCurrency}. No usamos cotizaciones externas.
            </p>
            <button
              type="button"
              onClick={() => navigateToSection("/configuracion")}
              className={`mt-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] ${FOCUS_RING}`}
            >
              Ir a Configuración
            </button>
          </div>
        ) : null}
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
                <Money amount={summary.balance} currency={summaryCurrency} />
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
      <RecurringIncomeProjectionHint />

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
