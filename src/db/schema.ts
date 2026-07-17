import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash),
  ],
);

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Client-side profile id (often equals userId after register). */
  clientId: text("client_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  defaultCurrency: text("default_currency").notNull().default("ARS"),
  paydayWeekday: text("payday_weekday").notNull().default("viernes"),
  initials: text("initials").notNull().default("??"),
  isSetupComplete: boolean("is_setup_complete").notNull().default(false),
  defaultAccountId: text("default_account_id"),
  shouldRemindPaydayLoad: boolean("should_remind_payday_load")
    .notNull()
    .default(false),
  monthlySavingsGoal: doublePrecision("monthly_savings_goal"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("ARS"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    kind: text("kind").notNull(),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const incomeSources = pgTable(
  "income_sources",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    isRecurring: boolean("is_recurring").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const budgets = pgTable(
  "budgets",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").notNull(),
    month: text("month").notNull(),
    amountLimit: doublePrecision("amount_limit").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const userRules = pgTable(
  "user_rules",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(),
    categoryId: text("category_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    amount: doublePrecision("amount").notNull(),
    currency: text("currency").notNull().default("ARS"),
    date: text("date").notNull(),
    method: text("method").notNull(),
    categoryId: text("category_id"),
    incomeSourceId: text("income_source_id"),
    accountId: text("account_id"),
    note: text("note").notNull().default(""),
    weekIso: text("week_iso").notNull(),
    month: text("month").notNull(),
    origin: text("origin").notNull().default("manual"),
    title: text("title").notNull(),
    isAutoCategorized: boolean("is_auto_categorized").notNull().default(false),
    isFixed: boolean("is_fixed").notNull().default(false),
    fixedPayWeekIndex: integer("fixed_pay_week_index"),
    installmentGroupId: text("installment_group_id"),
    installmentIndex: integer("installment_index"),
    installmentCount: integer("installment_count"),
    transferGroupId: text("transfer_group_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] })],
);

export type UserRow = typeof users.$inferSelect;
export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type IncomeSourceRow = typeof incomeSources.$inferSelect;
export type BudgetRow = typeof budgets.$inferSelect;
export type UserRuleRow = typeof userRules.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
