/**
 * Capacitor haptics helpers (K4). No-ops on web / when the plugin fails.
 */

import { isRunningInNativeApp } from "@/lib/device";

export async function hapticLightImpact(): Promise<void> {
  if (!isRunningInNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* ignore — web or plugin unavailable */
  }
}

export async function hapticMediumImpact(): Promise<void> {
  if (!isRunningInNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* ignore */
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!isRunningInNativeApp()) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* ignore */
  }
}
