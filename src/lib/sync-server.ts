import { and, eq, gt } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  accounts,
  budgets,
  categories,
  incomeSources,
  profiles,
  transactions,
  userRules,
  type AccountRow,
  type BudgetRow,
  type CategoryRow,
  type IncomeSourceRow,
  type ProfileRow,
  type TransactionRow,
  type UserRuleRow,
} from "@/db/schema";
import type {
  Account,
  Budget,
  Category,
  IncomeSource,
  Transaction,
  UserCategoryRule,
  UserProfile,
} from "@/lib/types";

/** Domain entity plus sync metadata (client may omit; server fills). */
export type SyncMeta = {
  updatedAt: string;
  deletedAt?: string | null;
};

export type SyncAccount = Account & SyncMeta;
export type SyncCategory = Category & SyncMeta;
export type SyncBudget = Budget & SyncMeta;
export type SyncIncomeSource = IncomeSource & SyncMeta;
export type SyncUserRule = UserCategoryRule & SyncMeta;
export type SyncTransaction = Transaction & SyncMeta;
export type SyncProfile = UserProfile & SyncMeta;

export type SyncChanges = {
  transactions?: SyncTransaction[];
  categories?: SyncCategory[];
  budgets?: SyncBudget[];
  incomeSources?: SyncIncomeSource[];
  userRules?: SyncUserRule[];
  accounts?: SyncAccount[];
  profile?: SyncProfile | null;
};

export type SyncRequestBody = {
  lastSyncedAt: string | null;
  changes: SyncChanges;
};

export type SyncResponseBody = {
  serverTime: string;
  changes: SyncChanges;
};

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function resolveUpdatedAt(incoming: string | undefined, fallback: Date): Date {
  const parsed = parseIsoDate(incoming);
  return parsed ?? fallback;
}

/** LWW: incoming wins on equal timestamps (server accepts the push). */
export function shouldOverwrite(
  existingUpdatedAt: Date,
  incomingUpdatedAt: Date,
): boolean {
  return incomingUpdatedAt.getTime() >= existingUpdatedAt.getTime();
}

function mapProfile(row: ProfileRow): SyncProfile {
  return {
    id: row.clientId,
    name: row.name,
    email: row.email,
    defaultCurrency: row.defaultCurrency as UserProfile["defaultCurrency"],
    paydayWeekday: row.paydayWeekday as UserProfile["paydayWeekday"],
    initials: row.initials,
    isSetupComplete: row.isSetupComplete,
    defaultAccountId: row.defaultAccountId ?? undefined,
    shouldRemindPaydayLoad: row.shouldRemindPaydayLoad,
    monthlySavingsGoal: row.monthlySavingsGoal ?? undefined,
    manualExchangeRate: row.manualExchangeRate ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
  };
}

function mapAccount(row: AccountRow): SyncAccount {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency as Account["currency"],
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
  };
}

function mapCategory(row: CategoryRow): SyncCategory {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    kind: row.kind as Category["kind"],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
  };
}

function mapIncomeSource(row: IncomeSourceRow): SyncIncomeSource {
  return {
    id: row.id,
    name: row.name,
    type: row.type as IncomeSource["type"],
    isRecurring: row.isRecurring,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
  };
}

function mapBudget(row: BudgetRow): SyncBudget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    month: row.month,
    amountLimit: row.amountLimit,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
  };
}

function mapUserRule(row: UserRuleRow): SyncUserRule {
  return {
    id: row.id,
    pattern: row.pattern,
    categoryId: row.categoryId,
    priority: row.priority,
    confirmCount: row.confirmCount,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
  };
}

function mapTransaction(row: TransactionRow): SyncTransaction {
  return {
    id: row.id,
    type: row.type as Transaction["type"],
    amount: row.amount,
    currency: row.currency as Transaction["currency"],
    date: row.date,
    method: row.method as Transaction["method"],
    categoryId: row.categoryId,
    incomeSourceId: row.incomeSourceId,
    accountId: row.accountId,
    note: row.note,
    weekIso: row.weekIso,
    month: row.month,
    origin: row.origin as Transaction["origin"],
    title: row.title,
    isAutoCategorized: row.isAutoCategorized,
    isFixed: row.isFixed,
    fixedPayWeekIndex: row.fixedPayWeekIndex,
    installmentGroupId: row.installmentGroupId,
    installmentIndex: row.installmentIndex,
    installmentCount: row.installmentCount,
    transferGroupId: row.transferGroupId,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
  };
}

async function upsertProfile(
  db: AppDatabase,
  userId: string,
  profile: SyncProfile,
  now: Date,
): Promise<void> {
  const updatedAt = resolveUpdatedAt(profile.updatedAt, now);
  const deletedAt = parseIsoDate(profile.deletedAt ?? null);

  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (existing && !shouldOverwrite(existing.updatedAt, updatedAt)) {
    return;
  }

  const values = {
    userId,
    clientId: profile.id || userId,
    name: profile.name,
    email: profile.email,
    defaultCurrency: profile.defaultCurrency,
    paydayWeekday: profile.paydayWeekday,
    initials: profile.initials,
    isSetupComplete: profile.isSetupComplete ?? false,
    defaultAccountId: profile.defaultAccountId ?? null,
    shouldRemindPaydayLoad: profile.shouldRemindPaydayLoad,
    monthlySavingsGoal:
      profile.monthlySavingsGoal != null && profile.monthlySavingsGoal > 0
        ? profile.monthlySavingsGoal
        : null,
    manualExchangeRate:
      profile.manualExchangeRate != null && profile.manualExchangeRate > 0
        ? profile.manualExchangeRate
        : null,
    updatedAt,
    deletedAt,
  };

  if (existing) {
    await db.update(profiles).set(values).where(eq(profiles.userId, userId));
  } else {
    await db.insert(profiles).values(values);
  }
}

async function upsertAccount(
  db: AppDatabase,
  userId: string,
  account: SyncAccount,
  now: Date,
): Promise<void> {
  const updatedAt = resolveUpdatedAt(account.updatedAt, now);
  const deletedAt = parseIsoDate(account.deletedAt ?? null);

  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, account.id)))
    .limit(1);

  if (existing && !shouldOverwrite(existing.updatedAt, updatedAt)) {
    return;
  }

  const values = {
    id: account.id,
    userId,
    name: account.name,
    currency: account.currency,
    updatedAt,
    deletedAt,
  };

  if (existing) {
    await db
      .update(accounts)
      .set(values)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, account.id)));
  } else {
    await db.insert(accounts).values(values);
  }
}

async function upsertCategory(
  db: AppDatabase,
  userId: string,
  category: SyncCategory,
  now: Date,
): Promise<void> {
  const updatedAt = resolveUpdatedAt(category.updatedAt, now);
  const deletedAt = parseIsoDate(category.deletedAt ?? null);

  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, category.id)))
    .limit(1);

  if (existing && !shouldOverwrite(existing.updatedAt, updatedAt)) {
    return;
  }

  const values = {
    id: category.id,
    userId,
    name: category.name,
    icon: category.icon,
    color: category.color,
    kind: category.kind,
    keywords: category.keywords ?? [],
    updatedAt,
    deletedAt,
  };

  if (existing) {
    await db
      .update(categories)
      .set(values)
      .where(and(eq(categories.userId, userId), eq(categories.id, category.id)));
  } else {
    await db.insert(categories).values(values);
  }
}

async function upsertIncomeSource(
  db: AppDatabase,
  userId: string,
  source: SyncIncomeSource,
  now: Date,
): Promise<void> {
  const updatedAt = resolveUpdatedAt(source.updatedAt, now);
  const deletedAt = parseIsoDate(source.deletedAt ?? null);

  const [existing] = await db
    .select()
    .from(incomeSources)
    .where(
      and(eq(incomeSources.userId, userId), eq(incomeSources.id, source.id)),
    )
    .limit(1);

  if (existing && !shouldOverwrite(existing.updatedAt, updatedAt)) {
    return;
  }

  const values = {
    id: source.id,
    userId,
    name: source.name,
    type: source.type,
    isRecurring: source.isRecurring,
    updatedAt,
    deletedAt,
  };

  if (existing) {
    await db
      .update(incomeSources)
      .set(values)
      .where(
        and(eq(incomeSources.userId, userId), eq(incomeSources.id, source.id)),
      );
  } else {
    await db.insert(incomeSources).values(values);
  }
}

async function upsertBudget(
  db: AppDatabase,
  userId: string,
  budget: SyncBudget,
  now: Date,
): Promise<void> {
  const updatedAt = resolveUpdatedAt(budget.updatedAt, now);
  const deletedAt = parseIsoDate(budget.deletedAt ?? null);

  const [existing] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, budget.id)))
    .limit(1);

  if (existing && !shouldOverwrite(existing.updatedAt, updatedAt)) {
    return;
  }

  const values = {
    id: budget.id,
    userId,
    categoryId: budget.categoryId,
    month: budget.month,
    amountLimit: budget.amountLimit,
    updatedAt,
    deletedAt,
  };

  if (existing) {
    await db
      .update(budgets)
      .set(values)
      .where(and(eq(budgets.userId, userId), eq(budgets.id, budget.id)));
  } else {
    await db.insert(budgets).values(values);
  }
}

async function upsertUserRule(
  db: AppDatabase,
  userId: string,
  rule: SyncUserRule,
  now: Date,
): Promise<void> {
  const updatedAt = resolveUpdatedAt(rule.updatedAt, now);
  const deletedAt = parseIsoDate(rule.deletedAt ?? null);

  const [existing] = await db
    .select()
    .from(userRules)
    .where(and(eq(userRules.userId, userId), eq(userRules.id, rule.id)))
    .limit(1);

  if (existing && !shouldOverwrite(existing.updatedAt, updatedAt)) {
    return;
  }

  const values = {
    id: rule.id,
    userId,
    pattern: rule.pattern,
    categoryId: rule.categoryId,
    priority: rule.priority ?? 0,
    confirmCount: Math.max(1, rule.confirmCount ?? 1),
    updatedAt,
    deletedAt,
  };

  if (existing) {
    await db
      .update(userRules)
      .set(values)
      .where(and(eq(userRules.userId, userId), eq(userRules.id, rule.id)));
  } else {
    await db.insert(userRules).values(values);
  }
}

async function upsertTransaction(
  db: AppDatabase,
  userId: string,
  transaction: SyncTransaction,
  now: Date,
): Promise<void> {
  const updatedAt = resolveUpdatedAt(transaction.updatedAt, now);
  const deletedAt = parseIsoDate(transaction.deletedAt ?? null);

  const [existing] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), eq(transactions.id, transaction.id)),
    )
    .limit(1);

  if (existing && !shouldOverwrite(existing.updatedAt, updatedAt)) {
    return;
  }

  const values = {
    id: transaction.id,
    userId,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    date: transaction.date,
    method: transaction.method,
    categoryId: transaction.categoryId,
    incomeSourceId: transaction.incomeSourceId,
    accountId: transaction.accountId ?? null,
    note: transaction.note ?? "",
    weekIso: transaction.weekIso,
    month: transaction.month,
    origin: transaction.origin,
    title: transaction.title,
    isAutoCategorized: transaction.isAutoCategorized,
    isFixed: transaction.isFixed,
    fixedPayWeekIndex: transaction.fixedPayWeekIndex ?? null,
    installmentGroupId: transaction.installmentGroupId ?? null,
    installmentIndex: transaction.installmentIndex ?? null,
    installmentCount: transaction.installmentCount ?? null,
    transferGroupId: transaction.transferGroupId ?? null,
    updatedAt,
    deletedAt,
  };

  if (existing) {
    await db
      .update(transactions)
      .set(values)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.id, transaction.id),
        ),
      );
  } else {
    await db.insert(transactions).values(values);
  }
}

export async function applyIncomingChanges(
  db: AppDatabase,
  userId: string,
  changes: SyncChanges,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const executor = tx as unknown as AppDatabase;

    if (changes.profile) {
      await upsertProfile(executor, userId, changes.profile, now);
    }

    for (const account of changes.accounts ?? []) {
      await upsertAccount(executor, userId, account, now);
    }
    for (const category of changes.categories ?? []) {
      await upsertCategory(executor, userId, category, now);
    }
    for (const source of changes.incomeSources ?? []) {
      await upsertIncomeSource(executor, userId, source, now);
    }
    for (const budget of changes.budgets ?? []) {
      await upsertBudget(executor, userId, budget, now);
    }
    for (const rule of changes.userRules ?? []) {
      await upsertUserRule(executor, userId, rule, now);
    }
    for (const transaction of changes.transactions ?? []) {
      await upsertTransaction(executor, userId, transaction, now);
    }
  });
}

function sinceFilter(lastSyncedAt: string | null) {
  if (!lastSyncedAt) return null;
  const parsed = parseIsoDate(lastSyncedAt);
  return parsed;
}

export async function collectOutgoingChanges(
  db: AppDatabase,
  userId: string,
  lastSyncedAt: string | null,
): Promise<SyncChanges> {
  const since = sinceFilter(lastSyncedAt);

  const profileWhere = since
    ? and(eq(profiles.userId, userId), gt(profiles.updatedAt, since))
    : eq(profiles.userId, userId);
  const accountWhere = since
    ? and(eq(accounts.userId, userId), gt(accounts.updatedAt, since))
    : eq(accounts.userId, userId);
  const categoryWhere = since
    ? and(eq(categories.userId, userId), gt(categories.updatedAt, since))
    : eq(categories.userId, userId);
  const incomeWhere = since
    ? and(eq(incomeSources.userId, userId), gt(incomeSources.updatedAt, since))
    : eq(incomeSources.userId, userId);
  const budgetWhere = since
    ? and(eq(budgets.userId, userId), gt(budgets.updatedAt, since))
    : eq(budgets.userId, userId);
  const ruleWhere = since
    ? and(eq(userRules.userId, userId), gt(userRules.updatedAt, since))
    : eq(userRules.userId, userId);
  const txWhere = since
    ? and(eq(transactions.userId, userId), gt(transactions.updatedAt, since))
    : eq(transactions.userId, userId);

  const [
    profileRows,
    accountRows,
    categoryRows,
    incomeRows,
    budgetRows,
    ruleRows,
    txRows,
  ] = await Promise.all([
    db.select().from(profiles).where(profileWhere),
    db.select().from(accounts).where(accountWhere),
    db.select().from(categories).where(categoryWhere),
    db.select().from(incomeSources).where(incomeWhere),
    db.select().from(budgets).where(budgetWhere),
    db.select().from(userRules).where(ruleWhere),
    db.select().from(transactions).where(txWhere),
  ]);

  const profileRow = profileRows[0];

  return {
    profile: profileRow ? mapProfile(profileRow) : undefined,
    accounts: accountRows.map(mapAccount),
    categories: categoryRows.map(mapCategory),
    incomeSources: incomeRows.map(mapIncomeSource),
    budgets: budgetRows.map(mapBudget),
    userRules: ruleRows.map(mapUserRule),
    transactions: txRows.map(mapTransaction),
  };
}

export type IncomingEntityIds = {
  profileId: string | null;
  accountIds: Set<string>;
  categoryIds: Set<string>;
  incomeSourceIds: Set<string>;
  budgetIds: Set<string>;
  userRuleIds: Set<string>;
  transactionIds: Set<string>;
};

/** Ids present in the client's push payload for this request (echo exclusion). */
export function collectIncomingEntityIds(
  changes: SyncChanges,
): IncomingEntityIds {
  return {
    profileId: changes.profile?.id ?? null,
    accountIds: new Set((changes.accounts ?? []).map((entity) => entity.id)),
    categoryIds: new Set((changes.categories ?? []).map((entity) => entity.id)),
    incomeSourceIds: new Set(
      (changes.incomeSources ?? []).map((entity) => entity.id),
    ),
    budgetIds: new Set((changes.budgets ?? []).map((entity) => entity.id)),
    userRuleIds: new Set((changes.userRules ?? []).map((entity) => entity.id)),
    transactionIds: new Set(
      (changes.transactions ?? []).map((entity) => entity.id),
    ),
  };
}

function filterExcludedIds<T extends { id: string }>(
  entities: T[] | undefined,
  excludedIds: Set<string>,
): T[] | undefined {
  if (!entities || entities.length === 0) return entities;
  const filtered = entities.filter((entity) => !excludedIds.has(entity.id));
  return filtered.length > 0 ? filtered : undefined;
}

/**
 * Drop entities that were just upserted from this same request so the client
 * does not re-apply its own push as a remote change (A7 echo fix).
 */
export function excludeIncomingEcho(
  outgoing: SyncChanges,
  incomingIds: IncomingEntityIds,
): SyncChanges {
  const next: SyncChanges = {
    accounts: filterExcludedIds(outgoing.accounts, incomingIds.accountIds),
    categories: filterExcludedIds(outgoing.categories, incomingIds.categoryIds),
    incomeSources: filterExcludedIds(
      outgoing.incomeSources,
      incomingIds.incomeSourceIds,
    ),
    budgets: filterExcludedIds(outgoing.budgets, incomingIds.budgetIds),
    userRules: filterExcludedIds(outgoing.userRules, incomingIds.userRuleIds),
    transactions: filterExcludedIds(
      outgoing.transactions,
      incomingIds.transactionIds,
    ),
  };

  if (
    outgoing.profile &&
    !(
      incomingIds.profileId != null &&
      outgoing.profile.id === incomingIds.profileId
    )
  ) {
    next.profile = outgoing.profile;
  }

  return next;
}

export async function runSync(
  db: AppDatabase,
  userId: string,
  body: SyncRequestBody,
): Promise<SyncResponseBody> {
  // Capture before apply so serverTime reflects request start (not post-write).
  const requestStartedAt = new Date();
  const incoming = body.changes ?? {};
  const incomingIds = collectIncomingEntityIds(incoming);

  await applyIncomingChanges(db, userId, incoming, requestStartedAt);

  // Collect with the client's since-cursor, then strip ids just written in this
  // request so we do not echo the client's own push back as remote changes.
  const outgoing = await collectOutgoingChanges(
    db,
    userId,
    body.lastSyncedAt,
  );
  const changes = excludeIncomingEcho(outgoing, incomingIds);

  return {
    serverTime: requestStartedAt.toISOString(),
    changes,
  };
}
