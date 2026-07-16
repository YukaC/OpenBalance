import { getDay, parseISO, subMonths, subWeeks } from "date-fns";
import type { Category, Transaction } from "./types";

const DEFAULT_AMOUNT_TOLERANCE = 0.2;
const DEFAULT_RECENT_MONTHS = 4;
const DEFAULT_RECENT_WEEKS = 8;
const MIN_MONTHLY_MATCHES = 2;
const MIN_WEEKLY_MATCHES = 3;

const WEEKDAY_LABELS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

export type RecurringExpenseCadence = "monthly" | "weekly";

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

/**
 * Scan gastos for patterns that look monthly (same category/title across months)
 * or weekly (same weekday, similar amount). Skips already-fixed matches.
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

  // Monthly: same category (or title pattern) across ≥2 distinct months, similar amounts.
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
      const candidate: RecurringExpenseSuggestion = {
        key: `monthly:${groupKey}`,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? null,
        categoryIcon: category?.icon ?? null,
        titlePattern: displayTitle(titlePattern, category?.name ?? null),
        cadence: "monthly",
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
        best = {
          key: `monthly:${groupKey}`,
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: category.icon,
          titlePattern: displayTitle(
            normalizeTitle(reference.title),
            category.name,
          ),
          cadence: "monthly",
          matchCount: group.length,
          weekday: null,
          weekdayLabel: null,
          referenceAmount: reference.amount,
          transactionIds: group.map((item) => item.id),
        };
      }
    }

    if (best && !seenKeys.has(best.key)) {
      seenKeys.add(best.key);
      suggestions.push(best);
    }
  }

  // Weekly: same title or category, same weekday, ≥3 similar loads.
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
    if (seenKeys.has(`monthly:${groupKey}`)) continue;

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
        if (bucket.length < MIN_WEEKLY_MATCHES) continue;
        const category = reference.categoryId
          ? (categoryById.get(reference.categoryId) ?? null)
          : null;
        const titlePattern = normalizeTitle(reference.title);
        const candidate: RecurringExpenseSuggestion = {
          key: `weekly:${groupKey}:${weekday}`,
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? null,
          categoryIcon: category?.icon ?? null,
          titlePattern: displayTitle(titlePattern, category?.name ?? null),
          cadence: "weekly",
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
