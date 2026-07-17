/**
 * Thin shared sync UI state (in-flight + last error).
 * Updated by pushPullSync; read by SyncStatusChip / SyncSection.
 */

export type SyncUiStatus =
  | "synced"
  | "pending"
  | "syncing"
  | "error"
  | "offline";

export const SYNC_UI_LABELS: Record<SyncUiStatus, string> = {
  synced: "Sincronizado",
  pending: "Pendiente",
  syncing: "Sincronizando…",
  error: "Error",
  offline: "Sin conexión",
};

type SyncStatusListener = () => void;

let isSyncing = false;
let lastError: string | null = null;
const listeners = new Set<SyncStatusListener>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getIsSyncing(): boolean {
  return isSyncing;
}

export function getLastSyncError(): string | null {
  return lastError;
}

export function subscribeSyncStatus(listener: SyncStatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginSync(): void {
  isSyncing = true;
  notifyListeners();
}

export function endSync(error: string | null = null): void {
  isSyncing = false;
  lastError = error;
  notifyListeners();
}

/** Exposed for unit tests — reset between cases. */
export function resetSyncStatusForTests(): void {
  isSyncing = false;
  lastError = null;
  notifyListeners();
}

/** Derive chip / settings label from live flags. Priority: offline → syncing → error → pending → synced. */
export function deriveSyncUiStatus(options: {
  isOnline: boolean;
  isSyncing: boolean;
  lastError: string | null;
  hasPending: boolean;
}): SyncUiStatus {
  if (!options.isOnline) return "offline";
  if (options.isSyncing) return "syncing";
  if (options.lastError) return "error";
  if (options.hasPending) return "pending";
  return "synced";
}
