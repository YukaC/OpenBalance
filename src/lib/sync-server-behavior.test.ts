import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-expect-error node:sqlite is built-in in Node 22+ but @types/node in this repo is v20
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { collectOutgoingChanges } from "./sync-server";

function createInMemoryDb() {
  const sqliteDb = new DatabaseSync(":memory:");
  sqliteDb.exec(`
    CREATE TABLE profiles (
      user_id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      default_currency TEXT NOT NULL DEFAULT 'ARS',
      pay_cadence TEXT NOT NULL DEFAULT 'monthly',
      payday_weekday TEXT NOT NULL DEFAULT 'viernes',
      payday_day_of_month INTEGER NOT NULL DEFAULT 1,
      initials TEXT NOT NULL DEFAULT '??',
      is_setup_complete INTEGER NOT NULL DEFAULT 0,
      default_account_id TEXT,
      should_remind_payday_load INTEGER NOT NULL DEFAULT 0,
      monthly_savings_goal REAL,
      manual_exchange_rate REAL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT
    );
    CREATE TABLE accounts (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ARS',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE categories (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      kind TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE income_sources (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE budgets (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      month TEXT NOT NULL,
      amount_limit REAL NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE user_rules (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      pattern TEXT NOT NULL,
      category_id TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      confirm_count INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE transactions (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ARS',
      date TEXT NOT NULL,
      method TEXT NOT NULL,
      category_id TEXT,
      income_source_id TEXT,
      account_id TEXT,
      note TEXT NOT NULL DEFAULT '',
      week_iso TEXT NOT NULL,
      month TEXT NOT NULL,
      origin TEXT NOT NULL DEFAULT 'manual',
      title TEXT NOT NULL,
      is_auto_categorized INTEGER NOT NULL DEFAULT 0,
      is_fixed INTEGER NOT NULL DEFAULT 0,
      fixed_pay_week_index INTEGER,
      installment_group_id TEXT,
      installment_index INTEGER,
      installment_count INTEGER,
      transfer_group_id TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      PRIMARY KEY (user_id, id)
    );
  `);

  const db = drizzle(async (sql, params, method) => {
    const stmt = sqliteDb.prepare(sql);
    if (method === "all") {
      const rows = stmt.all(...params) as Record<string, unknown>[];
      return { rows: rows.map((r: Record<string, unknown>) => Object.values(r)) };
    } else if (method === "get") {
      const row = stmt.get(...params) as Record<string, unknown> | undefined;
      return { rows: row ? Object.values(row) : [] };
    }
    return { rows: [] };
  });

  return { sqliteDb, db };
}

describe("collectOutgoingChanges iterative batching behavior", () => {
  it("collects >1000 transactions without silent truncation", async () => {
    const { sqliteDb, db } = createInMemoryDb();
    const insertTx = sqliteDb.prepare(`
      INSERT INTO transactions (
        id, user_id, type, amount, currency, date, method, category_id,
        note, week_iso, month, origin, title, is_auto_categorized, is_fixed, updated_at
      ) VALUES (
        ?, 'user-1', 'gasto', 10, 'ARS', '2026-01-01', 'efectivo', 'cat-1',
        '', '2026-W01', '2026-01', 'manual', 'Tx', 0, 0, '2026-06-01T00:00:00.000Z'
      )
    `);

    const TOTAL_COUNT = 1050;
    for (let i = 0; i < TOTAL_COUNT; i++) {
      insertTx.run(`tx-${i}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outgoing = await collectOutgoingChanges(db as any, "user-1", null);

    assert.equal(outgoing.transactions?.length, TOTAL_COUNT);
  });

  it("collects >1000 categories without loss", async () => {
    const { sqliteDb, db } = createInMemoryDb();
    const insertCat = sqliteDb.prepare(`
      INSERT INTO categories (
        id, user_id, name, icon, color, kind, keywords, updated_at
      ) VALUES (
        ?, 'user-1', 'Cat', 'icon', '#000000', 'gasto', '[]', '2026-06-01T00:00:00.000Z'
      )
    `);

    const TOTAL_COUNT = 1100;
    for (let i = 0; i < TOTAL_COUNT; i++) {
      insertCat.run(`cat-${i}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outgoing = await collectOutgoingChanges(db as any, "user-1", null);

    assert.equal(outgoing.categories?.length, TOTAL_COUNT);
  });
});
