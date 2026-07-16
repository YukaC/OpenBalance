import { isWithinInterval, parseISO } from "date-fns";
import type { Budget, Category, Transaction, Weekday } from "./types";
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

export function sumByType(
  transactions: Transaction[],
  type: Transaction["type"],
  currency?: "ARS" | "USD",
): number {
  const seenIds = new Set<string>();
  let total = 0;
  for (const item of transactions) {
    if (item.type !== type) continue;
    if (currency && item.currency !== currency) continue;
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    total += item.amount;
  }
  return total;
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

export function filterByWeek(
  transactions: Transaction[],
  weekStart: Date,
  weekEnd: Date,
): Transaction[] {
  return transactions.filter((item) => {
    const date = parseISO(item.date);
    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  });
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
): MonthSummary {
  const weeks = getMonthWorkWeeks(
    monthKey,
    referenceToday,
    paydayWeekday,
  ).map((week) => {
    const weekTx = filterByPayWeek(
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

  const monthTx = filterByMonthPayWeeks(
    transactions,
    monthKey,
    referenceToday,
    paydayWeekday,
    currency,
  );

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

export function averageWeeklyIncome(
  transactions: Transaction[],
  monthKey: string,
  currency?: "ARS" | "USD",
): number {
  const incomes = filterByMonth(transactions, monthKey, currency).filter(
    (item) => item.type === "ingreso",
  );
  if (incomes.length === 0) return 0;
  const weeks = new Set(incomes.map((item) => item.weekIso));
  return sumByType(incomes, "ingreso", currency) / Math.max(weeks.size, 1);
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
 * Hormiga category that repeats often and drains >100k within the month.
 */
export function getHormigaDrainAlert(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  opts?: {
    minOccurrences?: number;
    minTotal?: number;
    currency?: "ARS" | "USD";
  },
): HormigaDrainAlert | null {
  const minOccurrences = opts?.minOccurrences ?? HORMIGA_MIN_OCCURRENCES;
  const minTotal = opts?.minTotal ?? HORMIGA_MIN_TOTAL;
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const byCategory = new Map<string, { totalAmount: number; occurrenceCount: number }>();

  for (const item of filterByMonth(transactions, monthKey, opts?.currency)) {
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

function sumExpenseByCategory(
  transactions: Transaction[],
  monthKey: string,
  currency?: "ARS" | "USD",
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of filterByMonth(transactions, monthKey, currency)) {
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
  threshold = 0.2,
  currency?: "ARS" | "USD",
): CategorySpendAlert[] {
  const currentByCategory = sumExpenseByCategory(transactions, monthKey, currency);
  const previousByCategory = sumExpenseByCategory(
    transactions,
    previousMonthKey(monthKey),
    currency,
  );
  const categoryById = new Map(categories.map((category) => [category.id, category]));

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
 * Budgets for the month where spend is ≥ 80% (warning) or ≥ 100% (exceeded).
 */
export function findBudgetAlerts(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  monthKey: string,
  currency?: "ARS" | "USD",
): BudgetAlert[] {
  const monthBudgets = budgets.filter((budget) => budget.month === monthKey);
  if (monthBudgets.length === 0) return [];

  const spentByCategory = sumExpenseByCategory(transactions, monthKey, currency);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const alerts: BudgetAlert[] = [];
  for (const budget of monthBudgets) {
    if (budget.amountLimit <= 0) continue;
    const category = categoryById.get(budget.categoryId);
    if (!category) continue;
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
    const ratio = spent / budget.amountLimit;
    if (ratio < 0.8) continue;
    alerts.push({
      budget,
      category,
      spent,
      amountLimit: budget.amountLimit,
      ratio,
      percentUsed: Math.round(ratio * 100),
      level: ratio >= 1 ? "exceeded" : "warning",
    });
  }

  return alerts.sort((a, b) => b.ratio - a.ratio);
}
