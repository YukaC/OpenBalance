import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { CURRENCY_OPTIONS, parseMoneyInput } from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";
import type { UserProfile } from "@/lib/types";
import { useState } from "react";

type ProfileSectionProps = {
  profile: UserProfile;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  onSaveName: () => void;
  onSaveEmail: () => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
  onSavingsGoalChange: (goal: number | null) => void;
};

export function ProfileSection({
  profile,
  name,
  setName,
  email,
  setEmail,
  onSaveName,
  onSaveEmail,
  onCurrencyChange,
  onSavingsGoalChange,
}: ProfileSectionProps) {
  const isSetupComplete = profile.isSetupComplete === true;
  const [savingsGoalInput, setSavingsGoalInput] = useState(
    profile.monthlySavingsGoal != null && profile.monthlySavingsGoal > 0
      ? String(profile.monthlySavingsGoal)
      : "",
  );

  function handleSaveSavingsGoal() {
    const trimmed = savingsGoalInput.trim();
    if (!trimmed) {
      setSavingsGoalInput("");
      if (profile.monthlySavingsGoal != null) {
        onSavingsGoalChange(null);
      }
      return;
    }
    const parsed = parseMoneyInput(trimmed);
    if (!(parsed > 0)) {
      setSavingsGoalInput(
        profile.monthlySavingsGoal != null && profile.monthlySavingsGoal > 0
          ? String(profile.monthlySavingsGoal)
          : "",
      );
      return;
    }
    const rounded = Math.round(parsed);
    setSavingsGoalInput(String(rounded));
    if (profile.monthlySavingsGoal !== rounded) {
      onSavingsGoalChange(rounded);
    }
  }

  return (
    <CollapsibleLedgerSection
      headingId="profile-heading"
      title="Perfil"
      defaultOpen
      contentClassName="mt-4 space-y-4"
      summaryExtra={
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isSetupComplete
              ? "bg-[var(--green-soft,var(--gold-soft))] text-[var(--ink-soft)]"
              : "bg-[var(--bg)] text-[var(--ink-soft)]"
          }`}
        >
          {isSetupComplete ? "Setup completo" : "Setup pendiente"}
        </span>
      }
    >
      <label htmlFor="profile-name" className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
          Nombre
        </span>
        <input
          id="profile-name"
          name="profileName"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={onSaveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
        />
      </label>

      <label htmlFor="profile-email" className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
          Email
        </span>
        <input
          id="profile-email"
          name="profileEmail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={onSaveEmail}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
        />
      </label>

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
            const active = profile.defaultCurrency === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onCurrencyChange(option.value as CurrencyCode)}
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
        <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
          {
            CURRENCY_OPTIONS.find((o) => o.value === profile.defaultCurrency)
              ?.label
          }
        </p>
      </div>

      <label htmlFor="profile-savings-goal" className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
          Meta de ahorro mensual
        </span>
        <input
          id="profile-savings-goal"
          name="monthlySavingsGoal"
          inputMode="decimal"
          autoComplete="off"
          value={savingsGoalInput}
          onChange={(e) => setSavingsGoalInput(e.target.value)}
          onBlur={handleSaveSavingsGoal}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Opcional"
          className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
        />
        <span className="text-[11.5px] text-[var(--ink-faint)]">
          Se muestra el progreso en Resumen (balance del mes vs meta).
        </span>
      </label>
    </CollapsibleLedgerSection>
  );
}
