/**
 * Soft substitute for Capacitor hardware back without `@capacitor/app`.
 *
 * Capacitor WebViews usually map the Android back key to `history.back()`.
 * We push a history entry when an overlay (e.g. transaction form) opens, then
 * close it on `popstate`. Full control (intercept exit, custom priority) needs:
 *   npm i @capacitor/app  →  App.addListener("backButton", …)
 *
 * @see docs/MOBILE.md
 */

const OVERLAY_HISTORY_FLAG = "rindeOverlay";

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
 * Call from a `useEffect` in AppShell (or similar):
 *
 *   useEffect(
 *     () => bindOverlayHistoryBack(isFormOpen, closeForm),
 *     [isFormOpen, closeForm],
 *   );
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
    // Closed via UI (Escape / submit), not hardware back — drop the extra entry.
    if (readHistoryState()?.[OVERLAY_HISTORY_FLAG]) {
      window.history.back();
    }
  };
}
