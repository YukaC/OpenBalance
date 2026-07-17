import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { BACKUP_VERSION } from "@/lib/backup";
import type { Transaction } from "@/lib/types";
import { useFinanceStore } from "./finance-store";

function makeTxInput(
  overrides: Partial<{
    type: "ingreso" | "gasto";
    amount: number;
    date: string;
    method: Transaction["method"];
    categoryId: string | null;
    incomeSourceId: string | null;
    note: string;
    title: string;
    currency: "ARS" | "USD";
  }> = {},
) {
  return {
    type: "gasto" as const,
    amount: 100,
    date: "2026-03-15",
    method: "transferencia" as const,
    categoryId: "cat-comida",
    incomeSourceId: null,
    note: "",
    title: "Cafe",
    ...overrides,
  };
}

function resetStore() {
  useFinanceStore.setState({
    transactions: [],
    budgets: [],
    lastSyncedAt: null,
    isFormOpen: false,
    editingTransactionId: null,
    formPrefillDate: null,
  });
  globalThis.localStorage.clear();
}

describe("finance-store addTransaction", () => {
  beforeEach(resetStore);

  it("adds a single transaction with lifecycle fields", () => {
    useFinanceStore.getState().addTransaction(makeTxInput({ amount: 1500 }));

    const transactions = useFinanceStore.getState().transactions;
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0].amount, 1500);
    assert.equal(transactions[0].title, "Cafe");
    assert.equal(transactions[0].deletedAt, null);
    assert.ok(typeof transactions[0].updatedAt === "string");
    assert.match(transactions[0].id, /^tx-/);
  });

  it("rounds ARS amounts to whole pesos", () => {
    useFinanceStore.getState().addTransaction(
      makeTxInput({ amount: 99.6, currency: "ARS" }),
    );

    assert.equal(useFinanceStore.getState().transactions[0].amount, 100);
  });

  it("rounds USD amounts to two decimals", () => {
    useFinanceStore.getState().addTransaction(
      makeTxInput({ amount: 12.345, currency: "USD", title: "Usd coffee" }),
    );

    assert.equal(useFinanceStore.getState().transactions[0].amount, 12.35);
    assert.equal(useFinanceStore.getState().transactions[0].currency, "USD");
  });

  it("ignores accidental double-submit of the same payload", () => {
    const input = makeTxInput({ amount: 200, title: "Double" });
    useFinanceStore.getState().addTransaction(input);
    useFinanceStore.getState().addTransaction(input);

    assert.equal(useFinanceStore.getState().transactions.length, 1);
  });

  it("keeps two different ids with the same payload (no global payload dedupe)", () => {
    useFinanceStore.getState().addTransaction(
      makeTxInput({ amount: 50, title: "Same payload" }),
    );
    useFinanceStore.getState().addTransaction(
      makeTxInput({ amount: 10, title: "Other" }),
    );
    useFinanceStore.getState().addTransaction(
      makeTxInput({ amount: 50, title: "Same payload" }),
    );

    const transactions = useFinanceStore.getState().transactions;
    const samePayload = transactions.filter(
      (tx) => tx.title === "Same payload" && tx.amount === 50,
    );
    assert.equal(transactions.length, 3);
    assert.equal(samePayload.length, 2);
    assert.notEqual(samePayload[0].id, samePayload[1].id);
  });

  it("repairTransactions only dedupes by id, not by payload", () => {
    const sharedPayload = {
      type: "gasto" as const,
      amount: 80,
      currency: "ARS" as const,
      date: "2026-03-15",
      method: "efectivo" as const,
      categoryId: "cat-comida",
      incomeSourceId: null,
      note: "",
      weekIso: "2026-W11",
      month: "2026-03",
      origin: "manual" as const,
      title: "Clone pair",
      isAutoCategorized: false,
      isFixed: false,
      deletedAt: null,
      updatedAt: "2026-03-15T12:00:00.000Z",
    };

    useFinanceStore.setState({
      transactions: [
        { ...sharedPayload, id: "tx-a" },
        { ...sharedPayload, id: "tx-b" },
        { ...sharedPayload, id: "tx-a" },
      ],
    });

    useFinanceStore.getState().repairTransactions();

    const transactions = useFinanceStore.getState().transactions;
    assert.equal(transactions.length, 2);
    assert.deepEqual(
      transactions.map((tx) => tx.id).sort(),
      ["tx-a", "tx-b"],
    );
  });
});

describe("finance-store addTransfer", () => {
  beforeEach(() => {
    resetStore();
    useFinanceStore.setState({
      accounts: [
        {
          id: "acc-principal",
          name: "Principal",
          currency: "ARS",
          deletedAt: null,
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "acc-ahorro",
          name: "Ahorro",
          currency: "ARS",
          deletedAt: null,
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("creates linked gasto+ingreso legs with the same transferGroupId", () => {
    useFinanceStore.getState().addTransfer({
      fromAccountId: "acc-principal",
      toAccountId: "acc-ahorro",
      amount: 1500.4,
      date: "2026-03-15",
      note: "Move cash",
    });

    const transactions = useFinanceStore.getState().transactions;
    assert.equal(transactions.length, 2);

    const outflow = transactions.find((tx) => tx.type === "gasto");
    const inflow = transactions.find((tx) => tx.type === "ingreso");
    assert.ok(outflow);
    assert.ok(inflow);
    assert.ok(outflow.transferGroupId);
    assert.equal(outflow.transferGroupId, inflow.transferGroupId);
    assert.match(outflow.transferGroupId!, /^xfer-/);

    assert.equal(outflow.amount, 1500);
    assert.equal(inflow.amount, 1500);
    assert.equal(outflow.accountId, "acc-principal");
    assert.equal(inflow.accountId, "acc-ahorro");
    assert.equal(outflow.currency, "ARS");
    assert.equal(inflow.currency, "ARS");
    assert.equal(outflow.method, "transferencia");
    assert.equal(inflow.method, "transferencia");
    assert.equal(outflow.note, "Move cash");
    assert.equal(inflow.note, "Move cash");
    assert.equal(outflow.title, "Transferencia a Ahorro");
    assert.equal(inflow.title, "Transferencia desde Principal");
    assert.equal(outflow.deletedAt, null);
    assert.equal(inflow.deletedAt, null);
  });

  it("soft-deletes both transfer legs together", () => {
    useFinanceStore.getState().addTransfer({
      fromAccountId: "acc-principal",
      toAccountId: "acc-ahorro",
      amount: 200,
      date: "2026-03-15",
    });

    const [firstLeg] = useFinanceStore.getState().transactions;
    assert.ok(firstLeg?.transferGroupId);

    useFinanceStore.getState().deleteTransaction(firstLeg.id);

    const afterDelete = useFinanceStore.getState().transactions;
    assert.equal(afterDelete.length, 2);
    assert.ok(afterDelete.every((tx) => tx.deletedAt != null));
    assert.equal(
      afterDelete[0].transferGroupId,
      afterDelete[1].transferGroupId,
    );
  });

  it("ignores invalid transfers (same account, missing account, non-positive amount)", () => {
    useFinanceStore.getState().addTransfer({
      fromAccountId: "acc-principal",
      toAccountId: "acc-principal",
      amount: 100,
    });
    useFinanceStore.getState().addTransfer({
      fromAccountId: "acc-missing",
      toAccountId: "acc-ahorro",
      amount: 100,
    });
    useFinanceStore.getState().addTransfer({
      fromAccountId: "acc-principal",
      toAccountId: "acc-ahorro",
      amount: 0,
    });

    assert.equal(useFinanceStore.getState().transactions.length, 0);
  });
});

describe("finance-store deleteTransaction + restoreTransactions", () => {
  beforeEach(resetStore);

  it("soft-deletes and restores the same transaction ids (undo)", () => {
    useFinanceStore.getState().addTransaction(
      makeTxInput({ amount: 300, title: "Undo me" }),
    );
    useFinanceStore.getState().addTransaction(
      makeTxInput({ amount: 400, title: "Keep me" }),
    );

    const beforeDelete = useFinanceStore.getState().transactions;
    const target = beforeDelete.find((tx) => tx.title === "Undo me");
    assert.ok(target);

    useFinanceStore.getState().deleteTransaction(target.id);

    const afterDelete = useFinanceStore.getState().transactions;
    const deleted = afterDelete.find((tx) => tx.id === target.id);
    assert.ok(deleted?.deletedAt);
    assert.equal(
      afterDelete.filter((tx) => tx.deletedAt == null).length,
      1,
    );

    useFinanceStore.getState().restoreTransactions([deleted!]);

    const afterRestore = useFinanceStore.getState().transactions;
    const restored = afterRestore.find((tx) => tx.id === target.id);
    assert.equal(restored?.deletedAt, null);
    assert.equal(restored?.title, "Undo me");
    assert.equal(restored?.amount, 300);
    assert.equal(
      afterRestore.filter((tx) => tx.deletedAt == null).length,
      2,
    );
  });

  it("restoreTransactions revives clones without collapsing same payloads", () => {
    const clones: Transaction[] = [
      {
        id: "tx-clone-1",
        type: "gasto",
        amount: 25,
        currency: "ARS",
        date: "2026-02-01",
        method: "efectivo",
        categoryId: null,
        incomeSourceId: null,
        note: "",
        weekIso: "2026-W05",
        month: "2026-02",
        origin: "manual",
        title: "Clone",
        isAutoCategorized: false,
        isFixed: false,
        deletedAt: "2026-02-02T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
      {
        id: "tx-clone-2",
        type: "gasto",
        amount: 25,
        currency: "ARS",
        date: "2026-02-01",
        method: "efectivo",
        categoryId: null,
        incomeSourceId: null,
        note: "",
        weekIso: "2026-W05",
        month: "2026-02",
        origin: "manual",
        title: "Clone",
        isAutoCategorized: false,
        isFixed: false,
        deletedAt: "2026-02-02T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ];

    useFinanceStore.setState({ transactions: clones });
    useFinanceStore.getState().restoreTransactions(clones);

    const restored = useFinanceStore.getState().transactions;
    assert.equal(restored.length, 2);
    assert.ok(restored.every((tx) => tx.deletedAt == null));
    assert.deepEqual(
      restored.map((tx) => tx.id).sort(),
      ["tx-clone-1", "tx-clone-2"],
    );
  });
});

describe("finance-store restoreBackup", () => {
  beforeEach(resetStore);

  it("replaces the ledger from a backup payload", () => {
    useFinanceStore.getState().addTransaction(
      makeTxInput({ amount: 999, title: "Before backup" }),
    );

    useFinanceStore.getState().restoreBackup({
      version: BACKUP_VERSION,
      exportedAt: "2026-04-01T00:00:00.000Z",
      profile: {
        id: "user-backup",
        name: "Backup User",
        email: "backup@example.com",
        defaultCurrency: "ARS",
        payCadence: "weekly",
        paydayWeekday: "viernes",
        paydayDayOfMonth: 1,
        initials: "BU",
        isSetupComplete: true,
        defaultAccountId: "acc-principal",
        shouldRemindPaydayLoad: false,
      },
      categories: [
        {
          id: "cat-comida",
          name: "Comida",
          icon: "🛒",
          color: "#2a7d58",
          kind: "variable",
          keywords: ["super"],
        },
      ],
      incomeSources: [
        {
          id: "src-sueldo",
          name: "Sueldo",
          type: "semanal",
          isRecurring: true,
        },
      ],
      transactions: [
        {
          id: "tx-from-backup",
          type: "gasto",
          amount: 42,
          currency: "ARS",
          date: "2026-04-01",
          method: "transferencia",
          categoryId: "cat-comida",
          incomeSourceId: null,
          note: "",
          weekIso: "2026-W14",
          month: "2026-04",
          origin: "manual",
          title: "From backup",
          isAutoCategorized: false,
          isFixed: false,
        },
      ],
      userRules: [],
      budgets: [],
      accounts: [
        {
          id: "acc-principal",
          name: "Principal",
          currency: "ARS",
        },
      ],
      selectedMonth: "2026-04",
      viewMode: "mes",
      lastSyncedAt: null,
    });

    const state = useFinanceStore.getState();
    assert.equal(state.profile.name, "Backup User");
    assert.equal(state.selectedMonth, "2026-04");
    assert.equal(state.transactions.length, 1);
    assert.equal(state.transactions[0].id, "tx-from-backup");
    assert.equal(state.transactions[0].title, "From backup");
    assert.ok(typeof state.transactions[0].updatedAt === "string");
  });

  it("materializes projected recurring income for a month", () => {
    useFinanceStore.setState({
      incomeSources: [
        {
          id: "src-sueldo",
          name: "Sueldo",
          type: "mensual",
          isRecurring: true,
          updatedAt: new Date(0).toISOString(),
          deletedAt: null,
        },
      ],
      transactions: [
        {
          id: "tx-jan-sueldo",
          type: "ingreso",
          amount: 500_000,
          currency: "ARS",
          date: "2026-01-30",
          method: "transferencia",
          categoryId: null,
          incomeSourceId: "src-sueldo",
          accountId: "acc-principal",
          note: "",
          title: "Sueldo",
          weekIso: "2026-W05",
          month: "2026-01",
          origin: "manual",
          isAutoCategorized: false,
          isFixed: false,
          updatedAt: new Date(0).toISOString(),
          deletedAt: null,
        },
      ],
      selectedMonth: "2026-02",
    });

    const count =
      useFinanceStore.getState().materializeProjectedRecurringIncome("2026-02");
    assert.equal(count, 1);

    const febIncomes = useFinanceStore
      .getState()
      .transactions.filter(
        (tx) =>
          tx.month === "2026-02" &&
          tx.type === "ingreso" &&
          tx.incomeSourceId === "src-sueldo",
      );
    assert.equal(febIncomes.length, 1);
    assert.equal(febIncomes[0].amount, 500_000);
    assert.equal(febIncomes[0].origin, "recurrente");
    assert.ok(!febIncomes[0].id.startsWith("projected-income:"));

    const secondPass =
      useFinanceStore.getState().materializeProjectedRecurringIncome("2026-02");
    assert.equal(secondPass, 0);
  });
});
