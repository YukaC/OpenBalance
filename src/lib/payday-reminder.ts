import { getDay, parseISO } from "date-fns";
import { getPayWeekBounds, toWeekIso } from "./dates";
import type { Transaction, Weekday } from "./types";

const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export function isPaydayDate(
  referenceDate: Date,
  paydayWeekday: Weekday,
): boolean {
  return getDay(referenceDate) === WEEKDAY_TO_NUMBER[paydayWeekday];
}

/**
 * True when reminders are on, today is payday, and the current pay week
 * still has no ingreso loaded.
 */
export function shouldShowPaydayLoadReminder(
  transactions: Transaction[],
  paydayWeekday: Weekday,
  shouldRemindPaydayLoad: boolean,
  referenceDate: Date = new Date(),
): boolean {
  if (!shouldRemindPaydayLoad) return false;
  if (!isPaydayDate(referenceDate, paydayWeekday)) return false;

  const { start, end } = getPayWeekBounds(referenceDate, paydayWeekday);
  const weekIso = toWeekIso(start);

  const hasIncomeThisWeek = transactions.some((item) => {
    if (item.type !== "ingreso") return false;
    if (item.weekIso === weekIso) return true;
    const date = parseISO(item.date);
    return date >= start && date <= end;
  });

  return !hasIncomeThisWeek;
}

export const PAYDAY_NOTIFICATION_TITLE = "Rinde · Día de cobro";
export const PAYDAY_NOTIFICATION_BODY =
  "Todavía no cargaste el ingreso de esta semana.";

/**
 * Fire a one-shot Web Notification if permission is already granted.
 * Does not request permission — that belongs to the settings toggle.
 */
export function maybeNotifyPaydayLoad(options?: {
  storageKey?: string;
  dayKey?: string;
}): boolean {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }
  if (Notification.permission !== "granted") return false;

  const storageKey = options?.storageKey ?? "rinde-payday-notify";
  const dayKey =
    options?.dayKey ?? new Date().toISOString().slice(0, 10);
  try {
    const lastNotified = window.localStorage.getItem(storageKey);
    if (lastNotified === dayKey) return false;
    window.localStorage.setItem(storageKey, dayKey);
  } catch {
    // localStorage may be unavailable; still try to notify once per session.
  }

  try {
    new Notification(PAYDAY_NOTIFICATION_TITLE, {
      body: PAYDAY_NOTIFICATION_BODY,
      tag: `rinde-payday-${dayKey}`,
    });
    return true;
  } catch {
    return false;
  }
}
