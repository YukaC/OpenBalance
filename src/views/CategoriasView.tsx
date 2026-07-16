"use client";

import { useMemo, useState } from "react";
import { EmojiPicker } from "@/components/EmojiPicker";
import { DEFAULT_CATEGORY_EMOJI } from "@/lib/category-emojis";
import { formatMonthName } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import type { CategoryKind } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";

const KIND_LABELS: Record<CategoryKind, string> = {
  fijo: "Fijo",
  variable: "Variable",
  hormiga: "Hormiga",
};

const KIND_OPTIONS: CategoryKind[] = ["fijo", "variable", "hormiga"];

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
  const addCategory = useFinanceStore((s) => s.addCategory);
  const setBudget = useFinanceStore((s) => s.setBudget);
  const currency = useFinanceStore((s) => s.profile.defaultCurrency);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_EMOJI);
  const [kind, setKind] = useState<CategoryKind>("variable");
  const [draftKeywords, setDraftKeywords] = useState<Record<string, string>>(
    {},
  );
  const [draftBudgets, setDraftBudgets] = useState<Record<string, string>>({});
  const [editingIconCategoryId, setEditingIconCategoryId] = useState<
    string | null
  >(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const budgetByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const budget of budgets) {
      if (budget.month !== selectedMonth) continue;
      map.set(budget.categoryId, budget.amountLimit);
    }
    return map;
  }, [budgets, selectedMonth]);

  const spentByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.month !== selectedMonth || tx.type !== "gasto" || !tx.categoryId) {
        continue;
      }
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
    }
    return map;
  }, [transactions, selectedMonth]);

  if (!hydrated) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-[13px] text-[var(--ink-soft)]">Cargando…</p>
      </div>
    );
  }

  function keywordsValue(id: string, keywords: string[]): string {
    return draftKeywords[id] ?? keywords.join(", ");
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
      setBudget(categoryId, selectedMonth, 0);
    } else {
      const amount = Number(trimmed.replace(",", "."));
      if (Number.isFinite(amount) && amount >= 0) {
        setBudget(categoryId, selectedMonth, amount);
      }
    }
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
      color: "#7a6f64",
      kind,
      keywords: [],
    });
    setName("");
    setIcon(DEFAULT_CATEGORY_EMOJI);
    setKind("variable");
    setIsEmojiOpen(false);
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-[24px] font-semibold text-[var(--ink)]">
          Categorías
        </h1>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Keywords = auto-clasificación de gastos.
        </p>
      </header>

      <section
        className="flex flex-col rounded-[16px] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
        aria-label="Lista de categorías"
      >
        <div aria-label="Categorías guardadas">
          {categories.map((category) => {
            const isEditingIcon = editingIconCategoryId === category.id;
            return (
              <article
                key={category.id}
                className="border-b border-[var(--line)] py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Cambiar ícono de ${category.name}`}
                    aria-expanded={isEditingIcon}
                    onClick={() =>
                      setEditingIconCategoryId(
                        isEditingIcon ? null : category.id,
                      )
                    }
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[16px] leading-none transition-soft focus-visible:outline-none active:scale-95 ${
                      isEditingIcon
                        ? "bg-[var(--select-soft)] ring-2 ring-[var(--select)]"
                        : "bg-[var(--bg)] hover:bg-[var(--paper-deep)]"
                    }`}
                  >
                    {category.icon}
                  </button>

                  <p className="w-[7.5rem] shrink-0 truncate text-[13.5px] font-semibold text-[var(--ink)] sm:w-28">
                    {category.name}
                  </p>

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
                    placeholder="keywords…"
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
        className="space-y-3 rounded-[16px] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
        aria-labelledby="budgets-heading"
      >
        <div>
          <h2
            id="budgets-heading"
            className="font-display text-[16px] font-semibold text-[var(--ink)]"
          >
            Presupuestos
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
            Tope mensual por categoría · {formatMonthName(selectedMonth)}
          </p>
        </div>
        <div className="space-y-2">
          {categories.map((category) => {
            const limit = budgetByCategoryId.get(category.id);
            const spent = spentByCategoryId.get(category.id) ?? 0;
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
                  className="flex min-w-0 flex-1 items-center gap-2"
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
                    onChange={(e) =>
                      setDraftBudgets((prev) => ({
                        ...prev,
                        [category.id]: e.target.value,
                      }))
                    }
                    onBlur={() => handleSaveBudget(category.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    placeholder="Sin tope"
                    className="min-h-10 w-full min-w-[7rem] rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-2 font-mono text-[13px] outline-none transition-soft focus:border-[var(--select)]"
                  />
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
        className="space-y-3 rounded-[16px] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
        aria-labelledby="add-category-heading"
      >
        <h2
          id="add-category-heading"
          className="font-display text-[16px] font-semibold text-[var(--ink)]"
        >
          Nueva categoría
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Elegir ícono"
              aria-expanded={isEmojiOpen}
              onClick={() => setIsEmojiOpen((open) => !open)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[18px] leading-none transition-soft hover:bg-[var(--paper-deep)] focus-visible:outline-none active:scale-95"
            >
              {icon}
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
                    className={`min-h-10 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-soft focus-visible:outline-none active:scale-95 ${
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
              className="min-h-11 shrink-0 rounded-xl bg-[var(--ink)] px-4 text-[13px] font-bold text-[var(--ink-contrast)] transition-soft hover:opacity-90 focus-visible:outline-none active:scale-[0.98]"
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
    </div>
  );
}
