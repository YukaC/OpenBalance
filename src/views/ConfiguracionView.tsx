"use client";

import { useEffect, useState } from "react";
import { CURRENCY_OPTIONS, METHOD_LABELS, WEEKDAY_LABELS } from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";
import {
  clearPin,
  isPinEnabled,
  isValidPinFormat,
  setPin,
  verifyPin,
} from "@/lib/pin-lock";
import { initialsFromName } from "@/lib/profile-setup";
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
  const [email, setEmail] = useState(profile.email);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [pinError, setPinError] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  useEffect(() => {
    setName(profile.name);
  }, [profile.name]);

  useEffect(() => {
    setEmail(profile.email);
  }, [profile.email]);

  useEffect(() => {
    if (!hydrated) return;
    setPinEnabled(isPinEnabled());
  }, [hydrated]);

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

  function handleSaveEmail() {
    const trimmed = email.trim();
    if (!trimmed || trimmed === profile.email) {
      setEmail(profile.email);
      return;
    }
    if (!trimmed.includes("@")) {
      setEmail(profile.email);
      return;
    }
    updateProfile({ email: trimmed });
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
      "¿Restablecer datos de demostración? Se reemplazan perfil, categorías y movimientos. El perfil demo (Mariano) queda con setup completo y no vuelve a pedir onboarding.",
    );
    if (!ok) return;
    resetToSeed();
    setName("Mariano J.");
    setEmail("mariano@example.com");
  }

  async function handleSavePin() {
    setPinError("");
    setPinMessage("");
    if (!isValidPinFormat(newPin)) {
      setPinError("El PIN debe tener entre 4 y 6 dígitos.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("Los PIN no coinciden.");
      return;
    }
    if (pinEnabled) {
      const isCurrentValid = await verifyPin(currentPin);
      if (!isCurrentValid) {
        setPinError("PIN actual incorrecto.");
        return;
      }
    }
    setIsSavingPin(true);
    try {
      await setPin(newPin);
      setPinEnabled(true);
      setNewPin("");
      setConfirmPin("");
      setCurrentPin("");
      setPinMessage(pinEnabled ? "PIN actualizado." : "PIN activado.");
    } finally {
      setIsSavingPin(false);
    }
  }

  async function handleDisablePin() {
    setPinError("");
    setPinMessage("");
    if (!isValidPinFormat(currentPin)) {
      setPinError("Ingresá el PIN actual (4–6 dígitos) para desactivarlo.");
      return;
    }
    const isCurrentValid = await verifyPin(currentPin);
    if (!isCurrentValid) {
      setPinError("PIN actual incorrecto.");
      return;
    }
    clearPin();
    setPinEnabled(false);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinMessage("PIN desactivado.");
  }

  const isSetupComplete = profile.isSetupComplete === true;

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="profile-heading"
            className="font-display text-[16.5px] font-semibold text-[var(--ink)]"
          >
            Perfil
          </h2>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isSetupComplete
                ? "bg-[var(--green-soft,var(--gold-soft))] text-[var(--ink-soft)]"
                : "bg-[var(--bg)] text-[var(--ink-soft)]"
            }`}
          >
            {isSetupComplete ? "Setup completo" : "Setup pendiente"}
          </span>
        </div>
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

        <label htmlFor="profile-email" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Email
          </span>
          <input
            id="profile-email"
            name="profileEmail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleSaveEmail}
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
        aria-labelledby="pin-heading"
      >
        <h2
          id="pin-heading"
          className="font-display text-[16.5px] font-semibold text-[var(--ink)]"
        >
          PIN local
        </h2>
        <p className="text-[13px] text-[var(--ink-soft)]">
          Opcional. Se guarda hasheado en este dispositivo (no hay recuperación
          remota).
        </p>
        <p className="text-[13px] font-medium text-[var(--ink)]">
          Estado: {pinEnabled ? "activado" : "desactivado"}
        </p>

        {pinEnabled ? (
          <label htmlFor="current-pin" className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              PIN actual
            </span>
            <input
              id="current-pin"
              name="currentPin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={currentPin}
              onChange={(e) =>
                setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
            />
          </label>
        ) : null}

        <label htmlFor="new-pin" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            {pinEnabled ? "Nuevo PIN" : "PIN (4–6 dígitos)"}
          </span>
          <input
            id="new-pin"
            name="newPin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={newPin}
            onChange={(e) =>
              setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>

        <label htmlFor="confirm-pin" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
            Confirmar PIN
          </span>
          <input
            id="confirm-pin"
            name="confirmPin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={confirmPin}
            onChange={(e) =>
              setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--ink)]"
          />
        </label>

        {pinError ? (
          <p className="text-[13px] text-[var(--red)]" role="alert">
            {pinError}
          </p>
        ) : null}
        {pinMessage ? (
          <p className="text-[13px] text-[var(--ink-soft)]" role="status">
            {pinMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={isSavingPin}
            onClick={() => void handleSavePin()}
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-50"
          >
            {pinEnabled ? "Cambiar PIN" : "Activar PIN"}
          </button>
          {pinEnabled ? (
            <button
              type="button"
              onClick={() => void handleDisablePin()}
              className="flex h-12 flex-1 items-center justify-center rounded-xl border border-[var(--line)] text-[14px] font-bold text-[var(--red)] transition-colors hover:bg-[var(--red-soft)]"
            >
              Desactivar PIN
            </button>
          ) : null}
        </div>
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
        <p className="text-[12px] leading-relaxed text-[var(--ink-soft)]">
          Restaura el perfil demo (Mariano J.) con <code>isSetupComplete</code>{" "}
          en true, categorías y movimientos de julio 2026. No vuelve a mostrar
          el onboarding.
        </p>
      </section>
    </div>
  );
}
