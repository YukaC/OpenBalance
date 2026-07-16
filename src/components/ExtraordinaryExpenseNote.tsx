import { Money } from "@/components/Money";
import { formatShortDate } from "@/lib/dates";
import type {
  ExtraordinaryExpense,
  HormigaDrainAlert,
} from "@/lib/summaries";

interface ExtraordinaryExpenseNoteProps {
  expense: ExtraordinaryExpense | null;
  hormigaDrain?: HormigaDrainAlert | null;
}

export function ExtraordinaryExpenseNote({
  expense,
  hormigaDrain = null,
}: ExtraordinaryExpenseNoteProps) {
  if (!expense && !hormigaDrain) return null;

  return (
    <div className="flex flex-col gap-3">
      {expense ? (
        <aside
          className="rounded-xl bg-[var(--gold-soft)] px-3.5 py-3 ring-1 ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
          aria-label="Gasto extraordinario del mes"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--gold)]">
            Gasto extraordinario
          </p>
          <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-[var(--ink)]">
            {expense.transaction.title}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
            {expense.category
              ? `${expense.category.icon} ${expense.category.name}`
              : "Sin categoría"}{" "}
            · {formatShortDate(expense.transaction.date)}
          </p>
          <p className="mt-2">
            <Money
              amount={expense.transaction.amount}
              tone="expense"
              className="text-[16px] font-semibold text-[var(--gold)]"
            />
          </p>
        </aside>
      ) : null}

      {hormigaDrain ? (
        <aside
          className="rounded-xl bg-[var(--red-soft)] px-3.5 py-3 ring-1 ring-[color-mix(in_srgb,var(--red)_24%,transparent)]"
          aria-label="Gasto hormiga que drena ingresos"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--red)]">
            Gasto hormiga
          </p>
          <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-[var(--ink)]">
            {hormigaDrain.category.icon} {hormigaDrain.category.name} te está
            drenando
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
            {hormigaDrain.occurrenceCount} veces este mes · más de $100.000
          </p>
          <p className="mt-2">
            <Money
              amount={hormigaDrain.totalAmount}
              tone="expense"
              className="text-[16px] font-semibold text-[var(--red)]"
            />
          </p>
        </aside>
      ) : null}
    </div>
  );
}
