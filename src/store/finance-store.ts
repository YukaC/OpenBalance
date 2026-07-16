"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FinanceBackupPayload } from "@/lib/backup";
import { suggestCategoryId } from "@/lib/classifier";
import { sanitizeCssColor } from "@/lib/color-utils";
import { toMonthKey, toWeekIso, todayIso } from "@/lib/dates";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  DEFAULT_INCOME_SOURCES,
  DEFAULT_PROFILE,
  DEFAULT_USER_RULES,
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
  currency?: "ARS" | "USD";
  origin?: LoadOrigin;
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
  editingTransactionId: string | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setSelectedMonth: (monthKey: string) => void;
  setSelectedWeekIso: (weekIso: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  openForm: (type?: TransactionType) => void;
  openFormForEdit: (transactionId: string) => void;
  closeForm: () => void;
  addTransaction: (input: NewTransactionInput) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
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
  if (randomUuid) return `${prefix}-${randomUuid.slice(0, 8)}`;

  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36).slice(-4);
  return `${prefix}-${randomPart}${timePart}`;
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
      profile: DEFAULT_PROFILE,
      categories: DEFAULT_CATEGORIES,
      incomeSources: DEFAULT_INCOME_SOURCES,
      transactions: SEED_TRANSACTIONS,
      userRules: DEFAULT_USER_RULES,
      budgets: [],
      accounts: DEFAULT_ACCOUNTS,
      selectedMonth: "2026-07",
      selectedWeekIso: null,
      viewMode: "mes",
      isFormOpen: false,
      formPrefillType: "ingreso",
      editingTransactionId: null,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      setSelectedMonth: (monthKey) =>
        set({ selectedMonth: monthKey, selectedWeekIso: null }),
      setSelectedWeekIso: (weekIso) => set({ selectedWeekIso: weekIso }),
      setViewMode: (mode) => set({ viewMode: mode }),
      openForm: (type = "gasto") =>
        set({
          isFormOpen: true,
          formPrefillType: type,
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
        });
      },
      closeForm: () =>
        set({ isFormOpen: false, editingTransactionId: null }),
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

        const transaction: Transaction = {
          id: createId("tx"),
          type: input.type,
          amount: input.amount,
          currency: input.currency ?? get().profile.defaultCurrency,
          date: input.date || todayIso(),
          method: input.method,
          categoryId: input.type === "gasto" ? categoryId : null,
          incomeSourceId: input.type === "ingreso" ? input.incomeSourceId : null,
          accountId,
          note: input.note,
          title: input.title,
          weekIso: toWeekIso(input.date || todayIso()),
          month: toMonthKey(input.date || todayIso()),
          origin: input.origin ?? "manual",
          isAutoCategorized:
            input.type === "gasto" && !input.categoryId && suggestion.isAuto,
          isFixed: Boolean(input.isFixed),
        };

        set((state) => ({
          transactions: [transaction, ...state.transactions],
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
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((item) => item.id !== id),
        })),
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
      addIncomeSource: (source) =>
        set((state) => ({
          incomeSources: [
            ...state.incomeSources,
            { ...source, id: createId("src") },
          ],
        })),
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
        set({
          profile,
          categories: payload.categories,
          incomeSources: payload.incomeSources,
          transactions: payload.transactions,
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
          selectedMonth: "2026-07",
        }),
    }),
    {
      name: "rinde-finance-v2",
      partialize: (state) => ({
        profile: state.profile,
        categories: state.categories,
        incomeSources: state.incomeSources,
        transactions: state.transactions,
        userRules: state.userRules,
        budgets: state.budgets,
        accounts: state.accounts,
        selectedMonth: state.selectedMonth,
        viewMode: state.viewMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const hasSueldo = state.incomeSources.some(
            (source) => source.id === "src-sueldo" || source.name === "Sueldo",
          );
          if (!hasSueldo) {
            state.incomeSources = [
              {
                id: "src-sueldo",
                name: "Sueldo",
                type: "mensual",
                isRecurring: true,
              },
              ...state.incomeSources,
            ];
          }

          const defaultColorById = new Map(
            DEFAULT_CATEGORIES.map((category) => [category.id, category.color]),
          );
          state.categories = state.categories.map((category) => {
            const nextColor = defaultColorById.get(category.id);
            return nextColor ? { ...category, color: nextColor } : category;
          });

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

          state.setHydrated(true);
        }
      },
    },
  ),
);
