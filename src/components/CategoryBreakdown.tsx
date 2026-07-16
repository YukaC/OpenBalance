import { Money } from "@/components/Money";
import { sanitizeCssColor } from "@/lib/color-utils";
import type { MonthSummary } from "@/lib/summaries";

interface CategoryBreakdownProps {
  summary: MonthSummary;
  limit?: number;
}

/** Warm brand-aligned fallbacks (terracotta / sage / gold / ink). */
const FALLBACK_COLORS = [
  "#5c534f",
  "#2a7d58",
  "#9a4a32",
  "#a86b1a",
  "#5f7d72",
  "#8a7a68",
];

function buildDonutSegments(
  amounts: number[],
  colors: string[],
): Array<{ color: string; dash: string; offset: number }> {
  const total = amounts.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  const circumference = 100;
  let cursor = 25;
  return amounts.map((amount, index) => {
    const portion = (amount / total) * circumference;
    const segment = {
      color: colors[index] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      dash: `${portion} ${circumference - portion}`,
      offset: cursor,
    };
    cursor -= portion;
    return segment;
  });
}

export function CategoryBreakdown({
  summary,
  limit = 4,
}: CategoryBreakdownProps) {
  const rows = summary.byCategory.slice(0, limit);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  if (rows.length === 0) {
    return (
      <section className="py-1" aria-labelledby="cats-heading">
        <h2
          id="cats-heading"
          className="mb-3 font-display text-[15.5px] font-semibold text-[var(--ink)] min-[880px]:mb-4 min-[880px]:text-[16.5px]"
        >
          Gastos por categoría
        </h2>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Todavía no hay gastos este mes.
        </p>
      </section>
    );
  }

  const amounts = rows.map((row) => row.amount);
  const colors = rows.map((row, index) =>
    sanitizeCssColor(
      row.category.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    ),
  );
  const segments = buildDonutSegments(amounts, colors);

  return (
    <section className="py-1" aria-labelledby="cats-heading">
      <h2
        id="cats-heading"
        className="mb-3 font-display text-[15.5px] font-semibold text-[var(--ink)] min-[880px]:mb-4 min-[880px]:text-[16.5px]"
      >
        Gastos por categoría
      </h2>

      <div className="flex items-start gap-4 min-[880px]:items-center min-[880px]:gap-6">
        <svg
          width="96"
          height="96"
          viewBox="0 0 42 42"
          className="hidden h-[120px] w-[120px] shrink-0 min-[880px]:block"
          aria-hidden
        >
          <circle
            cx="21"
            cy="21"
            r="15.9"
            fill="transparent"
            stroke="var(--paper-deep)"
            strokeWidth="7"
          />
          {segments.map((segment) => (
            <circle
              key={`${segment.color}-${segment.offset}`}
              cx="21"
              cy="21"
              r="15.9"
              fill="transparent"
              stroke={segment.color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={segment.dash}
              strokeDashoffset={segment.offset}
            />
          ))}
        </svg>

        <ul className="flex flex-1 flex-col gap-3.5">
          {rows.map(({ category, amount }, index) => {
            const sharePercent =
              totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;
            const barColor =
              colors[index] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];

            return (
              <li key={category.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2.5 text-[var(--ink)]">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_0_2px_color-mix(in_srgb,var(--card)_80%,transparent)]"
                      style={{
                        background: barColor,
                        boxShadow: `0 0 0 2px color-mix(in srgb, ${barColor} 28%, transparent)`,
                      }}
                      aria-hidden
                    />
                    <span className="truncate font-medium">{category.name}</span>
                  </span>
                  <Money
                    amount={amount}
                    className="shrink-0 tabular-nums text-[13px] font-semibold text-[var(--ink)]"
                  />
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,var(--paper-deep))]"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out motion-safe:transition-[width]"
                    style={{
                      width: `${sharePercent}%`,
                      background: `linear-gradient(90deg, ${barColor}, color-mix(in srgb, ${barColor} 72%, white))`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
