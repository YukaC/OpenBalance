import type {
  Account,
  Budget,
  Category,
  IncomeSource,
  Transaction,
  UserCategoryRule,
  UserProfile,
} from "@/lib/types";

export const BACKUP_VERSION = 1 as const;

export interface FinanceBackupPayload {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  profile: UserProfile;
  categories: Category[];
  incomeSources: IncomeSource[];
  transactions: Transaction[];
  userRules: UserCategoryRule[];
  budgets: Budget[];
  accounts: Account[];
  selectedMonth?: string;
  viewMode?: "mes" | "semana";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidProfile(value: unknown): value is UserProfile {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    (value.defaultCurrency === "ARS" || value.defaultCurrency === "USD") &&
    typeof value.paydayWeekday === "string" &&
    typeof value.initials === "string"
  );
}

export function parseFinanceBackup(raw: string): FinanceBackupPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(parsed)) return null;
  if (parsed.version !== BACKUP_VERSION && parsed.version !== undefined) {
    // Accept missing version for flexibility, reject unknown future versions
    if (typeof parsed.version === "number" && parsed.version > BACKUP_VERSION) {
      return null;
    }
  }

  if (!isValidProfile(parsed.profile)) return null;
  if (!Array.isArray(parsed.categories)) return null;
  if (!Array.isArray(parsed.incomeSources)) return null;
  if (!Array.isArray(parsed.transactions)) return null;
  if (!Array.isArray(parsed.userRules)) return null;

  const budgets = Array.isArray(parsed.budgets) ? (parsed.budgets as Budget[]) : [];
  const accounts = Array.isArray(parsed.accounts)
    ? (parsed.accounts as Account[])
    : [];

  return {
    version: BACKUP_VERSION,
    exportedAt:
      typeof parsed.exportedAt === "string"
        ? parsed.exportedAt
        : new Date().toISOString(),
    profile: parsed.profile,
    categories: parsed.categories as Category[],
    incomeSources: parsed.incomeSources as IncomeSource[],
    transactions: parsed.transactions as Transaction[],
    userRules: parsed.userRules as UserCategoryRule[],
    budgets,
    accounts,
    selectedMonth:
      typeof parsed.selectedMonth === "string" ? parsed.selectedMonth : undefined,
    viewMode:
      parsed.viewMode === "mes" || parsed.viewMode === "semana"
        ? parsed.viewMode
        : undefined,
  };
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
