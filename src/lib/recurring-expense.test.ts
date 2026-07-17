import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findRecurringExpenseSuggestions } from "./recurring-expense";
import type { Category, Transaction } from "./types";

function makeExpense(
  overrides: Partial<Transaction> &
    Pick<Transaction, "id" | "amount" | "date" | "month">,
): Transaction {
  return {
    type: "gasto",
    currency: "ARS",
    method: "transferencia",
    categoryId: "cat-rent",
    incomeSourceId: null,
    note: "",
    weekIso: "2026-W01",
    origin: "manual",
    title: "Alquiler",
    isAutoCategorized: false,
    isFixed: false,
    deletedAt: null,
    ...overrides,
  };
}

const categories: Category[] = [
  {
    id: "cat-rent",
    name: "Alquiler",
    icon: "🏠",
    color: "#4a6a9a",
    kind: "fijo",
    keywords: ["alquiler"],
  },
];

describe("findRecurringExpenseSuggestions", () => {
  it("detects biweekly cadence from ~14-day gaps", () => {
    const txs = [
      makeExpense({
        id: "r1",
        amount: 200_000,
        date: "2026-01-02",
        month: "2026-01",
      }),
      makeExpense({
        id: "r2",
        amount: 200_000,
        date: "2026-01-16",
        month: "2026-01",
      }),
      makeExpense({
        id: "r3",
        amount: 200_000,
        date: "2026-01-30",
        month: "2026-01",
      }),
      makeExpense({
        id: "r4",
        amount: 200_000,
        date: "2026-02-13",
        month: "2026-02",
      }),
    ];
    const suggestions = findRecurringExpenseSuggestions(txs, categories, {
      referenceDate: new Date("2026-02-20"),
    });
    const biweekly = suggestions.find((item) => item.cadence === "biweekly");
    assert.ok(biweekly);
    assert.ok(biweekly.matchCount >= 3);
  });

  it("still detects monthly when gaps are about a month", () => {
    const txs = [
      makeExpense({
        id: "m1",
        amount: 400_000,
        date: "2026-01-05",
        month: "2026-01",
      }),
      makeExpense({
        id: "m2",
        amount: 400_000,
        date: "2026-02-05",
        month: "2026-02",
      }),
      makeExpense({
        id: "m3",
        amount: 400_000,
        date: "2026-03-05",
        month: "2026-03",
      }),
    ];
    const suggestions = findRecurringExpenseSuggestions(txs, categories, {
      referenceDate: new Date("2026-03-10"),
    });
    assert.ok(suggestions.some((item) => item.cadence === "monthly"));
    assert.equal(
      suggestions.find((item) => item.cadence === "biweekly"),
      undefined,
    );
  });
});
