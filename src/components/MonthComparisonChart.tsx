"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMonthName, previousMonthKey } from "@/lib/dates";
import {
  formatMoney,
  formatPercentDelta,
  type CurrencyCode,
} from "@/lib/format";
import { getMonthTransactions } from "@/lib/month-index";
import { sumByType } from "@/lib/summaries";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";

interface MonthComparisonChartProps {
  transactions: Transaction[];
  monthKey: string;
}

type MetricKey = "income" | "expense" | "balance";
type DeltaDirection = "up" | "down" | "flat";

interface ComparisonRow {
  key: MetricKey;
  label: string;
  previous: number;
  current: number;
}

function moneyColorClass(key: MetricKey, amount: number): string {
  if (key === "income") return "text-[var(--green)]";
  if (key === "expense") return "text-[var(--red)]";
  return amount >= 0 ? "text-[var(--green)]" : "text-[var(--red)]";
}

/** Semantic Δ: income/balance up=good; expense up=bad. */
function deltaColorClass(key: MetricKey, direction: DeltaDirection): string {
  if (direction === "flat") return "text-[var(--ink-soft)]";
  const isUp = direction === "up";
  if (key === "expense") {
    return isUp ? "text-[var(--red)]" : "text-[var(--green)]";
  }
  return isUp ? "text-[var(--green)]" : "text-[var(--red)]";
}

function deltaArrow(direction: DeltaDirection): string {
  if (direction === "up") return "▲ ";
  if (direction === "down") return "▼ ";
  return "";
}

function compactPercentLabel(label: string): string {
  if (label.includes("%")) return label.split(/\s+/)[0] ?? label;
  return label;
}

/** One-line Δ: `▲ $12.000 (12%)` when previous ≠ 0; else Sin cambio / Nuevo mes. */
function formatDeltaCell(
  current: number,
  previous: number,
  currency: CurrencyCode,
): { text: string; direction: DeltaDirection } {
  const percent = formatPercentDelta(current, previous);
  if (previous === 0 || percent.direction === "flat") {
    return { text: compactPercentLabel(percent.label), direction: percent.direction };
  }
  const absoluteDelta = Math.abs(current - previous);
  return {
    text: `${deltaArrow(percent.direction)}${formatMoney(absoluteDelta, false, currency)} (${compactPercentLabel(percent.label)})`,
    direction: percent.direction,
  };
}

export function MonthComparisonChart({
  transactions,
  monthKey,
}: MonthComparisonChartProps) {
  const currency = useFinanceStore((s) => s.profile.defaultCurrency);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);
  const payCadence = useFinanceStore((s) => s.profile.payCadence);
  const prevKey = previousMonthKey(monthKey);
  const previousLabel = formatMonthName(prevKey);
  const currentLabel = formatMonthName(monthKey);

  // Closed by default (mobile-first); sync open on desktop ≥880px.
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 880px)");
    const syncOpenToViewport = () => setIsOpen(mediaQuery.matches);
    syncOpenToViewport();
    mediaQuery.addEventListener("change", syncOpenToViewport);
    return () => mediaQuery.removeEventListener("change", syncOpenToViewport);
  }, []);

  const { rows, hasComparableData } = useMemo(() => {
    const cadence = payCadence ?? "monthly";
    const currentTx = getMonthTransactions(transactions, monthKey, {
      paydayWeekday,
      currency,
      payCadence: cadence,
    });
    const previousTx = getMonthTransactions(transactions, prevKey, {
      paydayWeekday,
      currency,
      payCadence: cadence,
    });

    const currentIncome = sumByType(currentTx, "ingreso", currency);
    const currentExpense = sumByType(currentTx, "gasto", currency);
    const previousIncome = sumByType(previousTx, "ingreso", currency);
    const previousExpense = sumByType(previousTx, "gasto", currency);

    const nextRows: ComparisonRow[] = [
      {
        key: "income",
        label: "Ingresos",
        previous: previousIncome,
        current: currentIncome,
      },
      {
        key: "expense",
        label: "Gastos",
        previous: previousExpense,
        current: currentExpense,
      },
      {
        key: "balance",
        label: "Balance",
        previous: previousIncome - previousExpense,
        current: currentIncome - currentExpense,
      },
    ];

    const hasData =
      currentIncome !== 0 ||
      currentExpense !== 0 ||
      previousIncome !== 0 ||
      previousExpense !== 0;

    return { rows: nextRows, hasComparableData: hasData };
  }, [transactions, monthKey, prevKey, currency, paydayWeekday, payCadence]);

  if (!hasComparableData) return null;

  return (
    <details
      className="group ledger-panel p-4 min-[880px]:p-5"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="relative flex cursor-pointer list-none items-center justify-center px-8 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 text-center">
          <h2 id="month-compare-heading" className="section-heading">
            Vs mes anterior
          </h2>
          <p className="section-lede">
            {currentLabel} vs {previousLabel}
          </p>
        </div>
        <span
          aria-hidden
          className="absolute right-0 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-faint)] transition-transform duration-200 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--line)] text-[11.5px] font-semibold text-[var(--ink-soft)]">
              <th scope="col" className="pb-2 pr-2 font-semibold">
                Métrica
              </th>
              <th scope="col" className="pb-2 pr-2 text-right font-semibold">
                {previousLabel}
              </th>
              <th scope="col" className="pb-2 pr-2 text-right font-semibold">
                {currentLabel}
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const delta = formatDeltaCell(row.current, row.previous, currency);
              const withSign = row.key === "balance";
              return (
                <tr
                  key={row.key}
                  className="border-b border-[var(--line)] last:border-b-0"
                >
                  <th
                    scope="row"
                    className="py-2.5 pr-2 text-[13px] font-semibold text-[var(--ink)]"
                  >
                    {row.label}
                  </th>
                  <td className="py-2.5 pr-2 text-right font-mono text-[12.5px] tabular-nums text-[var(--ink-soft)]">
                    {formatMoney(row.previous, withSign, currency)}
                  </td>
                  <td
                    className={`py-2.5 pr-2 text-right font-mono text-[13px] font-semibold tabular-nums ${moneyColorClass(row.key, row.current)}`}
                  >
                    {formatMoney(row.current, withSign, currency)}
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono text-[12px] font-semibold tabular-nums ${deltaColorClass(row.key, delta.direction)}`}
                  >
                    {delta.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
