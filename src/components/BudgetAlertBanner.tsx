import type { BudgetAlert } from "@/lib/summaries";

interface BudgetAlertBannerProps {
  alerts: BudgetAlert[];
}

export function BudgetAlertBanner({ alerts }: BudgetAlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-label="Alertas de presupuesto"
    >
      {alerts.map((alert) => {
        const categoryLabel = alert.category.name.toLowerCase();
        const isExceeded = alert.level === "exceeded";
        return (
          <aside
            key={alert.budget.id}
            className={`rounded-xl px-3.5 py-3 ring-1 ${
              isExceeded
                ? "bg-[var(--red-soft)] ring-[color-mix(in_srgb,var(--red)_28%,transparent)]"
                : "bg-[var(--gold-soft)] ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.05em] ${
                isExceeded ? "text-[var(--red)]" : "text-[var(--gold)]"
              }`}
            >
              Presupuesto
            </p>
            <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-[var(--ink)]">
              {isExceeded
                ? `Te pasaste del presupuesto de ‘${categoryLabel}’`
                : `Llevás el ${alert.percentUsed}% del presupuesto de ‘${categoryLabel}’`}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
              {alert.category.icon} {alert.category.name} · tope del mes
            </p>
          </aside>
        );
      })}
    </div>
  );
}
