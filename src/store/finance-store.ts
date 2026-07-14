"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { suggestCategoryId } from "@/lib/classifier";
import { toMonthKey, toWeekIso, todayIso } from "@/lib/dates";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_INCOME_SOURCES,
  DEFAULT_PROFILE,
  DEFAULT_USER_RULES,
  SEED_TRANSACTIONS,
} from "@/lib/seed";
import type {
  Category,
  IncomeSource,
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
  note: string;
  title: string;
  isFixed?: boolean;
}

interface FinanceState {
  profile: UserProfile;
  categories: Category[];
  incomeSources: IncomeSource[];
  transactions: Transaction[];
  userRules: UserCategoryRule[];
  selectedMonth: string;
  viewMode: ViewMode;
  isFormOpen: boolean;
  formPrefillType: TransactionType;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setSelectedMonth: (monthKey: string) => void;
  setViewMode: (mode: ViewMode) => void;
  openForm: (type?: TransactionType) => void;
  closeForm: () => void;
  addTransaction: (input: NewTransactionInput) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  addIncomeSource: (source: Omit<IncomeSource, "id">) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  setPayday: (weekday: Weekday) => void;
  rememberCategoryCorrection: (pattern: string, categoryId: string) => void;
  suggestCategory: (text: string) => { categoryId: string | null; isAuto: boolean };
  resetToSeed: () => void;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      categories: DEFAULT_CATEGORIES,
      incomeSources: DEFAULT_INCOME_SOURCES,
      transactions: SEED_TRANSACTIONS,
      userRules: DEFAULT_USER_RULES,
      selectedMonth: "2026-07",
      viewMode: "mes",
      isFormOpen: false,
      formPrefillType: "ingreso",
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      setSelectedMonth: (monthKey) => set({ selectedMonth: monthKey }),
      setViewMode: (mode) => set({ viewMode: mode }),
      openForm: (type = "gasto") =>
        set({ isFormOpen: true, formPrefillType: type }),
      closeForm: () => set({ isFormOpen: false }),
      addTransaction: (input) => {
        const suggestion =
          input.type === "gasto"
            ? suggestCategoryId(
                `${input.title} ${input.note}`,
                get().categories,
                get().userRules,
              )
            : { categoryId: null, isAuto: false };

        const categoryId =
          input.categoryId ?? suggestion.categoryId ?? null;

        const transaction: Transaction = {
          id: createId("tx"),
          type: input.type,
          amount: input.amount,
          currency: get().profile.defaultCurrency,
          date: input.date || todayIso(),
          method: input.method,
          categoryId: input.type === "gasto" ? categoryId : null,
          incomeSourceId: input.type === "ingreso" ? input.incomeSourceId : null,
          note: input.note,
          title: input.title,
          weekIso: toWeekIso(input.date || todayIso()),
          month: toMonthKey(input.date || todayIso()),
          origin: "manual",
          isAutoCategorized:
            input.type === "gasto" && !input.categoryId && suggestion.isAuto,
          isFixed: Boolean(input.isFixed),
        };

        set((state) => ({
          transactions: [transaction, ...state.transactions],
          isFormOpen: false,
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
            { ...category, id: createId("cat") },
          ],
        })),
      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        })),
      addIncomeSource: (source) =>
        set((state) => ({
          incomeSources: [
            ...state.incomeSources,
            { ...source, id: createId("src") },
          ],
        })),
      updateProfile: (patch) =>
        set((state) => ({ profile: { ...state.profile, ...patch } })),
      setPayday: (weekday) =>
        set((state) => ({
          profile: { ...state.profile, paydayWeekday: weekday },
        })),
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
      resetToSeed: () =>
        set({
          profile: DEFAULT_PROFILE,
          categories: DEFAULT_CATEGORIES,
          incomeSources: DEFAULT_INCOME_SOURCES,
          transactions: SEED_TRANSACTIONS,
          userRules: DEFAULT_USER_RULES,
          selectedMonth: "2026-07",
        }),
    }),
    {
      name: "rinde-finance-v2",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
