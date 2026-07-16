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
  const deltaClass =
    comparison.direction === "up"
      ? "bg-[var(--green-soft)] text-[var(--green)]"
      : comparison.direction === "down"
        ? "bg-[var(--red-soft)] text-[var(--red)]"
        : "bg-[var(--bg)] text-[var(--ink-soft)]";
  const deltaArrow =
    comparison.direction === "up"
      ? "▲ "
      : comparison.direction === "down"
        ? "▼ "
        : "";

  return (
    <section
      className="hover-lift card-surface mb-5 grid grid-cols-2 gap-x-4 gap-y-4 rounded-[16px] px-4 py-5 min-[880px]:mb-6 min-[880px]:grid-cols-[1.4fr_1fr_1fr] min-[880px]:gap-6 min-[880px]:rounded-[20px] min-[880px]:px-8 min-[880px]:py-7"
      aria-labelledby="balance-heading"
    >
      <div className="col-span-2 min-[880px]:col-span-1">
        <p
          id="balance-heading"
          className="mb-2 text-[12px] font-medium text-[var(--ink-soft)] min-[880px]:text-[13px]"
        >
          Balance del mes
        </p>
        <p className="leading-none">
          <Money
            amount={balance}
            useMono={false}
            className={`font-display text-[36px] font-semibold tracking-[-0.02em] min-[880px]:text-[44px] ${
              isPositive ? "text-[var(--green)]" : "text-[var(--red)]"
            }`}
          />
        </p>
        <span
          className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold min-[880px]:text-[12.5px] ${deltaClass}`}
        >
          {deltaArrow}
          {comparison.label.replace(/^[▲▼]\s*/, "")}
        </span>
      </div>

      <div className="border-t border-[var(--line)] pt-3.5 min-[880px]:border-l min-[880px]:border-t-0 min-[880px]:pl-6 min-[880px]:pt-0">
        <p className="mb-2 text-[12px] font-medium text-[var(--ink-soft)] min-[880px]:text-[13px]">
          Ingresos
        </p>
        <p>
          <Money
            amount={income}
            tone="income"
            className="text-[20px] font-semibold text-[var(--green)] min-[880px]:text-[24px]"
          />
        </p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12px] text-[var(--ink-soft)] min-[880px]:text-[12.5px]">
          <span>Promedio semanal</span>
          <Money
            amount={weeklyAverageIncome}
            tone="income"
            className="text-[12px] font-medium text-[var(--green)] min-[880px]:text-[12.5px]"
          />
        </p>
      </div>

      <div className="border-t border-[var(--line)] pt-3.5 min-[880px]:border-l min-[880px]:border-t-0 min-[880px]:pl-6 min-[880px]:pt-0">
        <p className="mb-2 text-[12px] font-medium text-[var(--ink-soft)] min-[880px]:text-[13px]">
          Gastos
        </p>
        <p>
          <Money
            amount={expense}
            tone="expense"
            className="text-[20px] font-semibold text-[var(--red)] min-[880px]:text-[24px]"
          />
        </p>
      </div>
    </section>
  );
}
