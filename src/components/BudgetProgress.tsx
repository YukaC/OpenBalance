import { Money } from "@/components/Money";
import { sanitizeCssColor } from "@/lib/color-utils";
import type { BudgetProgressRow } from "@/lib/summaries";

interface BudgetProgressProps {
  rows: BudgetProgressRow[];
  currency: "ARS" | "USD";
}

function progressBarTone(level: BudgetProgressRow["level"]): string {
  if (level === "exceeded") return "var(--red)";
  if (level === "warning") return "var(--gold)";
  return "var(--green)";
}

export function BudgetProgress({ rows, currency }: BudgetProgressProps) {
  if (rows.length === 0) return null;

  const showWeekBreakdown = rows.some(
    (row) => row.periodMode === "payWeeks" && row.weeks.length > 0,
  );

  return (
    <section
      className="ledger-panel p-4 min-[880px]:p-5"
      aria-labelledby="budget-progress-heading"
    >
      <div className="section-intro mb-3">
        <h2 id="budget-progress-heading" className="section-heading">
          Presupuestos
        </h2>
        <p className="section-lede">
          {showWeekBreakdown
            ? "Tope del mes y cuánto va en cada semana de cobro"
            : "Progreso del mes calendario"}
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {rows.map((row) => {
          const barTone = progressBarTone(row.level);
          const barColor = sanitizeCssColor(row.category.color, barTone);
          const clampedPercent = Math.min(100, Math.max(0, row.percentUsed));
          const weekCount = row.weeks.length;

          return (
            <li key={row.budget.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[13.5px] font-semibold text-[var(--ink)]">
                  <span aria-hidden>{row.category.icon} </span>
                  {row.category.name}
                </p>
                <p className="shrink-0 text-[12.5px] font-semibold tabular-nums text-[var(--ink)]">
                  <Money amount={row.spent} currency={currency} />
                  {" / "}
                  <Money amount={row.amountLimit} currency={currency} />
                </p>
              </div>

              <div
                className="h-2 overflow-hidden rounded-full bg-[var(--bg)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clampedPercent}
                aria-label={`Presupuesto de ${row.category.name}`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `${clampedPercent}%`,
                    background: `linear-gradient(90deg, ${barColor}, color-mix(in srgb, ${barColor} 70%, white))`,
                  }}
                />
              </div>

              <p
                className={`text-[11.5px] ${
                  row.level === "exceeded"
                    ? "font-semibold text-[var(--red)]"
                    : row.level === "warning"
                      ? "font-semibold text-[var(--gold)]"
                      : "text-[var(--ink-faint)]"
                }`}
              >
                {row.level === "exceeded"
                  ? `Te pasaste · ${row.percentUsed}% del tope`
                  : row.level === "warning"
                    ? `${row.percentUsed}% del tope — cerca del límite`
                    : `${row.percentUsed}% del tope`}
              </p>

              {row.periodMode === "payWeeks" && weekCount > 0 ? (
                <ul
                  className={`mt-0.5 grid gap-1.5 ${
                    weekCount <= 4
                      ? "grid-cols-2 min-[880px]:grid-cols-4"
                      : weekCount === 5
                        ? "grid-cols-2 min-[880px]:grid-cols-5"
                        : "grid-cols-3 min-[880px]:grid-cols-6"
                  }`}
                  aria-label={`Desglose semanal de ${row.category.name}`}
                >
                  {row.weeks.map((week) => (
                    <li
                      key={week.weekIso}
                      className="rounded-lg bg-[var(--bg)] px-2 py-1.5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                        S{week.index}
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-[var(--ink-soft)]">
                        {week.spent > 0 ? (
                          <Money amount={week.spent} currency={currency} />
                        ) : (
                          "—"
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
