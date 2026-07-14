"use client";

import { useMemo, useState } from "react";
import { MonthNavigator } from "@/components/MonthNavigator";
import { TransactionRow } from "@/components/TransactionRow";
import { filterByMonth } from "@/lib/summaries";
import type { TransactionType } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";

type TypeFilter = "all" | TransactionType;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "ingreso", label: "Ingreso" },
  { value: "gasto", label: "Gasto" },
];

export default function TransaccionesPage() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const openForm = useFinanceStore((s) => s.openForm);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    return filterByMonth(transactions, selectedMonth)
      .filter((tx) => (typeFilter === "all" ? true : tx.type === typeFilter))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [transactions, selectedMonth, typeFilter]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[13px] text-[var(--ink-muted)]">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <MonthNavigator />

      <section className="space-y-4" aria-labelledby="movements-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="movements-heading"
            className="font-display text-[22px] text-[var(--ink)]"
          >
            Movimientos
          </h2>
          <p className="text-[13px] text-[var(--ink-muted)]">
            {filtered.length}{" "}
            {filtered.length === 1 ? "registro" : "registros"}
          </p>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar por tipo"
        >
          {TYPE_FILTERS.map((item) => {
            const active = typeFilter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTypeFilter(item.value)}
                className={`rounded-[var(--radius-full)] px-3.5 py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? "bg-[var(--chip-active)] text-[var(--chip-active-text)]"
                    : "bg-[var(--chip)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="space-y-4 border-t border-[var(--line)] pt-6 text-center">
            <p className="font-display text-[22px] leading-snug text-[var(--ink)]">
              No hay movimientos este mes
            </p>
            <p className="mx-auto max-w-[28ch] text-[14px] text-[var(--ink-muted)]">
              Cargá un ingreso o un gasto para empezar a ver tu ritmo.
            </p>
            <button
              type="button"
              onClick={() => openForm()}
              className="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ink)] px-5 text-[14px] font-medium text-[var(--chip-active-text)] transition-opacity hover:opacity-90"
            >
              Agregar movimiento
            </button>
          </div>
        ) : (
          <div>
            {filtered.map((tx) => {
              const category = categories.find((c) => c.id === tx.categoryId);
              const incomeSource = incomeSources.find(
                (s) => s.id === tx.incomeSourceId,
              );
              return (
                <div key={tx.id} className="flex items-stretch gap-1">
                  <div className="min-w-0 flex-1">
                    <TransactionRow
                      transaction={tx}
                      category={category}
                      incomeSourceName={incomeSource?.name}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar ${tx.title}`}
                    onClick={() => deleteTransaction(tx.id)}
                    className="mt-3.5 flex h-10 w-8 shrink-0 items-center justify-center text-[18px] text-[var(--ink-faint)] transition-colors hover:text-[var(--danger)]"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
