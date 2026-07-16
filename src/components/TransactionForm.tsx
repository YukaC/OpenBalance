"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { extractCategoryPattern } from "@/lib/classifier";
import { METHOD_LABELS } from "@/lib/format";
import { detectRecurringIncomeHint } from "@/lib/recurring-income";
import type { PaymentMethod, TransactionType } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";

const METHODS: PaymentMethod[] = [
  "transferencia",
  "efectivo",
  "tarjeta_debito",
  "tarjeta_credito",
];

const REFERENCE_TODAY = new Date("2026-07-16");
const REFERENCE_TODAY_ISO = format(REFERENCE_TODAY, "yyyy-MM-dd");

export function TransactionForm() {
  const formPrefillType = useFinanceStore((s) => s.formPrefillType);
  const editingTransactionId = useFinanceStore((s) => s.editingTransactionId);
  const closeForm = useFinanceStore((s) => s.closeForm);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const accounts = useFinanceStore((s) => s.accounts);
  const defaultAccountId = useFinanceStore((s) => s.profile.defaultAccountId);
  const transactions = useFinanceStore((s) => s.transactions);
  const suggestCategory = useFinanceStore((s) => s.suggestCategory);
  const rememberCategoryCorrection = useFinanceStore(
    (s) => s.rememberCategoryCorrection,
  );
  const updateIncomeSource = useFinanceStore((s) => s.updateIncomeSource);

  const isEditing = Boolean(editingTransactionId);
  const panelRef = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<TransactionType>(formPrefillType);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(REFERENCE_TODAY_ISO);
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [categoryId, setCategoryId] = useState<string>("");
  const [incomeSourceId, setIncomeSourceId] = useState<string>(
    incomeSources[0]?.id ?? "",
  );
  const [accountId, setAccountId] = useState<string>(
    defaultAccountId ?? accounts[0]?.id ?? "",
  );
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [autoSuggested, setAutoSuggested] = useState(false);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(
    null,
  );
  const [hasManualCategoryOverride, setHasManualCategoryOverride] =
    useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isRecurringHintDismissed, setIsRecurringHintDismissed] =
    useState(false);
  const [didMarkRecurring, setDidMarkRecurring] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  useEffect(() => {
    if (editingTransactionId) return;
    setType(formPrefillType);
  }, [formPrefillType, editingTransactionId]);

  useEffect(() => {
    if (editingTransactionId) return;
    setAccountId(defaultAccountId ?? accounts[0]?.id ?? "");
  }, [editingTransactionId, defaultAccountId, accounts]);

  useEffect(() => {
    if (!editingTransactionId) return;
    const {
      transactions: storeTransactions,
      incomeSources: storeIncomeSources,
      accounts: storeAccounts,
      profile,
    } = useFinanceStore.getState();
    const transaction = storeTransactions.find(
      (item) => item.id === editingTransactionId,
    );
    if (!transaction) return;

    setType(transaction.type);
    setAmount(String(transaction.amount));
    setDate(transaction.date);
    setMethod(transaction.method);
    setCategoryId(transaction.categoryId ?? "");
    setIncomeSourceId(
      transaction.incomeSourceId ?? storeIncomeSources[0]?.id ?? "",
    );
    setAccountId(
      transaction.accountId ??
        profile.defaultAccountId ??
        storeAccounts[0]?.id ??
        "",
    );
    setNote(transaction.note);
    setTitle(transaction.title);
    setIsFixed(Boolean(transaction.isFixed));
    setHasManualCategoryOverride(Boolean(transaction.categoryId));
    setAutoSuggested(transaction.isAutoCategorized);
    setSuggestedCategoryId(transaction.categoryId);
  }, [editingTransactionId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panel) return;
      const nodes = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const list = [...nodes].filter((node) => !node.hasAttribute("disabled"));
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (type !== "gasto") {
      setSuggestedCategoryId(null);
      setAutoSuggested(false);
      setHasManualCategoryOverride(false);
      setIsFixed(false);
      return;
    }
    const text = `${title} ${note}`.trim();
    if (!text) {
      setSuggestedCategoryId(null);
      setAutoSuggested(false);
      return;
    }
    const suggestion = suggestCategory(text);
    setSuggestedCategoryId(suggestion.categoryId);
    if (!suggestion.categoryId) {
      setAutoSuggested(false);
      return;
    }
    if (!hasManualCategoryOverride) {
      setCategoryId(suggestion.categoryId);
      setAutoSuggested(suggestion.isAuto);
    }
  }, [note, title, type, suggestCategory, hasManualCategoryOverride]);

  useEffect(() => {
    setIsRecurringHintDismissed(false);
    setDidMarkRecurring(false);
  }, [incomeSourceId, amount, date]);

  function requestClose() {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => {
      closeForm();
    }, 150);
  }

  const amountNumber = Number(amount.replace(",", "."));
  const recurringSuggestion = useMemo(() => {
    if (type !== "ingreso") return null;
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return null;
    return detectRecurringIncomeHint(
      transactions,
      incomeSources,
      incomeSourceId || null,
      amountNumber,
      date,
      { referenceDate: REFERENCE_TODAY },
    );
  }, [
    type,
    amountNumber,
    transactions,
    incomeSources,
    incomeSourceId,
    date,
  ]);

  const showRecurringHint =
    Boolean(recurringSuggestion) &&
    !isRecurringHintDismissed &&
    !didMarkRecurring;

  function handleMarkRecurring() {
    if (!recurringSuggestion) return;
    updateIncomeSource(recurringSuggestion.incomeSourceId, {
      isRecurring: true,
    });
    setDidMarkRecurring(true);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return;

    const resolvedTitle =
      title.trim() ||
      (type === "ingreso"
        ? incomeSources.find((s) => s.id === incomeSourceId)?.name ?? "Ingreso"
        : categories.find((c) => c.id === categoryId)?.name ?? "Gasto");

    if (
      type === "gasto" &&
      categoryId &&
      suggestedCategoryId &&
      categoryId !== suggestedCategoryId
    ) {
      const pattern = extractCategoryPattern(title, note);
      if (pattern) {
        rememberCategoryCorrection(pattern, categoryId);
      }
    }

    const payload = {
      type,
      amount: Math.round(amountNumber),
      date,
      method,
      categoryId: type === "gasto" ? categoryId || null : null,
      incomeSourceId: type === "ingreso" ? incomeSourceId || null : null,
      accountId: accountId || null,
      note: note.trim(),
      title: resolvedTitle,
      isFixed: type === "gasto" ? isFixed : false,
    };

    if (editingTransactionId) {
      updateTransaction(editingTransactionId, {
        ...payload,
        isAutoCategorized:
          type === "gasto" &&
          Boolean(categoryId) &&
          categoryId === suggestedCategoryId &&
          autoSuggested,
      });
    } else {
      addTransaction(payload);
    }
    requestClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 min-[880px]:items-center min-[880px]:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-form-title"
    >
      <button
        type="button"
        className={`modal-backdrop absolute inset-0 bg-[rgba(31,29,32,0.42)] dark:bg-[rgba(0,0,0,0.55)] ${
          isLeaving ? "is-leaving" : ""
        }`}
        aria-label="Cerrar"
        onClick={requestClose}
      />

      <div
        ref={panelRef}
        className={`modal-panel mobile-bottom-sheet relative z-10 max-h-[92dvh] w-full max-w-[420px] overflow-y-auto rounded-t-[20px] bg-[var(--card)] p-5 shadow-[var(--shadow-sheet)] min-[880px]:rounded-[20px] min-[880px]:p-6 ${
          isLeaving ? "is-leaving" : ""
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="tx-form-title"
            className="font-display text-[20px] font-semibold text-[var(--ink)]"
          >
            {isEditing ? "Editar movimiento" : "Nueva transacción"}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            className="mt-0.5 min-h-10 rounded-lg px-2 text-[13px] font-semibold text-[var(--ink-soft)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] focus-visible:outline-none"
          >
            Cerrar
          </button>
        </div>

        <div className="mb-5 flex rounded-xl bg-[var(--bg)] p-1">
          <button
            type="button"
            onClick={() => setType("ingreso")}
            className={`min-h-11 flex-1 rounded-[10px] px-3 py-2.5 text-[13.5px] font-bold transition-soft focus-visible:outline-none active:scale-[0.98] ${
              type === "ingreso"
                ? "bg-[var(--green)] text-[#ffffff] shadow-sm"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            ↓ Ingreso
          </button>
          <button
            type="button"
            onClick={() => setType("gasto")}
            className={`min-h-11 flex-1 rounded-[10px] px-3 py-2.5 text-[13.5px] font-bold transition-soft focus-visible:outline-none active:scale-[0.98] ${
              type === "gasto"
                ? "bg-[var(--red)] text-[#ffffff] shadow-sm"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            ↑ Gasto
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <label htmlFor="tx-amount" className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Monto
            </span>
            <input
              id="tx-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="$ 0"
              required
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[22px] font-semibold text-[var(--ink)] outline-none transition-soft placeholder:text-[var(--ink-faint)] focus:border-[var(--select)]"
            />
          </label>

          <label htmlFor="tx-title" className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Título
            </span>
            <input
              id="tx-title"
              name="title"
              autoComplete="off"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "ingreso" ? "Ej. Changa viernes" : "Ej. Supermercado"
              }
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--ink)]"
            />
          </label>

          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <label htmlFor="tx-date" className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Fecha
              </span>
              <input
                id="tx-date"
                name="date"
                type="date"
                autoComplete="off"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--ink)]"
              />
            </label>

            <label htmlFor="tx-method" className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Método
              </span>
              <select
                id="tx-method"
                name="method"
                autoComplete="off"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--ink)]"
              >
                {METHODS.map((item) => (
                  <option key={item} value={item}>
                    {METHOD_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {accounts.length > 0 ? (
            <label htmlFor="tx-account" className="mb-3.5 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Cuenta
              </span>
              <select
                id="tx-account"
                name="accountId"
                autoComplete="off"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--ink)]"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {type === "ingreso" ? (
            <label htmlFor="tx-income-source" className="mb-3.5 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Fuente / Categoría
              </span>
              <select
                id="tx-income-source"
                name="incomeSourceId"
                autoComplete="off"
                value={incomeSourceId}
                onChange={(e) => setIncomeSourceId(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--ink)]"
              >
                {incomeSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label htmlFor="tx-category" className="mb-3.5 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Fuente / Categoría
                {autoSuggested ? (
                  <span className="ml-2 font-normal text-[var(--gold)]">
                    · sugerida
                  </span>
                ) : null}
              </span>
              <select
                id="tx-category"
                name="categoryId"
                autoComplete="off"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setHasManualCategoryOverride(true);
                  setAutoSuggested(false);
                }}
                required
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--ink)]"
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

          {type === "gasto" ? (
            <label
              htmlFor="tx-is-fixed"
              className="mb-3.5 flex cursor-pointer items-start gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5"
            >
              <input
                id="tx-is-fixed"
                name="isFixed"
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--ink)]"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-[var(--ink)]">
                  Gasto fijo (se repite cada mes)
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--ink-soft)]">
                  El resumen lo diferencia de los gastos variables.
                </span>
              </span>
            </label>
          ) : null}

          {showRecurringHint && recurringSuggestion ? (
            <div className="mb-3.5 -mt-1.5 rounded-lg bg-[var(--gold-soft)] px-2.5 py-2 text-[11.5px] text-[var(--gold)]">
              <p>
                Cargaste esto varios {recurringSuggestion.weekdayLabel}s
                seguidos — ¿lo marco como ingreso recurrente?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleMarkRecurring}
                  className="rounded-lg bg-[var(--ink)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-contrast)] transition-opacity hover:opacity-90"
                >
                  Sí, marcar
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecurringHintDismissed(true)}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
                >
                  Ahora no
                </button>
              </div>
            </div>
          ) : null}

          {didMarkRecurring ? (
            <p className="mb-3.5 -mt-1.5 rounded-lg bg-[var(--green-soft)] px-2.5 py-1.5 text-[11.5px] text-[var(--green)]">
              Fuente marcada como recurrente.
            </p>
          ) : null}

          <label htmlFor="tx-note" className="mb-3.5 flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Nota (opcional)
            </span>
            <input
              id="tx-note"
              name="note"
              autoComplete="off"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: transferencia de Juan"
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus:border-[var(--ink)]"
            />
          </label>

          <button
            type="submit"
            className="mt-2 min-h-12 w-full rounded-xl bg-[var(--ink)] py-3.5 text-[14.5px] font-bold text-[var(--ink-contrast)] transition-soft hover:opacity-90 hover:shadow-[var(--shadow-sheet)] focus-visible:outline-none active:scale-[0.99]"
          >
            {isEditing
              ? "Guardar"
              : type === "ingreso"
                ? "Guardar ingreso"
                : "Guardar gasto"}
          </button>
        </form>
      </div>
    </div>
  );
}
