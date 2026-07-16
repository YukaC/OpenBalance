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
            className={`insight-panel px-3.5 py-3 text-center ${
              isExceeded
                ? "bg-[var(--red-soft)]"
                : "bg-[var(--gold-soft)]"
            }`}
          >
            <p
              className={`text-[11px] font-semibold ${
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
