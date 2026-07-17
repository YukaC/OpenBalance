import { format, isWithinInterval, parseISO } from "date-fns";
import type { Account, Budget, Category, Transaction, Weekday } from "./types";
import {
  formatMonthName,
  getAppToday,
  getMonthWorkWeeks,
  getPayWeekPaydayIso,
  inferFixedPayWeekIndex,
  previousMonthKey,
  projectIsoDateToMonth,
  toMonthKey,
  toWeekIso,
  type MonthWeekSlice,
} from "./dates";
import { isActive } from "./entity-lifecycle";
import { formatPercentDelta } from "./format";

export interface MonthSummary {
  monthKey: string;
  income: number;
  expense: number;
  balance: number;
  comparison: ReturnType<typeof formatPercentDelta>;
  byCategory: Array<{
    category: Category;
    amount: number;
  }>;
  weeks: Array<
    MonthWeekSlice & {
      income: number;
      expense: number;
      hasData: boolean;
    }
  >;
}

/** Infinite monthly fixed expense (not a finite credit-card installment). */
export function isRecurringFixedExpense(transaction: Transaction): boolean {
  return (
    transaction.type === "gasto" &&
    transaction.isFixed &&
    !(
      transaction.installmentCount != null && transaction.installmentCount > 1
    )
  );
}

/**
 * 1-based pay-week index for a fixed expense: stored `fixedPayWeekIndex` if set,
 * otherwise inferred from `date` via `inferFixedPayWeekIndex` (clamped 1–4).
 */
export function resolveFixedPayWeekIndex(
  transaction: Transaction,
  paydayWeekday: Weekday = "viernes",
): number {
  if (
    transaction.fixedPayWeekIndex != null &&
    transaction.fixedPayWeekIndex >= 1
  ) {
    return Math.min(4, Math.round(transaction.fixedPayWeekIndex));
  }
  return inferFixedPayWeekIndex(transaction.date, paydayWeekday);
}

/**
 * Project a recurring fixed expense onto a target month's pay week
 * (1ª or 4ª by default), dated on that week's payday.
 */
export function projectTransactionToMonth(
  transaction: Transaction,
  monthKey: string,
  paydayWeekday: Weekday = "viernes",
): Transaction {
  if (
    isRecurringFixedExpense(transaction) &&
    transaction.month <= monthKey
  ) {
    const weekIndex = resolveFixedPayWeekIndex(transaction, paydayWeekday);
    const paydayIso =
      getPayWeekPaydayIso(monthKey, weekIndex, paydayWeekday) ??
      projectIsoDateToMonth(transaction.date, monthKey);
    return {
      ...transaction,
      date: paydayIso,
      month: monthKey,
      weekIso: toWeekIso(paydayIso),
      fixedPayWeekIndex: weekIndex,
    };
  }

  if (transaction.month === monthKey) return transaction;
  const projectedDate = projectIsoDateToMonth(transaction.date, monthKey);
  return {
    ...transaction,
    date: projectedDate,
    month: monthKey,
    weekIso: toWeekIso(projectedDate),
  };
}

/** Account-transfer leg — excluded from income/expense month summaries. */
export function isTransferLeg(transaction: Transaction): boolean {
  return Boolean(transaction.transferGroupId);
}

export function sumByType(
  transactions: Transaction[],
  type: Transaction["type"],
  currency?: "ARS" | "USD",
): number {
  const seenIds = new Set<string>();
  let total = 0;
  for (const item of transactions) {
    if (!isActive(item)) continue;
    if (isTransferLeg(item)) continue;
    if (item.type !== type) continue;
    if (currency && item.currency !== currency) continue;
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    total += item.amount;
  }
  return total;
}

export interface AccountLedgerTotals {
  income: number;
  expense: number;
}

/**
 * Active-ledger totals for one account (same currency filter as the account).
 * Includes transfer legs so account balances move correctly; month income/
 * expense summaries use sumByType, which excludes them.
 */
export function sumByAccount(
  transactions: Transaction[],
  accountId: string,
  currency?: "ARS" | "USD",
): AccountLedgerTotals {
  const seenIds = new Set<string>();
  let income = 0;
  let expense = 0;

  for (const item of transactions) {
    if (!isActive(item)) continue;
    if (item.accountId !== accountId) continue;
    if (currency && item.currency !== currency) continue;
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    if (item.type === "ingreso") income += item.amount;
    else if (item.type === "gasto") expense += item.amount;
  }

  return { income, expense };
}

/**
 * Account balance = openingBalance (default 0) + ingresos − gastos
 * over the full active ledger for that accountId / account currency.
 */
export function computeAccountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  const openingBalance = account.openingBalance ?? 0;
  const { income, expense } = sumByAccount(
    transactions,
    account.id,
    account.currency,
  );
  return openingBalance + income - expense;
}

export interface InstallmentDebtGroup {
  installmentGroupId: string;
  title: string;
  currency: "ARS" | "USD";
  remainingCount: number;
  remainingAmount: number;
  installmentCount: number;
  /** Earliest remaining cuota date (ISO), if any. */
  nextDate: string | null;
}

function installmentBaseTitle(title: string): string {
  const stripped = title.replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/u, "").trim();
  return stripped.length > 0 ? stripped : title;
}

/**
 * Pending credit-card installment debt grouped by installmentGroupId.
 * Remaining = active cuotas with date ≥ today (relative to referenceToday).
 */
export function computeInstallmentDebt(
  transactions: Transaction[],
  referenceToday: Date = getAppToday(),
): InstallmentDebtGroup[] {
  const today = format(referenceToday, "yyyy-MM-dd");

  type GroupBucket = {
    title: string;
    currency: "ARS" | "USD";
    installmentCount: number;
    remaining: Transaction[];
  };

  const groups = new Map<string, GroupBucket>();

  for (const item of transactions) {
    if (!isActive(item)) continue;
    if (item.type !== "gasto") continue;
    const groupId = item.installmentGroupId;
    if (!groupId) continue;
    if (item.installmentCount == null || item.installmentCount <= 1) {
      continue;
    }

    let bucket = groups.get(groupId);
    if (!bucket) {
      bucket = {
        title: installmentBaseTitle(item.title),
        currency: item.currency,
        installmentCount: item.installmentCount,
        remaining: [],
      };
      groups.set(groupId, bucket);
    } else if (item.installmentCount > bucket.installmentCount) {
      bucket.installmentCount = item.installmentCount;
    }

    if (item.date >= today) {
      bucket.remaining.push(item);
    }
  }

  const result: InstallmentDebtGroup[] = [];
  for (const [installmentGroupId, bucket] of groups) {
    if (bucket.remaining.length === 0) continue;
    bucket.remaining.sort((a, b) => a.date.localeCompare(b.date));
    result.push({
      installmentGroupId,
      title: bucket.title,
      currency: bucket.currency,
      remainingCount: bucket.remaining.length,
      remainingAmount: bucket.remaining.reduce(
        (total, item) => total + item.amount,
        0,
      ),
      installmentCount: bucket.installmentCount,
      nextDate: bucket.remaining[0]?.date ?? null,
    });
  }

  return result.sort((a, b) => {
    if (a.nextDate && b.nextDate) {
      const byDate = a.nextDate.localeCompare(b.nextDate);
      if (byDate !== 0) return byDate;
    }
    return b.remainingAmount - a.remainingAmount;
  });
}

export function filterByMonth(
  transactions: Transaction[],
  monthKey: string,
  currency?: "ARS" | "USD",
  paydayWeekday: Weekday = "viernes",
): Transaction[] {
  const result: Transaction[] = [];
  const seenIds = new Set<string>();

  for (const item of transactions) {
    if (!isActive(item)) continue;
    if (currency && item.currency !== currency) continue;
    if (seenIds.has(item.id)) continue;

    if (isRecurringFixedExpense(item)) {
      if (item.month <= monthKey) {
        seenIds.add(item.id);
        result.push(projectTransactionToMonth(item, monthKey, paydayWeekday));
      }
      continue;
    }

    if (item.month === monthKey) {
      seenIds.add(item.id);
      result.push(item);
    }
  }

  return result;
}

/**
 * Transactions in a payday week, including days that spill into adjacent months
 * and recurring fixed expenses projected onto those days.
 */
export function filterByPayWeek(
  transactions: Transaction[],
  weekStart: Date,
  weekEnd: Date,
  currency?: "ARS" | "USD",
  paydayWeekday: Weekday = "viernes",
): Transaction[] {
  const monthKeys = new Set<string>();
  for (
    let cursor = weekStart;
    cursor <= weekEnd;
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
    )
  ) {
    monthKeys.add(toMonthKey(cursor));
  }

  const result: Transaction[] = [];
  const seenKeys = new Set<string>();

  for (const item of transactions) {
    if (!isActive(item)) continue;
    if (currency && item.currency !== currency) continue;

    if (isRecurringFixedExpense(item)) {
      for (const monthKey of monthKeys) {
        if (item.month > monthKey) continue;
        const projected = projectTransactionToMonth(
          item,
          monthKey,
          paydayWeekday,
        );
        const date = parseISO(projected.date);
        if (!isWithinInterval(date, { start: weekStart, end: weekEnd })) {
          continue;
        }
        const seenKey = `${item.id}:${projected.date}`;
        if (seenKeys.has(seenKey)) continue;
        seenKeys.add(seenKey);
        result.push(projected);
      }
      continue;
    }

    if (seenKeys.has(item.id)) continue;
    const date = parseISO(item.date);
    if (isWithinInterval(date, { start: weekStart, end: weekEnd })) {
      seenKeys.add(item.id);
      result.push(item);
    }
  }

  return result;
}

/**
 * All transactions in the pay weeks of a month (weeks whose payday falls
 * in that month). Opening days may spill into the previous calendar month.
 */
export function filterByMonthPayWeeks(
  transactions: Transaction[],
  monthKey: string,
  referenceToday: Date = getAppToday(),
  paydayWeekday: Weekday = "viernes",
  currency?: "ARS" | "USD",
): Transaction[] {
  const weeks = getMonthWorkWeeks(monthKey, referenceToday, paydayWeekday);
  if (weeks.length === 0) {
    return filterByMonth(transactions, monthKey, currency);
  }

  const result: Transaction[] = [];
  const seenKeys = new Set<string>();

  for (const week of weeks) {
    for (const item of filterByPayWeek(
      transactions,
      week.start,
      week.end,
      currency,
      paydayWeekday,
    )) {
      const seenKey = `${item.id}:${item.date}`;
      if (seenKeys.has(seenKey)) continue;
      seenKeys.add(seenKey);
      result.push(item);
    }
  }

  return result;
}

export function buildMonthSummary(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  referenceToday: Date = getAppToday(),
  paydayWeekday: Weekday = "viernes",
  currency?: "ARS" | "USD",
  /**
   * I1 light: optional prefiltered pay-week txs for this month.
   * When provided, skips re-scanning the full ledger for weeks + category breakdown.
   */
  prefilteredMonthTransactions?: Transaction[],
): MonthSummary {
  const monthTx =
    prefilteredMonthTransactions ??
    filterByMonthPayWeeks(
      transactions,
      monthKey,
      referenceToday,
      paydayWeekday,
      currency,
    );

  const weeks = getMonthWorkWeeks(
    monthKey,
    referenceToday,
    paydayWeekday,
  ).map((week) => {
    const weekTx = prefilteredMonthTransactions
      ? monthTx.filter((item) => {
          const date = parseISO(item.date);
          return isWithinInterval(date, {
            start: week.start,
            end: week.end,
          });
        })
      : filterByPayWeek(
          transactions,
          week.start,
          week.end,
          currency,
          paydayWeekday,
        );
    const weekIncome = sumByType(weekTx, "ingreso", currency);
    const weekExpense = sumByType(weekTx, "gasto", currency);
    return {
      ...week,
      income: weekIncome,
      expense: weekExpense,
      hasData: weekTx.length > 0,
    };
  });

  // Month hero balance must match the pay weeks shown (not calendar-month clamp).
  const income = weeks.reduce((total, week) => total + week.income, 0);
  const expense = weeks.reduce((total, week) => total + week.expense, 0);
  const balance = income - expense;

  const prevKey = previousMonthKey(monthKey);
  const prevTx = filterByMonthPayWeeks(
    transactions,
    prevKey,
    referenceToday,
    paydayWeekday,
    currency,
  );
  const prevBalance =
    sumByType(prevTx, "ingreso", currency) - sumByType(prevTx, "gasto", currency);

  const expenseByCategory = new Map<string, number>();
  for (const item of monthTx) {
    if (isTransferLeg(item)) continue;
    if (item.type !== "gasto" || !item.categoryId) continue;
    expenseByCategory.set(
      item.categoryId,
      (expenseByCategory.get(item.categoryId) ?? 0) + item.amount,
    );
  }

  const byCategory = [...expenseByCategory.entries()]
    .map(([categoryId, amount]) => ({
      category: categories.find((category) => category.id === categoryId)!,
      amount,
    }))
    .filter((row) => row.category)
    .sort((a, b) => b.amount - a.amount);

  return {
    monthKey,
    income,
    expense,
    balance,
    comparison: formatPercentDelta(
      balance,
      prevBalance,
      formatMonthName(prevKey),
    ),
    byCategory,
    weeks,
  };
}

export interface HormigaDrainAlert {
  category: Category;
  totalAmount: number;
  occurrenceCount: number;
  /** Threshold used when the alert was computed (e.g. 100_000). */
  minTotal: number;
}

const HORMIGA_MIN_OCCURRENCES = 3;
const HORMIGA_MIN_TOTAL = 100_000;

/**
 * Hormiga category that repeats often and drains >100k within the pay-week month.
 */
export function getHormigaDrainAlert(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  paydayWeekday: Weekday = "viernes",
  opts?: {
    minOccurrences?: number;
    minTotal?: number;
    currency?: "ARS" | "USD";
    referenceToday?: Date;
    /** I1 light: optional prefiltered month pay-week txs. */
    prefilteredMonthTransactions?: Transaction[];
  },
): HormigaDrainAlert | null {
  const minOccurrences = opts?.minOccurrences ?? HORMIGA_MIN_OCCURRENCES;
  const minTotal = opts?.minTotal ?? HORMIGA_MIN_TOTAL;
  const activeCategories = categories.filter(isActive);
  const categoryById = new Map(
    activeCategories.map((category) => [category.id, category]),
  );

  const byCategory = new Map<string, { totalAmount: number; occurrenceCount: number }>();

  const monthTx =
    opts?.prefilteredMonthTransactions ??
    filterByMonthPayWeeks(
      transactions,
      monthKey,
      opts?.referenceToday ?? getAppToday(),
      paydayWeekday,
      opts?.currency,
    );

  for (const item of monthTx) {
    if (item.type !== "gasto" || !item.categoryId) continue;
    const category = categoryById.get(item.categoryId);
    if (!category || category.kind !== "hormiga") continue;
    const bucket = byCategory.get(item.categoryId) ?? {
      totalAmount: 0,
      occurrenceCount: 0,
    };
    bucket.totalAmount += item.amount;
    bucket.occurrenceCount += 1;
    byCategory.set(item.categoryId, bucket);
  }

  let best: HormigaDrainAlert | null = null;
  for (const [categoryId, stats] of byCategory) {
    if (stats.occurrenceCount < minOccurrences) continue;
    if (stats.totalAmount <= minTotal) continue;
    const category = categoryById.get(categoryId);
    if (!category) continue;
    if (!best || stats.totalAmount > best.totalAmount) {
      best = {
        category,
        totalAmount: stats.totalAmount,
        occurrenceCount: stats.occurrenceCount,
        minTotal,
      };
    }
  }

  return best;
}

export interface CategorySpendAlert {
  category: Category;
  currentAmount: number;
  previousAmount: number;
  /** How many percent above previous month (e.g. 25 = 25% above). */
  percentIncrease: number;
}

/**
 * Expense totals by category for a month's pay weeks.
 */
export function sumExpenseByCategory(
  transactions: Transaction[],
  monthKey: string,
  paydayWeekday: Weekday = "viernes",
  currency?: "ARS" | "USD",
  referenceToday: Date = getAppToday(),
  /** I1 light: optional prefiltered month pay-week txs. */
  prefilteredMonthTransactions?: Transaction[],
): Map<string, number> {
  const totals = new Map<string, number>();
  const monthTx =
    prefilteredMonthTransactions ??
    filterByMonthPayWeeks(
      transactions,
      monthKey,
      referenceToday,
      paydayWeekday,
      currency,
    );
  for (const item of monthTx) {
    if (item.type !== "gasto" || !item.categoryId) continue;
    totals.set(
      item.categoryId,
      (totals.get(item.categoryId) ?? 0) + item.amount,
    );
  }
  return totals;
}

/**
 * Categories where current-month spend is ≥ threshold above previous month.
 * Default threshold: 0.2 (20%). Skips categories with previousAmount === 0.
 */
export function findCategorySpendAlerts(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  paydayWeekday: Weekday = "viernes",
  threshold = 0.2,
  currency?: "ARS" | "USD",
  prefilteredMonthTransactions?: Transaction[],
): CategorySpendAlert[] {
  const currentByCategory = sumExpenseByCategory(
    transactions,
    monthKey,
    paydayWeekday,
    currency,
    getAppToday(),
    prefilteredMonthTransactions,
  );
  const previousByCategory = sumExpenseByCategory(
    transactions,
    previousMonthKey(monthKey),
    paydayWeekday,
    currency,
  );
  const categoryById = new Map(
    categories.filter(isActive).map((category) => [category.id, category]),
  );

  const alerts: CategorySpendAlert[] = [];
  for (const [categoryId, currentAmount] of currentByCategory) {
    const previousAmount = previousByCategory.get(categoryId) ?? 0;
    if (previousAmount <= 0) continue;
    const ratioIncrease =
      (currentAmount - previousAmount) / previousAmount;
    if (ratioIncrease < threshold) continue;
    const category = categoryById.get(categoryId);
    if (!category) continue;
    alerts.push({
      category,
      currentAmount,
      previousAmount,
      percentIncrease: Math.round(ratioIncrease * 100),
    });
  }

  return alerts.sort((a, b) => b.percentIncrease - a.percentIncrease);
}

export type BudgetAlertLevel = "warning" | "exceeded";

export interface BudgetAlert {
  budget: Budget;
  category: Category;
  spent: number;
  amountLimit: number;
  /** spent / amountLimit, e.g. 0.85 = 85% */
  ratio: number;
  percentUsed: number;
  level: BudgetAlertLevel;
}

/**
 * How budget spend is measured for the month.
 * Additive for Fase M: pass `"calendarMonth"` when payCadence is monthly
 * without reading UserProfile here.
 */
export type BudgetPeriodMode = "payWeeks" | "calendarMonth";

export type BudgetProgressLevel = "ok" | BudgetAlertLevel;

export interface BudgetWeekSpend {
  index: number;
  label: string;
  weekIso: string;
  spent: number;
}

export interface BudgetProgressRow {
  budget: Budget;
  category: Category;
  spent: number;
  amountLimit: number;
  ratio: number;
  percentUsed: number;
  level: BudgetProgressLevel;
  periodMode: BudgetPeriodMode;
  /** Per pay-week spend; empty when `periodMode === "calendarMonth"`. */
  weeks: BudgetWeekSpend[];
}

function resolveBudgetMonthTransactions(
  transactions: Transaction[],
  monthKey: string,
  paydayWeekday: Weekday,
  currency: "ARS" | "USD" | undefined,
  periodMode: BudgetPeriodMode,
  referenceToday: Date,
  prefilteredMonthTransactions?: Transaction[],
): Transaction[] {
  if (prefilteredMonthTransactions) return prefilteredMonthTransactions;
  if (periodMode === "calendarMonth") {
    return filterByMonth(transactions, monthKey, currency, paydayWeekday);
  }
  return filterByMonthPayWeeks(
    transactions,
    monthKey,
    referenceToday,
    paydayWeekday,
    currency,
  );
}

function sumCategorySpendInRange(
  transactions: Transaction[],
  categoryId: string,
  weekStart: Date,
  weekEnd: Date,
): number {
  let total = 0;
  for (const item of transactions) {
    if (!isActive(item)) continue;
    if (isTransferLeg(item)) continue;
    if (item.type !== "gasto" || item.categoryId !== categoryId) continue;
    const date = parseISO(item.date);
    if (!isWithinInterval(date, { start: weekStart, end: weekEnd })) continue;
    total += item.amount;
  }
  return total;
}

/**
 * Progress bars for active month budgets, with optional pay-week breakdown.
 * Default `periodMode` is `"payWeeks"` (current product model). Pass
 * `"calendarMonth"` when Fase M enables monthly cadence — no UserProfile coupling.
 */
export function buildBudgetProgress(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  monthKey: string,
  paydayWeekday: Weekday = "viernes",
  currency?: "ARS" | "USD",
  options?: {
    periodMode?: BudgetPeriodMode;
    referenceToday?: Date;
    prefilteredMonthTransactions?: Transaction[];
    /** Reuse `buildMonthSummary.weeks` when available (payWeeks mode). */
    weeks?: Array<
      Pick<MonthWeekSlice, "index" | "label" | "weekIso" | "start" | "end">
    >;
    /** Default true for payWeeks; alerts can skip week slices. */
    includeWeekBreakdown?: boolean;
  },
): BudgetProgressRow[] {
  const periodMode = options?.periodMode ?? "payWeeks";
  const referenceToday = options?.referenceToday ?? getAppToday();
  const shouldIncludeWeekBreakdown =
    options?.includeWeekBreakdown ?? periodMode === "payWeeks";
  const monthBudgets = budgets.filter(
    (budget) => isActive(budget) && budget.month === monthKey,
  );
  if (monthBudgets.length === 0) return [];

  const monthTx = resolveBudgetMonthTransactions(
    transactions,
    monthKey,
    paydayWeekday,
    currency,
    periodMode,
    referenceToday,
    options?.prefilteredMonthTransactions,
  );

  const spentByCategory = new Map<string, number>();
  for (const item of monthTx) {
    if (isTransferLeg(item)) continue;
    if (item.type !== "gasto" || !item.categoryId) continue;
    spentByCategory.set(
      item.categoryId,
      (spentByCategory.get(item.categoryId) ?? 0) + item.amount,
    );
  }

  const weekSlices =
    periodMode === "payWeeks" && shouldIncludeWeekBreakdown
      ? (options?.weeks ??
        getMonthWorkWeeks(monthKey, referenceToday, paydayWeekday))
      : [];
  const categoryById = new Map(
    categories.filter(isActive).map((category) => [category.id, category]),
  );

  const rows: BudgetProgressRow[] = [];
  for (const budget of monthBudgets) {
    if (budget.amountLimit <= 0) continue;
    const category = categoryById.get(budget.categoryId);
    if (!category) continue;
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
    const ratio = spent / budget.amountLimit;
    const weeks: BudgetWeekSpend[] = weekSlices.map((week) => ({
      index: week.index,
      label: week.label,
      weekIso: week.weekIso,
      spent: sumCategorySpendInRange(
        monthTx,
        budget.categoryId,
        week.start,
        week.end,
      ),
    }));

    rows.push({
      budget,
      category,
      spent,
      amountLimit: budget.amountLimit,
      ratio,
      percentUsed: Math.round(ratio * 100),
      level: ratio >= 1 ? "exceeded" : ratio >= 0.8 ? "warning" : "ok",
      periodMode,
      weeks,
    });
  }

  return rows.sort((a, b) => b.ratio - a.ratio);
}

/**
 * Budgets for the month where spend is ≥ 80% (warning) or ≥ 100% (exceeded).
 */
export function findBudgetAlerts(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  monthKey: string,
  paydayWeekday: Weekday = "viernes",
  currency?: "ARS" | "USD",
  prefilteredMonthTransactions?: Transaction[],
  /** Optional; defaults to pay-weeks. Ready for Fase M calendar mode. */
  periodMode: BudgetPeriodMode = "payWeeks",
): BudgetAlert[] {
  const progress = buildBudgetProgress(
    transactions,
    categories,
    budgets,
    monthKey,
    paydayWeekday,
    currency,
    {
      periodMode,
      prefilteredMonthTransactions,
      includeWeekBreakdown: false,
    },
  );

  return progress
    .filter((row) => row.level !== "ok")
    .map((row) => ({
      budget: row.budget,
      category: row.category,
      spent: row.spent,
      amountLimit: row.amountLimit,
      ratio: row.ratio,
      percentUsed: row.percentUsed,
      level: row.level,
    }));
}
