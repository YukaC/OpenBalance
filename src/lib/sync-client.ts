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
 * Keep this SMALL — a multi-minute window makes every recent entity look
 * "pending" forever after a successful sync (chip stuck + sync spam).
 */
const SKEW_EPSILON_MS = 2_000;

/**
 * Browsers limit keepalive request bodies (~64KB). Leave-flush splits dirty
 * payloads into chunks at or below this estimated JSON size (O4). A single
 * entity that alone exceeds the limit is sent without keepalive; Background
 * Sync / online replay covers any cancelled unload fetch.
 */
export const KEEPALIVE_MAX_BODY_BYTES = 50_000;

const SYNC_LIST_KEYS = [
  "transactions",
  "categories",
  "budgets",
  "incomeSources",
  "userRules",
  "accounts",
] as const;

type SyncListKey = (typeof SYNC_LIST_KEYS)[number];

type SyncableEntity = { id: string; updatedAt?: string; deletedAt?: string | null };

type SyncChangeEntry =
  | { kind: "list"; key: SyncListKey; entity: SyncableEntity }
  | { kind: "profile"; entity: UserProfile };

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
 * Compares skew-adjusted `updatedAt` to `lastSyncedAt`.
 * A tiny epsilon absorbs measurement noise; do NOT use a multi-minute
 * lookback (that keeps hasPendingLocalChanges true after every sync).
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
  return adjustedUpdatedMs > lastSyncedMs + SKEW_EPSILON_MS;
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

/** Estimated JSON body size for a sync POST (UTF-16 code units ≈ bytes for ASCII). */
export function estimateSyncRequestBodyBytes(
  lastSyncedAt: string | null,
  changes: SyncChanges,
): number {
  return JSON.stringify({ lastSyncedAt, changes }).length;
}

function flattenSyncChanges(changes: SyncChanges): SyncChangeEntry[] {
  const entries: SyncChangeEntry[] = [];
  for (const key of SYNC_LIST_KEYS) {
    for (const entity of changes[key] ?? []) {
      entries.push({ kind: "list", key, entity });
    }
  }
  if (changes.profile) {
    entries.push({ kind: "profile", entity: changes.profile });
  }
  return entries;
}

function appendSyncChangeEntry(
  changes: SyncChanges,
  entry: SyncChangeEntry,
): SyncChanges {
  if (entry.kind === "profile") {
    return { ...changes, profile: entry.entity };
  }
  const existingList = (changes[entry.key] ?? []) as SyncableEntity[];
  return {
    ...changes,
    [entry.key]: [...existingList, entry.entity],
  } as SyncChanges;
}

/**
 * Split dirty changes into keepalive-safe POST bodies (O4).
 * Returns one chunk when the full payload fits; otherwise greedily packs
 * entities. A lone entity larger than `maxBytes` is still returned as its
 * own chunk (caller must drop keepalive for that request).
 */
export function chunkSyncChangesForKeepalive(
  changes: SyncChanges,
  lastSyncedAt: string | null,
  maxBytes: number = KEEPALIVE_MAX_BODY_BYTES,
): SyncChanges[] {
  if (changesPayloadSize(changes) === 0) return [];
  if (estimateSyncRequestBodyBytes(lastSyncedAt, changes) <= maxBytes) {
    return [changes];
  }

  const chunks: SyncChanges[] = [];
  let current: SyncChanges = {};

  for (const entry of flattenSyncChanges(changes)) {
    const withEntry = appendSyncChangeEntry(current, entry);
    if (estimateSyncRequestBodyBytes(lastSyncedAt, withEntry) <= maxBytes) {
      current = withEntry;
      continue;
    }

    if (changesPayloadSize(current) > 0) {
      chunks.push(current);
      current = {};
    }

    const alone = appendSyncChangeEntry({}, entry);
    if (estimateSyncRequestBodyBytes(lastSyncedAt, alone) <= maxBytes) {
      current = alone;
    } else {
      chunks.push(alone);
      current = {};
    }
  }

  if (changesPayloadSize(current) > 0) {
    chunks.push(current);
  }
  return chunks;
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
   * When the JSON body exceeds KEEPALIVE_MAX_BODY_BYTES, the client splits
   * into multiple keepalive POSTs (O4) instead of truncating or dropping
   * keepalive for the whole payload.
   */
  keepalive?: boolean;
};

async function parseSyncSuccessResponse(
  response: Response,
): Promise<
  | { ok: true; payload: SyncResponseBody }
  | { ok: false; error: string }
> {
  if (response.status === 401) {
    return { ok: false, error: "Sesión expirada. Volvé a iniciar sesión." };
  }
  if (response.status === 503) {
    return {
      ok: false,
      error: "Servidor no disponible. Probá de nuevo más tarde.",
    };
  }
  if (!response.ok) {
    let message = `Error de sincronización (${response.status}).`;
    try {
      const errorPayload = (await response.json()) as { error?: string };
      if (errorPayload.error) message = errorPayload.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error: message };
  }

  const payload = (await response.json()) as SyncResponseBody;
  if (!payload.serverTime) {
    return { ok: false, error: "Respuesta de sync inválida." };
  }
  return { ok: true, payload };
}

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
  const changes = buildLocalChanges(lastSyncedAt);
  const wantsKeepalive = Boolean(options.keepalive);
  const fullBodyBytes = estimateSyncRequestBodyBytes(lastSyncedAt, changes);

  // O4: oversized leave payloads → N keepalive-sized chunks started together
  // so pagehide does not cancel a single non-keepalive fetch.
  const changeChunks =
    wantsKeepalive && fullBodyBytes > KEEPALIVE_MAX_BODY_BYTES
      ? chunkSyncChangesForKeepalive(changes, lastSyncedAt)
      : [changes];

  try {
    const authHeaders = await getSyncAuthHeaders();

    // Start every fetch immediately (map runs before any await on responses).
    const pendingResponses = changeChunks.map((chunkChanges) => {
      const bodyJson = JSON.stringify({
        lastSyncedAt,
        changes: chunkChanges,
      } satisfies SyncRequestBody);
      const useKeepalive =
        wantsKeepalive && bodyJson.length <= KEEPALIVE_MAX_BODY_BYTES;
      return fetch(`${API_BASE}/api/sync`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
        keepalive: useKeepalive,
        body: bodyJson,
      });
    });

    const responses = await Promise.all(pendingResponses);
    let latestServerTime: string | null = null;

    for (const response of responses) {
      const parsed = await parseSyncSuccessResponse(response);
      if (!parsed.ok) {
        endSync(parsed.error);
        return { ok: false, error: parsed.error };
      }
      applyRemoteSyncChanges(parsed.payload.changes ?? {});
      updateClockSkewFromServerTime(parsed.payload.serverTime);
      if (
        latestServerTime == null ||
        parsed.payload.serverTime > latestServerTime
      ) {
        latestServerTime = parsed.payload.serverTime;
      }
    }

    if (!latestServerTime) {
      const message = "Respuesta de sync inválida.";
      endSync(message);
      return { ok: false, error: message };
    }

    setLastSyncedAt(latestServerTime);
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
