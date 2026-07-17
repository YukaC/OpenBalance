"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ViewSkeleton } from "@/components/ViewSkeleton";
import { DEFAULT_CATEGORY_EMOJI } from "@/lib/category-emojis";
import { sanitizeCssColor } from "@/lib/color-utils";
import { formatMonthName } from "@/lib/dates";
import { isActive } from "@/lib/entity-lifecycle";
import { FOCUS_RING } from "@/lib/focus-ring";
import { formatMoney, parseMoneyInput } from "@/lib/format";
import { getMonthTransactions } from "@/lib/month-index";
import { sumExpenseByCategory } from "@/lib/summaries";
import type { Budget, Category, CategoryKind, Transaction, UserCategoryRule } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";
import { useToastStore } from "@/store/toast-store";

const KIND_LABELS: Record<CategoryKind, string> = {
  fijo: "Fijo",
  variable: "Variable",
  hormiga: "Hormiga",
};

const KIND_OPTIONS: CategoryKind[] = ["fijo", "variable", "hormiga"];

const DEFAULT_NEW_CATEGORY_COLOR = "#7a6f64";

function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export default function CategoriasView() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const categories = useFinanceStore((s) => s.categories);
  const budgets = useFinanceStore((s) => s.budgets);
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const transactions = useFinanceStore((s) => s.transactions);
  const updateCategory = useFinanceStore((s) => s.updateCategory);
  const removeCategory = useFinanceStore((s) => s.removeCategory);
  const addCategory = useFinanceStore((s) => s.addCategory);
  const setBudget = useFinanceStore((s) => s.setBudget);
  const currency = useFinanceStore((s) => s.profile.defaultCurrency);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);
  const payCadence = useFinanceStore((s) => s.profile.payCadence);
  const showToast = useToastStore((s) => s.showToast);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_EMOJI);
  const [color, setColor] = useState(DEFAULT_NEW_CATEGORY_COLOR);
  const [kind, setKind] = useState<CategoryKind>("variable");
  const [draftKeywords, setDraftKeywords] = useState<Record<string, string>>(
    {},
  );
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [draftBudgets, setDraftBudgets] = useState<Record<string, string>>({});
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  const [budgetErrors, setBudgetErrors] = useState<Record<string, string>>({});
  const [editingIconCategoryId, setEditingIconCategoryId] = useState<
    string | null
  >(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{
    id: string;
    name: string;
    message: string;
  } | null>(null);

  const activeCategories = useMemo(
    () => categories.filter(isActive),
    [categories],
  );

  const budgetByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const budget of budgets) {
      if (!isActive(budget)) continue;
      if (budget.month !== selectedMonth) continue;
      map.set(budget.categoryId, budget.amountLimit);
    }
    return map;
  }, [budgets, selectedMonth]);

  const prefilteredMonthTransactions = useMemo(
    () =>
      getMonthTransactions(transactions, selectedMonth, {
        paydayWeekday,
        currency,
        payCadence: payCadence ?? "monthly",
      }),
    [transactions, selectedMonth, paydayWeekday, payCadence, currency],
  );

  const spentByCategoryId = useMemo(
    () =>
      sumExpenseByCategory(
        transactions,
        selectedMonth,
        paydayWeekday,
        currency,
        undefined,
        prefilteredMonthTransactions,
        payCadence ?? "monthly",
      ),
    [
      transactions,
      selectedMonth,
      paydayWeekday,
      currency,
      payCadence,
      prefilteredMonthTransactions,
    ],
  );

  const transactionCountByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (!isActive(tx) || !tx.categoryId) continue;
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + 1);
    }
    return map;
  }, [transactions]);

  if (!hydrated) {
    return <ViewSkeleton />;
  }

  function keywordsValue(id: string, keywords: string[]): string {
    return draftKeywords[id] ?? keywords.join(", ");
  }

  function categoryNameValue(id: string, currentName: string): string {
    return draftNames[id] ?? currentName;
  }

  function handleSaveName(id: string, currentName: string) {
    const raw = draftNames[id];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    if (!trimmed) {
      setNameErrors((prev) => ({
        ...prev,
        [id]: "El nombre no puede estar vacío.",
      }));
      return;
    }
    setNameErrors((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (trimmed === currentName) {
      setDraftNames((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      return;
    }
    updateCategory(id, { name: trimmed });
    setDraftNames((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function handleRemoveCategory(categoryId: string, categoryName: string) {
    const spentThisMonth = spentByCategoryId.get(categoryId) ?? 0;
    const transactionCount = transactionCountByCategoryId.get(categoryId) ?? 0;
    const hasActivity = spentThisMonth > 0 || transactionCount > 0;

    let confirmMessage = `¿Quitar la categoría «${categoryName}»?`;
    if (hasActivity) {
      const parts: string[] = [];
      if (spentThisMonth > 0) {
        parts.push("tiene gastos este mes");
      }
      if (transactionCount > 0) {
        parts.push(
          `${transactionCount} ${transactionCount === 1 ? "movimiento asociado" : "movimientos asociados"}`,
        );
      }
      confirmMessage = `«${categoryName}» ${parts.join(" y ")}. Si la quitás, esos movimientos quedarán sin categoría y se borrarán sus presupuestos. ¿Continuar?`;
    }

    setPendingRemove({ id: categoryId, name: categoryName, message: confirmMessage });
  }

  function confirmRemoveCategory() {
    if (!pendingRemove) return;

    const categoryId = pendingRemove.id;
    const state = useFinanceStore.getState();
    const categorySnapshot = state.categories.find(
      (category) => category.id === categoryId,
    );
    if (!categorySnapshot) {
      setPendingRemove(null);
      return;
    }

    const transactionSnapshots = state.transactions.filter(
      (tx) => tx.categoryId === categoryId && isActive(tx),
    );
    const budgetSnapshots = state.budgets.filter(
      (budget) => budget.categoryId === categoryId && isActive(budget),
    );
    const ruleSnapshots = state.userRules.filter(
      (rule) => rule.categoryId === categoryId && isActive(rule),
    );

    removeCategory(categoryId);
    setPendingRemove(null);

    showToast({
      message: "Categoría eliminada",
      actionLabel: "Deshacer",
      durationMs: 5000,
      onAction: () => {
        restoreCategoryRemoval({
          category: categorySnapshot,
          transactions: transactionSnapshots,
          budgets: budgetSnapshots,
          userRules: ruleSnapshots,
        });
      },
    });
  }

  function budgetValue(categoryId: string): string {
    if (draftBudgets[categoryId] !== undefined) return draftBudgets[categoryId];
    const limit = budgetByCategoryId.get(categoryId);
    return limit !== undefined ? String(limit) : "";
  }

  function handleSaveKeywords(id: string, current: string[]) {
    const raw = draftKeywords[id];
    if (raw === undefined) return;
    const next = parseKeywords(raw);
    const same =
      next.length === current.length &&
      next.every((word, index) => word === current[index]);
    if (!same) updateCategory(id, { keywords: next });
    setDraftKeywords((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function handleSaveBudget(categoryId: string) {
    const raw = draftBudgets[categoryId];
    if (raw === undefined) return;
    const trimmed = raw.trim();
    if (!trimmed) {
      setBudgetErrors((prev) => {
        const copy = { ...prev };
        delete copy[categoryId];
        return copy;
      });
      setBudget(categoryId, selectedMonth, 0);
      setDraftBudgets((prev) => {
        const copy = { ...prev };
        delete copy[categoryId];
        return copy;
      });
      return;
    }

    const amount = parseMoneyInput(trimmed);
    if (!Number.isFinite(amount) || amount < 0) {
      setBudgetErrors((prev) => ({
        ...prev,
        [categoryId]: "Ingresá un monto válido.",
      }));
      return;
    }

    setBudgetErrors((prev) => {
      const copy = { ...prev };
      delete copy[categoryId];
      return copy;
    });
    setBudget(categoryId, selectedMonth, amount);
    setDraftBudgets((prev) => {
      const copy = { ...prev };
      delete copy[categoryId];
      return copy;
    });
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addCategory({
      name: trimmed,
      icon: icon || DEFAULT_CATEGORY_EMOJI,
      color: sanitizeCssColor(color),
      kind,
      keywords: [],
    });
    setName("");
    setIcon(DEFAULT_CATEGORY_EMOJI);
    setColor(DEFAULT_NEW_CATEGORY_COLOR);
    setKind("variable");
    setIsEmojiOpen(false);
  }

  return (
    <div className="view-stack">
      <header className="page-header">
        <h1 className="page-title">Categorías</h1>
        <p className="page-lede">Palabras que detectan el gasto</p>
      </header>

      <section
        className="ledger-panel flex flex-col p-4"
        aria-label="Lista de categorías"
      >
        <div aria-label="Categorías guardadas">
          {activeCategories.map((category) => {
            const isEditingIcon = editingIconCategoryId === category.id;
            const nameError = nameErrors[category.id];
            return (
              <article
                key={category.id}
                className="border-b border-[var(--line)] py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <label
                    className="relative shrink-0"
                    aria-label={`Color de ${category.name}`}
                  >
                    <span
                      className="block h-8 w-8 overflow-hidden rounded-lg border border-[var(--line)]"
                      style={{ backgroundColor: category.color }}
                    />
                    <input
                      type="color"
                      value={sanitizeCssColor(category.color)}
                      onChange={(e) =>
                        updateCategory(category.id, { color: e.target.value })
                      }
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>

                  <button
                    type="button"
                    aria-label={`Cambiar ícono de ${category.name}`}
                    aria-expanded={isEditingIcon}
                    onClick={() =>
                      setEditingIconCategoryId(
                        isEditingIcon ? null : category.id,
                      )
                    }
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[16px] leading-none transition-soft ${FOCUS_RING} ${
                      isEditingIcon
                        ? "bg-[var(--select-soft)] ring-2 ring-[var(--select)]"
                        : "bg-[var(--bg)] hover:bg-[var(--paper-deep)]"
                    }`}
                  >
                    <span aria-hidden>{category.icon}</span>
                  </button>

                  <div className="flex w-[7.5rem] shrink-0 flex-col gap-0.5 sm:w-28">
                    <input
                      id={`category-name-${category.id}`}
                      name={`categoryName-${category.id}`}
                      autoComplete="off"
                      value={categoryNameValue(category.id, category.name)}
                      onChange={(e) => {
                        setDraftNames((prev) => ({
                          ...prev,
                          [category.id]: e.target.value,
                        }));
                        setNameErrors((prev) => {
                          if (!prev[category.id]) return prev;
                          const copy = { ...prev };
                          delete copy[category.id];
                          return copy;
                        });
                      }}
                      onBlur={() => handleSaveName(category.id, category.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      aria-label={`Nombre de ${category.name}`}
                      aria-invalid={Boolean(nameError) || undefined}
                      aria-describedby={
                        nameError
                          ? `category-name-error-${category.id}`
                          : undefined
                      }
                      className="w-full rounded-xl border border-transparent bg-transparent px-1 py-1 text-[13.5px] font-semibold text-[var(--ink)] outline-none transition-soft focus:border-[var(--line)] focus:bg-[var(--surface-raised)]"
                    />
                    {nameError ? (
                      <p
                        id={`category-name-error-${category.id}`}
                        className="px-1 text-[11px] text-[var(--red)]"
                        role="alert"
                      >
                        {nameError}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleRemoveCategory(category.id, category.name)
                    }
                    className={`shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--red)] transition-soft hover:bg-[var(--red-soft)] ${FOCUS_RING}`}
                  >
                    Quitar
                  </button>

                  <span className="hidden w-14 shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)] sm:block">
                    {KIND_LABELS[category.kind]}
                  </span>

                  <input
                    id={`category-keywords-${category.id}`}
                    name={`categoryKeywords-${category.id}`}
                    autoComplete="off"
                    value={keywordsValue(category.id, category.keywords)}
                    onChange={(e) =>
                      setDraftKeywords((prev) => ({
                        ...prev,
                        [category.id]: e.target.value,
                      }))
                    }
                    onBlur={() =>
                      handleSaveKeywords(category.id, category.keywords)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    aria-label={`Palabras clave de ${category.name}`}
                    placeholder="ej. uber, rappi, almuerzo"
                    className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-2 text-[12.5px] outline-none transition-soft focus:border-[var(--select)]"
                  />
                </div>

                {isEditingIcon ? (
                  <div className="mt-2 pl-12">
                    <EmojiPicker
                      value={category.icon}
                      label="Ícono"
                      hasScroll
                      compact
                      onChange={(emoji) => {
                        updateCategory(category.id, { icon: emoji });
                        setEditingIconCategoryId(null);
                      }}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="ledger-panel space-y-3 p-4"
        aria-labelledby="budgets-heading"
      >
        <div className="section-intro">
          <h2 id="budgets-heading" className="section-heading">
            Presupuestos
          </h2>
          <p className="section-lede">
            Tope mensual por categoría · {formatMonthName(selectedMonth)}
          </p>
        </div>
        <div className="space-y-2">
          {activeCategories.map((category) => {
            const limit = budgetByCategoryId.get(category.id);
            const spent = spentByCategoryId.get(category.id) ?? 0;
            const budgetError = budgetErrors[category.id];
            return (
              <div
                key={category.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] py-2 last:border-b-0"
              >
                <span className="w-[8.5rem] shrink-0 truncate text-[13px] font-semibold text-[var(--ink)]">
                  {category.icon} {category.name}
                </span>
                <label
                  htmlFor={`budget-${category.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5"
                >
                  <span className="sr-only">
                    Presupuesto de {category.name}
                  </span>
                  <input
                    id={`budget-${category.id}`}
                    name={`budget-${category.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={budgetValue(category.id)}
                    onChange={(e) => {
                      setDraftBudgets((prev) => ({
                        ...prev,
                        [category.id]: e.target.value,
                      }));
                      setBudgetErrors((prev) => {
                        if (!prev[category.id]) return prev;
                        const copy = { ...prev };
                        delete copy[category.id];
                        return copy;
                      });
                    }}
                    onBlur={() => handleSaveBudget(category.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    placeholder="Sin tope"
                    aria-invalid={Boolean(budgetError) || undefined}
                    aria-describedby={
                      budgetError
                        ? `budget-error-${category.id}`
                        : undefined
                    }
                    className="min-h-10 w-full min-w-[7rem] rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-2 font-mono text-[13px] outline-none transition-soft focus:border-[var(--select)]"
                  />
                  {budgetError ? (
                    <p
                      id={`budget-error-${category.id}`}
                      className="text-[11px] text-[var(--red)]"
                      role="alert"
                    >
                      {budgetError}
                    </p>
                  ) : null}
                </label>
                {limit !== undefined && limit > 0 ? (
                  <span className="text-[11.5px] text-[var(--ink-soft)]">
                    {formatMoney(spent, false, currency)} /{" "}
                    {formatMoney(limit, false, currency)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="ledger-panel space-y-3 p-4"
        aria-labelledby="add-category-heading"
      >
        <h2 id="add-category-heading" className="section-heading">
          Nueva categoría
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="relative shrink-0"
              aria-label="Color de categoría"
            >
              <span
                className="block h-11 w-11 overflow-hidden rounded-xl border border-[var(--line)]"
                style={{ backgroundColor: sanitizeCssColor(color) }}
              />
              <input
                type="color"
                value={sanitizeCssColor(color)}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              aria-label="Elegir ícono"
              aria-expanded={isEmojiOpen}
              onClick={() => setIsEmojiOpen((open) => !open)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[18px] leading-none transition-soft hover:bg-[var(--paper-deep)] ${FOCUS_RING}`}
            >
              <span aria-hidden>{icon}</span>
            </button>
            <input
              id="new-category-name"
              name="categoryName"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              required
              aria-label="Nombre de categoría"
              className="min-h-11 min-w-[8rem] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-[13.5px] outline-none transition-soft focus:border-[var(--select)]"
            />
            <div className="flex flex-wrap gap-1" role="group" aria-label="Tipo">
              {KIND_OPTIONS.map((option) => {
                const active = kind === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setKind(option)}
                    className={`min-h-10 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-soft ${FOCUS_RING} active:scale-95 ${
                      active
                        ? "is-selected-solid"
                        : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {KIND_LABELS[option]}
                  </button>
                );
              })}
            </div>
            <button
              type="submit"
              className={`min-h-11 shrink-0 rounded-xl bg-[var(--select)] px-4 text-[13px] font-bold text-[var(--chip-active-text)] transition-soft hover:opacity-90 ${FOCUS_RING}`}
            >
              Agregar
            </button>
          </div>

          {isEmojiOpen ? (
            <EmojiPicker
              value={icon}
              onChange={(emoji) => {
                setIcon(emoji);
                setIsEmojiOpen(false);
              }}
              hasScroll
              compact
            />
          ) : null}
        </form>
      </section>

      <ConfirmDialog
        isOpen={Boolean(pendingRemove)}
        title={pendingRemove ? `Quitar ${pendingRemove.name}` : ""}
        message={pendingRemove?.message ?? ""}
        confirmLabel="Quitar"
        isDestructive
        onConfirm={confirmRemoveCategory}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}

function restoreCategoryRemoval(snapshot: {
  category: Category;
  transactions: Transaction[];
  budgets: Budget[];
  userRules: UserCategoryRule[];
}) {
  const transactionIds = new Set(
    snapshot.transactions.map((transaction) => transaction.id),
  );
  const budgetIds = new Set(snapshot.budgets.map((budget) => budget.id));
  const ruleIds = new Set(snapshot.userRules.map((rule) => rule.id));

  useFinanceStore.setState((state) => ({
    categories: state.categories.map((category) =>
      category.id === snapshot.category.id
        ? { ...snapshot.category, deletedAt: null }
        : category,
    ),
    transactions: state.transactions.map((transaction) => {
      if (!transactionIds.has(transaction.id)) return transaction;
      const original = snapshot.transactions.find(
        (item) => item.id === transaction.id,
      );
      return original ?? transaction;
    }),
    budgets: state.budgets.map((budget) => {
      if (!budgetIds.has(budget.id)) return budget;
      const original = snapshot.budgets.find((item) => item.id === budget.id);
      return original ? { ...original, deletedAt: null } : budget;
    }),
    userRules: state.userRules.map((rule) => {
      if (!ruleIds.has(rule.id)) return rule;
      const original = snapshot.userRules.find((item) => item.id === rule.id);
      return original ? { ...original, deletedAt: null } : rule;
    }),
  }));
}
