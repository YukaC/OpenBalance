import { Money } from "@/components/Money";
import { formatMonthLabel } from "@/lib/dates";
import type { MonthSummary } from "@/lib/summaries";

interface WeekBreakdownProps {
  summary: MonthSummary;
}

export function WeekBreakdown({ summary }: WeekBreakdownProps) {
  const monthName = formatMonthLabel(summary.monthKey).replace(/\s+\d+$/, "");

  return (
    <section className="space-y-4" aria-labelledby="weeks-heading">
      <div className="space-y-1.5">
        <h2
          id="weeks-heading"
          className="font-display text-[22px] text-[var(--ink)]"
        >
          Semanas de {monthName}
        </h2>
        <p className="text-[13px] leading-snug text-[var(--ink-muted)]">
          Tu sueldo entra los viernes — así se acomoda dentro del mes
        </p>
      </div>

      <ul className="divide-y divide-[var(--line)]">
        {summary.weeks.map((week) => {
          const showAmounts = week.hasData;
          const status = !week.hasData
            ? week.isCurrent
              ? "En curso"
              : "Sin cargar"
            : null;

          return (
            <li
              key={week.weekIso}
              className="flex items-start justify-between gap-3 py-3.5"
            >
              <div className="min-w-0">
                <p
                  className={`text-[15px] font-medium ${
                    week.isCurrent ? "text-[var(--income)]" : "text-[var(--ink)]"
                  }`}
                >
                  {week.label}
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--ink-muted)]">
                  {week.rangeLabel}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {showAmounts ? (
                  <>
                    {week.income > 0 && (
                      <p>
                        <Money
                          amount={week.income}
                          withSign
                          tone="income"
                          className="text-[14px] font-medium"
                        />
                      </p>
                    )}
                    {week.expense > 0 && (
                      <p className="mt-0.5 text-[12.5px] text-[var(--ink-muted)]">
                        <Money
                          amount={-week.expense}
                          withSign
                          tone="expense"
                          className="text-[12.5px] text-[var(--ink-muted)]"
                        />{" "}
                        gastado
                      </p>
                    )}
                    {week.income === 0 && week.expense === 0 && (
                      <p className="text-[13px] text-[var(--ink-faint)]">
                        {week.isCurrent ? "En curso" : "Sin cargar"}
                      </p>
                    )}
                  </>
                ) : (
                  <p
                    className={`text-[13px] ${
                      week.isCurrent
                        ? "text-[var(--income)]"
                        : "text-[var(--ink-faint)]"
                    }`}
                  >
                    {status}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
