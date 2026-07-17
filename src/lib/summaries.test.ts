import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthSummary,
  computeAccountBalance,
  computeInstallmentDebt,
  filterByMonth,
  findBudgetAlerts,
  findCategorySpendAlerts,
  sumByAccount,
  sumByType,
  sumExpenseByCategory,
} from "./summaries";
import type { Account, Budget, Category, Transaction } from "./types";

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
    deletedAt: null,
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

  it("skips soft-deleted transactions", () => {
    const txs = [
      makeTx({
        id: "alive",
        type: "gasto",
        amount: 10,
        month: "2026-01",
        date: "2026-01-01",
      }),
      makeTx({
        id: "gone",
        type: "gasto",
        amount: 99,
        month: "2026-01",
        date: "2026-01-02",
        deletedAt: "2026-01-03T00:00:00.000Z",
      }),
    ];
    const result = filterByMonth(txs, "2026-01");
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "alive");
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

  it("excludes transfer legs from income and expense totals", () => {
    const groupId = "xfer-1";
    const txs = [
      makeTx({
        id: "real-income",
        type: "ingreso",
        amount: 100,
        month: "2026-01",
        date: "2026-01-01",
      }),
      makeTx({
        id: "real-expense",
        type: "gasto",
        amount: 40,
        month: "2026-01",
        date: "2026-01-02",
      }),
      makeTx({
        id: "xfer-out",
        type: "gasto",
        amount: 25,
        month: "2026-01",
        date: "2026-01-03",
        transferGroupId: groupId,
        accountId: "acc-a",
      }),
      makeTx({
        id: "xfer-in",
        type: "ingreso",
        amount: 25,
        month: "2026-01",
        date: "2026-01-03",
        transferGroupId: groupId,
        accountId: "acc-b",
      }),
    ];
    assert.equal(sumByType(txs, "ingreso"), 100);
    assert.equal(sumByType(txs, "gasto"), 40);
  });
});

describe("sumExpenseByCategory", () => {
  it("uses pay-week month bounds (includes spillover)", () => {
    // July 2026 payday sábado: first week Dom 28 Jun — Sáb 4 Jul.
    const txs = [
      makeTx({
        id: "spill",
        type: "gasto",
        amount: 40,
        month: "2026-06",
        date: "2026-06-29",
        categoryId: "cat-comida",
      }),
      makeTx({
        id: "july",
        type: "gasto",
        amount: 10,
        month: "2026-07",
        date: "2026-07-10",
        categoryId: "cat-comida",
      }),
    ];
    const totals = sumExpenseByCategory(
      txs,
      "2026-07",
      "sabado",
      "ARS",
      new Date(2026, 6, 16),
    );
    assert.equal(totals.get("cat-comida"), 50);
  });
});

describe("findBudgetAlerts / findCategorySpendAlerts", () => {
  it("accepts paydayWeekday and ignores soft-deleted spend", () => {
    const txs = [
      makeTx({
        id: "g1",
        type: "gasto",
        amount: 90,
        month: "2026-07",
        date: "2026-07-10",
        categoryId: "cat-comida",
      }),
      makeTx({
        id: "g-deleted",
        type: "gasto",
        amount: 500,
        month: "2026-07",
        date: "2026-07-11",
        categoryId: "cat-comida",
        deletedAt: "2026-07-12T00:00:00.000Z",
      }),
      makeTx({
        id: "prev",
        type: "gasto",
        amount: 50,
        month: "2026-06",
        date: "2026-06-20",
        categoryId: "cat-comida",
      }),
    ];
    const budgets: Budget[] = [
      {
        id: "b1",
        categoryId: "cat-comida",
        month: "2026-07",
        amountLimit: 100,
        deletedAt: null,
      },
    ];

    const budgetAlerts = findBudgetAlerts(
      txs,
      categories,
      budgets,
      "2026-07",
      "sabado",
      "ARS",
    );
    assert.equal(budgetAlerts.length, 1);
    assert.equal(budgetAlerts[0].spent, 90);
    assert.equal(budgetAlerts[0].level, "warning");

    const spendAlerts = findCategorySpendAlerts(
      txs,
      categories,
      "2026-07",
      "sabado",
      0.2,
      "ARS",
    );
    assert.equal(spendAlerts.length, 1);
    assert.equal(spendAlerts[0].currentAmount, 90);
    assert.equal(spendAlerts[0].previousAmount, 50);
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

  it("uses prefiltered month transactions for category breakdown (I1)", () => {
    const txs = [
      makeTx({
        id: "hidden",
        type: "gasto",
        amount: 999,
        month: "2026-07",
        date: "2026-07-10",
        categoryId: "cat-comida",
      }),
    ];
    const prefiltered = [
      makeTx({
        id: "shown",
        type: "gasto",
        amount: 40,
        month: "2026-07",
        date: "2026-07-10",
        categoryId: "cat-comida",
      }),
    ];
    const summary = buildMonthSummary(
      txs,
      categories,
      "2026-07",
      new Date(2026, 6, 16),
      "sabado",
      "ARS",
      prefiltered,
    );
    assert.equal(summary.byCategory.length, 1);
    assert.equal(summary.byCategory[0].amount, 40);
  });

  it("monthly cadence totals follow calendar month, not pay-week spillover", () => {
    // July 2026 payday sábado: first week spills into Jun 28 — but monthly ignores it.
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
      makeTx({
        id: "july-expense",
        type: "gasto",
        amount: 20_000,
        month: "2026-07",
        date: "2026-07-15",
        categoryId: "cat-comida",
      }),
    ];
    const summary = buildMonthSummary(
      txs,
      categories,
      "2026-07",
      new Date(2026, 6, 16),
      "sabado",
      "ARS",
      undefined,
      "monthly",
    );

    assert.equal(summary.income, 100_000);
    assert.equal(summary.expense, 20_000);
    assert.equal(summary.balance, 80_000);
    assert.ok(summary.weeks.length > 0);
  });
});

describe("sumByAccount / computeAccountBalance", () => {
  const account: Account = {
    id: "acc-1",
    name: "Principal",
    currency: "ARS",
    openingBalance: 1000,
  };

  it("sums income and expense for the account and currency", () => {
    const txs = [
      makeTx({
        id: "in",
        type: "ingreso",
        amount: 500,
        month: "2026-01",
        date: "2026-01-01",
        accountId: "acc-1",
      }),
      makeTx({
        id: "out",
        type: "gasto",
        amount: 200,
        month: "2026-01",
        date: "2026-01-02",
        accountId: "acc-1",
      }),
      makeTx({
        id: "other-acc",
        type: "gasto",
        amount: 50,
        month: "2026-01",
        date: "2026-01-03",
        accountId: "acc-2",
      }),
      makeTx({
        id: "usd",
        type: "gasto",
        amount: 10,
        month: "2026-01",
        date: "2026-01-04",
        accountId: "acc-1",
        currency: "USD",
      }),
      makeTx({
        id: "gone",
        type: "gasto",
        amount: 999,
        month: "2026-01",
        date: "2026-01-05",
        accountId: "acc-1",
        deletedAt: "2026-01-06T00:00:00.000Z",
      }),
    ];

    assert.deepEqual(sumByAccount(txs, "acc-1", "ARS"), {
      income: 500,
      expense: 200,
    });
    assert.equal(computeAccountBalance(account, txs), 1300);
  });

  it("defaults openingBalance to 0", () => {
    const bare: Account = {
      id: "acc-1",
      name: "Principal",
      currency: "ARS",
    };
    const txs = [
      makeTx({
        id: "in",
        type: "ingreso",
        amount: 100,
        month: "2026-01",
        date: "2026-01-01",
        accountId: "acc-1",
      }),
    ];
    assert.equal(computeAccountBalance(bare, txs), 100);
  });
});

describe("computeInstallmentDebt", () => {
  it("groups remaining future cuotas by installmentGroupId", () => {
    const txs = [
      makeTx({
        id: "c1",
        type: "gasto",
        amount: 100,
        month: "2026-01",
        date: "2026-01-10",
        title: "Notebook (1/3)",
        installmentGroupId: "g1",
        installmentIndex: 1,
        installmentCount: 3,
      }),
      makeTx({
        id: "c2",
        type: "gasto",
        amount: 100,
        month: "2026-02",
        date: "2026-02-10",
        title: "Notebook (2/3)",
        installmentGroupId: "g1",
        installmentIndex: 2,
        installmentCount: 3,
      }),
      makeTx({
        id: "c3",
        type: "gasto",
        amount: 100,
        month: "2026-03",
        date: "2026-03-10",
        title: "Notebook (3/3)",
        installmentGroupId: "g1",
        installmentIndex: 3,
        installmentCount: 3,
      }),
      makeTx({
        id: "deleted-future",
        type: "gasto",
        amount: 50,
        month: "2026-04",
        date: "2026-04-10",
        title: "Gone (1/2)",
        installmentGroupId: "g2",
        installmentIndex: 1,
        installmentCount: 2,
        deletedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];

    const debt = computeInstallmentDebt(txs, new Date(2026, 1, 1));
    assert.equal(debt.length, 1);
    assert.equal(debt[0].installmentGroupId, "g1");
    assert.equal(debt[0].title, "Notebook");
    assert.equal(debt[0].remainingCount, 2);
    assert.equal(debt[0].remainingAmount, 200);
    assert.equal(debt[0].installmentCount, 3);
    assert.equal(debt[0].nextDate, "2026-02-10");
  });

  it("returns empty when all cuotas are in the past", () => {
    const txs = [
      makeTx({
        id: "c1",
        type: "gasto",
        amount: 100,
        month: "2026-01",
        date: "2026-01-10",
        title: "Done (1/2)",
        installmentGroupId: "g1",
        installmentIndex: 1,
        installmentCount: 2,
      }),
      makeTx({
        id: "c2",
        type: "gasto",
        amount: 100,
        month: "2026-02",
        date: "2026-02-10",
        title: "Done (2/2)",
        installmentGroupId: "g1",
        installmentIndex: 2,
        installmentCount: 2,
      }),
    ];
    assert.deepEqual(
      computeInstallmentDebt(txs, new Date(2026, 2, 1)),
      [],
    );
  });
});
