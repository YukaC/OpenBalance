"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CollapsibleLedgerSection } from "@/components/CollapsibleLedgerSection";
import { isAuthEnabled } from "@/lib/auth-flags";
import { pushPullSync } from "@/lib/sync-client";
import { useFinanceStore } from "@/store/finance-store";

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Nunca";
  try {
    return format(parseISO(iso), "d MMM yyyy · HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

export function SyncSection() {
  const { data: session, status } = useSession();
  const hydrated = useFinanceStore((s) => s.hydrated);
  const lastSyncedAt = useFinanceStore((s) => s.lastSyncedAt);

  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const authEnabled = isAuthEnabled();
  const isAuthenticated = status === "authenticated" && Boolean(session?.user);

  async function handleSyncNow() {
    setIsSyncing(true);
    setStatusMessage(null);
    setHasError(false);
    const result = await pushPullSync();
    setIsSyncing(false);
    if (result.ok) {
      setStatusMessage("Sincronización completa.");
      return;
    }
    setHasError(true);
    setStatusMessage(result.error ?? "No se pudo sincronizar.");
  }

  async function handleSignOut() {
    setStatusMessage(null);
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
        Última sync:{" "}
        <span className="font-semibold text-[var(--ink)]">
          {formatSyncedAt(lastSyncedAt)}
        </span>
      </p>

      {authEnabled && isAuthenticated ? (
        <p className="text-[12.5px] text-[var(--ink-faint)]">
          Sesión: {session?.user?.email ?? session?.user?.name ?? "activa"}
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
