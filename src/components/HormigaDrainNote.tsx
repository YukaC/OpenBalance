import { Money } from "@/components/Money";
import { useDefaultCurrency } from "@/lib/currency-context";
import { formatMoney } from "@/lib/format";
import type { HormigaDrainAlert } from "@/lib/summaries";

interface HormigaDrainNoteProps {
  hormigaDrain: HormigaDrainAlert | null;
}

export function HormigaDrainNote({ hormigaDrain }: HormigaDrainNoteProps) {
  const currency = useDefaultCurrency();

  if (!hormigaDrain) return null;

  const formattedThreshold = formatMoney(hormigaDrain.minTotal, false, currency);

  return (
    <aside
      className="insight-panel bg-[var(--red-soft)] px-3.5 py-3 text-center"
      aria-label="Gasto hormiga que drena ingresos"
    >
      <p className="text-[11px] font-semibold text-[var(--red)]">
        Gasto hormiga
      </p>
      <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-[var(--ink)]">
        {hormigaDrain.category.icon} {hormigaDrain.category.name} te está drenando
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
        {hormigaDrain.occurrenceCount} veces este mes · más de {formattedThreshold}
      </p>
      <p className="mt-2">
        <Money
          amount={hormigaDrain.totalAmount}
          tone="expense"
          className="text-[16px] font-semibold text-[var(--red)]"
        />
      </p>
    </aside>
  );
}
