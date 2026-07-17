import {
  canShareFiles,
  isMobileWebBrowser,
  isRunningInNativeApp,
} from "./device";
import { ensureLifecycle } from "./entity-lifecycle";
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
} from "./types";

export const BACKUP_VERSION = 2 as const;

export interface FinanceBackupPayload {
  version: typeof BACKUP_VERSION | 1;
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
  lastSyncedAt?: string | null;
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

const VALID_TRANSACTION_TYPES = new Set<TransactionType>(["ingreso", "gasto"]);
const VALID_PAYMENT_METHODS = new Set<PaymentMethod>([
  "transferencia",
  "efectivo",
  "tarjeta_debito",
  "tarjeta_credito",
  "otro",
]);
const VALID_LOAD_ORIGINS = new Set<LoadOrigin>([
  "manual",
  "importado",
  "recurrente",
]);

function isValidTransaction(value: unknown): value is Transaction {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    VALID_TRANSACTION_TYPES.has(value.type as TransactionType) &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    (value.currency === "ARS" || value.currency === "USD") &&
    typeof value.date === "string" &&
    VALID_PAYMENT_METHODS.has(value.method as PaymentMethod) &&
    (value.categoryId === null || typeof value.categoryId === "string") &&
    (value.incomeSourceId === null ||
      typeof value.incomeSourceId === "string") &&
    (value.accountId === undefined ||
      value.accountId === null ||
      typeof value.accountId === "string") &&
    typeof value.note === "string" &&
    typeof value.weekIso === "string" &&
    typeof value.month === "string" &&
    VALID_LOAD_ORIGINS.has(value.origin as LoadOrigin) &&
    typeof value.title === "string" &&
    typeof value.isAutoCategorized === "boolean" &&
    typeof value.isFixed === "boolean"
  );
}

function isValidCategory(value: unknown): value is Category {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.keywords) &&
    value.keywords.every((keyword) => typeof keyword === "string")
  );
}

function isValidAccount(value: unknown): value is Account {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.currency === "ARS" || value.currency === "USD")
  );
}

function migrateBackupEntities<T extends { updatedAt?: string; deletedAt?: string | null }>(
  entities: T[],
  nowIso: string,
): T[] {
  return entities.map((entity) => ensureLifecycle(entity, nowIso));
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
    // Accept v1 and missing version; reject unknown future versions.
    if (
      typeof parsed.version === "number" &&
      parsed.version > BACKUP_VERSION
    ) {
      return null;
    }
    if (
      typeof parsed.version === "number" &&
      parsed.version !== 1 &&
      parsed.version !== BACKUP_VERSION
    ) {
      return null;
    }
  }

  if (!isValidProfile(parsed.profile)) return null;
  if (!Array.isArray(parsed.categories)) return null;
  if (!Array.isArray(parsed.incomeSources)) return null;
  if (!Array.isArray(parsed.transactions)) return null;
  if (!Array.isArray(parsed.userRules)) return null;

  const nowIso =
    typeof parsed.exportedAt === "string"
      ? parsed.exportedAt
      : new Date().toISOString();

  // ensureLifecycle preserves existing updatedAt/deletedAt (B3 cloud-ready round-trip).
  const categories = migrateBackupEntities(
    parsed.categories.filter(isValidCategory),
    nowIso,
  );
  const transactions = migrateBackupEntities(
    parsed.transactions.filter(isValidTransaction),
    nowIso,
  );
  const budgets = migrateBackupEntities(
    Array.isArray(parsed.budgets) ? (parsed.budgets as Budget[]) : [],
    nowIso,
  );
  const accounts = migrateBackupEntities(
    Array.isArray(parsed.accounts)
      ? parsed.accounts.filter(isValidAccount)
      : [],
    nowIso,
  );
  const incomeSources = migrateBackupEntities(
    parsed.incomeSources as IncomeSource[],
    nowIso,
  );
  const userRules = migrateBackupEntities(
    parsed.userRules as UserCategoryRule[],
    nowIso,
  );

  return {
    version: BACKUP_VERSION,
    exportedAt: nowIso,
    profile: ensureLifecycle(parsed.profile, nowIso),
    categories,
    incomeSources,
    transactions,
    userRules,
    budgets,
    accounts,
    selectedMonth:
      typeof parsed.selectedMonth === "string" ? parsed.selectedMonth : undefined,
    viewMode:
      parsed.viewMode === "mes" || parsed.viewMode === "semana"
        ? parsed.viewMode
        : undefined,
    lastSyncedAt:
      parsed.lastSyncedAt === null || typeof parsed.lastSyncedAt === "string"
        ? parsed.lastSyncedAt
        : null,
  };
}

function downloadJsonViaAnchor(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Native export via Filesystem + Share (K1). Writes to Cache then opens the
 * system share sheet so the user can save/send the backup.
 */
async function downloadJsonViaNativeShare(
  filename: string,
  jsonText: string,
): Promise<boolean> {
  if (!isRunningInNativeApp()) return false;
  try {
    const { Filesystem, Directory, Encoding } = await import(
      "@capacitor/filesystem"
    );
    const { Share } = await import("@capacitor/share");

    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    await Filesystem.writeFile({
      path: safeName,
      data: jsonText,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({
      path: safeName,
      directory: Directory.Cache,
    });
    await Share.share({
      title: filename,
      url: uri,
      dialogTitle: "Exportar backup",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Export JSON: native Filesystem+Share (K1) → Web Share → `<a download>`.
 */
export async function downloadJsonFile(
  filename: string,
  data: unknown,
): Promise<void> {
  const jsonText = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonText], {
    type: "application/json;charset=utf-8",
  });

  if (await downloadJsonViaNativeShare(filename, jsonText)) {
    return;
  }

  // Prefer share on mobile web — `<a download>` is unreliable on phones.
  const shouldPreferShare =
    canShareFiles() && (isRunningInNativeApp() || isMobileWebBrowser());

  if (shouldPreferShare) {
    try {
      const file = new File([blob], filename, {
        type: "application/json",
      });
      await navigator.share({
        files: [file],
        title: filename,
      });
      return;
    } catch (error) {
      // User dismissed the share sheet — do not force a download.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      // Share unsupported/failed — fall through to anchor download.
    }
  }

  downloadJsonViaAnchor(filename, blob);
}
