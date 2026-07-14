"use client";

import Link from "next/link";
import {
  formatCurrentWeekLabel,
  formatMonthLabel,
  shiftMonth,
} from "@/lib/dates";
import { useFinanceStore } from "@/store/finance-store";

const REFERENCE_TODAY = new Date("2026-07-16");

export function MonthNavigator() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const setSelectedMonth = useFinanceStore((s) => s.setSelectedMonth);
  const viewMode = useFinanceStore((s) => s.viewMode);
  const setViewMode = useFinanceStore((s) => s.setViewMode);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);

  const weekLabel = formatCurrentWeekLabel(REFERENCE_TODAY, paydayWeekday);

  return (
    <header className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          className="flex h-10 w-10 items-center justify-center text-[22px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        >
          ‹
        </button>

        <h1 className="font-display text-center text-[28px] text-[var(--ink)] sm:text-[32px]">
          {formatMonthLabel(selectedMonth)}
        </h1>

        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          className="flex h-10 w-10 items-center justify-center text-[22px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        >
          ›
        </button>
      </div>

      <p className="text-center text-[13px] text-[var(--ink-muted)]">
        {weekLabel}
      </p>

      <nav
        className="flex items-center justify-center gap-5 text-[13px]"
        aria-label="Modo de vista"
      >
        <Link
          href="/"
          onClick={() => setViewMode("mes")}
          className={
            viewMode === "mes"
              ? "font-medium text-[var(--ink)] underline underline-offset-4 decoration-[var(--ink)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }
        >
          Vista mes
        </Link>
        <Link
          href="/semanas"
          onClick={() => setViewMode("semana")}
          className={
            viewMode === "semana"
              ? "font-medium text-[var(--ink)] underline underline-offset-4 decoration-[var(--ink)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }
        >
          Vista semana
        </Link>
      </nav>
    </header>
  );
}
