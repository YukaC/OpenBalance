"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Money } from "@/components/Money";
import { projectRecurringIncomeToMonth } from "@/lib/recurring-income";
import { useFinanceStore } from "@/store/finance-store";
import { useToastStore } from "@/store/toast-store";

export function RecurringIncomeProjectionHint() {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const materializeProjectedRecurringIncome = useFinanceStore(
    (s) => s.materializeProjectedRecurringIncome,
  );
  const showToast = useToastStore((s) => s.showToast);
  const [dismissedMonths, setDismissedMonths] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const projected = useMemo(
    () =>
      projectRecurringIncomeToMonth(
        transactions,
        incomeSources,
        selectedMonth,
      ),
    [transactions, incomeSources, selectedMonth],
  );

  if (projected.length === 0 || dismissedMonths.includes(selectedMonth)) {
    return null;
  }

  const totalByCurrency = new Map<"ARS" | "USD", number>();
  for (const item of projected) {
    totalByCurrency.set(
      item.currency,
      (totalByCurrency.get(item.currency) ?? 0) + item.amount,
    );
  }

  const names = projected
    .map((item) => item.title)
    .filter((name, index, list) => list.indexOf(name) === index);

  const titleLabel =
    names.length === 1
      ? `«${names[0]}»`
      : `${projected.length} ingresos recurrentes`;

  return (
    <>
      <section
        className="ledger-panel bg-[var(--gold-soft)] px-4 py-4 text-center"
        aria-label="Proyección de ingreso recurrente"
      >
        <p className="text-[13px] font-semibold text-[var(--ink)]">
          ¿Cargar {titleLabel} este mes?
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
          Hay {projected.length === 1 ? "un ingreso recurrente" : `${projected.length} ingresos recurrentes`}{" "}
          sin cargar en este mes
          {totalByCurrency.size > 0 ? (
            <>
              {" "}
              (
              {[...totalByCurrency.entries()].map(([currency, amount], index) => (
                <span key={currency}>
                  {index > 0 ? " + " : null}
                  <Money amount={amount} currency={currency} />
                </span>
              ))}
              )
            </>
          ) : null}
          . Se crea como movimiento real; podés editarlo o borrarlo después.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            className="min-h-11 rounded-xl bg-[var(--select)] px-4 py-2 text-[13px] font-bold text-[var(--chip-active-text)] transition-soft hover:opacity-90"
          >
            Sí, cargar
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissedMonths((prev) =>
                prev.includes(selectedMonth)
                  ? prev
                  : [...prev, selectedMonth],
              );
            }}
            className="min-h-11 rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--ink-soft)] transition-soft hover:text-[var(--ink)]"
          >
            Ahora no
          </button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Cargar ingreso recurrente"
        message={
          projected.length === 1
            ? `¿Confirmar «${projected[0].title}» por este mes?`
            : `¿Confirmar ${projected.length} ingresos recurrentes por este mes?`
        }
        confirmLabel="Cargar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          const count = materializeProjectedRecurringIncome(selectedMonth);
          setIsConfirmOpen(false);
          if (count > 0) {
            showToast({
              message:
                count === 1
                  ? "Ingreso recurrente cargado"
                  : `${count} ingresos recurrentes cargados`,
            });
          }
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}
