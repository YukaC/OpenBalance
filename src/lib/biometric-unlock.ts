/**
 * Optional biometric unlock (S4) for Capacitor.
 *
 * Uses `@aparajita/capacitor-biometric-auth` (already in package.json — not
 * `@capacitor/biometric`). Web and missing-plugin paths no-op safely.
 * Real crypto still comes from the PIN-derived session key via unlockWithPin.
 *
 * After a successful biometric prompt we read the stored PIN from Preferences
 * (native) / localStorage (fallback) and call unlockWithPin — the PIN never
 * leaves the device and is never sent to the server.
 */

import { isRunningInNativeApp } from "@/lib/device";
import { unlockWithPin } from "@/lib/pin-lock";

const BIOMETRIC_ENABLED_KEY = "openbalance-biometric-enabled";
const BIOMETRIC_PIN_KEY = "openbalance-biometric-pin";

async function readPref(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (isRunningInNativeApp()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const result = await Preferences.get({ key });
      if (result.value != null) return result.value;
    } catch {
      /* fall through */
    }
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writePref(key: string, value: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (isRunningInNativeApp()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key, value });
    } catch {
      /* fall through */
    }
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

async function removePref(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (isRunningInNativeApp()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key });
    } catch {
      /* ignore */
    }
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  if (!isRunningInNativeApp()) return false;
  try {
    const { BiometricAuth } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    const result = await BiometricAuth.checkBiometry();
    return Boolean(result.isAvailable);
  } catch {
    return false;
  }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  const flag = await readPref(BIOMETRIC_ENABLED_KEY);
  if (flag !== "1") return false;
  const pin = await readPref(BIOMETRIC_PIN_KEY);
  return Boolean(pin);
}

/**
 * After a successful PIN unlock/set, opt into biometrics.
 * Stores the PIN locally so a later biometric success can derive the crypto key.
 */
export async function enableBiometricUnlock(pin: string): Promise<boolean> {
  if (!isRunningInNativeApp()) return false;
  const isAvailable = await isBiometricHardwareAvailable();
  if (!isAvailable) return false;

  try {
    const { BiometricAuth } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    await BiometricAuth.authenticate({
      reason: "Activá el desbloqueo biométrico de OpenBalance",
      cancelTitle: "Cancelar",
      allowDeviceCredential: true,
    });
    await writePref(BIOMETRIC_ENABLED_KEY, "1");
    await writePref(BIOMETRIC_PIN_KEY, pin);
    return true;
  } catch {
    return false;
  }
}

export async function disableBiometricUnlock(): Promise<void> {
  await removePref(BIOMETRIC_ENABLED_KEY);
  await removePref(BIOMETRIC_PIN_KEY);
}

/**
 * After a PIN change, keep the stored biometric PIN in sync without re-prompting.
 * No-ops when biometrics are not enabled.
 */
export async function syncBiometricStoredPin(pin: string): Promise<void> {
  if (!(await isBiometricUnlockEnabled())) return;
  await writePref(BIOMETRIC_PIN_KEY, pin);
}

/**
 * Prompt biometrics; on success, unlock with the stored PIN (loads AES key).
 */
export async function unlockWithBiometric(): Promise<boolean> {
  if (!(await isBiometricUnlockEnabled())) return false;

  try {
    const { BiometricAuth } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    await BiometricAuth.authenticate({
      reason: "Desbloquear OpenBalance",
      cancelTitle: "Usar PIN",
      allowDeviceCredential: false,
    });
  } catch {
    return false;
  }

  const pin = await readPref(BIOMETRIC_PIN_KEY);
  if (!pin) return false;
  return unlockWithPin(pin);
}
