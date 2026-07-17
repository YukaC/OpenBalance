import { endOfMonth, getDay, parseISO, startOfMonth } from "date-fns";
import { getPayWeekBounds, isDayOfMonthDate, toMonthKey } from "./dates";
import { isRunningInNativeApp } from "./device";
import { isActive } from "./entity-lifecycle";
import type { PayCadence, PaydayDayOfMonth, Transaction, Weekday } from "./types";

const WEEKDAY_TO_NUMBER: Record<Weekday, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

/** Capacitor LocalNotifications Weekday: Sunday=1 … Saturday=7 */
const WEEKDAY_TO_CAPACITOR: Record<Weekday, number> = {
  domingo: 1,
  lunes: 2,
  martes: 3,
  miercoles: 4,
  jueves: 5,
  viernes: 6,
  sabado: 7,
};

export const PAYDAY_NATIVE_NOTIFICATION_ID = 42_001;

export function isWeeklyPaydayDate(
  referenceDate: Date,
  paydayWeekday: Weekday,
): boolean {
  return getDay(referenceDate) === WEEKDAY_TO_NUMBER[paydayWeekday];
}

/** @deprecated Prefer isWeeklyPaydayDate or isPaydayForProfile. */
export function isPaydayDate(
  referenceDate: Date,
  paydayWeekday: Weekday,
): boolean {
  return isWeeklyPaydayDate(referenceDate, paydayWeekday);
}

export type PaydayReminderProfile = {
  payCadence: PayCadence;
  paydayWeekday: Weekday;
  paydayDayOfMonth: PaydayDayOfMonth;
  shouldRemindPaydayLoad: boolean;
};

/**
 * True when today matches the user's configured payday
 * (weekday for weekly, day-of-month for monthly — shared clamp with G6).
 */
export function isPaydayForProfile(
  referenceDate: Date,
  profile: Pick<
    PaydayReminderProfile,
    "payCadence" | "paydayWeekday" | "paydayDayOfMonth"
  >,
): boolean {
  if (profile.payCadence === "monthly") {
    return isDayOfMonthDate(referenceDate, profile.paydayDayOfMonth);
  }
  return isWeeklyPaydayDate(referenceDate, profile.paydayWeekday);
}

function hasIncomeInRange(
  transactions: Transaction[],
  start: Date,
  end: Date,
): boolean {
  return transactions.some((item) => {
    if (!isActive(item)) return false;
    if (item.type !== "ingreso") return false;
    const date = parseISO(item.date);
    return date >= start && date <= end;
  });
}

/**
 * True when reminders are on, today is payday, and the current pay window
 * (week or calendar month) still has no ingreso loaded.
 */
export function shouldShowPaydayLoadReminder(
  transactions: Transaction[],
  profile: PaydayReminderProfile,
  referenceDate: Date = new Date(),
): boolean {
  if (!profile.shouldRemindPaydayLoad) return false;
  if (!isPaydayForProfile(referenceDate, profile)) return false;

  if (profile.payCadence === "monthly") {
    const monthStart = startOfMonth(referenceDate);
    const monthEnd = endOfMonth(referenceDate);
    return !hasIncomeInRange(transactions, monthStart, monthEnd);
  }

  const { start, end } = getPayWeekBounds(
    referenceDate,
    profile.paydayWeekday,
  );
  return !hasIncomeInRange(transactions, start, end);
}

export const PAYDAY_NOTIFICATION_TITLE = "OpenBalance · Día de cobro";
export const PAYDAY_NOTIFICATION_BODY_WEEKLY =
  "Todavía no cargaste el ingreso de esta semana.";
export const PAYDAY_NOTIFICATION_BODY_MONTHLY =
  "Todavía no cargaste el ingreso de este mes.";
/** @deprecated Use PAYDAY_NOTIFICATION_BODY_WEEKLY. */
export const PAYDAY_NOTIFICATION_BODY = PAYDAY_NOTIFICATION_BODY_WEEKLY;

const PAYDAY_NOTIFY_STORAGE_KEY = "openbalance-payday-notify";

/**
 * Fire a one-shot Web Notification if permission is already granted.
 * Does not request permission — that belongs to the settings toggle.
 */
export function maybeNotifyPaydayLoad(options?: {
  storageKey?: string;
  dayKey?: string;
  body?: string;
}): boolean {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }
  if (Notification.permission !== "granted") return false;

  const storageKey = options?.storageKey ?? PAYDAY_NOTIFY_STORAGE_KEY;
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
      body: options?.body ?? PAYDAY_NOTIFICATION_BODY_WEEKLY,
      tag: `openbalance-payday-${dayKey}`,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Request local-notification permission on Capacitor (E3).
 * Returns true when granted (or already granted).
 */
export async function requestNativePaydayPermission(): Promise<boolean> {
  if (!isRunningInNativeApp()) return false;
  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === "granted";
  } catch {
    return false;
  }
}

export type SyncNativePaydayOptions = {
  payCadence: PayCadence;
  paydayWeekday: Weekday;
  paydayDayOfMonth: PaydayDayOfMonth;
  shouldRemind: boolean;
};

/**
 * Schedule a native reminder on the user's payday at 09:00 (E3).
 * Weekly → weekday schedule; monthly → day-of-month (0 → day 28 approx for last day).
 * Cancels the previous schedule first. No-op on web.
 */
export async function syncNativePaydayNotification(
  options: SyncNativePaydayOptions | Weekday,
  shouldRemindLegacy?: boolean,
): Promise<void> {
  // Back-compat: older callers passed (weekday, shouldRemind).
  const resolved: SyncNativePaydayOptions =
    typeof options === "string"
      ? {
          payCadence: "weekly",
          paydayWeekday: options,
          paydayDayOfMonth: 1,
          shouldRemind: Boolean(shouldRemindLegacy),
        }
      : options;

  if (!isRunningInNativeApp()) return;

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    await LocalNotifications.cancel({
      notifications: [{ id: PAYDAY_NATIVE_NOTIFICATION_ID }],
    });

    if (!resolved.shouldRemind) return;

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== "granted") return;
    }

    const body =
      resolved.payCadence === "monthly"
        ? PAYDAY_NOTIFICATION_BODY_MONTHLY
        : PAYDAY_NOTIFICATION_BODY_WEEKLY;

    const scheduleOn =
      resolved.payCadence === "monthly"
        ? {
            // Capacitor has no "last day"; 0 → 28. Banner still uses clampDayOfMonth.
            day:
              resolved.paydayDayOfMonth <= 0
                ? 28
                : Math.min(28, resolved.paydayDayOfMonth),
            hour: 9,
            minute: 0,
          }
        : {
            weekday: WEEKDAY_TO_CAPACITOR[resolved.paydayWeekday],
            hour: 9,
            minute: 0,
          };

    await LocalNotifications.schedule({
      notifications: [
        {
          id: PAYDAY_NATIVE_NOTIFICATION_ID,
          title: PAYDAY_NOTIFICATION_TITLE,
          body,
          schedule: {
            on: scheduleOn,
            allowWhileIdle: true,
            // Weekly `on.weekday` already recurs; repeats keeps iOS/Android aligned.
            repeats: true,
          },
          extra: {
            deepLink: "openbalance://income",
            openIncome: true,
            monthKey: toMonthKey(new Date()),
          },
        },
      ],
    });
  } catch {
    /* plugin unavailable — keep in-app banner / web notifications */
  }
}

/**
 * Read native display permission without prompting (E3 / Config UI).
 * Returns null on web or when the plugin is unavailable.
 */
export async function getNativePaydayPermission(): Promise<
  "granted" | "denied" | "prompt" | null
> {
  if (!isRunningInNativeApp()) return null;
  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return "granted";
    if (current.display === "denied") return "denied";
    return "prompt";
  } catch {
    return null;
  }
}
