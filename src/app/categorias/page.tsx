"use client";

import { useState } from "react";
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

export default function CategoriasPage() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const categories = useFinanceStore((s) => s.categories);
  const updateCategory = useFinanceStore((s) => s.updateCategory);
  const addCategory = useFinanceStore((s) => s.addCategory);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [kind, setKind] = useState<CategoryKind>("variable");
  const [draftKeywords, setDraftKeywords] = useState<Record<string, string>>(
    {},
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[13px] text-[var(--ink-muted)]">Cargando…</p>
      </div>
    );
  }

  function keywordsValue(id: string, keywords: string[]): string {
    return draftKeywords[id] ?? keywords.join(", ");
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

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addCategory({
      name: trimmed,
      icon: icon.trim() || "📦",
      color: "#6b7280",
      kind,
      keywords: [],
    });
    setName("");
    setIcon("📦");
    setKind("variable");
  }

  return (
    <div className="space-y-10 pb-8">
      <header className="space-y-2">
        <h1 className="font-display text-[28px] text-[var(--ink)] sm:text-[32px]">
          Categorías
        </h1>
        <p className="max-w-[40ch] text-[14px] leading-relaxed text-[var(--ink-muted)]">
          Las palabras clave clasifican gastos automáticamente cuando el título
          o la nota coinciden.
        </p>
      </header>

      <section className="space-y-1" aria-label="Lista de categorías">
        {categories.map((category) => (
          <article
            key={category.id}
            className="border-b border-[var(--line)] py-4 last:border-b-0"
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--chip)] text-lg leading-none"
                aria-hidden
              >
                {category.icon}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[15px] font-medium text-[var(--ink)]">
                    {category.name}
                  </p>
                  <span className="shrink-0 text-[12px] uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                    {KIND_LABELS[category.kind]}
                  </span>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                    Palabras clave
                  </span>
                  <input
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
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="ej. coto, rappi, super"
                    className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-[13px] outline-none focus:border-[var(--ink)]"
                  />
                </label>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-4" aria-labelledby="add-category-heading">
        <h2
          id="add-category-heading"
          className="font-display text-[22px] text-[var(--ink)]"
        >
          Nueva categoría
        </h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-[4.5rem_1fr] gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                Ícono
              </span>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                aria-label="Emoji de categoría"
                className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-2 py-2.5 text-center text-[18px] outline-none focus:border-[var(--ink)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                Nombre
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mascotas"
                required
                className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
              />
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
              Tipo
            </legend>
            <div className="flex flex-wrap gap-2">
              {KIND_OPTIONS.map((option) => {
                const active = kind === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setKind(option)}
                    className={`rounded-[var(--radius-full)] px-3 py-1.5 text-[12.5px] transition-colors ${
                      active
                        ? "bg-[var(--chip-active)] text-[var(--chip-active-text)]"
                        : "bg-[var(--chip)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {KIND_LABELS[option]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--ink)] text-[14px] font-medium text-[var(--chip-active-text)] transition-opacity hover:opacity-90"
          >
            Agregar categoría
          </button>
        </form>
      </section>
    </div>
  );
}
