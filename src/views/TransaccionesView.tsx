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

export default function TransaccionesView() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const openForm = useFinanceStore((s) => s.openForm);
  const openFormForEdit = useFinanceStore((s) => s.openFormForEdit);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    return filterByMonth(transactions, selectedMonth)
      .filter((tx) => (typeFilter === "all" ? true : tx.type === typeFilter))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [transactions, selectedMonth, typeFilter]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const incomeSourcesById = useMemo(
    () =>
      new Map(incomeSources.map((incomeSource) => [incomeSource.id, incomeSource])),
    [incomeSources],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[13px] text-[var(--ink-soft)]">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <MonthNavigator />

      <section
        className="space-y-4 rounded-[18px] bg-[var(--card)] p-5 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] min-[880px]:p-6"
        aria-labelledby="movements-heading"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="movements-heading"
            className="font-display text-[17px] font-semibold text-[var(--ink)]"
          >
            Movimientos
          </h2>
          <p className="text-[13px] text-[var(--ink-soft)]">
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
                className={`min-h-10 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-soft focus-visible:outline-none active:scale-[0.98] ${
                  active
                    ? "is-selected-solid"
                    : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="space-y-4 border-t border-[var(--line)] pt-6 text-center">
            <p className="font-display text-[20px] font-semibold leading-snug text-[var(--ink)]">
              No hay movimientos este mes
            </p>
            <p className="mx-auto max-w-[28ch] text-[14px] text-[var(--ink-soft)]">
              Cargá un ingreso o un gasto para empezar a ver tu ritmo.
            </p>
            <button
              type="button"
              onClick={() => openForm()}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--ink)] px-5 text-[14px] font-bold text-[var(--ink-contrast)] transition-soft hover:opacity-90 active:scale-[0.99]"
            >
              Agregar movimiento
            </button>
          </div>
        ) : (
          <div>
            {filtered.map((tx) => {
              const category = tx.categoryId
                ? categoriesById.get(tx.categoryId)
                : undefined;
              const incomeSource = tx.incomeSourceId
                ? incomeSourcesById.get(tx.incomeSourceId)
                : undefined;
              return (
                <div
                  key={tx.id}
                  className="flex items-stretch gap-1"
                  onClick={() => openFormForEdit(tx.id)}
                >
                  <div className="min-w-0 flex-1 cursor-pointer">
                    <TransactionRow
                      transaction={tx}
                      category={category}
                      incomeSourceName={incomeSource?.name}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar ${tx.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (
                        window.confirm(`¿Eliminar «${tx.title}»?`)
                      ) {
                        deleteTransaction(tx.id);
                      }
                    }}
                    className="mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[20px] text-[var(--ink-faint)] transition-soft hover:bg-[var(--red-soft)] hover:text-[var(--red)] focus-visible:outline-none active:scale-95"
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
