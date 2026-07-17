/**
 * Optional biometric unlock (S4) for Capacitor.
 * Delegates real crypto to the PIN-derived session key (unlockWithPin).
 * Falls back to a no-op stub when the plugin is unavailable.
 */

import { isRunningInNativeApp } from "@/lib/device";
import { unlockWithPin } from "@/lib/pin-lock";

const BIOMETRIC_ENABLED_KEY = "openbalance-biometric-enabled";
const BIOMETRIC_PIN_KEY = "openbalance-biometric-pin";

/** LEGACY: pre-rename Preferences / localStorage keys (Rinde → OpenBalance). */
const LEGACY_BIOMETRIC_ENABLED_KEY = "rinde-biometric-enabled";
const LEGACY_BIOMETRIC_PIN_KEY = "rinde-biometric-pin";

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

/** LEGACY: read new key first, then pre-rename Rinde key. */
async function readPrefWithLegacy(
  key: string,
  legacyKey: string,
): Promise<string | null> {
  return (await readPref(key)) ?? (await readPref(legacyKey));
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

async function writePrefMigrating(
  key: string,
  legacyKey: string,
  value: string,
): Promise<void> {
  await writePref(key, value);
  await removePref(legacyKey);
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
  const flag = await readPrefWithLegacy(
    BIOMETRIC_ENABLED_KEY,
    LEGACY_BIOMETRIC_ENABLED_KEY,
  );
  if (flag !== "1") return false;
  const pin = await readPrefWithLegacy(
    BIOMETRIC_PIN_KEY,
    LEGACY_BIOMETRIC_PIN_KEY,
  );
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
    await writePrefMigrating(
      BIOMETRIC_ENABLED_KEY,
      LEGACY_BIOMETRIC_ENABLED_KEY,
      "1",
    );
    await writePrefMigrating(BIOMETRIC_PIN_KEY, LEGACY_BIOMETRIC_PIN_KEY, pin);
    return true;
  } catch {
    return false;
  }
}

export async function disableBiometricUnlock(): Promise<void> {
  await removePref(BIOMETRIC_ENABLED_KEY);
  await removePref(LEGACY_BIOMETRIC_ENABLED_KEY);
  await removePref(BIOMETRIC_PIN_KEY);
  await removePref(LEGACY_BIOMETRIC_PIN_KEY);
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

  const pin = await readPrefWithLegacy(
    BIOMETRIC_PIN_KEY,
    LEGACY_BIOMETRIC_PIN_KEY,
  );
  if (!pin) return false;
  return unlockWithPin(pin);
}
