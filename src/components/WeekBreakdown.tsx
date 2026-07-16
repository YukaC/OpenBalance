"use client";

import { Money } from "@/components/Money";
import { formatMonthName } from "@/lib/dates";
import { FOCUS_RING } from "@/lib/focus-ring";
import type { MonthSummary } from "@/lib/summaries";
import { useFinanceStore } from "@/store/finance-store";

type WeekSlice = MonthSummary["weeks"][number];

interface WeekBreakdownProps {
  summary: MonthSummary;
}

interface WeekCardProps {
  week: WeekSlice;
  isSelected: boolean;
  onSelect: () => void;
  /** Strip cards may lift on hover; focus (mobile) stays quiet. */
  allowHoverMotion?: boolean;
}

function WeekCard({
  week,
  isSelected,
  onSelect,
  allowHoverMotion = false,
}: WeekCardProps) {
  const overspendAmount = week.hasData
    ? Math.max(0, week.expense - week.income)
    : 0;
  const isOverspent = overspendAmount > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`week-card group relative h-full w-full overflow-hidden rounded-2xl px-3 pb-3 pt-3 text-left transition-soft ${FOCUS_RING} max-[879px]:[&_.week-card__sheen]:hidden max-[879px]:[&_.week-card__accent]:hidden min-[880px]:px-4 min-[880px]:pb-4 min-[880px]:pt-3.5 ${
        isSelected
          ? "week-card--selected z-[2]"
          : allowHoverMotion
            ? "border border-[var(--line)] bg-[var(--card)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-raised)] hover:shadow-[var(--shadow-card)]"
            : "border border-[var(--line)] bg-[var(--card)]"
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
        className={`relative z-[1] mt-1 mb-2.5 text-xs min-[880px]:mb-3 ${
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
  );
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
  const activeWeekIndex = summary.weeks.findIndex(
    (week) => week.weekIso === activeWeekIso,
  );
  const focusedWeek =
    (activeWeekIndex >= 0 ? summary.weeks[activeWeekIndex] : null) ??
    summary.weeks[0] ??
    null;
  const previousWeek =
    activeWeekIndex > 0 ? summary.weeks[activeWeekIndex - 1] : null;
  const nextWeek =
    activeWeekIndex >= 0 && activeWeekIndex < weekCount - 1
      ? summary.weeks[activeWeekIndex + 1]
      : null;

  return (
    <section className="mb-1" aria-labelledby="weeks-heading">
      <div className="mb-3 flex flex-wrap items-end justify-center gap-2 min-[880px]:mb-4">
        <div className="section-intro">
          <h2 id="weeks-heading" className="section-heading">
            Semanas de {monthName}
          </h2>
          <p className="section-lede max-[879px]:hidden">
            Tocá una semana para ver sus movimientos abajo
          </p>
          <p className="section-lede min-[880px]:hidden">
            Semana activa — usá Anterior / Siguiente para cambiar
          </p>
        </div>
      </div>

      {/* Mobile: single focused week + prev/next */}
      {focusedWeek ? (
        <div className="min-[880px]:hidden">
          <div className="flex items-center justify-between gap-2 mb-2">
            {previousWeek ? (
              <button
                type="button"
                onClick={() => setSelectedWeekIso(previousWeek.weekIso)}
                aria-label="Semana anterior"
                className={`text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 hover:text-[var(--ink)] hover:underline ${FOCUS_RING} rounded-sm px-1 py-0.5`}
              >
                Anterior
              </button>
            ) : (
              <span className="w-16" aria-hidden />
            )}
            <span className="text-[11px] font-medium text-[var(--ink-soft)] tabular-nums">
              {Math.max(activeWeekIndex, 0) + 1} / {weekCount}
            </span>
            {nextWeek ? (
              <button
                type="button"
                onClick={() => setSelectedWeekIso(nextWeek.weekIso)}
                aria-label="Semana siguiente"
                className={`text-xs font-semibold text-[var(--ink-soft)] underline-offset-2 hover:text-[var(--ink)] hover:underline ${FOCUS_RING} rounded-sm px-1 py-0.5`}
              >
                Siguiente
              </button>
            ) : (
              <span className="w-16" aria-hidden />
            )}
          </div>
          <WeekCard
            week={focusedWeek}
            isSelected
            onSelect={() => setSelectedWeekIso(focusedWeek.weekIso)}
            allowHoverMotion={false}
          />
        </div>
      ) : null}

      {/* Desktop: full horizontal strip */}
      <ul
        className={`week-strip-scroll hidden gap-2 min-[880px]:grid min-[880px]:overflow-visible ${
          weekCount <= 4
            ? "min-[880px]:grid-cols-4"
            : weekCount === 5
              ? "min-[880px]:grid-cols-5"
              : "min-[880px]:grid-cols-6"
        }`}
      >
        {summary.weeks.map((week) => {
          const isSelected = activeWeekIso === week.weekIso;

          return (
            <li
              key={week.weekIso}
              className="relative min-w-0 flex-1"
            >
              <WeekCard
                week={week}
                isSelected={isSelected}
                onSelect={() => setSelectedWeekIso(week.weekIso)}
                allowHoverMotion
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
