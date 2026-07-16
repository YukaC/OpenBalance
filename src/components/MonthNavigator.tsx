"use client";

import { useRef, useState } from "react";
import { MonthJumpCalendar } from "@/components/MonthJumpCalendar";
import {
  formatCurrentWeekLabel,
  formatMonthLabel,
  formatMonthName,
  getAppToday,
  shiftMonth,
  toMonthKey,
  toWeekIso,
} from "@/lib/dates";
import { FOCUS_RING } from "@/lib/focus-ring";
import { WEEKDAY_FULL_LABELS } from "@/lib/format";
import { useFinanceStore } from "@/store/finance-store";

export function MonthNavigator() {
  const appToday = getAppToday();
  const currentMonthKey = toMonthKey(appToday);

  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const setSelectedMonth = useFinanceStore((s) => s.setSelectedMonth);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);
  const setSelectedWeekIso = useFinanceStore((s) => s.setSelectedWeekIso);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const monthTitleRef = useRef<HTMLButtonElement>(null);

  const isAwayFromCurrentMonth = selectedMonth !== currentMonthKey;
  const paydayLabel = WEEKDAY_FULL_LABELS[paydayWeekday] ?? paydayWeekday;
  const weekLabel = isAwayFromCurrentMonth
    ? `Cobro los ${paydayLabel} · ${formatMonthName(selectedMonth)}`
    : formatCurrentWeekLabel(appToday, paydayWeekday);

  function handleSelectDate(pickedDate: Date) {
    setSelectedMonth(toMonthKey(pickedDate));
    setSelectedWeekIso(toWeekIso(pickedDate));
  }

  function handleGoToCurrentMonth() {
    setSelectedMonth(currentMonthKey);
    setIsCalendarOpen(false);
  }

  return (
    <header className="mb-4 flex flex-col items-center gap-3 min-[880px]:mb-7">
      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)] text-[16px] text-[var(--ink-soft)] transition-soft hover:border-[var(--line-strong)] hover:text-[var(--ink)] ${FOCUS_RING} min-[880px]:h-10 min-[880px]:w-10`}
          >
            ‹
          </button>

          <button
            ref={monthTitleRef}
            type="button"
            aria-expanded={isCalendarOpen}
            aria-haspopup="dialog"
            aria-label={`Mes seleccionado: ${formatMonthLabel(selectedMonth)}. Abrir calendario`}
            onClick={() => setIsCalendarOpen((open) => !open)}
            className={`rounded-xl px-2 py-1 transition-soft hover:bg-[var(--paper-deep)] ${FOCUS_RING}`}
          >
            <span className="font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)] min-[880px]:text-[28px]">
              {formatMonthLabel(selectedMonth)}
            </span>
          </button>

          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)] text-[16px] text-[var(--ink-soft)] transition-soft hover:border-[var(--line-strong)] hover:text-[var(--ink)] ${FOCUS_RING} min-[880px]:h-10 min-[880px]:w-10`}
          >
            ›
          </button>

          <MonthJumpCalendar
            isOpen={isCalendarOpen}
            selectedMonth={selectedMonth}
            referenceToday={appToday}
            onClose={() => setIsCalendarOpen(false)}
            onSelectDate={handleSelectDate}
            anchorRef={monthTitleRef}
          />
        </div>

        <p className="max-w-[min(100%,28rem)] truncate px-1 text-center text-[12.5px] text-[var(--ink-soft)] min-[880px]:text-[13px]">
          {weekLabel}
        </p>
      </div>

      {isAwayFromCurrentMonth ? (
        <button
          type="button"
          onClick={handleGoToCurrentMonth}
          className={`rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] ${FOCUS_RING}`}
        >
          Volver al mes actual
        </button>
      ) : null}
    </header>
  );
}
