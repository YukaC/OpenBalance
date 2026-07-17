import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BACKUP_VERSION, parseFinanceBackup } from "./backup";

const validProfile = {
  id: "u1",
  name: "Test",
  email: "test@example.com",
  defaultCurrency: "ARS",
  payCadence: "monthly",
  paydayWeekday: "viernes",
  paydayDayOfMonth: 1,
  initials: "T",
  shouldRemindPaydayLoad: false,
};

function makeValidTx(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx1",
    type: "gasto",
    amount: 100,
    currency: "ARS",
    date: "2026-01-01",
    method: "efectivo",
    categoryId: null,
    incomeSourceId: null,
    note: "",
    weekIso: "2026-W01",
    month: "2026-01",
    origin: "manual",
    title: "Cafe",
    isAutoCategorized: false,
    isFixed: false,
    ...overrides,
  };
}

describe("parseFinanceBackup", () => {
  it("returns null for invalid JSON", () => {
    assert.equal(parseFinanceBackup("{not json"), null);
  });

  it("returns null for missing profile", () => {
    assert.equal(
      parseFinanceBackup(
        JSON.stringify({
          categories: [],
          incomeSources: [],
          transactions: [],
          userRules: [],
        }),
      ),
      null,
    );
  });

  it("filters out invalid transactions", () => {
    const payload = parseFinanceBackup(
      JSON.stringify({
        version: 1,
        profile: validProfile,
        categories: [],
        incomeSources: [],
        transactions: [
          makeValidTx(),
          makeValidTx({ id: "bad", type: "transfer", amount: "nope" }),
          { id: "also-bad" },
        ],
        userRules: [],
      }),
    );
    assert.ok(payload);
    assert.equal(payload.transactions.length, 1);
    assert.equal(payload.transactions[0].id, "tx1");
  });

  it("accepts v1 backups and migrates to v2 lifecycle fields", () => {
    const payload = parseFinanceBackup(
      JSON.stringify({
        version: 1,
        profile: validProfile,
        categories: [
          {
            id: "cat-1",
            name: "Comida",
            icon: "🍽️",
            color: "#9a4a32",
            kind: "variable",
            keywords: ["comida"],
          },
        ],
        incomeSources: [],
        transactions: [makeValidTx()],
        userRules: [],
      }),
    );
    assert.ok(payload);
    assert.equal(payload.version, BACKUP_VERSION);
    assert.ok(typeof payload.profile.updatedAt === "string");
    assert.equal(payload.profile.deletedAt, null);
    assert.ok(typeof payload.transactions[0].updatedAt === "string");
    assert.equal(payload.transactions[0].deletedAt, null);
    assert.ok(typeof payload.categories[0].updatedAt === "string");
  });

  it("preserves existing lifecycle fields on v2 backups", () => {
    const payload = parseFinanceBackup(
      JSON.stringify({
        version: 2,
        profile: {
          ...validProfile,
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: null,
        },
        categories: [],
        incomeSources: [],
        transactions: [
          makeValidTx({
            updatedAt: "2026-02-01T00:00:00.000Z",
            deletedAt: "2026-02-02T00:00:00.000Z",
          }),
        ],
        userRules: [],
        lastSyncedAt: "2026-03-01T00:00:00.000Z",
      }),
    );
    assert.ok(payload);
    assert.equal(payload.transactions[0].updatedAt, "2026-02-01T00:00:00.000Z");
    assert.equal(payload.transactions[0].deletedAt, "2026-02-02T00:00:00.000Z");
    assert.equal(payload.lastSyncedAt, "2026-03-01T00:00:00.000Z");
  });
});
