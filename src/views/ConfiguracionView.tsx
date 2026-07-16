"use client";

import { useEffect, useState } from "react";
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
  const updateProfile = useFinanceStore((s) => s.updateProfile);
  const setPayday = useFinanceStore((s) => s.setPayday);
  const resetToSeed = useFinanceStore((s) => s.resetToSeed);

  const [name, setName] = useState(profile.name);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  useEffect(() => {
    setName(profile.name);
  }, [profile.name]);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, [profile.shouldRemindPaydayLoad]);

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

  function handleReset() {
    const ok = window.confirm(
      "¿Restablecer datos de demostración? Se reemplazan perfil, categorías y movimientos.",
    );
    if (!ok) return;
    resetToSeed();
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
        aria-labelledby="reminders-heading"
      >
        <h2
          id="reminders-heading"
          className="font-display text-[16.5px] font-semibold text-[var(--ink)]"
        >
          Recordatorios
        </h2>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Si abrís Rinde el día de cobro y todavía no cargaste el ingreso de la
          semana, te mostramos un aviso. Con permiso del navegador también
          podés recibir una notificación.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--ink)]"
            checked={Boolean(profile.shouldRemindPaydayLoad)}
            onChange={async (event) => {
              const nextEnabled = event.target.checked;
              if (nextEnabled && typeof Notification !== "undefined") {
                if (Notification.permission === "default") {
                  const permission = await Notification.requestPermission();
                  setNotificationPermission(permission);
                } else {
                  setNotificationPermission(Notification.permission);
                }
              }
              updateProfile({ shouldRemindPaydayLoad: nextEnabled });
            }}
          />
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-[var(--ink)]">
              Recordarme cargar el día de cobro
            </span>
            <span className="mt-0.5 block text-[12.5px] text-[var(--ink-soft)]">
              {notificationPermission === "granted"
                ? "Notificaciones del navegador activas."
                : notificationPermission === "denied"
                  ? "El navegador bloqueó notificaciones; el aviso en la app sigue disponible."
                  : "Al activarlo podemos pedir permiso de notificación."}
            </span>
          </span>
        </label>
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
        <button
          type="button"
          onClick={handleExportCsv}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
        >
          Exportar CSV
        </button>
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
