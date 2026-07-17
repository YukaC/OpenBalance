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
import { useToastStore } from "@/store/toast-store";

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

const LWW_CONFLICT_TOAST =
  "Se aplicó la versión más reciente de la nube";

export function getLastSyncedAt(): string | null {
  return useFinanceStore.getState().lastSyncedAt ?? null;
}

export function setLastSyncedAt(serverTime: string): void {
  useFinanceStore.setState({ lastSyncedAt: serverTime });
}

function pickNewer<T extends SyncableEntity>(
  local: T,
  remote: T,
): { entity: T; didOverwriteOlderLocal: boolean } {
  const localUpdated = local.updatedAt ?? "";
  const remoteUpdated = remote.updatedAt ?? "";
  if (remoteUpdated >= localUpdated) {
    // Strictly newer remote discarded an older local edit (LWW).
    const didOverwriteOlderLocal =
      Boolean(localUpdated) && remoteUpdated > localUpdated;
    return { entity: remote, didOverwriteOlderLocal };
  }
  return { entity: local, didOverwriteOlderLocal: false };
}

function mergeEntityList<T extends SyncableEntity>(
  localList: T[],
  remoteList: T[] | undefined,
): { merged: T[]; conflictCount: number } {
  if (!remoteList || remoteList.length === 0) {
    return { merged: localList, conflictCount: 0 };
  }

  let conflictCount = 0;
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
    const { entity, didOverwriteOlderLocal } = pickNewer(
      existing,
      remoteEntity,
    );
    if (didOverwriteOlderLocal) conflictCount += 1;
    byId.set(remoteEntity.id, entity);
  }
  return { merged: Array.from(byId.values()), conflictCount };
}

/**
 * Merge remote sync payload into the local store using last-write-wins on
 * `updatedAt`. Soft-deleted rows (deletedAt set) are kept for sync tombstones.
 * When a newer remote overwrites older local data, surfaces a toast (A3).
 */
export function applyRemoteSyncChanges(changes: SyncChanges): void {
  const state = useFinanceStore.getState();

  let conflictCount = 0;
  let nextProfile = state.profile;
  if (changes.profile) {
    const profileMerge = pickNewer(state.profile, changes.profile);
    nextProfile = profileMerge.entity;
    if (profileMerge.didOverwriteOlderLocal) conflictCount += 1;
  }

  const transactions = mergeEntityList(
    state.transactions,
    changes.transactions,
  );
  const categories = mergeEntityList(state.categories, changes.categories);
  const budgets = mergeEntityList(state.budgets, changes.budgets);
  const incomeSources = mergeEntityList(
    state.incomeSources,
    changes.incomeSources,
  );
  const userRules = mergeEntityList(state.userRules, changes.userRules);
  const accounts = mergeEntityList(state.accounts, changes.accounts);

  conflictCount +=
    transactions.conflictCount +
    categories.conflictCount +
    budgets.conflictCount +
    incomeSources.conflictCount +
    userRules.conflictCount +
    accounts.conflictCount;

  useFinanceStore.setState({
    profile: nextProfile,
    transactions: transactions.merged,
    categories: categories.merged,
    budgets: budgets.merged,
    incomeSources: incomeSources.merged,
    userRules: userRules.merged,
    accounts: accounts.merged,
  });

  if (conflictCount > 0) {
    useToastStore.getState().showToast({ message: LWW_CONFLICT_TOAST });
  }
}
