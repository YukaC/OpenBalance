import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  disableBiometricUnlock,
  enableBiometricUnlock,
  isBiometricHardwareAvailable,
  isBiometricUnlockEnabled,
  syncBiometricStoredPin,
  unlockWithBiometric,
} from "./biometric-unlock";

describe("biometric-unlock (web / no-plugin stub)", () => {
  it("reports hardware unavailable outside Capacitor native", async () => {
    assert.equal(await isBiometricHardwareAvailable(), false);
  });

  it("enableBiometricUnlock no-ops on web", async () => {
    assert.equal(await enableBiometricUnlock("1234"), false);
    assert.equal(await isBiometricUnlockEnabled(), false);
  });

  it("unlockWithBiometric no-ops when not enabled", async () => {
    assert.equal(await unlockWithBiometric(), false);
  });

  it("syncBiometricStoredPin and disable are safe no-ops when disabled", async () => {
    await syncBiometricStoredPin("5678");
    await disableBiometricUnlock();
    assert.equal(await isBiometricUnlockEnabled(), false);
  });
});
