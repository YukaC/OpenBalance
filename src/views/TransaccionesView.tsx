"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { endOfMonth, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MonthNavigator } from "@/components/MonthNavigator";
import { TransactionRow } from "@/components/TransactionRow";
import { ViewSkeleton } from "@/components/ViewSkeleton";
import { parseMonthKey } from "@/lib/dates";
import { isActive } from "@/lib/entity-lifecycle";
import { FOCUS_RING } from "@/lib/focus-ring";
import { METHOD_LABELS } from "@/lib/format";
import { getMonthTransactions } from "@/lib/month-index";
import type { PaymentMethod, Transaction, TransactionType } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";
import { useToastStore } from "@/store/toast-store";

type TypeFilter = "all" | TransactionType;

type DeleteDialogStep = "confirm" | "installment-group";

interface PendingDelete {
  transaction: Transaction;
  step: DeleteDialogStep;
}

interface ActiveFilterChip {
  id: string;
  label: string;
  onClear: () => void;
}

const PAGE_SIZE = 40;
/** Switch from "Mostrar más" pagination to virtual scroll above this count. */
const VIRTUALIZE_THRESHOLD = 80;
const ESTIMATED_ROW_HEIGHT = 72;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "ingreso", label: "Ingreso" },
  { value: "gasto", label: "Gasto" },
];

const METHOD_FILTERS: { value: "all" | PaymentMethod; label: string }[] = [
  { value: "all", label: "Todos los métodos" },
  { value: "transferencia", label: METHOD_LABELS.transferencia },
  { value: "efectivo", label: METHOD_LABELS.efectivo },
  { value: "tarjeta_debito", label: METHOD_LABELS.tarjeta_debito },
  { value: "tarjeta_credito", label: METHOD_LABELS.tarjeta_credito },
  { value: "otro", label: METHOD_LABELS.otro },
];

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition-soft placeholder:text-[var(--ink-faint)] focus:border-[var(--select)]";

function formatFilterDate(iso: string) {
  return format(parseISO(iso), "d MMM", { locale: es });
}
function collectDeleteSnapshot(
  transaction: Transaction,
  deleteInstallmentGroup: boolean,
): Transaction[] {
  const { transactions } = useFinanceStore.getState();
  if (deleteInstallmentGroup && transaction.installmentGroupId) {
    return transactions.filter(
      (item) => item.installmentGroupId === transaction.installmentGroupId,
    );
  }
  const target = transactions.find((item) => item.id === transaction.id);
  return target ? [target] : [];
}

export default function TransaccionesView() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);
  const defaultCurrency = useFinanceStore((s) => s.profile.defaultCurrency);
  const accounts = useFinanceStore((s) => s.accounts);
  const openForm = useFinanceStore((s) => s.openForm);
  const openFormForEdit = useFinanceStore((s) => s.openFormForEdit);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const restoreTransactions = useFinanceStore((s) => s.restoreTransactions);
  const showToast = useToastStore((s) => s.showToast);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [motivoFilter, setMotivoFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState<"all" | PaymentMethod>(
    "all",
  );
  const [accountFilter, setAccountFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateSortOrder, setDateSortOrder] = useState<"desc" | "asc">("desc");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const listScrollRef = useRef<HTMLDivElement>(null);

  const monthBounds = useMemo(() => {
    const monthStart = parseMonthKey(selectedMonth);
    return {
      start: format(monthStart, "yyyy-MM-dd"),
      end: format(endOfMonth(monthStart), "yyyy-MM-dd"),
    };
  }, [selectedMonth]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const incomeSourcesById = useMemo(
    () =>
      new Map(incomeSources.map((incomeSource) => [incomeSource.id, incomeSource])),
    [incomeSources],
  );

  const hasAdvancedFilters =
    categoryFilter !== "all" ||
    motivoFilter !== "all" ||
    methodFilter !== "all" ||
    accountFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const hasActiveFilters =
    typeFilter !== "all" ||
    searchQuery.trim().length > 0 ||
    hasAdvancedFilters;

  const advancedFilterCount =
    (dateFrom || dateTo ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (motivoFilter !== "all" ? 1 : 0) +
    (methodFilter !== "all" ? 1 : 0) +
    (accountFilter !== "all" ? 1 : 0);

  function clearAdvancedFilters() {
    setCategoryFilter("all");
    setMotivoFilter("all");
    setMethodFilter("all");
    setAccountFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function clearFilters() {
    setTypeFilter("all");
    setSearchQuery("");
    clearAdvancedFilters();
    setDateSortOrder("desc");
    setIsFilterPanelOpen(false);
  }

  useEffect(() => {
    setDateFrom("");
    setDateTo("");
    setDateSortOrder("desc");
    setCategoryFilter("all");
    setMotivoFilter("all");
    setMethodFilter("all");
    setAccountFilter("all");
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setTypeFilter("all");
    setIsFilterPanelOpen(false);
  }, [selectedMonth]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const monthTransactions = useMemo(
    () =>
      getMonthTransactions(transactions, selectedMonth, {
        paydayWeekday,
        currency: defaultCurrency,
      }),
    [transactions, selectedMonth, paydayWeekday, defaultCurrency],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = debouncedSearchQuery.trim().toLowerCase();
    const fromDate = dateFrom || monthBounds.start;
    const toDate = dateTo || monthBounds.end;

    return monthTransactions
      .filter((tx) => (typeFilter === "all" ? true : tx.type === typeFilter))
      .filter((tx) => tx.date >= fromDate && tx.date <= toDate)
      .filter((tx) => {
        if (methodFilter === "all") return true;
        return tx.method === methodFilter;
      })
      .filter((tx) => {
        if (accountFilter === "all") return true;
        if (accountFilter === "none") return !tx.accountId;
        return tx.accountId === accountFilter;
      })
      .filter((tx) => {
        if (categoryFilter === "all" || typeFilter === "ingreso") return true;
        if (tx.type !== "gasto") return false;
        if (categoryFilter === "uncategorized") return !tx.categoryId;
        return tx.categoryId === categoryFilter;
      })
      .filter((tx) => {
        if (motivoFilter === "all" || typeFilter === "gasto") return true;
        if (tx.type !== "ingreso") return false;
        return tx.incomeSourceId === motivoFilter;
      })
      .filter((tx) => {
        if (!normalizedQuery) return true;
        const categoryName = tx.categoryId
          ? (categoriesById.get(tx.categoryId)?.name ?? "")
          : "";
        const motivoName = tx.incomeSourceId
          ? (incomeSourcesById.get(tx.incomeSourceId)?.name ?? "")
          : "";
        const methodName = METHOD_LABELS[tx.method] ?? tx.method;
        const haystack = [tx.title, tx.note, categoryName, motivoName, methodName]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice()
      .sort((a, b) => {
        const byDate =
          dateSortOrder === "desc"
            ? b.date.localeCompare(a.date)
            : a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        return dateSortOrder === "desc"
          ? b.id.localeCompare(a.id)
          : a.id.localeCompare(b.id);
      });
  }, [
    monthTransactions,
    typeFilter,
    debouncedSearchQuery,
    categoryFilter,
    motivoFilter,
    methodFilter,
    accountFilter,
    dateFrom,
    dateTo,
    dateSortOrder,
    monthBounds.start,
    monthBounds.end,
    categoriesById,
    incomeSourcesById,
  ]);

  useEffect(() => {
    if (typeFilter === "ingreso") setCategoryFilter("all");
    if (typeFilter === "gasto") setMotivoFilter("all");
  }, [typeFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    selectedMonth,
    typeFilter,
    debouncedSearchQuery,
    categoryFilter,
    motivoFilter,
    methodFilter,
    accountFilter,
    dateFrom,
    dateTo,
    dateSortOrder,
    filtered.length,
  ]);

  const visibleTransactions = filtered.slice(0, visibleCount);
  const remainingCount = filtered.length - visibleCount;
  const shouldVirtualize = filtered.length > VIRTUALIZE_THRESHOLD;
  const showCategoryFilter = typeFilter === "all" || typeFilter === "gasto";
  const showMotivoFilter = typeFilter === "all" || typeFilter === "ingreso";

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? filtered.length : 0,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
  });
  const activeAccounts = useMemo(
    () => accounts.filter(isActive),
    [accounts],
  );
  const accountsById = useMemo(
    () => new Map(activeAccounts.map((account) => [account.id, account])),
    [activeAccounts],
  );

  const activeFilterChips = useMemo(() => {
    const chips: ActiveFilterChip[] = [];

    if (dateFrom || dateTo) {
      const fromLabel = dateFrom ? formatFilterDate(dateFrom) : "inicio";
      const toLabel = dateTo ? formatFilterDate(dateTo) : "fin";
      chips.push({
        id: "date-range",
        label: `${fromLabel} → ${toLabel}`,
        onClear: () => {
          setDateFrom("");
          setDateTo("");
        },
      });
    }

    if (categoryFilter !== "all" && showCategoryFilter) {
      const categoryLabel =
        categoryFilter === "uncategorized"
          ? "Sin categoría"
          : (categoriesById.get(categoryFilter)?.name ?? "Categoría");
      chips.push({
        id: "category",
        label: categoryLabel,
        onClear: () => setCategoryFilter("all"),
      });
    }

    if (motivoFilter !== "all" && showMotivoFilter) {
      chips.push({
        id: "motivo",
        label: incomeSourcesById.get(motivoFilter)?.name ?? "Motivo",
        onClear: () => setMotivoFilter("all"),
      });
    }

    if (methodFilter !== "all") {
      chips.push({
        id: "method",
        label: METHOD_LABELS[methodFilter],
        onClear: () => setMethodFilter("all"),
      });
    }

    if (accountFilter !== "all") {
      const accountLabel =
        accountFilter === "none"
          ? "Sin cuenta"
          : (accountsById.get(accountFilter)?.name ?? "Cuenta");
      chips.push({
        id: "account",
        label: accountLabel,
        onClear: () => setAccountFilter("all"),
      });
    }

    return chips;
  }, [
    dateFrom,
    dateTo,
    categoryFilter,
    motivoFilter,
    methodFilter,
    accountFilter,
    showCategoryFilter,
    showMotivoFilter,
    categoriesById,
    incomeSourcesById,
    accountsById,
  ]);

  function performDelete(
    transaction: Transaction,
    deleteInstallmentGroup: boolean,
  ) {
    const snapshot = collectDeleteSnapshot(transaction, deleteInstallmentGroup);
    deleteTransaction(transaction.id, { deleteInstallmentGroup });
    showToast({
      message: "Movimiento eliminado",
      actionLabel: "Deshacer",
      onAction: () => restoreTransactions(snapshot),
      durationMs: 5000,
    });
  }

  function handleConfirmDelete() {
    if (!pendingDelete) return;
    const { transaction, step } = pendingDelete;

    if (
      step === "confirm" &&
      transaction.installmentGroupId &&
      transaction.installmentCount &&
      transaction.installmentCount > 1
    ) {
      setPendingDelete({ transaction, step: "installment-group" });
      return;
    }

    const deleteInstallmentGroup = step === "installment-group";
    performDelete(transaction, deleteInstallmentGroup);
    setPendingDelete(null);
  }

  function handleCancelDelete() {
    if (pendingDelete?.step === "installment-group") {
      performDelete(pendingDelete.transaction, false);
    }
    setPendingDelete(null);
  }

  if (!hydrated) {
    return <ViewSkeleton />;
  }

  const deleteDialog =
    pendingDelete?.step === "installment-group"
      ? {
          title: "Eliminar cuotas",
          message:
            "¿Eliminar también las demás cuotas del grupo? Cancelar borra solo esta cuota.",
          confirmLabel: "Eliminar todas",
          cancelLabel: "Solo esta",
        }
      : pendingDelete
        ? {
            title: "Eliminar movimiento",
            message: `¿Eliminar «${pendingDelete.transaction.title}»?`,
            confirmLabel: "Eliminar",
            cancelLabel: "Cancelar",
          }
        : null;

  return (
    <div className="view-stack">
      <header className="page-header">
        <h1 className="page-title">Transacciones</h1>
        <p className="page-lede">Movimientos del mes</p>
      </header>

      <MonthNavigator />

      <section
        className="ledger-panel space-y-4 p-5 min-[880px]:p-6"
        aria-labelledby="movements-heading"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-left">
            <h2 id="movements-heading" className="section-heading !text-left">
              Movimientos
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--ink-soft)]">
              <span>
                {filtered.length}{" "}
                {filtered.length === 1 ? "registro" : "registros"}
                {hasActiveFilters ? " · filtrados" : ""}
              </span>
              <span aria-hidden className="text-[var(--ink-faint)]">
                ·
              </span>
              <button
                type="button"
                aria-pressed={dateSortOrder === "asc"}
                aria-label={
                  dateSortOrder === "desc"
                    ? "Orden: más recientes primero. Clic para más antiguos"
                    : "Orden: más antiguos primero. Clic para más recientes"
                }
                onClick={() =>
                  setDateSortOrder((order) =>
                    order === "desc" ? "asc" : "desc",
                  )
                }
                className={`inline-flex items-center gap-1 font-semibold text-[var(--ink-muted)] transition-soft hover:text-[var(--ink)] ${FOCUS_RING}`}
              >
                <span aria-hidden className="text-[12px] leading-none">
                  {dateSortOrder === "desc" ? "↓" : "↑"}
                </span>
                {dateSortOrder === "desc" ? "Recientes" : "Antiguos"}
              </button>
              <span aria-hidden className="text-[var(--ink-faint)]">
                ·
              </span>
              <button
                type="button"
                aria-expanded={isFilterPanelOpen}
                aria-controls="transaction-filters-panel"
                onClick={() => setIsFilterPanelOpen((open) => !open)}
                className={`inline-flex items-center gap-1.5 font-semibold transition-soft ${FOCUS_RING} ${
                  isFilterPanelOpen || hasAdvancedFilters
                    ? "text-[var(--select-fg)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                Filtros
                {advancedFilterCount > 0 ? (
                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--select)] px-1 text-[10.5px] font-bold leading-none text-[var(--chip-active-text)]">
                    {advancedFilterCount}
                  </span>
                ) : (
                  <span aria-hidden className="text-[10px] opacity-60">
                    {isFilterPanelOpen ? "▴" : "▾"}
                  </span>
                )}
              </button>
            </div>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className={`mt-1 shrink-0 text-[12.5px] font-semibold text-[var(--ink-faint)] underline-offset-2 transition-soft hover:text-[var(--ink)] hover:underline ${FOCUS_RING}`}
            >
              Limpiar
            </button>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--ink-faint)]"
            >
              ⌕
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar movimientos"
              placeholder="Buscar título, nota, categoría…"
              className={`${FIELD_CLASS} pl-9 ${searchQuery ? "pr-9" : ""}`}
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearchQuery("")}
                className={`absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[16px] text-[var(--ink-faint)] transition-soft hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] ${FOCUS_RING}`}
              >
                ×
              </button>
            ) : null}
          </div>

          <div
            className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--bg)] p-1"
            role="group"
            aria-label="Filtrar por tipo"
          >
            {TYPE_FILTERS.map((item) => {
              const active = typeFilter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTypeFilter(item.value)}
                  className={`min-h-9 rounded-lg px-2 text-[12.5px] font-semibold transition-soft ${FOCUS_RING} active:scale-[0.98] ${
                    active
                      ? "is-selected-solid shadow-sm"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {activeFilterChips.length > 0 ? (
            <div
              className="flex flex-wrap gap-1.5"
              aria-label="Filtros activos"
            >
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.onClear}
                  aria-label={`Quitar filtro ${chip.label}`}
                  className={`inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--select-border)] bg-[var(--select-soft)] py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-[var(--select-fg)] transition-soft hover:opacity-90 ${FOCUS_RING}`}
                >
                  <span className="truncate">{chip.label}</span>
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] leading-none opacity-70"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {isFilterPanelOpen ? (
            <div
              id="transaction-filters-panel"
              className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]/60 p-3.5"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-left">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                    Desde
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    min={monthBounds.start}
                    max={dateTo || monthBounds.end}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label="Filtrar desde fecha"
                    className={FIELD_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-1 text-left">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                    Hasta
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || monthBounds.start}
                    max={monthBounds.end}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label="Filtrar hasta fecha"
                    className={FIELD_CLASS}
                  />
                </label>
              </div>

              <div
                className={`grid gap-2.5 ${
                  showCategoryFilter && showMotivoFilter
                    ? "grid-cols-1 min-[560px]:grid-cols-2"
                    : "grid-cols-1"
                }`}
              >
                {showCategoryFilter ? (
                  <label className="flex flex-col gap-1 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                      Categoría
                    </span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      aria-label="Filtrar por categoría"
                      className={FIELD_CLASS}
                    >
                      <option value="all">Todas</option>
                      <option value="uncategorized">Sin categoría</option>
                      {categories.filter(isActive).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {showMotivoFilter ? (
                  <label className="flex flex-col gap-1 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                      Motivo
                    </span>
                    <select
                      value={motivoFilter}
                      onChange={(e) => setMotivoFilter(e.target.value)}
                      aria-label="Filtrar por motivo de ingreso"
                      className={FIELD_CLASS}
                    >
                      <option value="all">Todos</option>
                      {incomeSources.filter(isActive).map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <label className="flex flex-col gap-1 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                  Método
                </span>
                <select
                  value={methodFilter}
                  onChange={(e) =>
                    setMethodFilter(e.target.value as "all" | PaymentMethod)
                  }
                  aria-label="Filtrar por método de pago"
                  className={FIELD_CLASS}
                >
                  {METHOD_FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {activeAccounts.length > 0 ? (
                <label className="flex flex-col gap-1 text-left">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                    Cuenta
                  </span>
                  <select
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    aria-label="Filtrar por cuenta"
                    className={FIELD_CLASS}
                  >
                    <option value="all">Todas</option>
                    <option value="none">Sin cuenta</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {hasAdvancedFilters ? (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={clearAdvancedFilters}
                    className={`text-[12.5px] font-semibold text-[var(--ink-faint)] underline-offset-2 transition-soft hover:text-[var(--ink)] hover:underline ${FOCUS_RING}`}
                  >
                    Quitar filtros avanzados
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <div className="space-y-4 border-t border-[var(--line)] pt-6 text-center">
            <p className="font-display text-[20px] font-semibold leading-snug text-[var(--ink)]">
              {hasActiveFilters
                ? "Ningún movimiento coincide"
                : "No hay movimientos este mes"}
            </p>
            <p className="mx-auto max-w-[28ch] text-[14px] text-[var(--ink-soft)]">
              {hasActiveFilters
                ? "Probá limpiar o cambiar los filtros."
                : "Cargá un ingreso o un gasto para empezar a ver tu ritmo."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] px-5 text-[14px] font-bold text-[var(--ink)] transition-soft hover:bg-[var(--paper-deep)] ${FOCUS_RING}`}
              >
                Limpiar filtros
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openForm()}
                className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--select)] px-5 text-[14px] font-bold text-[var(--chip-active-text)] transition-soft hover:opacity-90 ${FOCUS_RING}`}
              >
                Agregar movimiento
              </button>
            )}
          </div>
        ) : shouldVirtualize ? (
          <div
            ref={listScrollRef}
            className="max-h-[min(70vh,36rem)] overflow-y-auto overscroll-contain"
            role="list"
            aria-label={`Lista virtualizada de ${filtered.length} movimientos`}
          >
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const tx = filtered[virtualRow.index];
                const category = tx.categoryId
                  ? categoriesById.get(tx.categoryId)
                  : undefined;
                const incomeSource = tx.incomeSourceId
                  ? incomeSourcesById.get(tx.incomeSourceId)
                  : undefined;
                return (
                  <div
                    key={tx.id}
                    role="listitem"
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="row-contain flex items-stretch gap-1">
                      <div className="min-w-0 flex-1">
                        <TransactionRow
                          transaction={tx}
                          category={category}
                          incomeSourceName={incomeSource?.name}
                          onSelect={() => openFormForEdit(tx.id)}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Eliminar ${tx.title}`}
                        onClick={() =>
                          setPendingDelete({
                            transaction: tx,
                            step: "confirm",
                          })
                        }
                        className={`mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[20px] text-[var(--ink-faint)] transition-soft hover:bg-[var(--red-soft)] hover:text-[var(--red)] ${FOCUS_RING}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div role="list" aria-label="Lista de movimientos">
            {visibleTransactions.map((tx, index) => {
              const category = tx.categoryId
                ? categoriesById.get(tx.categoryId)
                : undefined;
              const incomeSource = tx.incomeSourceId
                ? incomeSourcesById.get(tx.incomeSourceId)
                : undefined;
              return (
                <div
                  key={`${tx.id}-${index}`}
                  role="listitem"
                  className="row-contain flex items-stretch gap-1"
                >
                  <div className="min-w-0 flex-1">
                    <TransactionRow
                      transaction={tx}
                      category={category}
                      incomeSourceName={incomeSource?.name}
                      onSelect={() => openFormForEdit(tx.id)}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar ${tx.title}`}
                    onClick={() =>
                      setPendingDelete({ transaction: tx, step: "confirm" })
                    }
                    className={`mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[20px] text-[var(--ink-faint)] transition-soft hover:bg-[var(--red-soft)] hover:text-[var(--red)] ${FOCUS_RING}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {remainingCount > 0 ? (
              <div className="border-t border-[var(--line)] pt-4 text-center">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((count) => count + PAGE_SIZE)
                  }
                  className={`min-h-11 rounded-xl bg-[var(--bg)] px-4 text-[13px] font-semibold text-[var(--ink-soft)] transition-soft hover:text-[var(--ink)] ${FOCUS_RING}`}
                >
                  Mostrar más ({remainingCount})
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={Boolean(deleteDialog)}
        title={deleteDialog?.title ?? ""}
        message={deleteDialog?.message ?? ""}
        confirmLabel={deleteDialog?.confirmLabel}
        cancelLabel={deleteDialog?.cancelLabel}
        isDestructive
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
