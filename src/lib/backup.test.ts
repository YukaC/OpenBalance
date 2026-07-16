import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFinanceBackup } from "./backup";

const validProfile = {
  id: "u1",
  name: "Test",
  email: "test@example.com",
  defaultCurrency: "ARS",
  paydayWeekday: "viernes",
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
});
