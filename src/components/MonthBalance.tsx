import { Money } from "@/components/Money";
import type { MonthSummary } from "@/lib/summaries";

interface MonthBalanceProps {
  summary: MonthSummary;
}

export function MonthBalance({ summary }: MonthBalanceProps) {
  const { balance, income, expense, comparison } = summary;
  const comparisonColor =
    comparison.direction === "up"
      ? "text-[var(--income)]"
      : comparison.direction === "down"
        ? "text-[var(--danger)]"
        : "text-[var(--ink-muted)]";

  return (
    <section className="space-y-5" aria-labelledby="balance-heading">
      <div className="space-y-2">
        <p
          id="balance-heading"
          className="text-[13px] uppercase tracking-[0.06em] text-[var(--ink-muted)]"
        >
          Balance del mes
        </p>
        <p className="leading-none">
          <Money
            amount={balance}
            className="text-[48px] tracking-[-0.03em] text-[var(--ink)] sm:text-[56px]"
          />
        </p>
        <p className={`text-[13px] ${comparisonColor}`}>{comparison.label}</p>
      </div>

      <div className="grid grid-cols-2 gap-6 border-t border-[var(--line)] pt-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.05em] text-[var(--ink-muted)]">
            Ingresos
          </p>
          <p className="mt-1">
            <Money
              amount={income}
              tone="income"
              className="text-[18px] font-medium"
            />
          </p>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.05em] text-[var(--ink-muted)]">
            Gastos
          </p>
          <p className="mt-1">
            <Money
              amount={expense}
              tone="expense"
              className="text-[18px] font-medium"
            />
          </p>
        </div>
      </div>
    </section>
  );
}
