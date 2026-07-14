import { isWithinInterval, parseISO } from "date-fns";
import type { Category, Transaction } from "./types";
import {
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

export function buildMonthSummary(
  transactions: Transaction[],
  categories: Category[],
  monthKey: string,
  referenceToday: Date = new Date("2026-07-16"),
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

  const weeks = getMonthWorkWeeks(monthKey, referenceToday).map((week) => {
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
    comparison: formatPercentDelta(balance, prevBalance),
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

export function detectRecurringIncomeHint(
  transactions: Transaction[],
  incomeSourceId: string | null,
  amount: number,
): boolean {
  if (!incomeSourceId) return false;
  const similar = transactions
    .filter(
      (item) =>
        item.type === "ingreso" &&
        item.incomeSourceId === incomeSourceId &&
        Math.abs(item.amount - amount) / Math.max(amount, 1) < 0.15,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  if (similar.length < 2) return false;

  const fridays = similar.filter((item) => {
    const day = parseISO(item.date).getDay();
    return day === 5;
  });
  return fridays.length >= 2;
}
