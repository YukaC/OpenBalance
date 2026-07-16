"use client";

import { useEffect, useRef, useState } from "react";
import { downloadJsonFile, parseFinanceBackup } from "@/lib/backup";
import { parseTransactionsCsv } from "@/lib/csv-io";
import { CURRENCY_OPTIONS, METHOD_LABELS, WEEKDAY_LABELS } from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";
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

export default function ConfiguracionView() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const profile = useFinanceStore((s) => s.profile);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const accounts = useFinanceStore((s) => s.accounts);
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const setPayday = useFinanceStore((s) => s.setPayday);
  const resetToSeed = useFinanceStore((s) => s.resetToSeed);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const exportBackup = useFinanceStore((s) => s.exportBackup);
  const restoreBackup = useFinanceStore((s) => s.restoreBackup);
  const addAccount = useFinanceStore((s) => s.addAccount);
  const removeAccount = useFinanceStore((s) => s.removeAccount);

  const [name, setName] = useState(profile.name);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountCurrency, setNewAccountCurrency] =
    useState<CurrencyCode>("ARS");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(profile.name);
  }, [profile.name]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[13px] text-[var(--ink-soft)]">Cargando…</p>
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

  async function handleImportCsv(file: File | undefined) {
    if (!file) return;
    setImportMessage(null);
    try {
      const text = await file.text();
      const { rows, skippedCount } = parseTransactionsCsv(
        text,
        categories,
        incomeSources,
        profile.defaultCurrency,
      );
      for (const row of rows) {
        addTransaction({
          type: row.type,
          amount: row.amount,
          date: row.date,
          method: row.method,
          categoryId: row.categoryId,
          incomeSourceId: row.incomeSourceId,
          note: row.note,
          title: row.title,
          currency: row.currency,
          origin: row.origin,
        });
      }
      const parts = [`Se importaron ${rows.length} movimientos.`];
      if (skippedCount > 0) {
        parts.push(`Se omitieron ${skippedCount} filas inválidas.`);
      }
      setImportMessage(parts.join(" "));
    } catch {
      setImportMessage("No se pudo leer el CSV.");
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  function handleExportBackup() {
    const payload = exportBackup();
    downloadJsonFile(
      `rinde-respaldo-${payload.exportedAt.slice(0, 10)}.json`,
      payload,
    );
  }

  async function handleRestoreBackup(file: File | undefined) {
    if (!file) return;
    const ok = window.confirm(
      "¿Restaurar respaldo? Se reemplazan perfil, categorías, movimientos, presupuestos y cuentas.",
    );
    if (!ok) {
      if (backupInputRef.current) backupInputRef.current.value = "";
      return;
    }
    try {
      const text = await file.text();
      const payload = parseFinanceBackup(text);
      if (!payload) {
        window.alert("El archivo no es un respaldo válido de Rinde.");
        return;
      }
      restoreBackup(payload);
      setImportMessage("Respaldo restaurado correctamente.");
    } catch {
      window.alert("No se pudo leer el respaldo.");
    }
    if (backupInputRef.current) backupInputRef.current.value = "";
  }

  function handleAddAccount(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = newAccountName.trim();
    if (!trimmed) return;
    addAccount({ name: trimmed, currency: newAccountCurrency });
    setNewAccountName("");
    setNewAccountCurrency(profile.defaultCurrency);
  }

  function handleReset() {
    const ok = window.confirm(
      "¿Restablecer datos de demostración? Se reemplazan perfil, categorías y movimientos.",
    );
    if (!ok) return;
    resetToSeed();
    setImportMessage(null);
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="space-y-2">
        <h1 className="font-display text-[26px] font-semibold text-[var(--ink)]">
          Configuración
        </h1>
        <p className="max-w-[40ch] text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Rinde mira la semana primero — el cobro define el ritmo — y el mes
          como contexto. No al revés.
        </p>
      </header>

      <section
        className="space-y-4 rounded-[18px] bg-[var(--card)] p-[22px] shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
        aria-labelledby="profile-heading"
      >
        <h2
          id="profile-heading"
          className="font-display text-[16.5px] font-semibold text-[var(--ink)]"
        >
          Perfil
        </h2>
        <label htmlFor="profile-name" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Nombre
          </span>
          <input
            id="profile-name"
            name="profileName"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>

        <div>
          <p className="mb-2 text-[12px] font-semibold text-[var(--ink-soft)]">
            Moneda
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Moneda por defecto"
          >
            {CURRENCY_OPTIONS.map((option) => {
              const active = profile.defaultCurrency === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateProfile({
                      defaultCurrency: option.value as CurrencyCode,
                    })
                  }
                  aria-pressed={active}
                  className={`rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    active
                      ? "is-selected-solid"
                      : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {option.shortLabel}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
            {
              CURRENCY_OPTIONS.find((o) => o.value === profile.defaultCurrency)
                ?.label
            }
          </p>
        </div>
      </section>

      <section
        className="space-y-3 rounded-[18px] bg-[var(--card)] p-[22px] shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
        aria-labelledby="accounts-heading"
      >
        <h2
          id="accounts-heading"
          className="font-display text-[16.5px] font-semibold text-[var(--ink)]"
        >
          Cuentas
        </h2>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Multi-cuenta lite: cada movimiento puede asociarse a una cuenta.
        </p>
        <ul className="space-y-2">
          {accounts.map((account) => {
            const isDefault = profile.defaultAccountId === account.id;
            return (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-[var(--ink)]">
                  {account.name}{" "}
                  <span className="font-normal text-[var(--ink-soft)]">
                    · {account.currency}
                  </span>
                  {isDefault ? (
                    <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-faint)]">
                      Default
                    </span>
                  ) : null}
                </span>
                {!isDefault ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateProfile({ defaultAccountId: account.id })
                    }
                    className="rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--ink-soft)] hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]"
                  >
                    Usar por defecto
                  </button>
                ) : null}
                {accounts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeAccount(account.id)}
                    className="rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--red)] hover:bg-[var(--red-soft)]"
                  >
                    Quitar
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <form
          onSubmit={handleAddAccount}
          className="flex flex-wrap items-end gap-2 pt-1"
        >
          <label htmlFor="new-account-name" className="flex min-w-[10rem] flex-1 flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Nueva cuenta
            </span>
            <input
              id="new-account-name"
              name="accountName"
              autoComplete="off"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Ej. Dólares"
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            />
          </label>
          <label htmlFor="new-account-currency" className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              Moneda
            </span>
            <select
              id="new-account-currency"
              name="accountCurrency"
              value={newAccountCurrency}
              onChange={(e) =>
                setNewAccountCurrency(e.target.value as CurrencyCode)
              }
              className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.shortLabel}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-[var(--ink)] px-4 text-[13px] font-bold text-[var(--ink-contrast)] transition-colors hover:opacity-90"
          >
            Agregar
          </button>
        </form>
      </section>

      <section
        className="space-y-3 rounded-[18px] bg-[var(--card)] p-[22px] shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
        aria-labelledby="payday-heading"
      >
        <h2
          id="payday-heading"
          className="font-display text-[16.5px] font-semibold text-[var(--ink)]"
        >
          Día de cobro
        </h2>
        <p className="text-[13px] text-[var(--ink-soft)]">
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
                aria-pressed={active}
                className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  active
                    ? "is-selected-solid"
                    : "bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                {WEEKDAY_LABELS[day]}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Cobro los {WEEKDAY_FULL[profile.paydayWeekday].toLowerCase()}.
        </p>
      </section>

      <section
        className="space-y-3 rounded-[18px] bg-[var(--card)] p-[22px] shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
        aria-labelledby="data-heading"
      >
        <h2
          id="data-heading"
          className="font-display text-[16.5px] font-semibold text-[var(--ink)]"
        >
          Datos
        </h2>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => handleImportCsv(e.target.files?.[0])}
        />
        <input
          ref={backupInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => handleRestoreBackup(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={handleExportCsv}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
        >
          Exportar CSV
        </button>
        <button
          type="button"
          onClick={() => csvInputRef.current?.click()}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
        >
          Importar CSV
        </button>
        <button
          type="button"
          onClick={handleExportBackup}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
        >
          Respaldo
        </button>
        <button
          type="button"
          onClick={() => backupInputRef.current?.click()}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
        >
          Restaurar respaldo
        </button>
        {importMessage ? (
          <p className="text-[13px] text-[var(--ink-soft)]" role="status">
            {importMessage}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleReset}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] text-[14px] font-bold text-[var(--red)] transition-colors hover:bg-[var(--red-soft)]"
        >
          Restablecer datos demo
        </button>
      </section>
    </div>
  );
}
