"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { parseMonthKey } from "@/lib/dates";

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

interface MonthJumpCalendarProps {
  isOpen: boolean;
  selectedMonth: string;
  referenceToday: Date;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  anchorRef: RefObject<HTMLElement | null>;
}

function capitalizeLabel(label: string): string {
  return label.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function buildCalendarDays(viewMonth: Date): Date[] {
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const leadingEmpty = (monthStart.getDay() + 6) % 7;
  const dayCount = eachDayOfInterval({ start: monthStart, end: monthEnd }).length;
  const trailingCount = (7 - ((leadingEmpty + dayCount) % 7)) % 7;
  const gridEnd =
    trailingCount === 0
      ? monthEnd
      : new Date(
          monthEnd.getFullYear(),
          monthEnd.getMonth(),
          monthEnd.getDate() + trailingCount,
        );

  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function MonthJumpCalendar({
  isOpen,
  selectedMonth,
  referenceToday,
  onClose,
  onSelectDate,
  anchorRef,
}: MonthJumpCalendarProps) {
  const dialogId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [viewMonth, setViewMonth] = useState(() => parseMonthKey(selectedMonth));
  const [viewMode, setViewMode] = useState<"days" | "years">("days");
  const [decadeStart, setDecadeStart] = useState(
    () => Math.floor(parseMonthKey(selectedMonth).getFullYear() / 12) * 12,
  );

  useEffect(() => {
    if (!isOpen) return;
    setViewMonth(parseMonthKey(selectedMonth));
    setViewMode("days");
    setDecadeStart(
      Math.floor(parseMonthKey(selectedMonth).getFullYear() / 12) * 12,
    );
  }, [isOpen, selectedMonth]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const calendarDays = buildCalendarDays(viewMonth);
  const monthTitle = capitalizeLabel(
    format(viewMonth, "MMMM yyyy", { locale: es }),
  );
  const selectedMonthDate = parseMonthKey(selectedMonth);

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  function handleSelectDay(day: Date) {
    onSelectDate(day);
    onClose();
  }

  function handleSelectYear(year: number) {
    setViewMonth(new Date(year, viewMonth.getMonth(), 1));
    setViewMode("days");
  }

  const yearOptions = Array.from({ length: 12 }, (_, index) => decadeStart + index);

  return (
    <div
      ref={panelRef}
      id={dialogId}
      role="dialog"
      aria-modal="false"
      aria-label="Elegir fecha"
      tabIndex={-1}
      onKeyDown={handlePanelKeyDown}
      className="absolute left-0 top-[calc(100%+8px)] z-[60] w-[min(calc(100vw-1.75rem),288px)] rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-3 shadow-[var(--shadow-sheet)] max-[879px]:left-1/2 max-[879px]:right-auto max-[879px]:-translate-x-1/2"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={viewMode === "days" ? "Mes anterior" : "Años anteriores"}
          onClick={() => {
            if (viewMode === "days") {
              setViewMonth((current) => subMonths(current, 1));
              return;
            }
            setDecadeStart((current) => current - 12);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[14px] text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() =>
            setViewMode((current) => (current === "days" ? "years" : "days"))
          }
          className="rounded-lg px-2 py-1 font-display text-[15px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--bg)]"
          aria-label={
            viewMode === "days"
              ? "Cambiar a selector de año"
              : "Volver al calendario de días"
          }
        >
          {viewMode === "days" ? monthTitle : `${decadeStart} – ${decadeStart + 11}`}
        </button>

        <button
          type="button"
          aria-label={viewMode === "days" ? "Mes siguiente" : "Años siguientes"}
          onClick={() => {
            if (viewMode === "days") {
              setViewMonth((current) => addMonths(current, 1));
              return;
            }
            setDecadeStart((current) => current + 12);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[14px] text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
        >
          ›
        </button>
      </div>

      {viewMode === "years" ? (
        <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="Años">
          {yearOptions.map((year) => {
            const isSelectedYear = year === selectedMonthDate.getFullYear();
            const isCurrentYear = year === referenceToday.getFullYear();
            return (
              <button
                key={year}
                type="button"
                role="option"
                aria-selected={isSelectedYear}
                onClick={() => handleSelectYear(year)}
                className={`rounded-lg px-2 py-2.5 text-[13.5px] font-semibold transition-colors ${
                  isSelectedYear
                    ? "is-selected-solid"
                    : isCurrentYear
                      ? "bg-[var(--bg)] text-[var(--ink)] ring-1 ring-[var(--ink)]"
                      : "text-[var(--ink-soft)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                }`}
              >
                {year}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label={monthTitle}>
            {calendarDays.map((day) => {
              const isInViewMonth = isSameMonth(day, viewMonth);
              const isToday = isSameDay(day, referenceToday);

              return (
                <button
                  key={format(day, "yyyy-MM-dd")}
                  type="button"
                  disabled={!isInViewMonth}
                  onClick={() => handleSelectDay(day)}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={capitalizeLabel(
                    format(day, "d MMMM yyyy", { locale: es }),
                  )}
                  className={`flex h-9 items-center justify-center rounded-lg text-[13px] font-semibold transition-colors ${
                    !isInViewMonth
                      ? "cursor-default text-transparent"
                      : isToday
                        ? "is-selected-solid"
                        : "text-[var(--ink-soft)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                  }`}
                >
                  {isInViewMonth ? day.getDate() : ""}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
