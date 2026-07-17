import { getApiBaseUrl } from "@/lib/auth-flags";
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

type SyncableEntity = { id: string; updatedAt?: string; deletedAt?: string | null };

type SyncRequestBody = {
  lastSyncedAt: string | null;
  changes: SyncChanges;
};

type SyncResponseBody = {
  serverTime: string;
  changes: SyncChanges;
};

function isChangedSince(
  entity: SyncableEntity,
  lastSyncedAt: string | null,
): boolean {
  // Include soft-deleted tombstones so the server learns about deletes.
  if (!lastSyncedAt) return true;
  const updatedAt = entity.updatedAt;
  if (!updatedAt) return true;
  return updatedAt > lastSyncedAt;
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
  if (typeof window !== "undefined" && navigator.onLine === false) {
    return { ok: false, error: "Sin conexión. Los datos siguen en este dispositivo." };
  }

  const lastSyncedAt = getLastSyncedAt();
  const body: SyncRequestBody = {
    lastSyncedAt,
    changes: buildLocalChanges(lastSyncedAt),
  };

  try {
    const response = await fetch(`${API_BASE}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: Boolean(options.keepalive),
      body: JSON.stringify(body),
    });

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
        const payload = (await response.json()) as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        /* ignore */
      }
      return { ok: false, error: message };
    }

    const payload = (await response.json()) as SyncResponseBody;
    if (!payload.serverTime) {
      return { ok: false, error: "Respuesta de sync inválida." };
    }

    applyRemoteSyncChanges(payload.changes ?? {});
    setLastSyncedAt(payload.serverTime);
    return { ok: true };
  } catch (error) {
    if (isOfflineError(error)) {
      return {
        ok: false,
        error: "Sin conexión. Los datos siguen en este dispositivo.",
      };
    }
    return {
      ok: false,
      error: "No se pudo sincronizar. Reintentá más tarde.",
    };
  }
}
