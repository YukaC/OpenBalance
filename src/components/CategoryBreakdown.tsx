import { Money } from "@/components/Money";
import type { MonthSummary } from "@/lib/summaries";

interface CategoryBreakdownProps {
  summary: MonthSummary;
  limit?: number;
}

export function CategoryBreakdown({
  summary,
  limit = 5,
}: CategoryBreakdownProps) {
  const rows = summary.byCategory.slice(0, limit);

  if (rows.length === 0) {
    return (
      <section className="space-y-3" aria-labelledby="cats-heading">
        <h2
          id="cats-heading"
          className="font-display text-[22px] text-[var(--ink)]"
        >
          Gastos por categoría
        </h2>
        <p className="text-[13px] text-[var(--ink-muted)]">
          Todavía no hay gastos este mes.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="cats-heading">
      <h2
        id="cats-heading"
        className="font-display text-[22px] text-[var(--ink)]"
      >
        Gastos por categoría
      </h2>

      <ul className="space-y-2">
        {rows.map(({ category, amount }) => (
          <li
            key={category.id}
            className="flex items-baseline justify-between gap-3 text-[14px]"
          >
            <span className="truncate text-[var(--ink)]">
              <span className="mr-1.5 opacity-70" aria-hidden>
                {category.icon}
              </span>
              {category.name}
            </span>
            <Money
              amount={amount}
              className="shrink-0 text-[14px] text-[var(--ink)]"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
