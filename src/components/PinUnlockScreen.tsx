"use client";

import { useState } from "react";
import { isValidPinFormat, verifyPin } from "@/lib/pin-lock";

export function PinUnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPinFormat(pin)) {
      setErrorMessage("El PIN debe tener entre 4 y 6 dígitos.");
      return;
    }
    setIsChecking(true);
    setErrorMessage("");
    try {
      const isValid = await verifyPin(pin);
      if (!isValid) {
        setErrorMessage("PIN incorrecto.");
        setPin("");
        return;
      }
      onUnlocked();
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg)] px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:p-8"
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
        </header>

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
            }}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-center text-[20px] tracking-[0.35em] outline-none focus:border-[var(--ink)]"
            autoFocus
          />
        </label>

        {errorMessage ? (
          <p className="text-[13px] text-[var(--red)]" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isChecking || pin.length < 4}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {isChecking ? "Comprobando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
