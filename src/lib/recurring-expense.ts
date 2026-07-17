import {
  differenceInCalendarDays,
  getDay,
  parseISO,
  subMonths,
  subWeeks,
} from "date-fns";
import type { Category, Transaction } from "./types";

const DEFAULT_AMOUNT_TOLERANCE = 0.2;
const DEFAULT_RECENT_MONTHS = 4;
const DEFAULT_RECENT_WEEKS = 8;
const MIN_MONTHLY_MATCHES = 2;
const MIN_WEEKLY_MATCHES = 3;
const MIN_BIWEEKLY_MATCHES = 3;
const BIWEEKLY_GAP_MIN_DAYS = 11;
const BIWEEKLY_GAP_MAX_DAYS = 17;

const WEEKDAY_LABELS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

export type RecurringExpenseCadence = "monthly" | "weekly" | "biweekly";

export interface RecurringExpenseSuggestion {
  key: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  titlePattern: string;
  cadence: RecurringExpenseCadence;
  matchCount: number;
  weekday: number | null;
  weekdayLabel: string | null;
  referenceAmount: number;
  transactionIds: string[];
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

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/gi, "")
    .replace(/\s+\d{4}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWithinRecentMonths(
  dateIso: string,
  referenceDate: Date,
  recentMonths: number,
): boolean {
  const cutoff = subMonths(referenceDate, recentMonths);
  return parseISO(dateIso) >= cutoff;
}

function isWithinRecentWeeks(
  dateIso: string,
  referenceDate: Date,
  recentWeeks: number,
): boolean {
  const cutoff = subWeeks(referenceDate, recentWeeks);
  return parseISO(dateIso) >= cutoff;
}

function displayTitle(pattern: string, categoryName: string | null): string {
  if (pattern) {
    return pattern.charAt(0).toUpperCase() + pattern.slice(1);
  }
  return categoryName ?? "Gasto";
}

function medianGapDays(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort((a, b) => a.localeCompare(b));
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    gaps.push(
      differenceInCalendarDays(
        parseISO(sorted[index]),
        parseISO(sorted[index - 1]),
      ),
    );
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  if (gaps.length % 2 === 0) {
    return (gaps[mid - 1] + gaps[mid]) / 2;
  }
  return gaps[mid];
}

function isBiweeklySpacing(dates: string[]): boolean {
  if (dates.length < MIN_BIWEEKLY_MATCHES) return false;
  const median = medianGapDays(dates);
  return (
    median != null &&
    median >= BIWEEKLY_GAP_MIN_DAYS &&
    median <= BIWEEKLY_GAP_MAX_DAYS
  );
}

/**
 * Scan gastos for patterns that look monthly, biweekly (~14d), or weekly.
 * Skips already-fixed matches.
 */
export function findRecurringExpenseSuggestions(
  transactions: Transaction[],
  categories: Category[],
  options?: {
    amountTolerance?: number;
    recentMonths?: number;
    recentWeeks?: number;
    referenceDate?: Date;
  },
): RecurringExpenseSuggestion[] {
  const tolerance = options?.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const recentMonths = options?.recentMonths ?? DEFAULT_RECENT_MONTHS;
  const recentWeeks = options?.recentWeeks ?? DEFAULT_RECENT_WEEKS;
  const referenceDate = options?.referenceDate ?? new Date();
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const expenses = transactions
    .filter((item) => item.type === "gasto" && !item.isFixed)
    .sort((a, b) => b.date.localeCompare(a.date));

  const suggestions: RecurringExpenseSuggestion[] = [];
  const seenKeys = new Set<string>();

  // Monthly / biweekly: same category (or title pattern) across ≥2 distinct months.
  const byGroup = new Map<string, Transaction[]>();
  for (const item of expenses) {
    if (!isWithinRecentMonths(item.date, referenceDate, recentMonths)) continue;
    const titleKey = normalizeTitle(item.title);
    const groupKey = item.categoryId
      ? `cat:${item.categoryId}`
      : titleKey
        ? `title:${titleKey}`
        : null;
    if (!groupKey) continue;
    const bucket = byGroup.get(groupKey) ?? [];
    bucket.push(item);
    byGroup.set(groupKey, bucket);
  }

  for (const [groupKey, group] of byGroup) {
    const months = new Set(group.map((item) => item.month));
    if (months.size < MIN_MONTHLY_MATCHES) continue;

    let best: RecurringExpenseSuggestion | null = null;
    for (const reference of group) {
      const similar = group.filter((item) =>
        isAmountSimilar(item.amount, reference.amount, tolerance),
      );
      const similarMonths = new Set(similar.map((item) => item.month));
      if (similarMonths.size < MIN_MONTHLY_MATCHES) continue;

      const category = reference.categoryId
        ? (categoryById.get(reference.categoryId) ?? null)
        : null;
      const titlePattern = normalizeTitle(reference.title);
      const isBiweekly = isBiweeklySpacing(similar.map((item) => item.date));
      const cadence: RecurringExpenseCadence = isBiweekly
        ? "biweekly"
        : "monthly";
      const candidate: RecurringExpenseSuggestion = {
        key: `${cadence}:${groupKey}`,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? null,
        categoryIcon: category?.icon ?? null,
        titlePattern: displayTitle(titlePattern, category?.name ?? null),
        cadence,
        matchCount: similar.length,
        weekday: null,
        weekdayLabel: null,
        referenceAmount: reference.amount,
        transactionIds: similar.map((item) => item.id),
      };
      if (!best || candidate.matchCount > best.matchCount) {
        best = candidate;
      }
    }

    // Prefer kind=fijo categories even without tight amount similarity.
    if (!best) {
      const categoryId = groupKey.startsWith("cat:")
        ? groupKey.slice(4)
        : null;
      const category = categoryId ? categoryById.get(categoryId) : null;
      if (category?.kind === "fijo" && months.size >= MIN_MONTHLY_MATCHES) {
        const reference = group[0];
        const isBiweekly = isBiweeklySpacing(group.map((item) => item.date));
        const cadence: RecurringExpenseCadence = isBiweekly
          ? "biweekly"
          : "monthly";
        best = {
          key: `${cadence}:${groupKey}`,
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: category.icon,
          titlePattern: displayTitle(
            normalizeTitle(reference.title),
            category.name,
          ),
          cadence,
          matchCount: group.length,
          weekday: null,
          weekdayLabel: null,
          referenceAmount: reference.amount,
          transactionIds: group.map((item) => item.id),
        };
      }
    }

    if (best && !seenKeys.has(best.key) && !seenKeys.has(`monthly:${groupKey}`) && !seenKeys.has(`biweekly:${groupKey}`)) {
      seenKeys.add(best.key);
      seenKeys.add(`monthly:${groupKey}`);
      seenKeys.add(`biweekly:${groupKey}`);
      suggestions.push(best);
    }
  }

  // Weekly / biweekly-by-weekday: same title or category, same weekday.
  const weeklyGroups = new Map<string, Transaction[]>();
  for (const item of expenses) {
    if (!isWithinRecentWeeks(item.date, referenceDate, recentWeeks)) continue;
    const titleKey = normalizeTitle(item.title);
    const baseKey = item.categoryId
      ? `cat:${item.categoryId}`
      : titleKey
        ? `title:${titleKey}`
        : null;
    if (!baseKey) continue;
    const bucket = weeklyGroups.get(baseKey) ?? [];
    bucket.push(item);
    weeklyGroups.set(baseKey, bucket);
  }

  for (const [groupKey, group] of weeklyGroups) {
    if (seenKeys.has(`monthly:${groupKey}`) || seenKeys.has(`biweekly:${groupKey}`)) {
      continue;
    }

    let best: RecurringExpenseSuggestion | null = null;
    for (const reference of group) {
      const similar = group.filter((item) =>
        isAmountSimilar(item.amount, reference.amount, tolerance),
      );
      if (similar.length < MIN_WEEKLY_MATCHES) continue;

      const byWeekday = new Map<number, Transaction[]>();
      for (const item of similar) {
        const day = weekdayOf(item.date);
        const bucket = byWeekday.get(day) ?? [];
        bucket.push(item);
        byWeekday.set(day, bucket);
      }

      for (const [weekday, bucket] of byWeekday) {
        const isBiweekly = isBiweeklySpacing(bucket.map((item) => item.date));
        const minMatches = isBiweekly ? MIN_BIWEEKLY_MATCHES : MIN_WEEKLY_MATCHES;
        if (bucket.length < minMatches) continue;

        const category = reference.categoryId
          ? (categoryById.get(reference.categoryId) ?? null)
          : null;
        const titlePattern = normalizeTitle(reference.title);
        const cadence: RecurringExpenseCadence = isBiweekly
          ? "biweekly"
          : "weekly";
        const candidate: RecurringExpenseSuggestion = {
          key: `${cadence}:${groupKey}:${weekday}`,
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? null,
          categoryIcon: category?.icon ?? null,
          titlePattern: displayTitle(titlePattern, category?.name ?? null),
          cadence,
          matchCount: bucket.length,
          weekday,
          weekdayLabel: WEEKDAY_LABELS[weekday] ?? "día",
          referenceAmount: reference.amount,
          transactionIds: bucket.map((item) => item.id),
        };
        if (!best || candidate.matchCount > best.matchCount) {
          best = candidate;
        }
      }
    }

    if (best && !seenKeys.has(best.key)) {
      seenKeys.add(best.key);
      suggestions.push(best);
    }
  }

  return suggestions.sort((a, b) => b.matchCount - a.matchCount);
}
