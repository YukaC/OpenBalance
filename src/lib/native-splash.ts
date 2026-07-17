/**
 * Hide Capacitor splash once the app shell is ready (K3).
 */

import { isRunningInNativeApp } from "@/lib/device";

export async function hideNativeSplash(): Promise<void> {
  if (!isRunningInNativeApp()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {
    /* ignore */
  }
}
