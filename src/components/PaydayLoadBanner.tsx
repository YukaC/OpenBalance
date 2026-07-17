"use client";

import { useEffect, useMemo, useState } from "react";
import {
  maybeNotifyPaydayLoad,
  shouldShowPaydayLoadReminder,
} from "@/lib/payday-reminder";
import { useFinanceStore } from "@/store/finance-store";

function getPaydayDismissKey(referenceDate: Date = new Date()): string {
  const dayKey = referenceDate.toISOString().slice(0, 10);
  return `openbalance-payday-dismiss-${dayKey}`;
}

/** LEGACY: read-only migration from pre-rename sessionStorage keys. */
function getLegacyPaydayDismissKey(referenceDate: Date = new Date()): string {
  const dayKey = referenceDate.toISOString().slice(0, 10);
  return `rinde-payday-dismiss-${dayKey}`;
}

function readPaydayDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = getPaydayDismissKey();
    if (sessionStorage.getItem(key) === "1") return true;
    const legacyKey = getLegacyPaydayDismissKey();
    if (sessionStorage.getItem(legacyKey) === "1") {
      sessionStorage.setItem(key, "1");
      sessionStorage.removeItem(legacyKey);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function PaydayLoadBanner() {
  const hydrated = useFinanceStore((s) => s.hydrated);
  const transactions = useFinanceStore((s) => s.transactions);
  const paydayWeekday = useFinanceStore((s) => s.profile.paydayWeekday);
  const shouldRemindPaydayLoad = useFinanceStore(
    (s) => s.profile.shouldRemindPaydayLoad,
  );
  const openForm = useFinanceStore((s) => s.openForm);
  const [isDismissed, setIsDismissed] = useState(readPaydayDismissed);

  const shouldShow = useMemo(() => {
    if (!hydrated || isDismissed) return false;
    return shouldShowPaydayLoadReminder(
      transactions,
      paydayWeekday,
      shouldRemindPaydayLoad,
      new Date(),
    );
  }, [
    hydrated,
    isDismissed,
    transactions,
    paydayWeekday,
    shouldRemindPaydayLoad,
  ]);

  useEffect(() => {
    if (!shouldShow) return;
    maybeNotifyPaydayLoad();
  }, [shouldShow]);

  function handleDismiss() {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(getPaydayDismissKey(), "1");
    } catch {
      // sessionStorage may be unavailable
    }
  }

  if (!shouldShow) return null;

  return (
    <aside
      className="mb-4 rounded-[14px] bg-[var(--gold-soft)] px-3.5 py-3 ring-1 ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
      role="status"
      aria-label="Recordatorio de carga de ingreso"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--gold)]">
            Día de cobro
          </p>
          <p className="mt-1 text-[13.5px] font-semibold leading-snug text-[var(--ink)]">
            Todavía no cargaste el ingreso de esta semana
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--ink-soft)] transition-soft hover:text-[var(--ink)]"
          aria-label="Descartar recordatorio"
        >
          Cerrar
        </button>
      </div>
      <button
        type="button"
        onClick={() => openForm("ingreso")}
        className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--select)] px-3.5 text-[13px] font-bold text-[var(--chip-active-text)] transition-soft hover:opacity-90"
      >
        Cargar ingreso
      </button>
    </aside>
  );
}
