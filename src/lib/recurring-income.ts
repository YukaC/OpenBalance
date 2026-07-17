import { getDate, getDay, parseISO, subMonths, subWeeks } from "date-fns";
import { projectIsoDateToMonth, toWeekIso } from "./dates";
import { isActive } from "./entity-lifecycle";
import type { IncomeSource, Transaction } from "./types";

const DEFAULT_AMOUNT_TOLERANCE = 0.15;
const DEFAULT_RECENT_WEEKS = 8;
const DEFAULT_RECENT_MONTHS = 4;
const MIN_MATCHES_EXISTING = 3;
/** Form hint: 2 past + the one being typed ≈ 3 loads. */
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

export type RecurringIncomeMatchKind = "weekday" | "dayOfMonth";

export interface RecurringIncomeSuggestion {
  incomeSourceId: string;
  incomeSourceName: string;
  matchCount: number;
  matchKind: RecurringIncomeMatchKind;
  weekday: number | null;
  weekdayLabel: string;
  dayOfMonth: number | null;
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

function dayOfMonthOf(dateIso: string): number {
  return getDate(parseISO(dateIso));
}

function isWithinRecentWeeks(
  dateIso: string,
  referenceDate: Date,
  recentWeeks: number,
): boolean {
  const cutoff = subWeeks(referenceDate, recentWeeks);
  return parseISO(dateIso) >= cutoff;
}

function isWithinRecentMonths(
  dateIso: string,
  referenceDate: Date,
  recentMonths: number,
): boolean {
  const cutoff = subMonths(referenceDate, recentMonths);
  return parseISO(dateIso) >= cutoff;
}

function shouldMatchByDayOfMonth(source: IncomeSource): boolean {
  return source.type === "mensual";
}

function buildWeekdaySuggestion(
  source: IncomeSource,
  matches: Transaction[],
  weekday: number,
  referenceAmount: number,
): RecurringIncomeSuggestion {
  return {
    incomeSourceId: source.id,
    incomeSourceName: source.name,
    matchCount: matches.length,
    matchKind: "weekday",
    weekday,
    weekdayLabel: WEEKDAY_LABELS[weekday] ?? "día",
    dayOfMonth: null,
    referenceAmount,
  };
}

function buildDayOfMonthSuggestion(
  source: IncomeSource,
  matches: Transaction[],
  dayOfMonth: number,
  referenceAmount: number,
): RecurringIncomeSuggestion {
  return {
    incomeSourceId: source.id,
    incomeSourceName: source.name,
    matchCount: matches.length,
    matchKind: "dayOfMonth",
    weekday: null,
    weekdayLabel: `día ${dayOfMonth}`,
    dayOfMonth,
    referenceAmount,
  };
}

/**
 * Suggest marking a source as recurring while the user types an ingreso.
 * Monthly sources match by day-of-month; others by weekday.
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
    recentMonths?: number;
    referenceDate?: Date;
  },
): RecurringIncomeSuggestion | null {
  if (!incomeSourceId || !Number.isFinite(amount) || amount <= 0) return null;

  const source = incomeSources.find((item) => item.id === incomeSourceId);
  if (!source || !isActive(source) || source.isRecurring) return null;

  const tolerance = options?.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const recentWeeks = options?.recentWeeks ?? DEFAULT_RECENT_WEEKS;
  const recentMonths = options?.recentMonths ?? DEFAULT_RECENT_MONTHS;
  const referenceDate = options?.referenceDate ?? new Date();

  if (shouldMatchByDayOfMonth(source)) {
    const targetDay = dayOfMonthOf(dateIso);
    const matches = transactions
      .filter(
        (item) =>
          isActive(item) &&
          item.type === "ingreso" &&
          item.incomeSourceId === incomeSourceId &&
          isAmountSimilar(item.amount, amount, tolerance) &&
          dayOfMonthOf(item.date) === targetDay &&
          isWithinRecentMonths(item.date, referenceDate, recentMonths),
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    if (matches.length < MIN_MATCHES_WITH_DRAFT) return null;
    return buildDayOfMonthSuggestion(source, matches, targetDay, amount);
  }

  const targetWeekday = weekdayOf(dateIso);
  const matches = transactions
    .filter(
      (item) =>
        isActive(item) &&
        item.type === "ingreso" &&
        item.incomeSourceId === incomeSourceId &&
        isAmountSimilar(item.amount, amount, tolerance) &&
        weekdayOf(item.date) === targetWeekday &&
        isWithinRecentWeeks(item.date, referenceDate, recentWeeks),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  if (matches.length < MIN_MATCHES_WITH_DRAFT) return null;
  return buildWeekdaySuggestion(source, matches, targetWeekday, amount);
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
    recentMonths?: number;
    referenceDate?: Date;
  },
): RecurringIncomeSuggestion[] {
  const tolerance = options?.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const recentWeeks = options?.recentWeeks ?? DEFAULT_RECENT_WEEKS;
  const recentMonths = options?.recentMonths ?? DEFAULT_RECENT_MONTHS;
  const referenceDate = options?.referenceDate ?? new Date();
  const suggestions: RecurringIncomeSuggestion[] = [];

  for (const source of incomeSources) {
    if (!isActive(source) || source.isRecurring) continue;

    const useDayOfMonth = shouldMatchByDayOfMonth(source);
    const incomes = transactions
      .filter(
        (item) =>
          isActive(item) &&
          item.type === "ingreso" &&
          item.incomeSourceId === source.id &&
          (useDayOfMonth
            ? isWithinRecentMonths(item.date, referenceDate, recentMonths)
            : isWithinRecentWeeks(item.date, referenceDate, recentWeeks)),
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    if (incomes.length < MIN_MATCHES_EXISTING) continue;

    let best: RecurringIncomeSuggestion | null = null;

    for (const reference of incomes) {
      const similar = incomes.filter((item) =>
        isAmountSimilar(item.amount, reference.amount, tolerance),
      );
      if (similar.length < MIN_MATCHES_EXISTING) continue;

      if (useDayOfMonth) {
        const byDay = new Map<number, Transaction[]>();
        for (const item of similar) {
          const day = dayOfMonthOf(item.date);
          const bucket = byDay.get(day) ?? [];
          bucket.push(item);
          byDay.set(day, bucket);
        }

        for (const [dayOfMonth, bucket] of byDay) {
          if (bucket.length < MIN_MATCHES_EXISTING) continue;
          const candidate = buildDayOfMonthSuggestion(
            source,
            bucket,
            dayOfMonth,
            reference.amount,
          );
          if (!best || candidate.matchCount > best.matchCount) {
            best = candidate;
          }
        }
      } else {
        const byWeekday = new Map<number, Transaction[]>();
        for (const item of similar) {
          const day = weekdayOf(item.date);
          const bucket = byWeekday.get(day) ?? [];
          bucket.push(item);
          byWeekday.set(day, bucket);
        }

        for (const [weekday, bucket] of byWeekday) {
          if (bucket.length < MIN_MATCHES_EXISTING) continue;
          const candidate = buildWeekdaySuggestion(
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
    }

    if (best) suggestions.push(best);
  }

  return suggestions;
}

/**
 * Virtual ingresos for recurring sources that have no real load in `monthKey`
 * yet. Dated by projecting the last template's day-of-month (clamped).
 * Does not touch pay-week fixed-expense logic in summaries.
 */
export function projectRecurringIncomeToMonth(
  transactions: Transaction[],
  incomeSources: IncomeSource[],
  monthKey: string,
  currency?: "ARS" | "USD",
): Transaction[] {
  const projected: Transaction[] = [];

  for (const source of incomeSources) {
    if (!isActive(source) || !source.isRecurring) continue;

    const sourceIncomes = transactions.filter(
      (item) =>
        isActive(item) &&
        item.type === "ingreso" &&
        item.incomeSourceId === source.id &&
        (!currency || item.currency === currency),
    );

    if (sourceIncomes.some((item) => item.month === monthKey)) continue;

    const templates = sourceIncomes
      .filter((item) => item.month < monthKey)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (templates.length === 0) continue;

    const template = templates[0];
    const projectedDate = projectIsoDateToMonth(template.date, monthKey);

    projected.push({
      ...template,
      id: `projected-income:${source.id}:${monthKey}`,
      date: projectedDate,
      month: monthKey,
      weekIso: toWeekIso(projectedDate),
      origin: "recurrente",
      title: template.title || source.name,
    });
  }

  return projected;
}
