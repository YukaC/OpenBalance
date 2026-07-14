"use client";

import { useEffect, useState } from "react";
import { METHOD_LABELS, WEEKDAY_LABELS } from "@/lib/format";
import type { Weekday } from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";

const WEEKDAYS: Weekday[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

const WEEKDAY_FULL: Record<Weekday, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export default function ConfiguracionPage() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const profile = useFinanceStore((s) => s.profile);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const setPayday = useFinanceStore((s) => s.setPayday);
  const resetToSeed = useFinanceStore((s) => s.resetToSeed);

  const [name, setName] = useState(profile.name);

  useEffect(() => {
    setName(profile.name);
  }, [profile.name]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[13px] text-[var(--ink-muted)]">Cargando…</p>
      </div>
    );
  }

  function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === profile.name) {
      setName(profile.name);
      return;
    }
    updateProfile({ name: trimmed, initials: initialsFromName(trimmed) });
  }

  function handleExportCsv() {
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const sourceById = new Map(incomeSources.map((s) => [s.id, s.name]));
    const header = [
      "fecha",
      "tipo",
      "titulo",
      "monto",
      "moneda",
      "metodo",
      "categoria",
      "fuente",
      "nota",
      "mes",
      "semana",
    ];
    const rows = [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((tx) =>
        [
          tx.date,
          tx.type,
          tx.title,
          String(tx.amount),
          tx.currency,
          METHOD_LABELS[tx.method] ?? tx.method,
          tx.categoryId ? (categoryById.get(tx.categoryId) ?? "") : "",
          tx.incomeSourceId ? (sourceById.get(tx.incomeSourceId) ?? "") : "",
          tx.note,
          tx.month,
          tx.weekIso,
        ]
          .map(escapeCsv)
          .join(","),
      );

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rinde-movimientos-${profile.defaultCurrency.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    const ok = window.confirm(
      "¿Restablecer datos de demostración? Se reemplazan perfil, categorías y movimientos.",
    );
    if (!ok) return;
    resetToSeed();
  }

  return (
    <div className="space-y-10 pb-8">
      <header className="space-y-2">
        <h1 className="font-display text-[28px] text-[var(--ink)] sm:text-[32px]">
          Configuración
        </h1>
        <p className="max-w-[40ch] text-[14px] leading-relaxed text-[var(--ink-muted)]">
          Rinde mira la semana primero — el cobro define el ritmo — y el mes
          como contexto. No al revés.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="profile-heading">
        <h2
          id="profile-heading"
          className="font-display text-[22px] text-[var(--ink)]"
        >
          Perfil
        </h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
            Nombre
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>

        <div>
          <p className="text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
            Moneda
          </p>
          <p className="mt-1.5 text-[15px] font-medium text-[var(--ink)]">
            {profile.defaultCurrency} · pesos argentinos
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="payday-heading">
        <h2
          id="payday-heading"
          className="font-display text-[22px] text-[var(--ink)]"
        >
          Día de cobro
        </h2>
        <p className="text-[13px] text-[var(--ink-muted)]">
          Define el inicio de cada semana personal.
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Día de cobro"
        >
          {WEEKDAYS.map((day) => {
            const active = profile.paydayWeekday === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setPayday(day)}
                title={WEEKDAY_FULL[day]}
                className={`rounded-[var(--radius-full)] px-3 py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? "bg-[var(--chip-active)] text-[var(--chip-active-text)]"
                    : "bg-[var(--chip)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-[var(--ink-muted)]">
          Cobro los {WEEKDAY_FULL[profile.paydayWeekday].toLowerCase()}.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="data-heading">
        <h2
          id="data-heading"
          className="font-display text-[22px] text-[var(--ink)]"
        >
          Datos
        </h2>
        <button
          type="button"
          onClick={handleExportCsv}
          className="flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--line-strong)] bg-[var(--surface)] text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--chip)]"
        >
          Exportar CSV
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--line)] text-[14px] font-medium text-[var(--danger)] transition-colors hover:bg-[var(--chip)]"
        >
          Restablecer datos demo
        </button>
      </section>
    </div>
  );
}
