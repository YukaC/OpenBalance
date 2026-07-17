import { getApiBaseUrl } from "@/lib/auth-flags";
import { getSyncAuthHeaders } from "@/lib/native-auth";
import {
  beginSync,
  endSync,
  getIsSyncing,
  getLastSyncError,
  resetSyncStatusForTests,
  type SyncUiStatus as DerivedSyncUiStatus,
} from "@/lib/sync-status";
import type {
  Account,
  Budget,
  Category,
  IncomeSource,
  Transaction,
  UserCategoryRule,
  UserProfile,
} from "@/lib/types";
import { useFinanceStore } from "@/store/finance-store";
import {
  applyRemoteSyncChanges,
  getLastSyncedAt,
  setLastSyncedAt,
  type SyncChanges,
} from "@/store/sync-actions";

const API_BASE = getApiBaseUrl();

/**
 * Extra window so a slightly behind client clock still pushes recent edits.
 * Combined with clockSkewMs from the last serverTime.
 */
const SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Browsers limit keepalive request bodies (~64KB). Above this estimated JSON
 * size we still sync, but without keepalive so the body is not truncated.
 */
const KEEPALIVE_MAX_BODY_BYTES = 50_000;

type SyncableEntity = { id: string; updatedAt?: string; deletedAt?: string | null };

type SyncRequestBody = {
  lastSyncedAt: string | null;
  changes: SyncChanges;
};

type SyncResponseBody = {
  serverTime: string;
  changes: SyncChanges;
};

/** @deprecated Prefer deriveSyncUiStatus / SYNC_UI_LABELS from sync-status. */
export type SyncUiStatus = "idle" | DerivedSyncUiStatus;

/** serverTime − clientNow; positive when the client clock is behind the server. */
let clockSkewMs = 0;

/** Update skew estimate from a successful sync's serverTime. */
export function updateClockSkewFromServerTime(serverTime: string): void {
  const serverMs = Date.parse(serverTime);
  if (Number.isNaN(serverMs)) return;
  clockSkewMs = serverMs - Date.now();
}

/** Exposed for unit tests (clock-skew pending detection). */
export function getClockSkewMs(): number {
  return clockSkewMs;
}

/** Exposed for unit tests — reset between cases. */
export function resetSyncClientClockStateForTests(): void {
  clockSkewMs = 0;
  resetSyncStatusForTests();
}

/**
 * Whether a local entity should be included in the next push.
 * Adjusts client `updatedAt` by clockSkewMs and always includes entities
 * within SKEW_TOLERANCE_MS of lastSyncedAt so a behind clock cannot drop edits.
 */
export function isChangedSince(
  entity: SyncableEntity,
  lastSyncedAt: string | null,
  skewMs: number = clockSkewMs,
): boolean {
  // Include soft-deleted tombstones so the server learns about deletes.
  if (!lastSyncedAt) return true;
  const updatedAt = entity.updatedAt;
  if (!updatedAt) return true;

  const updatedMs = Date.parse(updatedAt);
  const lastSyncedMs = Date.parse(lastSyncedAt);
  if (Number.isNaN(updatedMs) || Number.isNaN(lastSyncedMs)) return true;

  const adjustedUpdatedMs = updatedMs + skewMs;
  // Push if skew-adjusted time is after cursor, or raw time is inside tolerance.
  return (
    adjustedUpdatedMs > lastSyncedMs ||
    updatedMs >= lastSyncedMs - SKEW_TOLERANCE_MS
  );
}

function collectChangedEntities<T extends SyncableEntity>(
  entities: T[],
  lastSyncedAt: string | null,
): T[] {
  return entities.filter((entity) => isChangedSince(entity, lastSyncedAt));
}

function buildLocalChanges(lastSyncedAt: string | null): SyncChanges {
  const state = useFinanceStore.getState();
  const changes: SyncChanges = {};

  const transactions = collectChangedEntities(
    state.transactions as Transaction[],
    lastSyncedAt,
  );
  if (transactions.length > 0) changes.transactions = transactions;

  const categories = collectChangedEntities(
    state.categories as Category[],
    lastSyncedAt,
  );
  if (categories.length > 0) changes.categories = categories;

  const budgets = collectChangedEntities(
    state.budgets as Budget[],
    lastSyncedAt,
  );
  if (budgets.length > 0) changes.budgets = budgets;

  const incomeSources = collectChangedEntities(
    state.incomeSources as IncomeSource[],
    lastSyncedAt,
  );
  if (incomeSources.length > 0) changes.incomeSources = incomeSources;

  const userRules = collectChangedEntities(
    state.userRules as UserCategoryRule[],
    lastSyncedAt,
  );
  if (userRules.length > 0) changes.userRules = userRules;

  const accounts = collectChangedEntities(
    state.accounts as Account[],
    lastSyncedAt,
  );
  if (accounts.length > 0) changes.accounts = accounts;

  const profile = state.profile as UserProfile;
  if (isChangedSince(profile, lastSyncedAt)) {
    changes.profile = profile;
  }

  return changes;
}

function changesPayloadSize(changes: SyncChanges): number {
  return (
    (changes.transactions?.length ?? 0) +
    (changes.categories?.length ?? 0) +
    (changes.budgets?.length ?? 0) +
    (changes.incomeSources?.length ?? 0) +
    (changes.userRules?.length ?? 0) +
    (changes.accounts?.length ?? 0) +
    (changes.profile ? 1 : 0)
  );
}

/** True when local entities changed since last successful cloud sync. */
export function hasPendingLocalChanges(): boolean {
  return changesPayloadSize(buildLocalChanges(getLastSyncedAt())) > 0;
}

/**
 * Derived UI chip status for sync (A1 helper).
 * "idle" maps to synced when there is nothing pending.
 */
export function getSyncUiStatus(): SyncUiStatus {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "offline";
  }
  if (getIsSyncing()) return "syncing";
  if (getLastSyncError()) return "error";
  if (hasPendingLocalChanges()) return "pending";
  return "idle";
}

function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  if (error instanceof TypeError) {
    // fetch network failure
    return true;
  }
  return false;
}

export type PushPullSyncOptions = {
  /**
   * Keep the request alive after the tab closes (pagehide / background).
   * Prefer only when flushing pending local changes on leave.
   * Ignored when the JSON body exceeds KEEPALIVE_MAX_BODY_BYTES (O4).
   */
  keepalive?: boolean;
};

/**
 * Push local dirty entities and pull remote changes since lastSyncedAt.
 * Soft-fails when offline or the API is unavailable — local-first stays usable.
 */
export async function pushPullSync(
  options: PushPullSyncOptions = {},
): Promise<{ ok: boolean; error?: string }> {
  beginSync();

  if (typeof window !== "undefined" && navigator.onLine === false) {
    const offlineMessage =
      "Sin conexión. Los datos siguen en este dispositivo.";
    endSync(offlineMessage);
    return { ok: false, error: offlineMessage };
  }

  const lastSyncedAt = getLastSyncedAt();
  const body: SyncRequestBody = {
    lastSyncedAt,
    changes: buildLocalChanges(lastSyncedAt),
  };
  const bodyJson = JSON.stringify(body);
  // Keepalive bodies are capped by the browser (~64KB). Large dirty payloads
  // still sync with a normal fetch so the request is not silently truncated.
  const useKeepalive =
    Boolean(options.keepalive) && bodyJson.length <= KEEPALIVE_MAX_BODY_BYTES;

  try {
    const authHeaders = await getSyncAuthHeaders();
    const response = await fetch(`${API_BASE}/api/sync`, {
      method: "POST",
      headers: authHeaders,
      credentials: "include",
      keepalive: useKeepalive,
      body: bodyJson,
    });

    if (response.status === 401) {
      const message = "Sesión expirada. Volvé a iniciar sesión.";
      endSync(message);
      return { ok: false, error: message };
    }
    if (response.status === 503) {
      const message = "Servidor no disponible. Probá de nuevo más tarde.";
      endSync(message);
      return { ok: false, error: message };
    }
    if (!response.ok) {
      let message = `Error de sincronización (${response.status}).`;
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        /* ignore */
      }
      endSync(message);
      return { ok: false, error: message };
    }

    const payload = (await response.json()) as SyncResponseBody;
    if (!payload.serverTime) {
      const message = "Respuesta de sync inválida.";
      endSync(message);
      return { ok: false, error: message };
    }

    applyRemoteSyncChanges(payload.changes ?? {});
    updateClockSkewFromServerTime(payload.serverTime);
    setLastSyncedAt(payload.serverTime);
    endSync(null);
    return { ok: true };
  } catch (error) {
    if (isOfflineError(error)) {
      const message = "Sin conexión. Los datos siguen en este dispositivo.";
      endSync(message);
      return { ok: false, error: message };
    }
    const message = "No se pudo sincronizar. Reintentá más tarde.";
    endSync(message);
    return { ok: false, error: message };
  }
}
