"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BACKUP_VERSION, type FinanceBackupPayload } from "@/lib/backup";
import {
  suggestCategoryId,
  applyCategoryCorrectionMemory,
} from "@/lib/classifier";
import { sanitizeCssColor } from "@/lib/color-utils";
import {
  getAppToday,
  inferFixedPayWeekIndex,
  shiftIsoDateByMonths,
  toMonthKey,
  toWeekIso,
  todayIso,
} from "@/lib/dates";
import {
  consumeWasLastGetLockedCiphertext,
  createEncryptedPersistStorage,
  FINANCE_STORAGE_NAME,
} from "@/lib/encrypted-storage";
import { ensureLifecycle, isActive, touch } from "@/lib/entity-lifecycle";
import { roundAmountForCurrency } from "@/lib/format";
import { isPinEnabled } from "@/lib/pin-lock";
import { projectRecurringIncomeToMonth } from "@/lib/recurring-income";
import { markTransactionsRepairedThisSession } from "@/lib/repair-session";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  DEFAULT_INCOME_SOURCES,
  DEFAULT_PROFILE,
  DEFAULT_USER_RULES,
  normalizeIncomeSources,
  SEED_TRANSACTIONS,
} from "@/lib/seed";
import type {
  Account,
  Budget,
  Category,
  IncomeSource,
  LoadOrigin,
  PayCadence,
  PaymentMethod,
  PaydayDayOfMonth,
  Transaction,
  TransactionType,
  UserCategoryRule,
  UserProfile,
  Weekday,
} from "@/lib/types";

/** First-run blank profile — onboarding claims it; seed demo uses DEFAULT_PROFILE. */
const BLANK_PROFILE: UserProfile = {
  id: "user-1",
  name: "",
  email: "",
  defaultCurrency: "ARS",
  payCadence: "monthly",
  paydayWeekday: "viernes",
  paydayDayOfMonth: 1,
  initials: "??",
  isSetupComplete: false,
  defaultAccountId: "acc-principal",
  shouldRemindPaydayLoad: false,
  updatedAt: new Date(0).toISOString(),
  deletedAt: null,
};

export type ViewMode = "mes" | "semana";

interface NewTransactionInput {
  type: TransactionType;
  amount: number;
  date: string;
  method: PaymentMethod;
  categoryId: string | null;
  incomeSourceId: string | null;
  accountId?: string | null;
  note: string;
  title: string;
  isFixed?: boolean;
  /**
   * For fixed expenses: pay week of the month (1 = primera, 4 = cuarta).
   */
  fixedPayWeekIndex?: number;
  /**
   * Credit-card installments only: when > 1, splits amount across months.
   * Ignored when isFixed is true.
   */
  installmentCount?: number;
  currency?: "ARS" | "USD";
  origin?: LoadOrigin;
}

interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  note?: string;
}

function buildInstallmentAmounts(
  totalAmount: number,
  count: number,
  currency: "ARS" | "USD",
): number[] {
  if (currency === "USD") {
    const totalCents = Math.round(totalAmount * 100);
    const base = Math.floor(totalCents / count);
    let remainder = totalCents - base * count;
    return Array.from({ length: count }, () => {
      const cents = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return cents / 100;
    });
  }

  const base = Math.floor(totalAmount / count);
  let remainder = totalAmount - base * count;
  return Array.from({ length: count }, () => {
    const amount = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return amount;
  });
}

interface FinanceState {
  profile: UserProfile;
  categories: Category[];
  incomeSources: IncomeSource[];
  transactions: Transaction[];
  userRules: UserCategoryRule[];
  budgets: Budget[];
  accounts: Account[];
  selectedMonth: string;
  selectedWeekIso: string | null;
  viewMode: ViewMode;
  isFormOpen: boolean;
  formPrefillType: TransactionType;
  formPrefillDate: string | null;
  editingTransactionId: string | null;
  hydrated: boolean;
  /** Last successful remote sync timestamp; null until sync lands. */
  lastSyncedAt: string | null;
  setHydrated: (value: boolean) => void;
  setSelectedMonth: (monthKey: string) => void;
  setSelectedWeekIso: (weekIso: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  openForm: (
    type?: TransactionType,
    options?: { date?: string },
  ) => void;
  openFormForEdit: (transactionId: string) => void;
  closeForm: () => void;
  addTransaction: (input: NewTransactionInput) => void;
  /** Linked gasto+ingreso pair between two accounts (excluded from month totals). */
  addTransfer: (input: TransferInput) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (
    id: string,
    options?: { deleteInstallmentGroup?: boolean },
  ) => void;
  /** Remove duplicate ids from the ledger (structural safety net). */
  repairTransactions: () => void;
  restoreTransactions: (transactions: Transaction[]) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  addIncomeSource: (source: Omit<IncomeSource, "id">) => void;
  updateIncomeSource: (id: string, patch: Partial<IncomeSource>) => void;
  /**
   * Materialize virtual recurring-income projections for `monthKey` as real
   * ledger rows (G6). Returns how many transactions were created.
   */
  materializeProjectedRecurringIncome: (monthKey: string) => number;
  updateProfile: (patch: Partial<UserProfile>) => void;
  setPayday: (weekday: Weekday) => void;
  setPayCadence: (payCadence: PayCadence) => void;
  setPaydayDayOfMonth: (dayOfMonth: PaydayDayOfMonth) => void;
  setBudget: (categoryId: string, month: string, amountLimit: number) => void;
  removeBudget: (id: string) => void;
  addAccount: (account: Omit<Account, "id">) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  rememberCategoryCorrection: (pattern: string, categoryId: string) => void;
  suggestCategory: (text: string) => { categoryId: string | null; isAuto: boolean };
  exportBackup: () => FinanceBackupPayload;
  restoreBackup: (payload: FinanceBackupPayload) => void;
  resetToSeed: () => void;
}

function createId(prefix: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `${prefix}-${randomUuid}`;

  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
}

function transactionPayloadKey(transaction: {
  type: Transaction["type"];
  amount: number;
  date: string;
  title: string;
  method: Transaction["method"];
  categoryId: string | null;
  incomeSourceId: string | null;
  note?: string;
}): string {
  return [
    transaction.type,
    transaction.amount,
    transaction.date,
    transaction.title,
    transaction.method,
    transaction.categoryId ?? "",
    transaction.incomeSourceId ?? "",
    (transaction.note ?? "").trim(),
  ].join("|");
}

function dedupeTransactionsById(transactions: Transaction[]): Transaction[] {
  const seenIds = new Set<string>();
  const unique: Transaction[] = [];
  for (const transaction of transactions) {
    if (seenIds.has(transaction.id)) continue;
    seenIds.add(transaction.id);
    unique.push(transaction);
  }
  return unique;
}

function isSameTransactionPayload(
  existing: Transaction,
  candidate: {
    type: Transaction["type"];
    amount: number;
    date: string;
    title: string;
    method: Transaction["method"];
    categoryId: string | null;
    incomeSourceId: string | null;
    note?: string;
  },
): boolean {
  return (
    transactionPayloadKey(existing) === transactionPayloadKey(candidate)
  );
}

function resolveDefaultAccountId(
  profile: UserProfile,
  accounts: Account[],
): string | null {
  const activeAccounts = accounts.filter(isActive);
  if (
    profile.defaultAccountId &&
    activeAccounts.some((account) => account.id === profile.defaultAccountId)
  ) {
    return profile.defaultAccountId;
  }
  return activeAccounts[0]?.id ?? null;
}

function softDeleteById<T extends { id: string; deletedAt?: string | null }>(
  items: T[],
  id: string,
  nowIso: string,
): T[] {
  return items.map((item) =>
    item.id === id ? touch({ ...item, deletedAt: nowIso }) : item,
  );
}

function migrateEntitiesForSync<T extends { updatedAt?: string; deletedAt?: string | null }>(
  entities: T[],
  nowIso: string,
): T[] {
  return entities.map((entity) => ensureLifecycle(entity, nowIso));
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      profile: BLANK_PROFILE,
      categories: DEFAULT_CATEGORIES,
      incomeSources: DEFAULT_INCOME_SOURCES,
      transactions: [],
      userRules: DEFAULT_USER_RULES,
      budgets: [],
      accounts: DEFAULT_ACCOUNTS,
      selectedMonth: toMonthKey(getAppToday()),
      selectedWeekIso: null,
      viewMode: "mes",
      isFormOpen: false,
      formPrefillType: "ingreso",
      formPrefillDate: null,
      editingTransactionId: null,
      hydrated: false,
      lastSyncedAt: null,
      setHydrated: (value) => set({ hydrated: value }),
      setSelectedMonth: (monthKey) =>
        set({ selectedMonth: monthKey, selectedWeekIso: null }),
      setSelectedWeekIso: (weekIso) => set({ selectedWeekIso: weekIso }),
      setViewMode: (mode) => set({ viewMode: mode }),
      openForm: (type = "gasto", options) =>
        set({
          isFormOpen: true,
          formPrefillType: type,
          formPrefillDate: options?.date ?? null,
          editingTransactionId: null,
        }),
      openFormForEdit: (transactionId) => {
        const transaction = get().transactions.find(
          (item) => item.id === transactionId && isActive(item),
        );
        if (!transaction) return;
        set({
          isFormOpen: true,
          editingTransactionId: transactionId,
          formPrefillType: transaction.type,
          formPrefillDate: null,
        });
      },
      closeForm: () =>
        set({
          isFormOpen: false,
          editingTransactionId: null,
          formPrefillDate: null,
        }),
      addTransaction: (input) => {
        const suggestion =
          input.type === "gasto" && !input.categoryId
            ? suggestCategoryId(
                `${input.title} ${input.note}`,
                get().categories.filter(isActive),
                get().userRules.filter(isActive),
              )
            : { categoryId: null, isAuto: false };

        const categoryId =
          input.categoryId ?? suggestion.categoryId ?? null;
        const defaultAccountId = resolveDefaultAccountId(
          get().profile,
          get().accounts,
        );
        const accountId =
          input.accountId !== undefined
            ? input.accountId
            : defaultAccountId;
        const currency = input.currency ?? get().profile.defaultCurrency;
        const origin = input.origin ?? "manual";
        const isAutoCategorized =
          input.type === "gasto" && !input.categoryId && suggestion.isAuto;
        const isFixed = Boolean(input.isFixed) && input.type === "gasto";
        const canUseInstallments =
          input.type === "gasto" &&
          input.method === "tarjeta_credito" &&
          !isFixed;
        const installmentCount = canUseInstallments && input.installmentCount
          ? Math.max(1, Math.min(24, Math.round(input.installmentCount)))
          : 1;
        const startDate = input.date || todayIso();
        const totalAmount = roundAmountForCurrency(input.amount, currency);
        const fixedPayWeekIndex = isFixed
          ? Math.max(
              1,
              Math.min(
                4,
                Math.round(
                  input.fixedPayWeekIndex ??
                    inferFixedPayWeekIndex(
                      startDate,
                      get().profile.paydayWeekday,
                    ),
                ),
              ),
            )
          : undefined;

        if (installmentCount === 1) {
          const transaction = touch({
            id: createId("tx"),
            type: input.type,
            amount: totalAmount,
            currency,
            date: startDate,
            method: input.method,
            categoryId: input.type === "gasto" ? categoryId : null,
            incomeSourceId:
              input.type === "ingreso" ? input.incomeSourceId : null,
            accountId,
            note: input.note,
            title: input.title,
            weekIso: toWeekIso(startDate),
            month: toMonthKey(startDate),
            origin,
            isAutoCategorized,
            isFixed,
            deletedAt: null,
            ...(fixedPayWeekIndex != null ? { fixedPayWeekIndex } : {}),
          });

          const latestTransaction = get().transactions.find(isActive);
          if (
            latestTransaction &&
            isSameTransactionPayload(latestTransaction, transaction)
          ) {
            // Ignore accidental double-submit (same payload twice in a row).
            return;
          }

          set((state) => ({
            transactions: dedupeTransactionsById([
              transaction,
              ...state.transactions,
            ]),
          }));
          return;
        }

        const groupId = createId("inst");
        const amounts = buildInstallmentAmounts(
          totalAmount,
          installmentCount,
          currency,
        );
        const installmentTransactions: Transaction[] = amounts.map(
          (amount, index) => {
            const dateIso = shiftIsoDateByMonths(startDate, index);
            const installmentIndex = index + 1;
            return touch({
              id: createId("tx"),
              type: "gasto" as const,
              amount,
              currency,
              date: dateIso,
              method: input.method,
              categoryId,
              incomeSourceId: null,
              accountId,
              note: input.note,
              title: `${input.title} (${installmentIndex}/${installmentCount})`,
              weekIso: toWeekIso(dateIso),
              month: toMonthKey(dateIso),
              origin,
              isAutoCategorized,
              isFixed: false,
              deletedAt: null,
              installmentGroupId: groupId,
              installmentIndex,
              installmentCount,
            });
          },
        );

        set((state) => ({
          transactions: dedupeTransactionsById([
            ...installmentTransactions,
            ...state.transactions,
          ]),
        }));
      },
      addTransfer: (input) => {
        const fromAccount = get().accounts.find(
          (account) => account.id === input.fromAccountId && isActive(account),
        );
        const toAccount = get().accounts.find(
          (account) => account.id === input.toAccountId && isActive(account),
        );
        if (!fromAccount || !toAccount) return;
        if (fromAccount.id === toAccount.id) return;

        const currency = fromAccount.currency;
        const amount = roundAmountForCurrency(input.amount, currency);
        if (!(amount > 0)) return;

        const dateIso = input.date || todayIso();
        const note = (input.note ?? "").trim();
        const groupId = createId("xfer");
        const weekIso = toWeekIso(dateIso);
        const month = toMonthKey(dateIso);

        const outflow = touch({
          id: createId("tx"),
          type: "gasto" as const,
          amount,
          currency,
          date: dateIso,
          method: "transferencia" as const,
          categoryId: null,
          incomeSourceId: null,
          accountId: fromAccount.id,
          note,
          title: `Transferencia a ${toAccount.name}`,
          weekIso,
          month,
          origin: "manual" as const,
          isAutoCategorized: false,
          isFixed: false,
          deletedAt: null,
          transferGroupId: groupId,
        });

        const inflow = touch({
          id: createId("tx"),
          type: "ingreso" as const,
          amount,
          currency,
          date: dateIso,
          method: "transferencia" as const,
          categoryId: null,
          incomeSourceId: null,
          accountId: toAccount.id,
          note,
          title: `Transferencia desde ${fromAccount.name}`,
          weekIso,
          month,
          origin: "manual" as const,
          isAutoCategorized: false,
          isFixed: false,
          deletedAt: null,
          transferGroupId: groupId,
        });

        set((state) => ({
          transactions: dedupeTransactionsById([
            outflow,
            inflow,
            ...state.transactions,
          ]),
        }));
      },
      updateTransaction: (id, patch) =>
        set((state) => ({
          transactions: state.transactions.map((item) => {
            if (item.id !== id) return item;
            const nextAmount =
              patch.amount !== undefined
                ? roundAmountForCurrency(
                    patch.amount,
                    patch.currency ?? item.currency,
                  )
                : item.amount;
            return touch({
              ...item,
              ...patch,
              amount: nextAmount,
              weekIso: patch.date ? toWeekIso(patch.date) : item.weekIso,
              month: patch.date ? toMonthKey(patch.date) : item.month,
            });
          }),
        })),
      deleteTransaction: (id, options) =>
        set((state) => {
          const target = state.transactions.find((item) => item.id === id);
          if (!target || !isActive(target)) return state;

          const nowIso = new Date().toISOString();

          if (target.transferGroupId) {
            const groupId = target.transferGroupId;
            return {
              transactions: state.transactions.map((item) =>
                item.transferGroupId === groupId && isActive(item)
                  ? touch({ ...item, deletedAt: nowIso })
                  : item,
              ),
            };
          }

          if (options?.deleteInstallmentGroup && target.installmentGroupId) {
            const groupId = target.installmentGroupId;
            return {
              transactions: state.transactions.map((item) =>
                item.installmentGroupId === groupId && isActive(item)
                  ? touch({ ...item, deletedAt: nowIso })
                  : item,
              ),
            };
          }

          return {
            transactions: softDeleteById(state.transactions, id, nowIso),
          };
        }),
      repairTransactions: () =>
        set((state) => ({
          transactions: dedupeTransactionsById(state.transactions),
        })),
      restoreTransactions: (restored) =>
        set((state) => {
          if (restored.length === 0) return state;
          const restoredIds = new Set(restored.map((item) => item.id));
          const withoutDuplicates = state.transactions.filter(
            (item) => !restoredIds.has(item.id),
          );
          const revived = restored.map((item) =>
            touch({ ...item, deletedAt: null }),
          );
          return {
            transactions: [...revived, ...withoutDuplicates],
          };
        }),
      addCategory: (category) =>
        set((state) => ({
          categories: [
            ...state.categories,
            touch({
              ...category,
              color: sanitizeCssColor(category.color),
              id: createId("cat"),
              deletedAt: null,
            }),
          ],
        })),
      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((item) => {
            if (item.id !== id) return item;
            const next = touch({ ...item, ...patch });
            if (patch.color !== undefined) {
              next.color = sanitizeCssColor(patch.color);
            }
            return next;
          }),
        })),
      removeCategory: (id) =>
        set((state) => {
          const nowIso = new Date().toISOString();
          return {
            categories: softDeleteById(state.categories, id, nowIso),
            transactions: state.transactions.map((tx) =>
              tx.categoryId === id && isActive(tx)
                ? touch({ ...tx, categoryId: null })
                : tx,
            ),
            budgets: state.budgets.map((budget) =>
              budget.categoryId === id && isActive(budget)
                ? touch({ ...budget, deletedAt: nowIso })
                : budget,
            ),
            userRules: state.userRules.map((rule) =>
              rule.categoryId === id && isActive(rule)
                ? touch({ ...rule, deletedAt: nowIso })
                : rule,
            ),
          };
        }),
      addIncomeSource: () => {
        // Income motives are fixed: Sueldo, Ingreso extra, Ahorro previo.
      },
      updateIncomeSource: (id, patch) =>
        set((state) => ({
          incomeSources: state.incomeSources.map((item) =>
            item.id === id ? touch({ ...item, ...patch }) : item,
          ),
        })),
      materializeProjectedRecurringIncome: (monthKey) => {
        const projected = projectRecurringIncomeToMonth(
          get().transactions,
          get().incomeSources,
          monthKey,
        );
        if (projected.length === 0) return 0;

        const materialized = projected.map((item) =>
          touch({
            ...item,
            id: createId("tx"),
            origin: "recurrente" as const,
            deletedAt: null,
          }),
        );

        set((state) => ({
          transactions: dedupeTransactionsById([
            ...materialized,
            ...state.transactions,
          ]),
        }));
        return materialized.length;
      },
      updateProfile: (patch) =>
        set((state) => ({
          profile: touch({ ...state.profile, ...patch }),
        })),
      setPayday: (weekday) =>
        set((state) => ({
          profile: touch({ ...state.profile, paydayWeekday: weekday }),
          selectedWeekIso: null,
        })),
      setPayCadence: (payCadence) =>
        set((state) => ({
          profile: touch({ ...state.profile, payCadence }),
          selectedWeekIso: null,
        })),
      setPaydayDayOfMonth: (dayOfMonth) =>
        set((state) => ({
          profile: touch({
            ...state.profile,
            paydayDayOfMonth: Math.max(0, Math.min(28, Math.round(dayOfMonth))),
          }),
        })),
      setBudget: (categoryId, month, amountLimit) => {
        const roundedLimit = Math.max(0, Math.round(amountLimit));
        set((state) => {
          const existing = state.budgets.find(
            (budget) =>
              isActive(budget) &&
              budget.categoryId === categoryId &&
              budget.month === month,
          );
          const nowIso = new Date().toISOString();
          if (roundedLimit <= 0) {
            if (!existing) return state;
            return {
              budgets: softDeleteById(state.budgets, existing.id, nowIso),
            };
          }
          if (existing) {
            return {
              budgets: state.budgets.map((budget) =>
                budget.id === existing.id
                  ? touch({ ...budget, amountLimit: roundedLimit })
                  : budget,
              ),
            };
          }
          return {
            budgets: [
              ...state.budgets,
              touch({
                id: createId("budget"),
                categoryId,
                month,
                amountLimit: roundedLimit,
                deletedAt: null,
              }),
            ],
          };
        });
      },
      removeBudget: (id) =>
        set((state) => ({
          budgets: softDeleteById(
            state.budgets,
            id,
            new Date().toISOString(),
          ),
        })),
      addAccount: (account) =>
        set((state) => {
          const nextAccount = touch({
            ...account,
            id: createId("acc"),
            deletedAt: null,
          });
          const nextAccounts = [...state.accounts, nextAccount];
          const activeCount = state.accounts.filter(isActive).length;
          const nextProfile =
            state.profile.defaultAccountId || activeCount > 0
              ? state.profile
              : touch({
                  ...state.profile,
                  defaultAccountId: nextAccount.id,
                });
          return {
            accounts: nextAccounts,
            profile: nextProfile,
          };
        }),
      updateAccount: (id, patch) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id ? touch({ ...account, ...patch }) : account,
          ),
        })),
      removeAccount: (id) =>
        set((state) => {
          const activeAccounts = state.accounts.filter(isActive);
          if (activeAccounts.length <= 1) return state;
          const nowIso = new Date().toISOString();
          const nextAccounts = softDeleteById(state.accounts, id, nowIso);
          const nextActive = nextAccounts.filter(isActive);
          const nextDefault =
            state.profile.defaultAccountId === id
              ? nextActive[0]?.id
              : state.profile.defaultAccountId;
          return {
            accounts: nextAccounts,
            profile: touch({
              ...state.profile,
              defaultAccountId: nextDefault,
            }),
          };
        }),
      rememberCategoryCorrection: (pattern, categoryId) => {
        const normalized = pattern.trim().toLowerCase();
        if (!normalized) return;
        set((state) => ({
          userRules: applyCategoryCorrectionMemory(
            state.userRules,
            normalized,
            categoryId,
            () => createId("rule"),
          ),
        }));
      },
      suggestCategory: (text) =>
        suggestCategoryId(
          text,
          get().categories.filter(isActive),
          get().userRules.filter(isActive),
        ),
      exportBackup: () => {
        const state = get();
        return {
          version: BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          profile: state.profile,
          categories: state.categories,
          incomeSources: state.incomeSources,
          transactions: state.transactions,
          userRules: state.userRules,
          budgets: state.budgets,
          accounts: state.accounts,
          selectedMonth: state.selectedMonth,
          viewMode: state.viewMode,
          lastSyncedAt: state.lastSyncedAt,
        };
      },
      restoreBackup: (payload) => {
        const nowIso = new Date().toISOString();
        const accounts =
          payload.accounts.length > 0
            ? migrateEntitiesForSync(payload.accounts, nowIso)
            : DEFAULT_ACCOUNTS;
        const incomingProfile = payload.profile as UserProfile & {
          payCadence?: UserProfile["payCadence"];
          paydayDayOfMonth?: number;
        };
        const profile = ensureLifecycle(
          {
            ...incomingProfile,
            payCadence:
              incomingProfile.payCadence ??
              (incomingProfile.isSetupComplete ||
              incomingProfile.paydayWeekday !== "viernes" ||
              Boolean(incomingProfile.shouldRemindPaydayLoad)
                ? "weekly"
                : "monthly"),
            paydayDayOfMonth: incomingProfile.paydayDayOfMonth ?? 1,
            defaultAccountId:
              incomingProfile.defaultAccountId ?? accounts[0]?.id,
          },
          nowIso,
        );
        const normalized = normalizeIncomeSources(
          payload.incomeSources,
          payload.transactions,
        );
        set({
          profile,
          categories: migrateEntitiesForSync(payload.categories, nowIso),
          incomeSources: migrateEntitiesForSync(
            normalized.incomeSources,
            nowIso,
          ),
          transactions: dedupeTransactionsById(
            migrateEntitiesForSync(normalized.transactions, nowIso),
          ),
          userRules: migrateEntitiesForSync(payload.userRules, nowIso),
          budgets: migrateEntitiesForSync(payload.budgets ?? [], nowIso),
          accounts,
          selectedMonth: payload.selectedMonth ?? get().selectedMonth,
          viewMode: payload.viewMode ?? get().viewMode,
          lastSyncedAt: payload.lastSyncedAt ?? null,
          selectedWeekIso: null,
          isFormOpen: false,
          editingTransactionId: null,
        });
      },
      resetToSeed: () => {
        const nowIso = new Date().toISOString();
        set({
          profile: ensureLifecycle({ ...DEFAULT_PROFILE }, nowIso),
          categories: migrateEntitiesForSync(DEFAULT_CATEGORIES, nowIso),
          incomeSources: migrateEntitiesForSync(DEFAULT_INCOME_SOURCES, nowIso),
          transactions: migrateEntitiesForSync(SEED_TRANSACTIONS, nowIso),
          userRules: migrateEntitiesForSync(DEFAULT_USER_RULES, nowIso),
          budgets: [],
          accounts: migrateEntitiesForSync(DEFAULT_ACCOUNTS, nowIso),
          selectedMonth: toMonthKey(getAppToday()),
          lastSyncedAt: null,
        });
      },
    }),
    {
      name: FINANCE_STORAGE_NAME,
      storage: createEncryptedPersistStorage(),
      partialize: (state) => ({
        profile: state.profile,
        categories: state.categories,
        incomeSources: state.incomeSources,
        transactions: dedupeTransactionsById(state.transactions),
        userRules: state.userRules,
        budgets: state.budgets,
        accounts: state.accounts,
        selectedMonth: state.selectedMonth,
        viewMode: state.viewMode,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        const wasLockedCiphertext = consumeWasLastGetLockedCiphertext();

        if (!state) {
          // Allow PIN unlock UI even when ciphertext could not be decrypted yet.
          if (wasLockedCiphertext || isPinEnabled()) {
            useFinanceStore.setState({ hydrated: true });
          }
          return;
        }

        // Locked ciphertext hydrate uses blank defaults — mark ready for PIN UI,
        // but do not repair/persist (would wipe the encrypted blob).
        if (wasLockedCiphertext) {
          state.setHydrated(true);
          return;
        }

        const nowIso = new Date().toISOString();

        // Legacy installs (pre–isSetupComplete): keep using the app without onboarding.
        if (state.profile.isSetupComplete === undefined) {
          const looksClaimed =
            state.profile.name.trim().length > 0 &&
            state.profile.email.trim().length > 0;
          state.profile = {
            ...state.profile,
            isSetupComplete: looksClaimed,
          };
        }

        const normalized = normalizeIncomeSources(
          state.incomeSources,
          state.transactions,
        );
        state.incomeSources = migrateEntitiesForSync(
          normalized.incomeSources,
          nowIso,
        );
        state.transactions = dedupeTransactionsById(
          migrateEntitiesForSync(normalized.transactions, nowIso),
        );

        state.profile = ensureLifecycle(state.profile, nowIso);
        state.categories = migrateEntitiesForSync(state.categories, nowIso).map(
          (category) => ({
            ...category,
            color: sanitizeCssColor(category.color),
          }),
        );
        state.userRules = migrateEntitiesForSync(
          state.userRules ?? [],
          nowIso,
        );

        if (!Array.isArray(state.budgets)) {
          state.budgets = [];
        } else {
          state.budgets = migrateEntitiesForSync(state.budgets, nowIso);
        }
        if (!Array.isArray(state.accounts) || state.accounts.length === 0) {
          state.accounts = migrateEntitiesForSync(DEFAULT_ACCOUNTS, nowIso);
        } else {
          state.accounts = migrateEntitiesForSync(state.accounts, nowIso);
        }
        if (state.lastSyncedAt === undefined) {
          state.lastSyncedAt = null;
        }
        if (!state.profile.defaultAccountId) {
          state.profile = touch({
            ...state.profile,
            defaultAccountId: state.accounts.filter(isActive)[0]?.id,
          });
        }
        if (state.profile.shouldRemindPaydayLoad === undefined) {
          state.profile = touch({
            ...state.profile,
            shouldRemindPaydayLoad: false,
          });
        }

        // Fase M: backfill payCadence / paydayDayOfMonth for legacy local profiles.
        const profileRecord = state.profile as UserProfile & {
          payCadence?: PayCadence;
          paydayDayOfMonth?: number;
        };
        if (profileRecord.payCadence === undefined) {
          const hasCustomizedPayday =
            state.profile.paydayWeekday !== "viernes" ||
            Boolean(state.profile.shouldRemindPaydayLoad) ||
            Boolean(state.profile.isSetupComplete);
          state.profile = touch({
            ...state.profile,
            payCadence: hasCustomizedPayday ? "weekly" : "monthly",
          });
        }
        if (profileRecord.paydayDayOfMonth === undefined) {
          state.profile = touch({
            ...state.profile,
            paydayDayOfMonth: 1,
          });
        }

        const isFreshInstall =
          state.transactions.filter(isActive).length === 0 &&
          !state.profile.isSetupComplete &&
          !state.profile.name.trim();
        const hasValidSelectedMonth = /^\d{4}-\d{2}$/.test(
          state.selectedMonth ?? "",
        );
        if (isFreshInstall || !hasValidSelectedMonth) {
          state.selectedMonth = toMonthKey(getAppToday());
        }

        state.setHydrated(true);
        // Rewrite storage with cleaned ledger (in-place hydrate alone may not persist).
        // Flag before microtask so ResumenView mount skips a redundant repair.
        markTransactionsRepairedThisSession();
        queueMicrotask(() => {
          useFinanceStore.getState().repairTransactions();
        });
      },
    },
  ),
);

/** Nudge persist so enabling/disabling PIN rewrites ciphertext vs plaintext. */
export function touchFinancePersist(): void {
  useFinanceStore.setState((state) => ({
    profile: { ...state.profile },
  }));
}
