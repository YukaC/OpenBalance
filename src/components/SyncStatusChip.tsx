"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { isAuthEnabled } from "@/lib/auth-flags";
import { hasPendingLocalChanges } from "@/lib/sync-client";
import {
  SYNC_UI_LABELS,
  deriveSyncUiStatus,
  getIsSyncing,
  getLastSyncError,
  subscribeSyncStatus,
  type SyncUiStatus,
} from "@/lib/sync-status";
import { useFinanceStore } from "@/store/finance-store";

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

const STATUS_CHIP_CLASS: Record<SyncUiStatus, string> = {
  synced:
    "border-[var(--green)]/25 bg-[var(--green-soft)] text-[var(--green)]",
  pending:
    "border-[var(--gold)]/30 bg-[var(--gold-soft)] text-[var(--gold)]",
  syncing:
    "border-[var(--line)] bg-[var(--paper-deep)] text-[var(--ink-soft)]",
  error: "border-[var(--red)]/30 bg-[var(--red-soft)] text-[var(--red)]",
  offline:
    "border-[var(--line)] bg-[var(--paper-deep)] text-[var(--ink-faint)]",
};

interface SyncStatusChipProps {
  compact?: boolean;
}

export function SyncStatusChip({ compact = false }: SyncStatusChipProps) {
  const authEnabled = isAuthEnabled();
  const { status: sessionStatus } = useSession();
  const hydrated = useFinanceStore((s) => s.hydrated);
  const lastSyncedAt = useFinanceStore((s) => s.lastSyncedAt);
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const budgets = useFinanceStore((s) => s.budgets);
  const incomeSources = useFinanceStore((s) => s.incomeSources);
  const userRules = useFinanceStore((s) => s.userRules);
  const accounts = useFinanceStore((s) => s.accounts);
  const profile = useFinanceStore((s) => s.profile);

  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getIsOnlineSnapshot,
    getIsOnlineServerSnapshot,
  );

  const [isSyncing, setIsSyncing] = useState(getIsSyncing);
  const [lastError, setLastError] = useState(getLastSyncError);
  const [hasPending, setHasPending] = useState(false);

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

  if (!authEnabled || !hydrated) return null;
  if (sessionStatus !== "authenticated") return null;

  const uiStatus = deriveSyncUiStatus({
    isOnline,
    isSyncing,
    lastError,
    hasPending,
  });
  const label = SYNC_UI_LABELS[uiStatus];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold leading-none ${STATUS_CHIP_CLASS[uiStatus]} ${
        compact ? "max-w-[7.5rem] truncate" : ""
      }`}
      role="status"
      aria-live="polite"
      title={lastError && uiStatus === "error" ? lastError : label}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          uiStatus === "syncing" ? "animate-pulse bg-current" : "bg-current"
        }`}
        aria-hidden
      />
      <span className={compact ? "truncate" : undefined}>{label}</span>
    </span>
  );
}
