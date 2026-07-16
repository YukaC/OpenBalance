import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDate,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import type { Weekday } from "./types";

const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export function toMonthKey(date: Date | string): string {
  const value = typeof date === "string" ? parseISO(date) : date;
  return format(value, "yyyy-MM");
}

export function toWeekIso(date: Date | string): string {
  const value = typeof date === "string" ? parseISO(date) : date;
  const year = getISOWeekYear(value);
  const week = String(getISOWeek(value)).padStart(2, "0");
  return `${year}-W${week}`;
}

export function parseMonthKey(monthKey: string): Date {
  return parseISO(`${monthKey}-01`);
}

export function shiftMonth(monthKey: string, delta: number): string {
  return toMonthKey(addMonths(parseMonthKey(monthKey), delta));
}

export function previousMonthKey(monthKey: string): string {
  return toMonthKey(subMonths(parseMonthKey(monthKey), 1));
}

/** date-fns es locale returns lowercase weekday/month; title-case for UI copy. */
function capitalizeDateParts(label: string): string {
  return label.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function formatMonthLabel(monthKey: string): string {
  const label = format(parseMonthKey(monthKey), "MMMM yyyy", { locale: es });
  return capitalizeDateParts(label);
}

export function formatMonthName(monthKey: string): string {
  return capitalizeDateParts(
    format(parseMonthKey(monthKey), "MMMM", { locale: es }),
  );
}

export function formatShortDate(date: string): string {
  return capitalizeDateParts(
    format(parseISO(date), "EEE d MMM", { locale: es }),
  );
}

export function formatDayMonth(date: Date): string {
  return capitalizeDateParts(format(date, "d MMM", { locale: es }));
}

export function formatWeekRangeLabel(start: Date, end: Date): string {
  const sameMonth = format(start, "MM") === format(end, "MM");
  if (sameMonth) {
    return capitalizeDateParts(
      `${format(start, "d", { locale: es })} — ${format(end, "d MMM", { locale: es })}`,
    );
  }
  return `${formatDayMonth(start)} — ${formatDayMonth(end)}`;
}

/**
 * Full 7-day pay week that ends on the user's payday.
 * Opens the day after the previous payday (domingo when payday is sábado)
 * and closes on payday.
 */
export function getPayWeekBounds(
  reference: Date,
  paydayWeekday: Weekday,
): { start: Date; end: Date } {
  const paydayNumber = WEEKDAY_TO_NUMBER[paydayWeekday];
  const day = reference.getDay();
  const daysSincePayday = (day - paydayNumber + 7) % 7;
  const daysUntilPayday = (paydayNumber - day + 7) % 7;
  const end =
    daysSincePayday === 0
      ? startOfDay(reference)
      : startOfDay(addDays(reference, daysUntilPayday));
  const start = startOfDay(addDays(end, -6));
  return { start, end };
}

export function formatCurrentWeekLabel(
  reference: Date,
  paydayWeekday: Weekday,
): string {
  const { start, end } = getPayWeekBounds(reference, paydayWeekday);
  return `Semana actual: ${capitalizeDateParts(
    `${format(start, "EEE d", { locale: es })} — ${format(end, "EEE d MMM", { locale: es })}`,
  )}`;
}

export interface MonthWeekSlice {
  index: number;
  start: Date;
  end: Date;
  weekIso: string;
  label: string;
  rangeLabel: string;
  isCurrent: boolean;
}

/**
 * Pay weeks (7 days ending on payday) whose payday falls in the month.
 * If payday lands in the next month, that week belongs there — not here.
 * Week bounds still span the full domingo→payday range (may start in the
 * previous calendar month), e.g. Dom 28 Jun — Sáb 4 Jul for July.
 */
export function getMonthWorkWeeks(
  monthKey: string,
  referenceToday: Date = new Date(),
  paydayWeekday: Weekday = "viernes",
): MonthWeekSlice[] {
  const monthStart = startOfMonth(parseMonthKey(monthKey));
  const monthEnd = endOfMonth(monthStart);
  const paydayNumber = WEEKDAY_TO_NUMBER[paydayWeekday];

  const daysUntilFirstPayday = (paydayNumber - monthStart.getDay() + 7) % 7;
  let paydayCursor = startOfDay(addDays(monthStart, daysUntilFirstPayday));

  const weeks: MonthWeekSlice[] = [];
  let index = 1;

  while (paydayCursor <= monthEnd) {
    const weekEnd = paydayCursor;
    const weekStart = addDays(weekEnd, -6);
    const isCurrent =
      referenceToday >= weekStart && referenceToday <= weekEnd;

    weeks.push({
      index,
      start: weekStart,
      end: weekEnd,
      weekIso: toWeekIso(weekStart),
      label: isCurrent ? `Semana ${index} · Hoy` : `Semana ${index}`,
      rangeLabel: formatWeekRangeLabel(weekStart, weekEnd),
      isCurrent,
    });
    index += 1;
    paydayCursor = addDays(paydayCursor, 7);
  }

  return weeks;
}

export function getAppToday(): Date {
  return new Date();
}

export function todayIso(): string {
  return format(getAppToday(), "yyyy-MM-dd");
}

/** Shift a calendar date by N months (keeps day-of-month when possible). */
export function shiftIsoDateByMonths(dateIso: string, months: number): string {
  return format(addMonths(parseISO(dateIso), months), "yyyy-MM-dd");
}

/**
 * Project a date onto another month, clamping the day to that month's length
 * (e.g. Jan 31 → Feb 28).
 */
export function projectIsoDateToMonth(dateIso: string, monthKey: string): string {
  const day = getDate(parseISO(dateIso));
  const monthStart = parseMonthKey(monthKey);
  const clampedDay = Math.min(day, getDate(endOfMonth(monthStart)));
  return format(
    new Date(monthStart.getFullYear(), monthStart.getMonth(), clampedDay),
    "yyyy-MM-dd",
  );
}

/**
 * Payday ISO date for pay-week `weekIndex` (1-based) in `monthKey`.
 * Falls back to the last payday when the month has fewer weeks.
 */
export function getPayWeekPaydayIso(
  monthKey: string,
  weekIndex: number,
  paydayWeekday: Weekday = "viernes",
  referenceToday: Date = new Date(),
): string | null {
  const weeks = getMonthWorkWeeks(monthKey, referenceToday, paydayWeekday);
  if (weeks.length === 0) return null;
  const clampedIndex = Math.max(1, Math.min(weekIndex, weeks.length));
  return format(weeks[clampedIndex - 1].end, "yyyy-MM-dd");
}

/**
 * Infer 1-based pay-week index from a date inside its month.
 * Prefers exact week match; otherwise day ≤ 15 → 1, else → 4 (or last).
 */
export function inferFixedPayWeekIndex(
  dateIso: string,
  paydayWeekday: Weekday = "viernes",
): number {
  const monthKey = toMonthKey(dateIso);
  const weeks = getMonthWorkWeeks(monthKey, parseISO(dateIso), paydayWeekday);
  if (weeks.length === 0) return 1;
  const date = startOfDay(parseISO(dateIso));
  const matchIndex = weeks.findIndex(
    (week) => date >= week.start && date <= week.end,
  );
  if (matchIndex >= 0) {
    // Prefer "cuarta" over a 5th spillover week for late-month dates.
    if (matchIndex + 1 >= 5 && weeks.length >= 4) return 4;
    return matchIndex + 1;
  }
  const day = getDate(date);
  if (day <= 15) return 1;
  return Math.min(4, weeks.length);
}
