import { getAppToday } from "./dates";
import { filterByMonth, filterByMonthPayWeeks } from "./summaries";
import type { PayCadence, Transaction, Weekday } from "./types";

export type MonthTransactionsOptions = {
  referenceToday?: Date;
  paydayWeekday?: Weekday;
  currency?: "ARS" | "USD";
  /** monthly → calendar month; weekly → pay weeks (legacy default for callers). */
  payCadence?: PayCadence;
};

/**
 * Pre-filter month transactions once (I1) so Resumen helpers reuse
 * the same slice instead of re-scanning the full ledger.
 * Bifurcates by payCadence (Fase M).
 */
export function getMonthTransactions(
  transactions: Transaction[],
  monthKey: string,
  options: MonthTransactionsOptions = {},
): Transaction[] {
  const paydayWeekday = options.paydayWeekday ?? "viernes";
  const referenceToday = options.referenceToday ?? getAppToday();
  const payCadence = options.payCadence ?? "weekly";

  if (payCadence === "monthly") {
    return filterByMonth(
      transactions,
      monthKey,
      options.currency,
      paydayWeekday,
    );
  }

  return filterByMonthPayWeeks(
    transactions,
    monthKey,
    referenceToday,
    paydayWeekday,
    options.currency,
  );
}
