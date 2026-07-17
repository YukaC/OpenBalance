/**
 * Android hardware back (K2) via `@capacitor/app`.
 * Falls back to history overlay binding for WebViews without the plugin.
 */

import { isRunningInNativeApp } from "@/lib/device";

const OVERLAY_HISTORY_FLAG = "openBalanceOverlay";

type OverlayHistoryState = {
  [OVERLAY_HISTORY_FLAG]?: boolean;
};

function readHistoryState(): OverlayHistoryState | null {
  if (typeof window === "undefined") return null;
  const state = window.history.state;
  if (state && typeof state === "object") {
    return state as OverlayHistoryState;
  }
  return null;
}

/**
 * While `isOverlayOpen` is true, push a history entry and close on back/popstate.
 * Soft substitute when Capacitor `backButton` is not available.
 */
export function bindOverlayHistoryBack(
  isOverlayOpen: boolean,
  onCloseOverlay: () => void,
): (() => void) | void {
  if (!isOverlayOpen || typeof window === "undefined") return;

  const previousState = readHistoryState();
  window.history.pushState(
    { ...(previousState ?? {}), [OVERLAY_HISTORY_FLAG]: true },
    "",
  );

  const onPopState = () => {
    onCloseOverlay();
  };

  window.addEventListener("popstate", onPopState);

  return () => {
    window.removeEventListener("popstate", onPopState);
    if (readHistoryState()?.[OVERLAY_HISTORY_FLAG]) {
      window.history.back();
    }
  };
}

export type NativeBackHandlers = {
  isFormOpen: () => boolean;
  closeForm: () => void;
  getSection: () => string;
  navigateHome: () => void;
};

/**
 * Capacitor `backButton`: close form → leave section → exit app.
 * No-op on web. Returns unsubscribe.
 */
export async function bindNativeBackButton(
  handlers: NativeBackHandlers,
): Promise<() => void> {
  if (!isRunningInNativeApp()) return () => {};

  try {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("backButton", () => {
      if (handlers.isFormOpen()) {
        handlers.closeForm();
        return;
      }
      const section = handlers.getSection();
      if (section !== "/") {
        handlers.navigateHome();
        return;
      }
      void App.exitApp();
    });
    return () => {
      void listener.remove();
    };
  } catch {
    return () => {};
  }
}
