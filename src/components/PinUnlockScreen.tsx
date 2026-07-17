"use client";

import { useEffect, useState } from "react";
import {
  isBiometricHardwareAvailable,
  isBiometricUnlockEnabled,
  unlockWithBiometric,
} from "@/lib/biometric-unlock";
import { isRunningInNativeApp } from "@/lib/device";
import { isValidPinFormat, unlockWithPin } from "@/lib/pin-lock";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
const UNLOCK_ERROR_ID = "unlock-pin-error";

export function PinUnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutEndsAt, setLockoutEndsAt] = useState<number | null>(null);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [isBiometricChecking, setIsBiometricChecking] = useState(false);

  const isLocked =
    lockoutEndsAt !== null && Date.now() < lockoutEndsAt;

  useEffect(() => {
    if (lockoutEndsAt === null) return;
    const remaining = lockoutEndsAt - Date.now();
    if (remaining <= 0) {
      setLockoutEndsAt(null);
      setFailedAttempts(0);
      setErrorMessage("");
      return;
    }
    const timer = window.setTimeout(() => {
      setLockoutEndsAt(null);
      setFailedAttempts(0);
      setErrorMessage("");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [lockoutEndsAt]);

  useEffect(() => {
    let isCancelled = false;
    async function probeBiometric() {
      if (!isRunningInNativeApp()) return;
      const [isEnabled, isAvailable] = await Promise.all([
        isBiometricUnlockEnabled(),
        isBiometricHardwareAvailable(),
      ]);
      if (isCancelled) return;
      setCanUseBiometric(isEnabled && isAvailable);
      if (isEnabled && isAvailable) {
        setIsBiometricChecking(true);
        try {
          const unlocked = await unlockWithBiometric();
          if (!isCancelled && unlocked) onUnlocked();
        } finally {
          if (!isCancelled) setIsBiometricChecking(false);
        }
      }
    }
    void probeBiometric();
    return () => {
      isCancelled = true;
    };
  }, [onUnlocked]);

  async function handleBiometricClick() {
    if (isLocked || isBiometricChecking) return;
    setIsBiometricChecking(true);
    setErrorMessage("");
    try {
      const unlocked = await unlockWithBiometric();
      if (unlocked) {
        onUnlocked();
        return;
      }
      setErrorMessage("No se pudo desbloquear con biometría. Usá el PIN.");
    } finally {
      setIsBiometricChecking(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLocked) return;
    if (!isValidPinFormat(pin)) {
      setErrorMessage("El PIN debe tener entre 4 y 6 dígitos.");
      return;
    }
    setIsChecking(true);
    setErrorMessage("");
    try {
      const isValid = await unlockWithPin(pin);
      if (!isValid) {
        const nextFailedAttempts = failedAttempts + 1;
        setFailedAttempts(nextFailedAttempts);
        if (nextFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          setLockoutEndsAt(Date.now() + LOCKOUT_MS);
          setErrorMessage("Demasiados intentos. Esperá 30 segundos.");
        } else {
          setErrorMessage("PIN incorrecto.");
        }
        setPin("");
        return;
      }
      setFailedAttempts(0);
      setLockoutEndsAt(null);
      onUnlocked();
    } finally {
      setIsChecking(false);
    }
  }

  const hasError = Boolean(errorMessage);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg)] px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="ledger-panel w-full max-w-sm space-y-5 p-6 sm:p-8"
        aria-labelledby="unlock-heading"
      >
        <header className="space-y-2 text-center">
          <p className="font-display text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            Rinde
          </p>
          <h1
            id="unlock-heading"
            className="font-display text-[20px] font-semibold text-[var(--ink)]"
          >
            Desbloquear
          </h1>
          <p className="text-[14px] text-[var(--ink-soft)]">
            Ingresá tu PIN local para continuar.
          </p>
          <p className="text-[12.5px] text-[var(--ink-faint)]">
            El PIN cifra el almacenamiento local; nunca se envía al servidor.
          </p>
        </header>

        {canUseBiometric ? (
          <button
            type="button"
            onClick={() => void handleBiometricClick()}
            disabled={isLocked || isBiometricChecking}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-50"
          >
            {isBiometricChecking
              ? "Comprobando biometría…"
              : "Desbloquear con huella / Face ID"}
          </button>
        ) : null}

        <label htmlFor="unlock-pin" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            PIN
          </span>
          <input
            id="unlock-pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{4,6}"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPin(digits);
              if (errorMessage) setErrorMessage("");
            }}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? UNLOCK_ERROR_ID : undefined}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-center text-[20px] tracking-[0.35em] outline-none focus:border-[var(--ink)]"
            autoFocus
          />
        </label>

        {errorMessage ? (
          <p
            id={UNLOCK_ERROR_ID}
            className="text-[13px] text-[var(--red)]"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isChecking || pin.length < 4 || isLocked}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {isChecking ? "Comprobando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
