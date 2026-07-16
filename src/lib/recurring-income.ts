import { getDay, parseISO, subWeeks } from "date-fns";
import type { IncomeSource, Transaction } from "./types";

const DEFAULT_AMOUNT_TOLERANCE = 0.15;
const DEFAULT_RECENT_WEEKS = 8;
const MIN_MATCHES_EXISTING = 3;
/** Form hint: 2 past + the one being typed ≈ 3 cargas. */
const MIN_MATCHES_WITH_DRAFT = 2;

const WEEKDAY_LABELS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

export interface RecurringIncomeSuggestion {
  incomeSourceId: string;
  incomeSourceName: string;
  matchCount: number;
  weekday: number;
  weekdayLabel: string;
  referenceAmount: number;
}

function isAmountSimilar(
  left: number,
  right: number,
  tolerance = DEFAULT_AMOUNT_TOLERANCE,
): boolean {
  const baseline = Math.max(left, right, 1);
  return Math.abs(left - right) / baseline < tolerance;
}

function weekdayOf(dateIso: string): number {
  return getDay(parseISO(dateIso));
}

function isWithinRecentWeeks(
  dateIso: string,
  referenceDate: Date,
  recentWeeks: number,
): boolean {
  const cutoff = subWeeks(referenceDate, recentWeeks);
  return parseISO(dateIso) >= cutoff;
}

function buildSuggestion(
  source: IncomeSource,
  matches: Transaction[],
  weekday: number,
  referenceAmount: number,
): RecurringIncomeSuggestion {
  return {
    incomeSourceId: source.id,
    incomeSourceName: source.name,
    matchCount: matches.length,
    weekday,
    weekdayLabel: WEEKDAY_LABELS[weekday] ?? "día",
    referenceAmount,
  };
}

/**
 * Suggest marking a source as recurring while the user types an ingreso.
 * Counts existing similar loads (same source, ±tolerance, same weekday).
 */
export function detectRecurringIncomeHint(
  transactions: Transaction[],
  incomeSources: IncomeSource[],
  incomeSourceId: string | null,
  amount: number,
  dateIso: string,
  options?: {
    amountTolerance?: number;
    recentWeeks?: number;
    referenceDate?: Date;
  },
): RecurringIncomeSuggestion | null {
  if (!incomeSourceId || !Number.isFinite(amount) || amount <= 0) return null;

  const source = incomeSources.find((item) => item.id === incomeSourceId);
  if (!source || source.isRecurring) return null;

  const tolerance = options?.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const recentWeeks = options?.recentWeeks ?? DEFAULT_RECENT_WEEKS;
  const referenceDate = options?.referenceDate ?? new Date();
  const targetWeekday = weekdayOf(dateIso);

  const matches = transactions
    .filter(
      (item) =>
        item.type === "ingreso" &&
        item.incomeSourceId === incomeSourceId &&
        isAmountSimilar(item.amount, amount, tolerance) &&
        weekdayOf(item.date) === targetWeekday &&
        isWithinRecentWeeks(item.date, referenceDate, recentWeeks),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  if (matches.length < MIN_MATCHES_WITH_DRAFT) return null;

  return buildSuggestion(source, matches, targetWeekday, amount);
}

/**
 * Scan existing ingresos for non-recurring sources with ~3 similar loads.
 */
export function findRecurringIncomeSuggestions(
  transactions: Transaction[],
  incomeSources: IncomeSource[],
  options?: {
    amountTolerance?: number;
    recentWeeks?: number;
    referenceDate?: Date;
  },
): RecurringIncomeSuggestion[] {
  const tolerance = options?.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const recentWeeks = options?.recentWeeks ?? DEFAULT_RECENT_WEEKS;
  const referenceDate = options?.referenceDate ?? new Date();
  const suggestions: RecurringIncomeSuggestion[] = [];

  for (const source of incomeSources) {
    if (source.isRecurring) continue;

    const incomes = transactions
      .filter(
        (item) =>
          item.type === "ingreso" &&
          item.incomeSourceId === source.id &&
          isWithinRecentWeeks(item.date, referenceDate, recentWeeks),
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    if (incomes.length < MIN_MATCHES_EXISTING) continue;

    let best: RecurringIncomeSuggestion | null = null;

    for (const reference of incomes) {
      const similar = incomes.filter((item) =>
        isAmountSimilar(item.amount, reference.amount, tolerance),
      );
      if (similar.length < MIN_MATCHES_EXISTING) continue;

      const byWeekday = new Map<number, Transaction[]>();
      for (const item of similar) {
        const day = weekdayOf(item.date);
        const bucket = byWeekday.get(day) ?? [];
        bucket.push(item);
        byWeekday.set(day, bucket);
      }

      for (const [weekday, bucket] of byWeekday) {
        if (bucket.length < MIN_MATCHES_EXISTING) continue;
        const candidate = buildSuggestion(
          source,
          bucket,
          weekday,
          reference.amount,
        );
        if (!best || candidate.matchCount > best.matchCount) {
          best = candidate;
        }
      }
    }

    if (best) suggestions.push(best);
  }

  return suggestions;
}
