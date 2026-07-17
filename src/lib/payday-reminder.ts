import { getDay, parseISO } from "date-fns";
import { isRunningInNativeApp } from "./device";
import { getPayWeekBounds } from "./dates";
import { isActive } from "./entity-lifecycle";
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

  const hasIncomeThisWeek = transactions.some((item) => {
    if (!isActive(item)) return false;
    if (item.type !== "ingreso") return false;
    const date = parseISO(item.date);
    return date >= start && date <= end;
  });

  return !hasIncomeThisWeek;
}

export const PAYDAY_NOTIFICATION_TITLE = "OpenBalance · Día de cobro";
export const PAYDAY_NOTIFICATION_BODY =
  "Todavía no cargaste el ingreso de esta semana.";

const PAYDAY_NOTIFY_STORAGE_KEY = "openbalance-payday-notify";

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
      body: PAYDAY_NOTIFICATION_BODY,
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

/**
 * Schedule a weekly native reminder on the user's payday at 09:00 (E3).
 * Cancels the previous schedule first. No-op on web.
 */
export async function syncNativePaydayNotification(
  paydayWeekday: Weekday,
  shouldRemind: boolean,
): Promise<void> {
  if (!isRunningInNativeApp()) return;

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    await LocalNotifications.cancel({
      notifications: [{ id: PAYDAY_NATIVE_NOTIFICATION_ID }],
    });

    if (!shouldRemind) return;

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== "granted") return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: PAYDAY_NATIVE_NOTIFICATION_ID,
          title: PAYDAY_NOTIFICATION_TITLE,
          body: PAYDAY_NOTIFICATION_BODY,
          schedule: {
            on: {
              weekday: WEEKDAY_TO_CAPACITOR[paydayWeekday],
              hour: 9,
              minute: 0,
            },
            allowWhileIdle: true,
          },
          extra: {
            deepLink: "openbalance://income",
            openIncome: true,
          },
        },
      ],
    });
  } catch {
    /* plugin unavailable — keep in-app banner / web notifications */
  }
}
