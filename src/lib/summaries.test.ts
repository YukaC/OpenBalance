import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthSummary,
  filterByMonth,
  sumByType,
} from "./summaries";
import type { Category, Transaction } from "./types";

function makeTx(
  overrides: Partial<Transaction> &
    Pick<Transaction, "id" | "type" | "amount" | "month" | "date">,
): Transaction {
  return {
    currency: "ARS",
    method: "transferencia",
    categoryId: null,
    incomeSourceId: null,
    note: "",
    weekIso: "2026-W01",
    origin: "manual",
    title: overrides.id,
    isAutoCategorized: false,
    isFixed: false,
    ...overrides,
  };
}

const categories: Category[] = [
  {
    id: "cat-comida",
    name: "Comida",
    icon: "🍽️",
    color: "#9a4a32",
    kind: "variable",
    keywords: ["comida", "almuerzo"],
  },
];

describe("filterByMonth", () => {
  it("projects recurring fixed expenses into later months", () => {
    const fixed = makeTx({
      id: "rent",
      type: "gasto",
      amount: 100_000,
      month: "2026-01",
      date: "2026-01-05",
      isFixed: true,
      categoryId: "cat-comida",
    });
    const result = filterByMonth([fixed], "2026-03");
    assert.equal(result.length, 1);
    assert.equal(result[0].month, "2026-03");
    assert.equal(result[0].amount, 100_000);
    assert.match(result[0].date, /^2026-03-/);
  });

  it("does not project fixed expenses before their start month", () => {
    const fixed = makeTx({
      id: "rent",
      type: "gasto",
      amount: 100_000,
      month: "2026-03",
      date: "2026-03-05",
      isFixed: true,
    });
    assert.deepEqual(filterByMonth([fixed], "2026-02"), []);
  });
});

describe("sumByType", () => {
  it("filters by currency when provided", () => {
    const txs = [
      makeTx({
        id: "a",
        type: "gasto",
        amount: 10,
        month: "2026-01",
        date: "2026-01-01",
        currency: "ARS",
      }),
      makeTx({
        id: "b",
        type: "gasto",
        amount: 20,
        month: "2026-01",
        date: "2026-01-02",
        currency: "USD",
      }),
      makeTx({
        id: "c",
        type: "ingreso",
        amount: 50,
        month: "2026-01",
        date: "2026-01-03",
        currency: "ARS",
      }),
    ];
    assert.equal(sumByType(txs, "gasto"), 30);
    assert.equal(sumByType(txs, "gasto", "ARS"), 10);
    assert.equal(sumByType(txs, "gasto", "USD"), 20);
    assert.equal(sumByType(txs, "ingreso", "ARS"), 50);
  });
});

describe("buildMonthSummary", () => {
  it("builds basic income expense and balance", () => {
    const txs = [
      makeTx({
        id: "in",
        type: "ingreso",
        amount: 200,
        month: "2026-02",
        date: "2026-02-02",
      }),
      makeTx({
        id: "out",
        type: "gasto",
        amount: 50,
        month: "2026-02",
        date: "2026-02-03",
        categoryId: "cat-comida",
      }),
    ];
    const summary = buildMonthSummary(
      txs,
      categories,
      "2026-02",
      new Date("2026-02-10T12:00:00"),
      "viernes",
      "ARS",
    );
    assert.equal(summary.income, 200);
    assert.equal(summary.expense, 50);
    assert.equal(summary.balance, 150);
    assert.equal(summary.byCategory.length, 1);
    assert.equal(summary.byCategory[0].category.id, "cat-comida");
  });

  it("includes spillover-day income from the first pay week in month balance", () => {
    // July 2026 payday sábado: first week is Dom 28 Jun — Sáb 4 Jul.
    const txs = [
      makeTx({
        id: "june-income",
        type: "ingreso",
        amount: 270_000,
        month: "2026-06",
        date: "2026-06-28",
      }),
      makeTx({
        id: "july-income",
        type: "ingreso",
        amount: 100_000,
        month: "2026-07",
        date: "2026-07-11",
      }),
    ];
    const summary = buildMonthSummary(
      txs,
      categories,
      "2026-07",
      new Date(2026, 6, 16),
      "sabado",
      "ARS",
    );

    assert.equal(summary.weeks[0].income, 270_000);
    assert.equal(summary.income, 370_000);
    assert.equal(summary.balance, 370_000);
  });

  it("places recurring fixed expenses on 1st and 4th pay weeks", () => {
    const txs = [
      makeTx({
        id: "fixed-1",
        type: "gasto",
        amount: 150_000,
        month: "2026-07",
        date: "2026-07-04",
        isFixed: true,
        fixedPayWeekIndex: 1,
        categoryId: "cat-comida",
      }),
      makeTx({
        id: "fixed-4",
        type: "gasto",
        amount: 150_000,
        month: "2026-07",
        date: "2026-07-25",
        isFixed: true,
        fixedPayWeekIndex: 4,
        categoryId: "cat-comida",
      }),
    ];
    const summary = buildMonthSummary(
      txs,
      categories,
      "2026-08",
      new Date(2026, 7, 16),
      "sabado",
      "ARS",
    );

    assert.equal(summary.weeks[0].expense, 150_000);
    assert.equal(summary.weeks[3].expense, 150_000);
    assert.equal(summary.weeks[4]?.expense ?? 0, 0);
    assert.equal(summary.expense, 300_000);
  });
});
