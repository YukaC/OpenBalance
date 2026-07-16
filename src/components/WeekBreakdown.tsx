"use client";

import { Money } from "@/components/Money";
import { formatMonthName } from "@/lib/dates";
import type { MonthSummary } from "@/lib/summaries";
import { useFinanceStore } from "@/store/finance-store";

interface WeekBreakdownProps {
  summary: MonthSummary;
}

export function WeekBreakdown({ summary }: WeekBreakdownProps) {
  const monthName = formatMonthName(summary.monthKey).toLowerCase();
  const selectedWeekIso = useFinanceStore((s) => s.selectedWeekIso);
  const setSelectedWeekIso = useFinanceStore((s) => s.setSelectedWeekIso);

  const fallbackWeekIso =
    summary.weeks.find((week) => week.isCurrent)?.weekIso ??
    summary.weeks[0]?.weekIso ??
    null;
  const activeWeekIso = selectedWeekIso ?? fallbackWeekIso;
  const weekCount = summary.weeks.length;

  return (
    <section className="mb-1" aria-labelledby="weeks-heading">
      <h2
        id="weeks-heading"
        className="mb-4 font-display text-base font-semibold text-[var(--ink)] min-[880px]:text-lg"
      >
        Semanas de {monthName}
      </h2>

      <ul
        className={`week-strip-scroll flex gap-2 overflow-x-auto overflow-y-visible px-0.5 pb-2 pt-1 min-[880px]:grid min-[880px]:gap-2 min-[880px]:overflow-visible ${
          weekCount <= 4
            ? "min-[880px]:grid-cols-4"
            : weekCount === 5
              ? "min-[880px]:grid-cols-5"
              : "min-[880px]:grid-cols-6"
        }`}
      >
        {summary.weeks.map((week) => {
          const overspendAmount = week.hasData
            ? Math.max(0, week.expense - week.income)
            : 0;
          const isOverspent = overspendAmount > 0;
          const isSelected = activeWeekIso === week.weekIso;

          return (
            <li
              key={week.weekIso}
              className="relative min-w-[152px] flex-none max-[879px]:snap-start min-[880px]:min-w-0 min-[880px]:flex-1"
            >
              <button
                type="button"
                onClick={() => setSelectedWeekIso(week.weekIso)}
                aria-pressed={isSelected}
                className={`week-card group relative h-full w-full overflow-hidden rounded-2xl px-3.5 pb-4 pt-3.5 text-left transition-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] min-[880px]:px-4 ${
                  isSelected
                    ? "week-card--selected z-[2]"
                    : "border border-[var(--line)] bg-[var(--card)] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-[var(--surface-raised)] hover:shadow-[var(--shadow-card)] active:translate-y-0 active:scale-[0.99]"
                }`}
              >
                {isSelected ? (
                  <>
                    <span className="week-card__sheen" aria-hidden />
                    <span className="week-card__accent" aria-hidden />
                  </>
                ) : null}

                <div className="relative z-[1] flex items-start justify-between gap-2">
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${
                      isSelected
                        ? "text-[var(--select-fg)]"
                        : "text-[var(--ink-soft)]"
                    }`}
                  >
                    {week.isCurrent ? `Semana ${week.index}` : week.label}
                  </p>
                  {week.isCurrent ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${
                        isSelected
                          ? "bg-[color-mix(in_srgb,var(--select)_18%,transparent)] text-[var(--select-fg)]"
                          : "bg-[var(--green-soft)] text-[var(--green)]"
                      }`}
                    >
                      Hoy
                    </span>
                  ) : null}
                </div>

                <p
                  className={`relative z-[1] mt-1 mb-3 text-xs ${
                    isSelected
                      ? "text-[color-mix(in_srgb,var(--select-fg)_75%,transparent)]"
                      : "text-[var(--ink-soft)]"
                  }`}
                >
                  {week.rangeLabel}
                </p>

                <div className="relative z-[1]">
                  {week.hasData ? (
                    <>
                      <p>
                        {week.income > 0 ? (
                          <Money
                            amount={week.income}
                            withSign
                            className="text-[15px] font-semibold text-[var(--green)] min-[880px]:text-base"
                          />
                        ) : (
                          <span className="font-mono text-[15px] font-semibold text-[var(--ink-soft)] min-[880px]:text-base">
                            Sin ingreso
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[var(--red)] min-[880px]:text-[13px]">
                        {week.expense > 0 ? (
                          <>
                            −{" "}
                            <Money
                              amount={week.expense}
                              className="text-xs text-[var(--red)] min-[880px]:text-[13px]"
                            />{" "}
                            gastado
                          </>
                        ) : (
                          "−"
                        )}
                      </p>
                      {isOverspent ? (
                        <p
                          className={`mt-2 text-[11px] font-semibold ${
                            isSelected
                              ? "text-[var(--select-fg)]"
                              : "text-[var(--red)]"
                          }`}
                        >
                          −
                          <Money
                            amount={overspendAmount}
                            className={`text-[11px] font-semibold ${
                              isSelected
                                ? "text-[var(--select-fg)]"
                                : "text-[var(--red)]"
                            }`}
                          />{" "}
                          de más
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="font-mono text-[15px] font-semibold text-[var(--ink-soft)] min-[880px]:text-base">
                        Sin cargar
                      </p>
                      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">−</p>
                    </>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
