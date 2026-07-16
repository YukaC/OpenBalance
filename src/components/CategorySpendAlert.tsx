import type { CategorySpendAlert as CategorySpendAlertItem } from "@/lib/summaries";

interface CategorySpendAlertProps {
  alerts: CategorySpendAlertItem[];
}

export function CategorySpendAlert({ alerts }: CategorySpendAlertProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-label="Alertas de gasto por categoría"
    >
      {alerts.map((alert) => {
        const categoryLabel = alert.category.name.toLowerCase();
        return (
          <aside
            key={alert.category.id}
            className="rounded-xl bg-[var(--gold-soft)] px-3.5 py-3 ring-1 ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--gold)]">
              Alerta de gasto
            </p>
            <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-[var(--ink)]">
              Vas {alert.percentIncrease}% arriba de lo que gastás normalmente en
              &lsquo;{categoryLabel}&rsquo;
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
              {alert.category.icon} {alert.category.name} · vs. mes anterior
            </p>
          </aside>
        );
      })}
    </div>
  );
}
