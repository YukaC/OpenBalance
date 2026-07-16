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
            className="insight-panel bg-[var(--gold-soft)] px-3.5 py-3"
          >
            <p className="text-[11px] font-semibold text-[var(--gold)]">
              Alerta de gasto
            </p>
            <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-[var(--ink)]">
              En &lsquo;{categoryLabel}&rsquo; vas {alert.percentIncrease}% arriba
              del mes pasado
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
