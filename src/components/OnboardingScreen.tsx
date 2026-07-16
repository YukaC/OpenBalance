"use client";

import { useState } from "react";
import { CURRENCY_OPTIONS, WEEKDAY_LABELS } from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";
import { initialsFromName } from "@/lib/profile-setup";
import type { Weekday } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";

const WEEKDAYS: Weekday[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

const WEEKDAY_FULL: Record<Weekday, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

export function OnboardingScreen() {
  const profile = useFinanceStore((s) => s.profile);
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const setPayday = useFinanceStore((s) => s.setPayday);

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [paydayWeekday, setPaydayWeekday] = useState<Weekday>(profile.paydayWeekday);
  const [currency, setCurrency] = useState<CurrencyCode>(profile.defaultCurrency);
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setErrorMessage("Ingresá tu nombre para continuar.");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setErrorMessage("Ingresá un email válido.");
      return;
    }
    setErrorMessage("");
    updateProfile({
      name: trimmedName,
      email: trimmedEmail,
      defaultCurrency: currency,
      paydayWeekday,
      initials: initialsFromName(trimmedName),
      isSetupComplete: true,
    });
    setPayday(paydayWeekday);
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg)] px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-[18px] bg-[var(--card)] p-6 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] sm:p-8"
        aria-labelledby="onboarding-heading"
      >
        <header className="space-y-2 text-center">
          <p className="font-display text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            Rinde
          </p>
          <h1
            id="onboarding-heading"
            className="font-display text-[20px] font-semibold text-[var(--ink)]"
          >
            Configurá tu perfil
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Un paso local — sin cuenta ni servidor. Podés cambiarlo después en
            Configuración.
          </p>
        </header>

        <label htmlFor="onboarding-name" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Nombre
          </span>
          <input
            id="onboarding-name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            placeholder="Tu nombre"
          />
        </label>

        <label htmlFor="onboarding-email" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Email
          </span>
          <input
            id="onboarding-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            placeholder="vos@ejemplo.com"
          />
        </label>

        <div>
          <p className="mb-2 text-[12px] font-semibold text-[var(--ink-soft)]">
            Día de cobro
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Día de cobro"
          >
            {WEEKDAYS.map((day) => {
              const active = paydayWeekday === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setPaydayWeekday(day)}
                  title={WEEKDAY_FULL[day]}
                  aria-pressed={active}
                  className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    active
                      ? "is-selected-solid"
                      : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {WEEKDAY_LABELS[day]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold text-[var(--ink-soft)]">
            Moneda
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Moneda por defecto"
          >
            {CURRENCY_OPTIONS.map((option) => {
              const active = currency === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCurrency(option.value as CurrencyCode)}
                  aria-pressed={active}
                  className={`rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    active
                      ? "is-selected-solid"
                      : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {option.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {errorMessage ? (
          <p className="text-[13px] text-[var(--red)]" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:brightness-110"
        >
          Continuar
        </button>
      </form>
    </div>
  );
}
