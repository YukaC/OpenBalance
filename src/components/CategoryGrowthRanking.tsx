import { Money } from "@/components/Money";
import type { CategoryGrowthInsight } from "@/lib/summaries";

interface CategoryGrowthRankingProps {
  ranks: CategoryGrowthInsight[];
}

export function CategoryGrowthRanking({ ranks }: CategoryGrowthRankingProps) {
  if (ranks.length === 0) return null;

  return (
    <section
      className="rounded-xl bg-[var(--card)] px-3.5 py-3 ring-1 ring-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
      aria-labelledby="category-growth-heading"
    >
      <h2
        id="category-growth-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--gold)]"
      >
        Categoría que más creció
      </h2>

      <ol className="mt-2.5 flex flex-col gap-2.5">
        {ranks.map((insight, index) => {
          const growthLabel =
            insight.percentGrowth !== null
              ? `+${insight.percentGrowth}%`
              : "nuevo";

          return (
            <li
              key={insight.category.id}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--ink)]">
                <span
                  className="w-4 shrink-0 text-center text-[11px] font-semibold tabular-nums text-[var(--ink-soft)]"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="shrink-0" aria-hidden>
                  {insight.category.icon}
                </span>
                <span className="truncate font-medium">
                  {insight.category.name}
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-[13px] font-semibold tabular-nums text-[var(--gold)]">
                  {growthLabel}
                </span>
                <span className="text-[11.5px] text-[var(--ink-soft)]">
                  <Money
                    amount={insight.previousAmount}
                    className="text-[11.5px] text-[var(--ink-soft)]"
                  />
                  {" → "}
                  <Money
                    amount={insight.currentAmount}
                    className="text-[11.5px] font-medium text-[var(--ink)]"
                  />
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
