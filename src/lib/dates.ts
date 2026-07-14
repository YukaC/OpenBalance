import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  startOfMonth,
  startOfWeek,
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

export function formatMonthLabel(monthKey: string): string {
  const label = format(parseMonthKey(monthKey), "MMMM yyyy", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortDate(date: string): string {
  return format(parseISO(date), "EEE d MMM", { locale: es });
}

export function formatDayMonth(date: Date): string {
  return format(date, "d MMM", { locale: es });
}

export function getPayWeekBounds(
  reference: Date,
  paydayWeekday: Weekday,
): { start: Date; end: Date } {
  const weekStartsOn = WEEKDAY_TO_NUMBER[paydayWeekday] === 5 ? 1 : 1;
  const start = startOfWeek(reference, { weekStartsOn: weekStartsOn as 0 | 1 });
  const end = addDays(start, 4);
  return { start, end };
}

export function formatCurrentWeekLabel(
  reference: Date,
  paydayWeekday: Weekday,
): string {
  const { start, end } = getPayWeekBounds(reference, paydayWeekday);
  return `Semana actual: ${format(start, "EEE d", { locale: es })} — ${format(end, "EEE d MMM", { locale: es })}`;
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

/** Work weeks Mon–Fri that intersect the month (matches mockup payday Fridays). */
export function getMonthWorkWeeks(
  monthKey: string,
  referenceToday: Date = new Date(),
): MonthWeekSlice[] {
  const monthStart = startOfMonth(parseMonthKey(monthKey));
  const monthEnd = endOfMonth(monthStart);
  let cursor = startOfWeek(monthStart, { weekStartsOn: 1 });

  const weeks: MonthWeekSlice[] = [];
  let index = 1;

  while (cursor <= monthEnd || weeks.length === 0) {
    const weekStart = cursor;
    const weekEnd = addDays(weekStart, 4);
    const intersects =
      weekEnd >= monthStart && weekStart <= monthEnd;

    if (intersects) {
      const clampedStart = weekStart < monthStart ? monthStart : weekStart;
      const clampedEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
      const isCurrent =
        referenceToday >= weekStart && referenceToday <= addDays(weekStart, 6);

      weeks.push({
        index,
        start: weekStart,
        end: weekEnd,
        weekIso: toWeekIso(weekStart),
        label: isCurrent ? `Semana ${index} · Hoy` : `Semana ${index}`,
        rangeLabel: `${formatDayMonth(clampedStart)} — ${formatDayMonth(clampedEnd)}`.replace(
          /\./g,
          "",
        ),
        isCurrent,
      });
      index += 1;
    }

    cursor = addDays(cursor, 7);
    if (weeks.length > 6) break;
  }

  return weeks;
}

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}
