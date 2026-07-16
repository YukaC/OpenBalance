/**
 * Device / runtime helpers for mobile web vs Capacitor native.
 * SSR-safe: browser-only checks return false on the server.
 */

type CapacitorLike = {
  isNativePlatform?: () => boolean;
};

function tryGetCapacitor(): CapacitorLike | null {
  if (typeof window === "undefined") return null;

  const fromWindow = (
    window as Window & { Capacitor?: CapacitorLike }
  ).Capacitor;
  if (fromWindow && typeof fromWindow.isNativePlatform === "function") {
    return fromWindow;
  }

  try {
    // Optional: present when @capacitor/core is installed and bundled.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require("@capacitor/core") as {
      Capacitor?: CapacitorLike;
    };
    if (core?.Capacitor && typeof core.Capacitor.isNativePlatform === "function") {
      return core.Capacitor;
    }
  } catch {
    // Package missing at runtime/build — treat as non-native.
  }

  return null;
}

/** True when running inside a Capacitor native shell (Android/iOS). */
export function isRunningInNativeApp(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const capacitor = tryGetCapacitor();
    return Boolean(capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

/**
 * True when the current client looks like a mobile web browser.
 * Uses UA plus coarse pointer / touch heuristics. Always false on SSR.
 */
export function isMobileWebBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const isMobileUserAgent =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      userAgent,
    );

  const hasCoarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  const hasTouchPoints = (navigator.maxTouchPoints ?? 0) > 0;

  return isMobileUserAgent || (hasCoarsePointer && hasTouchPoints);
}

/** Show download banner only on mobile web, never inside the native app. */
export function shouldShowDownloadAppBanner(): boolean {
  return isMobileWebBrowser() && !isRunningInNativeApp();
}
