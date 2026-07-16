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

export type SyncChanges = {
  transactions?: Transaction[];
  categories?: Category[];
  budgets?: Budget[];
  incomeSources?: IncomeSource[];
  userRules?: UserCategoryRule[];
  accounts?: Account[];
  profile?: UserProfile | null;
};

type SyncableEntity = { id: string; updatedAt?: string };

export function getLastSyncedAt(): string | null {
  return useFinanceStore.getState().lastSyncedAt ?? null;
}

export function setLastSyncedAt(serverTime: string): void {
  useFinanceStore.setState({ lastSyncedAt: serverTime });
}

function pickNewer<T extends SyncableEntity>(local: T, remote: T): T {
  const localUpdated = local.updatedAt ?? "";
  const remoteUpdated = remote.updatedAt ?? "";
  return remoteUpdated >= localUpdated ? remote : local;
}

function mergeEntityList<T extends SyncableEntity>(
  localList: T[],
  remoteList: T[] | undefined,
): T[] {
  if (!remoteList || remoteList.length === 0) return localList;

  const byId = new Map<string, T>();
  for (const entity of localList) {
    byId.set(entity.id, entity);
  }
  for (const remoteEntity of remoteList) {
    const existing = byId.get(remoteEntity.id);
    if (!existing) {
      byId.set(remoteEntity.id, remoteEntity);
      continue;
    }
    byId.set(remoteEntity.id, pickNewer(existing, remoteEntity));
  }
  return Array.from(byId.values());
}

/**
 * Merge remote sync payload into the local store using last-write-wins on
 * `updatedAt`. Soft-deleted rows (deletedAt set) are kept for sync tombstones.
 */
export function applyRemoteSyncChanges(changes: SyncChanges): void {
  const state = useFinanceStore.getState();

  let nextProfile = state.profile;
  if (changes.profile) {
    nextProfile = pickNewer(state.profile, changes.profile);
  }

  useFinanceStore.setState({
    profile: nextProfile,
    transactions: mergeEntityList(state.transactions, changes.transactions),
    categories: mergeEntityList(state.categories, changes.categories),
    budgets: mergeEntityList(state.budgets, changes.budgets),
    incomeSources: mergeEntityList(state.incomeSources, changes.incomeSources),
    userRules: mergeEntityList(state.userRules, changes.userRules),
    accounts: mergeEntityList(state.accounts, changes.accounts),
  });
}
