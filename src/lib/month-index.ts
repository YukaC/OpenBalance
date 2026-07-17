import { getAppToday } from "./dates";
import { filterByMonthPayWeeks } from "./summaries";
import type { Transaction, Weekday } from "./types";

export type MonthTransactionsOptions = {
  referenceToday?: Date;
  paydayWeekday?: Weekday;
  currency?: "ARS" | "USD";
};

/**
 * Pre-filter month pay-week transactions once (I1) so Resumen helpers reuse
 * the same slice instead of re-scanning the full ledger.
 */
export function getMonthTransactions(
  transactions: Transaction[],
  monthKey: string,
  options: MonthTransactionsOptions = {},
): Transaction[] {
  return filterByMonthPayWeeks(
    transactions,
    monthKey,
    options.referenceToday ?? getAppToday(),
    options.paydayWeekday ?? "viernes",
    options.currency,
  );
}
