/**
 * Deep link stub (K6) — parse app URL / notification extras and open flows.
 *
 * Supported shapes (best-effort):
 * - openbalance://income (LEGACY: rinde://income still parsed)
 * - openbalance://transaction/new?type=ingreso
 * - https://…/open/income
 * - extra.deepLink / extra.action on local notifications
 */

const DEFAULT_DEEP_LINK_SCHEME = "openbalance";

import { isRunningInNativeApp } from "@/lib/device";
import type { TransactionType } from "@/lib/types";

export type DeepLinkAction = {
  type: "open-form";
  formType: TransactionType;
};

export function parseDeepLinkUrl(rawUrl: string): DeepLinkAction | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const normalized = trimmed.includes("://")
      ? trimmed
      : `${DEFAULT_DEEP_LINK_SCHEME}://${trimmed.replace(/^\/+/, "")}`;
    const url = new URL(normalized);

    const hostAndPath = `${url.host}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
    const typeParam = url.searchParams.get("type")?.toLowerCase();

    if (
      hostAndPath === "income" ||
      hostAndPath === "open/income" ||
      hostAndPath.endsWith("/income") ||
      typeParam === "ingreso"
    ) {
      return { type: "open-form", formType: "ingreso" };
    }

    if (
      hostAndPath === "expense" ||
      hostAndPath === "gasto" ||
      hostAndPath === "open/expense" ||
      typeParam === "gasto"
    ) {
      return { type: "open-form", formType: "gasto" };
    }

    if (
      hostAndPath.includes("transaction") ||
      hostAndPath.includes("nueva") ||
      hostAndPath === "new"
    ) {
      const formType: TransactionType =
        typeParam === "gasto" ? "gasto" : "ingreso";
      return { type: "open-form", formType };
    }
  } catch {
    const lower = trimmed.toLowerCase();
    if (lower.includes("income") || lower.includes("ingreso")) {
      return { type: "open-form", formType: "ingreso" };
    }
  }

  return null;
}

export function parseDeepLinkExtra(
  extra: Record<string, unknown> | undefined | null,
): DeepLinkAction | null {
  if (!extra || typeof extra !== "object") return null;
  const deepLink =
    typeof extra.deepLink === "string"
      ? extra.deepLink
      : typeof extra.action === "string"
        ? extra.action
        : null;
  if (deepLink) return parseDeepLinkUrl(deepLink);
  if (extra.openIncome === true || extra.openIncome === "true") {
    return { type: "open-form", formType: "ingreso" };
  }
  return null;
}

/**
 * Listen for Capacitor launch URL, `appUrlOpen`, and notification taps.
 * Returns an unsubscribe fn. No-op on web.
 */
export async function bindDeepLinkListeners(
  onAction: (action: DeepLinkAction) => void,
): Promise<() => void> {
  if (!isRunningInNativeApp()) return () => {};

  const unsubscribers: Array<() => void> = [];

  try {
    const { App } = await import("@capacitor/app");

    // Cold start: app opened via deep link / notification.
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        const action = parseDeepLinkUrl(launch.url);
        if (action) onAction(action);
      }
    } catch {
      /* getLaunchUrl unavailable */
    }

    const urlHandle = await App.addListener("appUrlOpen", (event) => {
      const action = parseDeepLinkUrl(event.url);
      if (action) onAction(action);
    });
    unsubscribers.push(() => {
      void urlHandle.remove();
    });
  } catch {
    /* plugin missing */
  }

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );
    const notifHandle = await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (event) => {
        const extra = event.notification.extra as
          | Record<string, unknown>
          | undefined;
        const action =
          parseDeepLinkExtra(extra) ??
          parseDeepLinkUrl(`${DEFAULT_DEEP_LINK_SCHEME}://income`);
        if (action) onAction(action);
      },
    );
    unsubscribers.push(() => {
      void notifHandle.remove();
    });
  } catch {
    /* plugin missing */
  }

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
