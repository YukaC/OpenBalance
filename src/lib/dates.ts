import {
  addDays,
  addMonths,
  endOfMonth,
  format,
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
 * 5-day work week that ends on the user's payday.
 * Mid-week → upcoming payday. Weekend after payday → week that just ended
 * (same horizon as getMonthWorkWeeks: weekStart + 6 days).
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
    daysSincePayday > 0 && daysSincePayday <= 2
      ? startOfDay(addDays(reference, -daysSincePayday))
      : startOfDay(addDays(reference, daysUntilPayday));
  const start = startOfDay(addDays(end, -4));
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
 * Work weeks (5 days ending on payday) that intersect the month.
 * Ranges and “current” week follow the selected payday weekday.
 */
export function getMonthWorkWeeks(
  monthKey: string,
  referenceToday: Date = new Date(),
  paydayWeekday: Weekday = "viernes",
): MonthWeekSlice[] {
  const monthStart = startOfMonth(parseMonthKey(monthKey));
  const monthEnd = endOfMonth(monthStart);
  const paydayNumber = WEEKDAY_TO_NUMBER[paydayWeekday];

  const scanStart = addDays(monthStart, -4);
  const daysUntilPayday = (paydayNumber - scanStart.getDay() + 7) % 7;
  let paydayCursor = startOfDay(addDays(scanStart, daysUntilPayday));

  const weeks: MonthWeekSlice[] = [];
  let index = 1;

  while (paydayCursor <= addDays(monthEnd, 4)) {
    const weekEnd = paydayCursor;
    const weekStart = addDays(weekEnd, -4);
    const intersects = weekEnd >= monthStart && weekStart <= monthEnd;

    if (intersects) {
      const clampedStart = weekStart < monthStart ? monthStart : weekStart;
      const clampedEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
      const weekHorizonEnd = addDays(weekStart, 6);
      const isCurrent =
        referenceToday >= weekStart && referenceToday <= weekHorizonEnd;

      weeks.push({
        index,
        start: weekStart,
        end: weekEnd,
        weekIso: toWeekIso(weekStart),
        label: isCurrent ? `Semana ${index} · Hoy` : `Semana ${index}`,
        rangeLabel: formatWeekRangeLabel(clampedStart, clampedEnd),
        isCurrent,
      });
      index += 1;
    }

    paydayCursor = addDays(paydayCursor, 7);
    if (weeks.length > 6) break;
  }

  return weeks;
}

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}
