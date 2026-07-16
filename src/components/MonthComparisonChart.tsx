"use client";

import { useMemo } from "react";
import { formatMonthName, previousMonthKey } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { filterByMonth, sumByType } from "@/lib/summaries";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";

interface MonthComparisonChartProps {
  transactions: Transaction[];
  monthKey: string;
}

interface ChartMetric {
  key: "income" | "expense" | "balance";
  label: string;
  previous: number;
  current: number;
  previousColor: string;
  currentColor: string;
}

export function MonthComparisonChart({
  transactions,
  monthKey,
}: MonthComparisonChartProps) {
  const currency = useFinanceStore((s) => s.profile.defaultCurrency);
  const prevKey = previousMonthKey(monthKey);

  const metrics = useMemo((): ChartMetric[] => {
    const currentTx = filterByMonth(transactions, monthKey);
    const previousTx = filterByMonth(transactions, prevKey);

    const currentIncome = sumByType(currentTx, "ingreso");
    const currentExpense = sumByType(currentTx, "gasto");
    const previousIncome = sumByType(previousTx, "ingreso");
    const previousExpense = sumByType(previousTx, "gasto");

    return [
      {
        key: "income",
        label: "Ingresos",
        previous: previousIncome,
        current: currentIncome,
        previousColor: "color-mix(in srgb, var(--green) 45%, var(--line))",
        currentColor: "var(--green)",
      },
      {
        key: "expense",
        label: "Gastos",
        previous: previousExpense,
        current: currentExpense,
        previousColor: "color-mix(in srgb, var(--red) 45%, var(--line))",
        currentColor: "var(--red)",
      },
      {
        key: "balance",
        label: "Balance",
        previous: previousIncome - previousExpense,
        current: currentIncome - currentExpense,
        previousColor: "color-mix(in srgb, var(--ink) 35%, var(--line))",
        currentColor: "var(--ink)",
      },
    ];
  }, [transactions, monthKey, prevKey]);

  const maxAbs = Math.max(
    ...metrics.flatMap((metric) => [
      Math.abs(metric.previous),
      Math.abs(metric.current),
    ]),
    1,
  );

  const chartHeight = 120;
  const barWidth = 18;
  const groupGap = 52;
  const pairGap = 6;
  const leftPad = 8;
  const topPad = 8;
  const bottomPad = 28;
  const svgWidth = leftPad * 2 + metrics.length * groupGap;
  const svgHeight = topPad + chartHeight + bottomPad;
  const zeroY = topPad + chartHeight;

  const previousLabel = formatMonthName(prevKey);
  const currentLabel = formatMonthName(monthKey);

  return (
    <section
      className="card-surface rounded-[16px] px-4 py-4 min-[880px]:rounded-[18px] min-[880px]:px-5 min-[880px]:py-5"
      aria-labelledby="month-compare-heading"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="month-compare-heading"
            className="font-display text-[16px] font-semibold text-[var(--ink)] min-[880px]:text-[17px]"
          >
            Comparativa mensual
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
            {previousLabel} vs {currentLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11.5px] font-semibold text-[var(--ink-soft)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{
                background:
                  "color-mix(in srgb, var(--ink) 35%, var(--line))",
              }}
              aria-hidden
            />
            {previousLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--ink)]"
              aria-hidden
            />
            {currentLabel}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="mx-auto h-auto w-full max-w-[320px]"
        role="img"
        aria-label={`Comparativa de ingresos, gastos y balance entre ${previousLabel} y ${currentLabel}`}
      >
        <line
          x1={leftPad}
          x2={svgWidth - leftPad}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--line)"
          strokeWidth="1"
        />

        {metrics.map((metric, index) => {
          const groupX = leftPad + index * groupGap + groupGap / 2;
          const prevHeight =
            (Math.abs(metric.previous) / maxAbs) * (chartHeight * 0.92);
          const currHeight =
            (Math.abs(metric.current) / maxAbs) * (chartHeight * 0.92);
          const prevX = groupX - barWidth - pairGap / 2;
          const currX = groupX + pairGap / 2;
          const prevY =
            metric.previous >= 0 ? zeroY - prevHeight : zeroY;
          const currY =
            metric.current >= 0 ? zeroY - currHeight : zeroY;

          return (
            <g key={metric.key}>
              <rect
                x={prevX}
                y={prevY}
                width={barWidth}
                height={Math.max(prevHeight, metric.previous === 0 ? 0 : 2)}
                rx="4"
                fill={metric.previousColor}
              >
                <title>
                  {metric.label} {previousLabel}:{" "}
                  {formatMoney(metric.previous, true, currency)}
                </title>
              </rect>
              <rect
                x={currX}
                y={currY}
                width={barWidth}
                height={Math.max(currHeight, metric.current === 0 ? 0 : 2)}
                rx="4"
                fill={metric.currentColor}
              >
                <title>
                  {metric.label} {currentLabel}:{" "}
                  {formatMoney(metric.current, true, currency)}
                </title>
              </rect>
              <text
                x={groupX}
                y={svgHeight - 8}
                textAnchor="middle"
                fill="var(--ink-soft)"
                style={{ fontSize: "10px", fontWeight: 600 }}
              >
                {metric.label}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3">
        {metrics.map((metric) => (
          <li key={metric.key} className="min-w-0 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-soft)]">
              {metric.label}
            </p>
            <p className="mt-1 truncate font-mono text-[12px] tabular-nums text-[var(--ink-soft)]">
              {formatMoney(metric.previous, false, currency)}
            </p>
            <p
              className={`truncate font-mono text-[13px] font-semibold tabular-nums ${
                metric.key === "income"
                  ? "text-[var(--green)]"
                  : metric.key === "expense"
                    ? "text-[var(--red)]"
                    : "text-[var(--ink)]"
              }`}
            >
              {formatMoney(metric.current, false, currency)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
