"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractCategoryPattern } from "@/lib/classifier";
import { getAppToday, inferFixedPayWeekIndex, todayIso } from "@/lib/dates";
import { FOCUS_RING } from "@/lib/focus-ring";
import { METHOD_LABELS, formatMoney, parseMoneyInput, roundAmountForCurrency } from "@/lib/format";
import { isActive } from "@/lib/entity-lifecycle";
import { detectRecurringIncomeHint } from "@/lib/recurring-income";
import type { PaymentMethod, TransactionType } from "@/lib/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { hapticSuccess } from "@/lib/native-haptics";
import { useFinanceStore } from "@/store/finance-store";
import { useToastStore } from "@/store/toast-store";

const METHODS: PaymentMethod[] = [
  "transferencia",
  "efectivo",
  "tarjeta_debito",
  "tarjeta_credito",
  "otro",
];

const INSTALLMENT_COUNT_OPTIONS = [1, 2, 3, 4, 6, 9, 12] as const;

export function TransactionForm() {
  const formPrefillType = useFinanceStore((s) => s.formPrefillType);
  const formPrefillDate = useFinanceStore((s) => s.formPrefillDate);
  const editingTransactionId = useFinanceStore((s) => s.editingTransactionId);
  const closeForm = useFinanceStore((s) => s.closeForm);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const accounts = useFinanceStore((s) => s.accounts);
  const defaultAccountId = useFinanceStore((s) => s.profile.defaultAccountId);
  const defaultCurrency = useFinanceStore((s) => s.profile.defaultCurrency);
  const transactions = useFinanceStore((s) => s.transactions);
  const suggestCategory = useFinanceStore((s) => s.suggestCategory);
  const rememberCategoryCorrection = useFinanceStore(
    (s) => s.rememberCategoryCorrection,
  );
  const updateIncomeSource = useFinanceStore((s) => s.updateIncomeSource);

  const activeCategories = useMemo(
    () => categories.filter(isActive),
    [categories],
  );
  const activeIncomeSources = useMemo(
    () => incomeSources.filter(isActive),
    [incomeSources],
  );
  const activeAccounts = useMemo(
    () => accounts.filter(isActive),
    [accounts],
  );
  const showToast = useToastStore((s) => s.showToast);

  const isEditing = Boolean(editingTransactionId);
  const panelRef = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<TransactionType>(formPrefillType);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const [date, setDate] = useState(formPrefillDate ?? todayIso);
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [categoryId, setCategoryId] = useState<string>("");
  const [incomeSourceId, setIncomeSourceId] = useState<string>(
    activeIncomeSources[0]?.id ?? "",
  );
  const [accountId, setAccountId] = useState<string>(
    defaultAccountId ?? activeAccounts[0]?.id ?? "",
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
  const isSubmittingRef = useRef(false);
  const [isRecurringHintDismissed, setIsRecurringHintDismissed] =
    useState(false);
  const [didMarkRecurring, setDidMarkRecurring] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [fixedPayWeekIndex, setFixedPayWeekIndex] = useState<1 | 4>(1);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [editingInstallmentLabel, setEditingInstallmentLabel] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (editingTransactionId) return;
    setType(formPrefillType);
  }, [formPrefillType, editingTransactionId]);

  useEffect(() => {
    if (editingTransactionId) return;
    setAccountId(defaultAccountId ?? activeAccounts[0]?.id ?? "");
  }, [editingTransactionId, defaultAccountId, activeAccounts]);

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
      transaction.incomeSourceId ??
        storeIncomeSources.find(isActive)?.id ??
        "",
    );
    setAccountId(
      transaction.accountId ??
        profile.defaultAccountId ??
        storeAccounts.find(isActive)?.id ??
        "",
    );
    setNote(transaction.note);
    setTitle(transaction.title);
    setIsFixed(Boolean(transaction.isFixed));
    setFixedPayWeekIndex(
      transaction.fixedPayWeekIndex === 4 ? 4 : 1,
    );
    setInstallmentCount(1);
    setEditingInstallmentLabel(
      transaction.installmentCount &&
        transaction.installmentCount > 1 &&
        transaction.installmentIndex
        ? `Cuota ${transaction.installmentIndex} de ${transaction.installmentCount}`
        : null,
    );
    setHasManualCategoryOverride(Boolean(transaction.categoryId));
    setAutoSuggested(transaction.isAutoCategorized);
    setSuggestedCategoryId(transaction.categoryId);
  }, [editingTransactionId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function requestClose() {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => {
      closeForm();
    }, 150);
  }

  useFocusTrap({
    containerRef: panelRef,
    isActive: true,
    onEscape: requestClose,
    fallbackFocusSelector: ".fab-button",
  });

  useEffect(() => {
    if (type !== "gasto") {
      setSuggestedCategoryId(null);
      setAutoSuggested(false);
      setHasManualCategoryOverride(false);
      setIsFixed(false);
      setFixedPayWeekIndex(1);
      setInstallmentCount(1);
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

  const amountNumber = parseMoneyInput(amount);
  const recurringSuggestion = useMemo(() => {
    if (type !== "ingreso") return null;
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return null;
    return detectRecurringIncomeHint(
      transactions.filter(isActive),
      activeIncomeSources,
      incomeSourceId || null,
      amountNumber,
      date,
      { referenceDate: getAppToday() },
    );
  }, [
    type,
    amountNumber,
    transactions,
    activeIncomeSources,
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

  const selectedAccount = activeAccounts.find(
    (account) => account.id === accountId,
  );
  const showAccountCurrencyHelper =
    activeAccounts.length > 1 ||
    selectedAccount?.currency !== defaultCurrency;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLeaving || isSubmittingRef.current) return;

    const isAmountInvalid = !Number.isFinite(amountNumber) || amountNumber <= 0;
    const isDateInvalid = !date.trim();
    const isCategoryInvalid = type === "gasto" && !categoryId;

    setAmountError(isAmountInvalid);
    setDateError(isDateInvalid);
    setCategoryError(isCategoryInvalid);

    if (isAmountInvalid || isDateInvalid || isCategoryInvalid) return;

    isSubmittingRef.current = true;

    const resolvedTitle =
      title.trim() ||
      (type === "ingreso"
        ? activeIncomeSources.find((s) => s.id === incomeSourceId)?.name ??
          "Ingreso"
        : activeCategories.find((c) => c.id === categoryId)?.name ?? "Gasto");

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
      amount: roundAmountForCurrency(amountNumber, defaultCurrency),
      date,
      method,
      categoryId: type === "gasto" ? categoryId || null : null,
      incomeSourceId: type === "ingreso" ? incomeSourceId || null : null,
      accountId: accountId || null,
      note: note.trim(),
      title: resolvedTitle,
      isFixed: type === "gasto" ? isFixed : false,
      fixedPayWeekIndex:
        type === "gasto" && isFixed ? fixedPayWeekIndex : undefined,
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
      addTransaction({
        ...payload,
        installmentCount:
          type === "gasto" &&
          method === "tarjeta_credito" &&
          !isFixed
            ? installmentCount
            : 1,
      });
    }
    showToast({ message: "Movimiento guardado", durationMs: 2500 });
    void hapticSuccess();
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
        className={`modal-panel mobile-bottom-sheet relative z-10 max-h-[92dvh] w-full max-w-[420px] overflow-y-auto rounded-t-[20px] bg-[var(--card)] p-5 shadow-[var(--shadow-sheet)] min-[880px]:max-h-[min(85dvh,720px)] min-[880px]:rounded-[20px] min-[880px]:p-5 ${
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
            className={`mt-0.5 min-h-10 rounded-lg px-2 text-[13px] font-semibold text-[var(--ink-soft)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] ${FOCUS_RING}`}
          >
            Cerrar
          </button>
        </div>

        <div className="mb-5 flex rounded-xl bg-[var(--bg)] p-1">
          <button
            type="button"
            onClick={() => setType("ingreso")}
            className={`min-h-11 flex-1 rounded-[var(--radius-md)] px-3 py-2.5 text-[13.5px] font-bold transition-soft ${FOCUS_RING} active:scale-[0.98] ${
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
            className={`min-h-11 flex-1 rounded-[var(--radius-md)] px-3 py-2.5 text-[13.5px] font-bold transition-soft ${FOCUS_RING} active:scale-[0.98] ${
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
              {type === "gasto" &&
              method === "tarjeta_credito" &&
              !isFixed &&
              installmentCount > 1 &&
              !isEditing
                ? "Monto total"
                : "Monto"}
            </span>
            <input
              id="tx-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError(false);
              }}
              placeholder="Ej. 270.000"
              aria-invalid={amountError || undefined}
              aria-describedby={amountError ? "tx-amount-error" : undefined}
              className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 font-mono text-[22px] font-semibold text-[var(--ink)] outline-none transition-soft placeholder:text-[var(--ink-faint)] focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
            />
            {amountError ? (
              <p
                id="tx-amount-error"
                className="text-[12.5px] text-[var(--red)]"
                role="alert"
              >
                Ingresá un monto válido.
              </p>
            ) : Number.isFinite(amountNumber) && amountNumber > 0 ? (
              <p className="text-[12px] text-[var(--ink-soft)]">
                Se guarda como{" "}
                <span className="font-mono font-semibold text-[var(--ink)]">
                  {formatMoney(Math.round(amountNumber), false, defaultCurrency)}
                </span>
              </p>
            ) : null}
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
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
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
                onChange={(e) => {
                  setDate(e.target.value);
                  setDateError(false);
                }}
                aria-invalid={dateError || undefined}
                aria-describedby={dateError ? "tx-date-error" : undefined}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
              />
              {dateError ? (
                <p
                  id="tx-date-error"
                  className="text-[12.5px] text-[var(--red)]"
                  role="alert"
                >
                  Elegí una fecha.
                </p>
              ) : null}
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
                onChange={(e) => {
                  const nextMethod = e.target.value as PaymentMethod;
                  setMethod(nextMethod);
                  if (nextMethod !== "tarjeta_credito") {
                    setInstallmentCount(1);
                  }
                }}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
              >
                {METHODS.map((item) => (
                  <option key={item} value={item}>
                    {METHOD_LABELS[item]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {type === "gasto" &&
          method === "tarjeta_credito" &&
          !isFixed &&
          !isEditing ? (
            <div className="mb-3.5 space-y-2">
              <label
                htmlFor="tx-installment-count"
                className="flex flex-col gap-1.5"
              >
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                  Cuotas
                </span>
                <select
                  id="tx-installment-count"
                  name="installmentCount"
                  autoComplete="off"
                  value={installmentCount}
                  onChange={(e) =>
                    setInstallmentCount(Number(e.target.value) || 1)
                  }
                  className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
                >
                  {INSTALLMENT_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count === 1 ? "1 cuota (sin dividir)" : `${count} cuotas`}
                    </option>
                  ))}
                </select>
              </label>
              {installmentCount > 1 &&
              Number.isFinite(amountNumber) &&
              amountNumber > 0 ? (
                <p className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[12.5px] text-[var(--ink-soft)]">
                  Se crearán{" "}
                  <span className="font-semibold text-[var(--ink)]">
                    {installmentCount} cuotas
                  </span>{" "}
                  de{" "}
                  <span className="font-semibold text-[var(--ink)]">
                    ~
                    {formatMoney(
                      Math.round(amountNumber / installmentCount),
                    )}
                  </span>{" "}
                  (total {formatMoney(Math.round(amountNumber))}).
                </p>
              ) : null}
            </div>
          ) : null}

          {editingInstallmentLabel ? (
            <p
              className="mb-3.5 rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] text-[var(--ink-soft)]"
              role="status"
            >
              <span className="font-semibold text-[var(--ink)]">
                {editingInstallmentLabel}
              </span>
              . Estás editando una cuota. Los cambios no se aplican al resto de
              la serie.
            </p>
          ) : null}

          {activeAccounts.length > 0 ? (
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
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
              >
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
              {showAccountCurrencyHelper ? (
                <p className="text-[11.5px] text-[var(--ink-faint)]">
                  La cuenta puede usar otra moneda; el resumen filtra por la
                  moneda del perfil.
                </p>
              ) : null}
            </label>
          ) : null}

          {type === "ingreso" ? (
            <label htmlFor="tx-income-source" className="mb-3.5 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Motivo
              </span>
              <select
                id="tx-income-source"
                name="incomeSourceId"
                autoComplete="off"
                value={incomeSourceId}
                onChange={(e) => setIncomeSourceId(e.target.value)}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
              >
                {activeIncomeSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label htmlFor="tx-category" className="mb-3.5 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                Categoría
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
                  setCategoryError(false);
                }}
                aria-invalid={categoryError || undefined}
                aria-describedby={
                  categoryError ? "tx-category-error" : undefined
                }
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
              >
                <option value="">Elegir categoría</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
              {categoryError ? (
                <p
                  id="tx-category-error"
                  className="text-[12.5px] text-[var(--red)]"
                  role="alert"
                >
                  Elegí una categoría.
                </p>
              ) : null}
            </label>
          )}

          {type === "gasto" ? (
            <div className="mb-3.5 space-y-2">
              <label
                htmlFor="tx-is-fixed"
                className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5"
              >
                <input
                  id="tx-is-fixed"
                  name="isFixed"
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--ink)]"
                  checked={isFixed}
                  onChange={(e) => {
                    const nextIsFixed = e.target.checked;
                    setIsFixed(nextIsFixed);
                    if (nextIsFixed) {
                      setInstallmentCount(1);
                      const inferred = inferFixedPayWeekIndex(date);
                      setFixedPayWeekIndex(inferred >= 4 ? 4 : 1);
                    }
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-[var(--ink)]">
                    Gasto fijo mensual
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[var(--ink-soft)]">
                    Se refleja en todos los meses desde la fecha hasta que lo
                    edites o elimines.
                  </span>
                </span>
              </label>
              {isFixed ? (
                <label
                  htmlFor="tx-fixed-week"
                  className="flex flex-col gap-1.5"
                >
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                    Semana de cobro
                  </span>
                  <select
                    id="tx-fixed-week"
                    name="fixedPayWeekIndex"
                    value={fixedPayWeekIndex}
                    onChange={(e) =>
                      setFixedPayWeekIndex(
                        Number(e.target.value) === 4 ? 4 : 1,
                      )
                    }
                    className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
                  >
                    <option value={1}>1ª semana del mes</option>
                    <option value={4}>4ª semana del mes</option>
                  </select>
                </label>
              ) : null}
              {isEditing && isFixed ? (
                <p className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] text-[var(--ink-soft)]">
                  Desmarcá esta opción o eliminá el movimiento para que deje de
                  aparecer en los meses siguientes.
                </p>
              ) : null}
            </div>
          ) : null}

          {showRecurringHint && recurringSuggestion ? (
            <div className="mb-3.5 -mt-1.5 rounded-lg bg-[var(--gold-soft)] px-2.5 py-2 text-[11.5px] text-[var(--gold)]">
              <p>
                {recurringSuggestion.matchKind === "dayOfMonth"
                  ? `Cargaste esto varios meses el ${recurringSuggestion.weekdayLabel} — ¿lo marco como ingreso recurrente?`
                  : `Cargaste esto varios ${recurringSuggestion.weekdayLabel}s seguidos — ¿lo marco como ingreso recurrente?`}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleMarkRecurring}
                  className={`rounded-lg bg-[var(--select)] px-2.5 py-1 text-[11px] font-bold text-[var(--chip-active-text)] transition-opacity hover:opacity-90 ${FOCUS_RING}`}
                >
                  Sí, marcar
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecurringHintDismissed(true)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] ${FOCUS_RING}`}
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
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-[11px] text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--select)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card)] focus:border-[var(--select)]"
            />
          </label>

          <button
            type="submit"
            disabled={isLeaving}
            className={`mt-2 min-h-12 w-full rounded-xl bg-[var(--select)] py-3.5 text-[14.5px] font-bold text-[var(--chip-active-text)] transition-soft hover:opacity-90 hover:shadow-[var(--shadow-sheet)] disabled:pointer-events-none disabled:opacity-70 ${FOCUS_RING}`}
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
