"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { signOut, useSession } from "next-auth/react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { isAuthEnabled } from "@/lib/auth-flags";
import {
  NATIVE_AUTH_CHANGED_EVENT,
  clearNativeAuthToken,
  hasNativeAuthToken,
} from "@/lib/native-auth";
import { hasPendingLocalChanges, pushPullSync } from "@/lib/sync-client";
import {
  SYNC_UI_LABELS,
  deriveSyncUiStatus,
  getIsSyncing,
  getLastSyncError,
  subscribeSyncStatus,
} from "@/lib/sync-status";
import { useFinanceStore } from "@/store/finance-store";

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Nunca";
  try {
    return format(parseISO(iso), "d MMM yyyy · HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function getIsOnlineSnapshot(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getIsOnlineServerSnapshot(): boolean {
  return true;
}

export function SyncSection() {
  const { data: session, status } = useSession();
  const hydrated = useFinanceStore((s) => s.hydrated);
  const lastSyncedAt = useFinanceStore((s) => s.lastSyncedAt);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const budgets = useFinanceStore((s) => s.budgets);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const userRules = useFinanceStore((s) => s.userRules);
  const accounts = useFinanceStore((s) => s.accounts);
  const profile = useFinanceStore((s) => s.profile);

  const [isSyncing, setIsSyncing] = useState(getIsSyncing);
  const [lastError, setLastError] = useState(getLastSyncError);
  const [hasPending, setHasPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [hasNativeSession, setHasNativeSession] = useState(false);

  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getIsOnlineSnapshot,
    getIsOnlineServerSnapshot,
  );

  const authEnabled = isAuthEnabled();
  const isAuthenticated =
    (status === "authenticated" && Boolean(session?.user)) || hasNativeSession;

  useEffect(() => {
    let isCancelled = false;
    async function refreshNativeSession() {
      const hasToken = await hasNativeAuthToken();
      if (!isCancelled) setHasNativeSession(hasToken);
    }
    void refreshNativeSession();
    function onNativeAuthChanged() {
      void refreshNativeSession();
    }
    window.addEventListener(NATIVE_AUTH_CHANGED_EVENT, onNativeAuthChanged);
    return () => {
      isCancelled = true;
      window.removeEventListener(NATIVE_AUTH_CHANGED_EVENT, onNativeAuthChanged);
    };
  }, []);

  useEffect(() => {
    return subscribeSyncStatus(() => {
      setIsSyncing(getIsSyncing());
      setLastError(getLastSyncError());
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setHasPending(hasPendingLocalChanges());
  }, [
    hydrated,
    lastSyncedAt,
    transactions,
    categories,
    budgets,
    incomeSources,
    userRules,
    accounts,
    profile,
  ]);

  const syncUiStatus = deriveSyncUiStatus({
    isOnline,
    isSyncing,
    lastError,
    hasPending,
  });

  async function handleSyncNow() {
    setStatusMessage(null);
    setHasError(false);
    const result = await pushPullSync();
    if (result.ok) {
      setStatusMessage("Sincronización completa.");
      return;
    }
    setHasError(true);
    setStatusMessage(result.error ?? "No se pudo sincronizar.");
  }

  async function handleSignOut() {
    setStatusMessage(null);
    await clearNativeAuthToken();
    await signOut({ redirect: false });
    setStatusMessage("Sesión cerrada. Los datos locales se conservan.");
  }

  if (!hydrated) return null;

  return (
    <CollapsibleLedgerSection
      headingId="sync-heading"
      title="Sincronización"
      lede={
        authEnabled ? (
          <p className="section-lede">
            Sync automática al iniciar sesión; si editás, sube sola tras 10
            minutos quietos o al salir/ocultar la pestaña (solo si hay cambios
            pendientes). Este botón fuerza una sync ahora.
          </p>
        ) : (
          <p className="section-lede">
            Modo local: la sincronización en la nube está desactivada. Tus
            datos quedan en este dispositivo.
          </p>
        )
      }
      defaultOpen={authEnabled}
    >
      <p className="text-[13px] text-[var(--ink-soft)]">
        Estado:{" "}
        <span className="font-semibold text-[var(--ink)]">
          {authEnabled && isAuthenticated
            ? SYNC_UI_LABELS[syncUiStatus]
            : authEnabled
              ? "Sin sesión"
              : "Solo local"}
        </span>
      </p>

      <p className="text-[13px] text-[var(--ink-soft)]">
        Última sync:{" "}
        <span className="font-semibold text-[var(--ink)]">
          {formatSyncedAt(lastSyncedAt)}
        </span>
      </p>

      {authEnabled && isAuthenticated ? (
        <p className="text-[12.5px] text-[var(--ink-faint)]">
          Sesión:{" "}
          {session?.user?.email ??
            session?.user?.name ??
            (hasNativeSession ? "nativa (Bearer)" : "activa")}
        </p>
      ) : null}

      {authEnabled && !isAuthenticated && status !== "loading" ? (
        <p className="text-[13px] text-[var(--ink-soft)]">
          Iniciá sesión para sincronizar entre dispositivos.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          void handleSyncNow();
        }}
        disabled={isSyncing || (authEnabled && !isAuthenticated)}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-[var(--select)] text-[14px] font-bold text-[var(--chip-active-text)] transition-colors hover:brightness-110 disabled:opacity-50"
      >
        {isSyncing ? "Sincronizando…" : "Sincronizar ahora"}
      </button>

      {authEnabled && isAuthenticated ? (
        <button
          type="button"
          onClick={() => {
            void handleSignOut();
          }}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[14px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--paper-deep)]"
        >
          Cerrar sesión
        </button>
      ) : null}

      {statusMessage ? (
        <p
          className={`text-[13px] ${hasError ? "text-[var(--red)]" : "text-[var(--ink-soft)]"}`}
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}
    </CollapsibleLedgerSection>
  );
}
