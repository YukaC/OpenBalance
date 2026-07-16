"use client";

import { useRef, useState } from "react";
import { MonthJumpCalendar } from "@/components/MonthJumpCalendar";
import {
  formatCurrentWeekLabel,
  formatMonthLabel,
  formatMonthName,
  shiftMonth,
  toMonthKey,
  toWeekIso,
} from "@/lib/dates";
import { WEEKDAY_FULL_LABELS } from "@/lib/format";
import { useFinanceStore } from "@/store/finance-store";

const REFERENCE_TODAY = new Date("2026-07-16");
const CURRENT_MONTH_KEY = toMonthKey(REFERENCE_TODAY);

export function MonthNavigator() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const setSelectedMonth = useFinanceStore((s) => s.setSelectedMonth);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);
  const setSelectedWeekIso = useFinanceStore((s) => s.setSelectedWeekIso);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const monthTitleRef = useRef<HTMLButtonElement>(null);

  const isAwayFromCurrentMonth = selectedMonth !== CURRENT_MONTH_KEY;
  const paydayLabel = WEEKDAY_FULL_LABELS[paydayWeekday] ?? paydayWeekday;
  const weekLabel = isAwayFromCurrentMonth
    ? `Cobro los ${paydayLabel} · ${formatMonthName(selectedMonth)}`
    : formatCurrentWeekLabel(REFERENCE_TODAY, paydayWeekday);

  function handleSelectDate(pickedDate: Date) {
    setSelectedMonth(toMonthKey(pickedDate));
    setSelectedWeekIso(toWeekIso(pickedDate));
  }

  function handleGoToCurrentMonth() {
    setSelectedMonth(CURRENT_MONTH_KEY);
    setIsCalendarOpen(false);
  }

  return (
    <header className="mb-4 flex flex-col gap-3 min-[880px]:mb-7">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex w-fit max-w-full items-center gap-2">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)] text-[16px] text-[var(--ink-soft)] transition-soft hover:border-[var(--line-strong)] hover:text-[var(--ink)] focus-visible:outline-none active:scale-95 min-[880px]:h-10 min-[880px]:w-10"
          >
            ‹
          </button>

          <div className="relative min-w-0">
            <button
              ref={monthTitleRef}
              type="button"
              aria-expanded={isCalendarOpen}
              aria-haspopup="dialog"
              aria-label={`Mes seleccionado: ${formatMonthLabel(selectedMonth)}. Abrir calendario`}
              onClick={() => setIsCalendarOpen((open) => !open)}
              className="rounded-xl px-2 py-1 text-left transition-soft hover:bg-[var(--paper-deep)] focus-visible:outline-none"
            >
              <span className="font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)] min-[880px]:text-[28px]">
                {formatMonthLabel(selectedMonth)}
              </span>
            </button>
            <p className="mt-0.5 max-w-[min(100%,28rem)] truncate px-2 text-[12.5px] text-[var(--ink-soft)] min-[880px]:text-[13px]">
              {weekLabel}
            </p>

            <MonthJumpCalendar
              isOpen={isCalendarOpen}
              selectedMonth={selectedMonth}
              referenceToday={REFERENCE_TODAY}
              onClose={() => setIsCalendarOpen(false)}
              onSelectDate={handleSelectDate}
              anchorRef={monthTitleRef}
            />
          </div>

          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)] text-[16px] text-[var(--ink-soft)] transition-soft hover:border-[var(--line-strong)] hover:text-[var(--ink)] focus-visible:outline-none active:scale-95 min-[880px]:h-10 min-[880px]:w-10"
          >
            ›
          </button>
        </div>

        {isAwayFromCurrentMonth ? (
          <button
            type="button"
            onClick={handleGoToCurrentMonth}
            className="self-start rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            Volver al mes actual
          </button>
        ) : null}
      </div>
    </header>
  );
}
