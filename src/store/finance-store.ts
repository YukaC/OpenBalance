"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FinanceBackupPayload } from "@/lib/backup";
import { suggestCategoryId } from "@/lib/classifier";
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
  PaymentMethod,
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
  paydayWeekday: "viernes",
  initials: "??",
  isSetupComplete: false,
  defaultAccountId: "acc-principal",
  shouldRemindPaydayLoad: false,
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

function buildInstallmentAmounts(totalAmount: number, count: number): number[] {
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
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (
    id: string,
    options?: { deleteInstallmentGroup?: boolean },
  ) => void;
  /** Remove duplicate ids / identical payload clones from the ledger. */
  repairTransactions: () => void;
  restoreTransactions: (transactions: Transaction[]) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  addIncomeSource: (source: Omit<IncomeSource, "id">) => void;
  updateIncomeSource: (id: string, patch: Partial<IncomeSource>) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  setPayday: (weekday: Weekday) => void;
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

/** Keep first of each identical payload (newest-first store order). */
function dedupeIdenticalPayloadTransactions(
  transactions: Transaction[],
): Transaction[] {
  const seenPayloads = new Set<string>();
  const unique: Transaction[] = [];
  for (const transaction of transactions) {
    const payloadKey = transactionPayloadKey(transaction);
    if (seenPayloads.has(payloadKey)) continue;
    seenPayloads.add(payloadKey);
    unique.push(transaction);
  }
  return unique;
}

function sanitizeStoredTransactions(
  transactions: Transaction[],
): Transaction[] {
  return dedupeIdenticalPayloadTransactions(
    dedupeTransactionsById(transactions),
  );
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
  if (
    profile.defaultAccountId &&
    accounts.some((account) => account.id === profile.defaultAccountId)
  ) {
    return profile.defaultAccountId;
  }
  return accounts[0]?.id ?? null;
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
          (item) => item.id === transactionId,
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
                get().categories,
                get().userRules,
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
        const totalAmount = Math.round(input.amount);
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
          const transaction: Transaction = {
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
            ...(fixedPayWeekIndex != null ? { fixedPayWeekIndex } : {}),
          };

          const latestTransaction = get().transactions[0];
          if (
            latestTransaction &&
            isSameTransactionPayload(latestTransaction, transaction)
          ) {
            // Ignore accidental double-submit (same payload twice in a row).
            return;
          }

          set((state) => ({
            transactions: sanitizeStoredTransactions([
              transaction,
              ...state.transactions,
            ]),
          }));
          return;
        }

        const groupId = createId("inst");
        const amounts = buildInstallmentAmounts(totalAmount, installmentCount);
        const installmentTransactions: Transaction[] = amounts.map(
          (amount, index) => {
            const dateIso = shiftIsoDateByMonths(startDate, index);
            const installmentIndex = index + 1;
            return {
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
              installmentGroupId: groupId,
              installmentIndex,
              installmentCount,
            };
          },
        );

        set((state) => ({
          transactions: sanitizeStoredTransactions([
            ...installmentTransactions,
            ...state.transactions,
          ]),
        }));
      },
      updateTransaction: (id, patch) =>
        set((state) => ({
          transactions: state.transactions.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...patch,
                  weekIso: patch.date ? toWeekIso(patch.date) : item.weekIso,
                  month: patch.date ? toMonthKey(patch.date) : item.month,
                }
              : item,
          ),
        })),
      deleteTransaction: (id, options) =>
        set((state) => {
          const target = state.transactions.find((item) => item.id === id);
          if (!target) return state;

          if (options?.deleteInstallmentGroup && target.installmentGroupId) {
            const groupId = target.installmentGroupId;
            return {
              transactions: sanitizeStoredTransactions(
                state.transactions.filter(
                  (item) => item.installmentGroupId !== groupId,
                ),
              ),
            };
          }

          const payloadKey = transactionPayloadKey(target);
          return {
            transactions: sanitizeStoredTransactions(
              state.transactions.filter((item) => {
                if (item.id === id) return false;
                // Also drop ghost clones (same payload, different id).
                return transactionPayloadKey(item) !== payloadKey;
              }),
            ),
          };
        }),
      repairTransactions: () =>
        set((state) => ({
          transactions: sanitizeStoredTransactions(state.transactions),
        })),
      restoreTransactions: (restored) =>
        set((state) => {
          if (restored.length === 0) return state;
          const restoredIds = new Set(restored.map((item) => item.id));
          const withoutDuplicates = state.transactions.filter(
            (item) => !restoredIds.has(item.id),
          );
          return {
            transactions: [...restored, ...withoutDuplicates],
          };
        }),
      addCategory: (category) =>
        set((state) => ({
          categories: [
            ...state.categories,
            {
              ...category,
              color: sanitizeCssColor(category.color),
              id: createId("cat"),
            },
          ],
        })),
      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((item) => {
            if (item.id !== id) return item;
            const next = { ...item, ...patch };
            if (patch.color !== undefined) {
              next.color = sanitizeCssColor(patch.color);
            }
            return next;
          }),
        })),
      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((item) => item.id !== id),
          transactions: state.transactions.map((tx) =>
            tx.categoryId === id ? { ...tx, categoryId: null } : tx,
          ),
          budgets: state.budgets.filter((budget) => budget.categoryId !== id),
          userRules: state.userRules.filter((rule) => rule.categoryId !== id),
        })),
      addIncomeSource: () => {
        // Income motives are fixed: Sueldo, Ingreso extra, Ahorro previo.
      },
      updateIncomeSource: (id, patch) =>
        set((state) => ({
          incomeSources: state.incomeSources.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        })),
      updateProfile: (patch) =>
        set((state) => ({ profile: { ...state.profile, ...patch } })),
      setPayday: (weekday) =>
        set((state) => ({
          profile: { ...state.profile, paydayWeekday: weekday },
          selectedWeekIso: null,
        })),
      setBudget: (categoryId, month, amountLimit) => {
        const roundedLimit = Math.max(0, Math.round(amountLimit));
        set((state) => {
          const existing = state.budgets.find(
            (budget) =>
              budget.categoryId === categoryId && budget.month === month,
          );
          if (roundedLimit <= 0) {
            return {
              budgets: state.budgets.filter(
                (budget) =>
                  !(budget.categoryId === categoryId && budget.month === month),
              ),
            };
          }
          if (existing) {
            return {
              budgets: state.budgets.map((budget) =>
                budget.id === existing.id
                  ? { ...budget, amountLimit: roundedLimit }
                  : budget,
              ),
            };
          }
          return {
            budgets: [
              ...state.budgets,
              {
                id: createId("budget"),
                categoryId,
                month,
                amountLimit: roundedLimit,
              },
            ],
          };
        });
      },
      removeBudget: (id) =>
        set((state) => ({
          budgets: state.budgets.filter((budget) => budget.id !== id),
        })),
      addAccount: (account) =>
        set((state) => {
          const nextAccount: Account = {
            ...account,
            id: createId("acc"),
          };
          const nextAccounts = [...state.accounts, nextAccount];
          const nextProfile =
            state.profile.defaultAccountId || state.accounts.length > 0
              ? state.profile
              : { ...state.profile, defaultAccountId: nextAccount.id };
          return {
            accounts: nextAccounts,
            profile: nextProfile,
          };
        }),
      updateAccount: (id, patch) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id ? { ...account, ...patch } : account,
          ),
        })),
      removeAccount: (id) =>
        set((state) => {
          if (state.accounts.length <= 1) return state;
          const nextAccounts = state.accounts.filter(
            (account) => account.id !== id,
          );
          const nextDefault =
            state.profile.defaultAccountId === id
              ? nextAccounts[0]?.id
              : state.profile.defaultAccountId;
          return {
            accounts: nextAccounts,
            profile: {
              ...state.profile,
              defaultAccountId: nextDefault,
            },
          };
        }),
      rememberCategoryCorrection: (pattern, categoryId) => {
        const normalized = pattern.trim().toLowerCase();
        if (!normalized) return;
        set((state) => {
          const without = state.userRules.filter(
            (rule) => rule.pattern.toLowerCase() !== normalized,
          );
          return {
            userRules: [
              {
                id: createId("rule"),
                pattern: normalized,
                categoryId,
              },
              ...without,
            ],
          };
        });
      },
      suggestCategory: (text) =>
        suggestCategoryId(text, get().categories, get().userRules),
      exportBackup: () => {
        const state = get();
        return {
          version: 1 as const,
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
        };
      },
      restoreBackup: (payload) => {
        const accounts =
          payload.accounts.length > 0 ? payload.accounts : DEFAULT_ACCOUNTS;
        const profile = {
          ...payload.profile,
          defaultAccountId:
            payload.profile.defaultAccountId ?? accounts[0]?.id,
        };
        const normalized = normalizeIncomeSources(
          payload.incomeSources,
          payload.transactions,
        );
        set({
          profile,
          categories: payload.categories,
          incomeSources: normalized.incomeSources,
          transactions: sanitizeStoredTransactions(normalized.transactions),
          userRules: payload.userRules,
          budgets: payload.budgets ?? [],
          accounts,
          selectedMonth: payload.selectedMonth ?? get().selectedMonth,
          viewMode: payload.viewMode ?? get().viewMode,
          selectedWeekIso: null,
          isFormOpen: false,
          editingTransactionId: null,
        });
      },
      resetToSeed: () =>
        set({
          profile: DEFAULT_PROFILE,
          categories: DEFAULT_CATEGORIES,
          incomeSources: DEFAULT_INCOME_SOURCES,
          transactions: SEED_TRANSACTIONS,
          userRules: DEFAULT_USER_RULES,
          budgets: [],
          accounts: DEFAULT_ACCOUNTS,
          selectedMonth: toMonthKey(getAppToday()),
        }),
    }),
    {
      name: "rinde-finance-v2",
      partialize: (state) => ({
        profile: state.profile,
        categories: state.categories,
        incomeSources: state.incomeSources,
        transactions: sanitizeStoredTransactions(state.transactions),
        userRules: state.userRules,
        budgets: state.budgets,
        accounts: state.accounts,
        selectedMonth: state.selectedMonth,
        viewMode: state.viewMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

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
        state.incomeSources = normalized.incomeSources;
        state.transactions = sanitizeStoredTransactions(
          normalized.transactions,
        );

        state.categories = state.categories.map((category) => ({
          ...category,
          color: sanitizeCssColor(category.color),
        }));

        if (!Array.isArray(state.budgets)) {
          state.budgets = [];
        }
        if (!Array.isArray(state.accounts) || state.accounts.length === 0) {
          state.accounts = DEFAULT_ACCOUNTS;
        }
        if (!state.profile.defaultAccountId) {
          state.profile = {
            ...state.profile,
            defaultAccountId: state.accounts[0]?.id,
          };
        }
        if (state.profile.shouldRemindPaydayLoad === undefined) {
          state.profile = {
            ...state.profile,
            shouldRemindPaydayLoad: false,
          };
        }

        const isFreshInstall =
          state.transactions.length === 0 &&
          !state.profile.isSetupComplete &&
          !state.profile.name.trim();
        const hasValidSelectedMonth = /^\d{4}-\d{2}$/.test(
          state.selectedMonth ?? "",
        );
        if (isFreshInstall || !hasValidSelectedMonth) {
          state.selectedMonth = toMonthKey(getAppToday());
        }

        state.setHydrated(true);
        // Rewrite localStorage with cleaned ledger (in-place hydrate alone may not persist).
        queueMicrotask(() => {
          useFinanceStore.getState().repairTransactions();
        });
      },
    },
  ),
);
