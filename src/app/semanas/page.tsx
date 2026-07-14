"use client";

import { useEffect, useMemo, useState } from "react";
import { Money } from "@/components/Money";
import { MonthNavigator } from "@/components/MonthNavigator";
import { buildMonthSummary } from "@/lib/summaries";
import { useFinanceStore } from "@/store/finance-store";

const REFERENCE_TODAY = new Date("2026-07-16");

export default function SemanasPage() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const openForm = useFinanceStore((s) => s.openForm);
  const setViewMode = useFinanceStore((s) => s.setViewMode);

  const summary = useMemo(
    () =>
      buildMonthSummary(
        transactions,
        categories,
        selectedMonth,
        REFERENCE_TODAY,
      ),
    [transactions, categories, selectedMonth],
  );

  const currentIndex = useMemo(() => {
    const idx = summary.weeks.findIndex((w) => w.isCurrent);
    return idx >= 0 ? idx : 0;
  }, [summary.weeks]);

  const [weekIndex, setWeekIndex] = useState(currentIndex);

  useEffect(() => {
    setViewMode("semana");
  }, [setViewMode]);

  useEffect(() => {
    setWeekIndex(currentIndex);
  }, [selectedMonth, currentIndex]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[13px] text-[var(--ink-muted)]">Cargando…</p>
      </div>
    );
  }

  const week = summary.weeks[weekIndex] ?? summary.weeks[0];
  const canPrev = weekIndex > 0;
  const canNext = weekIndex < summary.weeks.length - 1;
  const emptyIncome = !week || week.income === 0;

  return (
    <div className="space-y-10 pb-8">
      <MonthNavigator />

      {!week ? (
        <p className="text-[13px] text-[var(--ink-muted)]">
          No hay semanas en este mes.
        </p>
      ) : (
        <section className="space-y-8" aria-labelledby="week-focus-heading">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Semana anterior"
              disabled={!canPrev}
              onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
              className="flex h-10 w-10 items-center justify-center text-[22px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-30"
            >
              ‹
            </button>

            <div className="min-w-0 text-center">
              <h2
                id="week-focus-heading"
                className={`font-display text-[24px] ${
                  week.isCurrent ? "text-[var(--income)]" : "text-[var(--ink)]"
                }`}
              >
                {week.label}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
                {week.rangeLabel}
              </p>
            </div>

            <button
              type="button"
              aria-label="Semana siguiente"
              disabled={!canNext}
              onClick={() =>
                setWeekIndex((i) => Math.min(summary.weeks.length - 1, i + 1))
              }
              className="flex h-10 w-10 items-center justify-center text-[22px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-30"
            >
              ›
            </button>
          </div>

          {emptyIncome ? (
            <div className="space-y-5 border-t border-[var(--line)] pt-6 text-center">
              <p className="font-display text-[22px] leading-snug text-[var(--ink)]">
                Todavía no cargaste el ingreso de esta semana
              </p>
              <p className="mx-auto max-w-[28ch] text-[14px] text-[var(--ink-muted)]">
                Sumá lo que cobraste el viernes para ver cuánto te queda
                realmente.
              </p>
              <button
                type="button"
                onClick={() => openForm("ingreso")}
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ink)] px-5 text-[14px] font-medium text-[var(--chip-active-text)] transition-opacity hover:opacity-90"
              >
                Agregar ingreso de esta semana
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6 border-t border-[var(--line)] pt-6">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.05em] text-[var(--ink-muted)]">
                    Ingreso
                  </p>
                  <p className="mt-2 leading-none">
                    <Money
                      amount={week.income}
                      tone="income"
                      className="text-[36px] tracking-[-0.03em]"
                    />
                  </p>
                </div>
                <div>
                  <p className="text-[12px] uppercase tracking-[0.05em] text-[var(--ink-muted)]">
                    Gastado
                  </p>
                  <p className="mt-2 leading-none">
                    <Money
                      amount={week.expense}
                      tone="expense"
                      className="text-[36px] tracking-[-0.03em]"
                    />
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openForm("ingreso")}
                className="flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--line-strong)] bg-[var(--surface)] text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--chip)]"
              >
                Agregar ingreso de esta semana
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
