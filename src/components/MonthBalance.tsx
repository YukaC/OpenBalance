import { useEffect, useState } from "react";
import { Money } from "@/components/Money";
import type { MonthSummary } from "@/lib/summaries";

interface MonthBalanceProps {
  summary: MonthSummary;
  weeklyAverageIncome: number;
}

export function MonthBalance({
  summary,
  weeklyAverageIncome,
}: MonthBalanceProps) {
  const { balance, income, expense, comparison } = summary;
  const isPositive = balance >= 0;
  const spendRatio =
    income > 0 ? Math.min(expense / income, 1.25) : expense > 0 ? 1 : 0;
  const spendPercent = income > 0 ? Math.round((expense / income) * 100) : null;
  const barWidthPercent = Math.min(spendRatio * 100, 100);

  const [heroClass, setHeroClass] = useState(
    "ledger-hero ledger-hero--static",
  );
  useEffect(() => {
    try {
      const heroAnimatedKey = "openbalance-hero-animated";
      const hasAnimated = sessionStorage.getItem(heroAnimatedKey) === "1";
      if (!hasAnimated) {
        sessionStorage.setItem(heroAnimatedKey, "1");
        setHeroClass("ledger-hero");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const deltaClass =
    comparison.direction === "up"
      ? "bg-[var(--green-soft)] text-[var(--green)]"
      : comparison.direction === "down"
        ? "bg-[var(--red-soft)] text-[var(--red)]"
        : "bg-[var(--paper-deep)] text-[var(--ink-soft)]";
  const deltaArrow =
    comparison.direction === "up"
      ? "▲ "
      : comparison.direction === "down"
        ? "▼ "
        : "";

  return (
    <section
      className={`${heroClass} text-center`}
      aria-labelledby="balance-heading"
    >
      <div className="relative z-[1] flex flex-col items-center gap-5">
        <div className="min-w-0">
          <p id="balance-heading" className="section-kicker mb-2">
            {isPositive ? "Te queda este mes" : "Vas en rojo este mes"}
          </p>
          <p className="leading-none">
            <Money
              amount={balance}
              useMono={false}
              className={`font-display text-[42px] font-semibold tracking-[-0.03em] min-[880px]:text-[52px] ${
                isPositive ? "text-[var(--ink)]" : "text-[var(--red)]"
              }`}
            />
          </p>
          <span
            className={`mt-3.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${deltaClass}`}
          >
            {deltaArrow}
            {comparison.label.replace(/^[▲▼]\s*/, "")}
          </span>
        </div>

        <div className="flex w-full max-w-md justify-center gap-10 border-t border-[var(--line)] pt-4 min-[880px]:gap-16">
          <div className="min-w-[7.5rem]">
            <p className="section-kicker mb-1.5">Entró</p>
            <p>
              <Money
                amount={income}
                tone="income"
                className="text-[20px] font-semibold text-[var(--green)] min-[880px]:text-[22px]"
              />
            </p>
            {weeklyAverageIncome > 0 ? (
              <p className="mt-1 text-[11.5px] leading-snug text-[var(--ink-soft)]">
                ~{" "}
                <Money
                  amount={weeklyAverageIncome}
                  tone="income"
                  className="text-[11.5px] font-medium text-[var(--ink-soft)]"
                />{" "}
                / semana
              </p>
            ) : null}
          </div>
          <div className="min-w-[7.5rem]">
            <p className="section-kicker mb-1.5">Salió</p>
            <p>
              <Money
                amount={expense}
                tone="expense"
                className="text-[20px] font-semibold text-[var(--red)] min-[880px]:text-[22px]"
              />
            </p>
            {spendPercent !== null ? (
              <p className="mt-1 text-[11.5px] leading-snug text-[var(--ink-soft)]">
                {spendPercent}% de lo que entró
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {income > 0 || expense > 0 ? (
        <div className="relative z-[1] mx-auto mt-5 w-full max-w-lg">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11.5px] text-[var(--ink-soft)]">
            <span>Cuánto del ingreso ya gastaste</span>
            {spendPercent !== null ? (
              <span className="font-semibold tabular-nums text-[var(--ink)]">
                {spendPercent}%
              </span>
            ) : null}
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,var(--paper-deep))]"
            role="meter"
            aria-label="Porcentaje del ingreso gastado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={spendPercent ?? 0}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                spendRatio >= 1
                  ? "bg-[var(--red)]"
                  : spendRatio >= 0.8
                    ? "bg-[var(--gold)]"
                    : "bg-[var(--green)]"
              }`}
              style={{ width: `${barWidthPercent}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
