import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectRecurringIncomeHint,
  findRecurringIncomeSuggestions,
  projectRecurringIncomeToMonth,
} from "./recurring-income";
import type { IncomeSource, Transaction } from "./types";

function makeIncome(
  overrides: Partial<Transaction> &
    Pick<Transaction, "id" | "amount" | "date" | "month" | "incomeSourceId">,
): Transaction {
  return {
    type: "ingreso",
    currency: "ARS",
    method: "transferencia",
    categoryId: null,
    note: "",
    weekIso: "2026-W01",
    origin: "manual",
    title: overrides.id,
    isAutoCategorized: false,
    isFixed: false,
    deletedAt: null,
    ...overrides,
  };
}

const monthlySource: IncomeSource = {
  id: "src-sueldo",
  name: "Sueldo",
  type: "mensual",
  isRecurring: false,
};

const weeklySource: IncomeSource = {
  id: "src-changa",
  name: "Changa",
  type: "semanal",
  isRecurring: false,
};

describe("detectRecurringIncomeHint", () => {
  it("matches monthly sources by day-of-month, not weekday", () => {
    // Same day-of-month (28), different weekdays across months.
    const txs = [
      makeIncome({
        id: "i1",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-01-28",
        month: "2026-01",
      }),
      makeIncome({
        id: "i2",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-02-28",
        month: "2026-02",
      }),
    ];
    const hint = detectRecurringIncomeHint(
      txs,
      [monthlySource],
      "src-sueldo",
      500_000,
      "2026-03-28",
      { referenceDate: new Date("2026-03-28") },
    );
    assert.ok(hint);
    assert.equal(hint.matchKind, "dayOfMonth");
    assert.equal(hint.dayOfMonth, 28);
    assert.equal(hint.matchCount, 2);
  });

  it("still matches weekly sources by weekday", () => {
    const txs = [
      makeIncome({
        id: "c1",
        incomeSourceId: "src-changa",
        amount: 40_000,
        date: "2026-03-06", // Friday
        month: "2026-03",
      }),
      makeIncome({
        id: "c2",
        incomeSourceId: "src-changa",
        amount: 40_000,
        date: "2026-03-13", // Friday
        month: "2026-03",
      }),
    ];
    const hint = detectRecurringIncomeHint(
      txs,
      [weeklySource],
      "src-changa",
      40_000,
      "2026-03-20",
      { referenceDate: new Date("2026-03-20") },
    );
    assert.ok(hint);
    assert.equal(hint.matchKind, "weekday");
    assert.equal(hint.weekday, 5);
  });
});

describe("findRecurringIncomeSuggestions", () => {
  it("suggests monthly sources via day-of-month buckets", () => {
    const aligned = [
      makeIncome({
        id: "a1",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-01-30",
        month: "2026-01",
      }),
      makeIncome({
        id: "a2",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-02-28",
        month: "2026-02",
      }),
      makeIncome({
        id: "a3",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-03-30",
        month: "2026-03",
      }),
      makeIncome({
        id: "a4",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2025-12-30",
        month: "2025-12",
      }),
    ];
    const suggestions = findRecurringIncomeSuggestions(aligned, [monthlySource], {
      referenceDate: new Date("2026-03-30"),
    });
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].matchKind, "dayOfMonth");
    assert.equal(suggestions[0].dayOfMonth, 30);
    assert.ok(suggestions[0].matchCount >= 3);
  });
});

describe("projectRecurringIncomeToMonth", () => {
  it("projects recurring income when month has no real ingreso yet", () => {
    const recurring: IncomeSource = {
      ...monthlySource,
      isRecurring: true,
    };
    const txs = [
      makeIncome({
        id: "jan",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-01-30",
        month: "2026-01",
      }),
    ];
    const projected = projectRecurringIncomeToMonth(
      txs,
      [recurring],
      "2026-02",
    );
    assert.equal(projected.length, 1);
    assert.equal(projected[0].month, "2026-02");
    assert.equal(projected[0].amount, 500_000);
    assert.equal(projected[0].origin, "recurrente");
    assert.match(projected[0].date, /^2026-02-/);
    assert.equal(projected[0].id, "projected-income:src-sueldo:2026-02");
  });

  it("does not project when an ingreso already exists for the month", () => {
    const recurring: IncomeSource = {
      ...monthlySource,
      isRecurring: true,
    };
    const txs = [
      makeIncome({
        id: "jan",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-01-30",
        month: "2026-01",
      }),
      makeIncome({
        id: "feb",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-02-28",
        month: "2026-02",
      }),
    ];
    const projected = projectRecurringIncomeToMonth(
      txs,
      [recurring],
      "2026-02",
    );
    assert.deepEqual(projected, []);
  });

  it("does not project non-recurring sources", () => {
    const txs = [
      makeIncome({
        id: "jan",
        incomeSourceId: "src-sueldo",
        amount: 500_000,
        date: "2026-01-30",
        month: "2026-01",
      }),
    ];
    const projected = projectRecurringIncomeToMonth(
      txs,
      [monthlySource],
      "2026-02",
    );
    assert.deepEqual(projected, []);
  });
});
