import { isWithinInterval, parseISO } from "date-fns";
import type { Budget, Category, Transaction, Weekday } from "./types";
import {
  formatMonthName,
  getMonthWorkWeeks,
  previousMonthKey,
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

export function sumByType(
  transactions: Transaction[],
  type: Transaction["type"],
): number {
  return transactions
    .filter((item) => item.type === type)
    .reduce((total, item) => total + item.amount, 0);
}

export function filterByMonth(
  transactions: Transaction[],
  monthKey: string,
): Transaction[] {
  return transactions.filter((item) => item.month === monthKey);
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

export function buildMonthSummary(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  referenceToday: Date = new Date("2026-07-16"),
  paydayWeekday: Weekday = "viernes",
): MonthSummary {
  const monthTx = filterByMonth(transactions, monthKey);
  const income = sumByType(monthTx, "ingreso");
  const expense = sumByType(monthTx, "gasto");
  const balance = income - expense;

  const prevKey = previousMonthKey(monthKey);
  const prevTx = filterByMonth(transactions, prevKey);
  const prevBalance = sumByType(prevTx, "ingreso") - sumByType(prevTx, "gasto");

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

  const weeks = getMonthWorkWeeks(
    monthKey,
    referenceToday,
    paydayWeekday,
  ).map((week) => {
    const weekTx = monthTx.filter((item) => {
      const date = parseISO(item.date);
      return isWithinInterval(date, {
        start: week.start,
        end: week.end,
      });
    });
    const weekIncome = sumByType(weekTx, "ingreso");
    const weekExpense = sumByType(weekTx, "gasto");
    return {
      ...week,
      income: weekIncome,
      expense: weekExpense,
      hasData: weekTx.length > 0,
    };
  });

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
): number {
  const incomes = filterByMonth(transactions, monthKey).filter(
    (item) => item.type === "ingreso",
  );
  if (incomes.length === 0) return 0;
  const weeks = new Set(incomes.map((item) => item.weekIso));
  return sumByType(incomes, "ingreso") / Math.max(weeks.size, 1);
}

export interface ExtraordinaryExpense {
  transaction: Transaction;
  category: Category | null;
  /** How many times larger than the median non-fixed expense this month. */
  timesMedian: number;
}

function medianAmount(amounts: number[]): number {
  if (amounts.length === 0) return 0;
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Largest non-fixed gasto that stands out vs typical month spend
 * (≥ 2× median, or ≥ 1.75× the second-largest).
 */
export function getExtraordinaryExpense(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
): ExtraordinaryExpense | null {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const candidates = filterByMonth(transactions, monthKey)
    .filter((item) => {
      if (item.type !== "gasto") return false;
      if (item.isFixed) return false;
      const category = item.categoryId
        ? categoryById.get(item.categoryId)
        : null;
      if (category?.kind === "fijo") return false;
      return true;
    })
    .slice()
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date));

  if (candidates.length < 2) return null;

  const top = candidates[0];
  const second = candidates[1];
  const median = medianAmount(candidates.map((item) => item.amount));
  if (median <= 0) return null;

  const timesMedian = top.amount / median;
  const isOutlier =
    timesMedian >= 2 || top.amount >= second.amount * 1.75;

  if (!isOutlier) return null;

  return {
    transaction: top,
    category: top.categoryId
      ? (categoryById.get(top.categoryId) ?? null)
      : null,
    timesMedian: Math.round(timesMedian * 10) / 10,
  };
}

export interface HormigaDrainAlert {
  category: Category;
  totalAmount: number;
  occurrenceCount: number;
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
  opts?: { minOccurrences?: number; minTotal?: number },
): HormigaDrainAlert | null {
  const minOccurrences = opts?.minOccurrences ?? HORMIGA_MIN_OCCURRENCES;
  const minTotal = opts?.minTotal ?? HORMIGA_MIN_TOTAL;
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const byCategory = new Map<string, { totalAmount: number; occurrenceCount: number }>();

  for (const item of filterByMonth(transactions, monthKey)) {
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

export interface CategoryGrowthInsight {
  category: Category;
  currentAmount: number;
  previousAmount: number;
  absoluteGrowth: number;
  /** null when previous month spend was 0 (new category spend). */
  percentGrowth: number | null;
}

function sumExpenseByCategory(
  transactions: Transaction[],
  monthKey: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of filterByMonth(transactions, monthKey)) {
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
): CategorySpendAlert[] {
  const currentByCategory = sumExpenseByCategory(transactions, monthKey);
  const previousByCategory = sumExpenseByCategory(
    transactions,
    previousMonthKey(monthKey),
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

/**
 * Categories ranked by spend growth vs previous month.
 * Sorts by percentGrowth (desc) when previousAmount > 0; otherwise by absoluteGrowth.
 * Excludes non-positive growth. Default limit: 3.
 */
export function rankCategoryGrowth(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  limit = 3,
): CategoryGrowthInsight[] {
  const currentByCategory = sumExpenseByCategory(transactions, monthKey);
  const previousByCategory = sumExpenseByCategory(
    transactions,
    previousMonthKey(monthKey),
  );
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const candidates: CategoryGrowthInsight[] = [];
  const allCategoryIds = new Set([
    ...currentByCategory.keys(),
    ...previousByCategory.keys(),
  ]);

  for (const categoryId of allCategoryIds) {
    const currentAmount = currentByCategory.get(categoryId) ?? 0;
    const previousAmount = previousByCategory.get(categoryId) ?? 0;
    const absoluteGrowth = currentAmount - previousAmount;
    if (absoluteGrowth <= 0) continue;
    const category = categoryById.get(categoryId);
    if (!category) continue;
    candidates.push({
      category,
      currentAmount,
      previousAmount,
      absoluteGrowth,
      percentGrowth:
        previousAmount > 0
          ? Math.round((absoluteGrowth / previousAmount) * 100)
          : null,
    });
  }

  return candidates
    .sort((left, right) => {
      const leftHasPercent = left.percentGrowth !== null;
      const rightHasPercent = right.percentGrowth !== null;

      if (leftHasPercent && rightHasPercent) {
        if (left.percentGrowth !== right.percentGrowth) {
          return (right.percentGrowth ?? 0) - (left.percentGrowth ?? 0);
        }
        return right.absoluteGrowth - left.absoluteGrowth;
      }
      if (leftHasPercent !== rightHasPercent) {
        return leftHasPercent ? -1 : 1;
      }
      return right.absoluteGrowth - left.absoluteGrowth;
    })
    .slice(0, limit);
}

/**
 * Category with the largest growth vs previous month.
 * Prefers highest % among categories with previous spend > 0;
 * otherwise falls back to largest absolute increase.
 */
export function getFastestGrowingCategory(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
): CategoryGrowthInsight | null {
  const ranks = rankCategoryGrowth(transactions, categories, monthKey, 1);
  return ranks[0] ?? null;
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
): BudgetAlert[] {
  const monthBudgets = budgets.filter((budget) => budget.month === monthKey);
  if (monthBudgets.length === 0) return [];

  const spentByCategory = sumExpenseByCategory(transactions, monthKey);
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
