"use client";

import { useEffect, useState } from "react";
import { todayIso } from "@/lib/dates";
import { METHOD_LABELS } from "@/lib/format";
import { detectRecurringIncomeHint } from "@/lib/summaries";
import type { PaymentMethod, TransactionType } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";

const METHODS: PaymentMethod[] = [
  "transferencia",
  "efectivo",
  "tarjeta_debito",
  "tarjeta_credito",
];

export function TransactionForm() {
  const formPrefillType = useFinanceStore((s) => s.formPrefillType);
  const closeForm = useFinanceStore((s) => s.closeForm);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const transactions = useFinanceStore((s) => s.transactions);
  const suggestCategory = useFinanceStore((s) => s.suggestCategory);

  const [type, setType] = useState<TransactionType>(formPrefillType);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [categoryId, setCategoryId] = useState<string>("");
  const [incomeSourceId, setIncomeSourceId] = useState<string>(
    incomeSources[0]?.id ?? "",
  );
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [autoSuggested, setAutoSuggested] = useState(false);

  useEffect(() => {
    setType(formPrefillType);
  }, [formPrefillType]);

  useEffect(() => {
    if (type !== "gasto") return;
    const text = `${title} ${note}`.trim();
    if (!text) return;
    const suggestion = suggestCategory(text);
    if (suggestion.categoryId) {
      setCategoryId(suggestion.categoryId);
      setAutoSuggested(suggestion.isAuto);
    }
  }, [note, title, type, suggestCategory]);

  const amountNumber = Number(amount.replace(",", "."));
  const showRecurringHint =
    type === "ingreso" &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    detectRecurringIncomeHint(
      transactions,
      incomeSourceId || null,
      amountNumber,
    );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return;

    const resolvedTitle =
      title.trim() ||
      (type === "ingreso"
        ? incomeSources.find((s) => s.id === incomeSourceId)?.name ?? "Ingreso"
        : categories.find((c) => c.id === categoryId)?.name ?? "Gasto");

    addTransaction({
      type,
      amount: Math.round(amountNumber),
      date,
      method,
      categoryId: type === "gasto" ? categoryId || null : null,
      incomeSourceId: type === "ingreso" ? incomeSourceId || null : null,
      note: note.trim(),
      title: resolvedTitle,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-form-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(20,20,20,0.28)]"
        aria-label="Cerrar"
        onClick={closeForm}
      />

      <div className="relative z-10 max-h-[92dvh] w-full max-w-[var(--shell-max)] overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--surface)] px-5 pb-8 pt-4 shadow-[var(--shadow-sheet)] sm:mx-4 sm:rounded-[var(--radius-lg)] sm:pb-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line-strong)] sm:hidden" />

        <div className="mb-5 flex items-start justify-between gap-3">
          <h2
            id="tx-form-title"
            className="font-display text-[1.65rem] tracking-[-0.02em] text-[var(--ink)]"
          >
            Nueva transacción
          </h2>
          <button
            type="button"
            onClick={closeForm}
            className="mt-1 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Cerrar
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-[var(--radius-md)] bg-[var(--chip)] p-1">
          <button
            type="button"
            onClick={() => setType("ingreso")}
            className={`rounded-[var(--radius-sm)] px-3 py-2.5 text-[13.5px] transition-colors ${
              type === "ingreso"
                ? "bg-[var(--surface)] font-medium text-[var(--income)] shadow-sm"
                : "text-[var(--ink-muted)]"
            }`}
          >
            ↓ Ingreso
          </button>
          <button
            type="button"
            onClick={() => setType("gasto")}
            className={`rounded-[var(--radius-sm)] px-3 py-2.5 text-[13.5px] transition-colors ${
              type === "gasto"
                ? "bg-[var(--surface)] font-medium text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-muted)]"
            }`}
          >
            ↑ Gasto
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Monto
            </span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              className="w-full border-b border-[var(--line-strong)] bg-transparent py-2 font-mono text-[2rem] tracking-tight text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--ink)]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Título
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "ingreso" ? "Ej. Changa viernes" : "Ej. Supermercado"
              }
              className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Fecha
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Método
            </legend>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((item) => {
                const active = method === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMethod(item)}
                    className={`rounded-[var(--radius-full)] px-3 py-1.5 text-[12.5px] transition-colors ${
                      active
                        ? "bg-[var(--chip-active)] text-[var(--chip-active-text)]"
                        : "bg-[var(--chip)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {METHOD_LABELS[item]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {type === "ingreso" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                Fuente
              </span>
              <select
                value={incomeSourceId}
                onChange={(e) => setIncomeSourceId(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              >
                {incomeSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                Categoría
                {autoSuggested ? (
                  <span className="ml-2 normal-case tracking-normal text-[var(--ink-muted)]">
                    · sugerida
                  </span>
                ) : null}
              </span>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setAutoSuggested(false);
                }}
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              >
                <option value="">Elegir categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Nota
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Opcional"
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            />
          </label>

          {showRecurringHint ? (
            <p className="rounded-[var(--radius-md)] bg-[var(--income-soft)] px-3 py-2.5 text-[13px] text-[var(--income)]">
              Parece un ingreso recurrente (mismo monto / viernes). Podés
              marcarlo como fijo más adelante.
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-1 w-full rounded-[var(--radius-md)] bg-[var(--ink)] py-3.5 text-[14.5px] font-medium text-[var(--chip-active-text)] transition-opacity hover:opacity-90 active:opacity-80"
          >
            {type === "ingreso" ? "Guardar ingreso" : "Guardar gasto"}
          </button>
        </form>
      </div>
    </div>
  );
}
