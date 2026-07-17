import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { hasPendingLocalChanges, pushPullSync } from "./sync-client";
import { useFinanceStore } from "@/store/finance-store";

const CLEAN_SYNCED_AT = "2026-01-01T00:00:00.000Z";
const OLDER_AT = "2025-06-01T00:00:00.000Z";
const NEWER_AT = "2026-06-01T00:00:00.000Z";

function makeCleanProfile() {
  return {
    id: "user-1",
    name: "Test",
    email: "test@example.com",
    defaultCurrency: "ARS" as const,
    paydayWeekday: "viernes" as const,
    initials: "T",
    isSetupComplete: true,
    defaultAccountId: "acc-principal",
    shouldRemindPaydayLoad: false,
    updatedAt: OLDER_AT,
    deletedAt: null,
  };
}

/** Empty collections with timestamps so nothing looks dirty vs lastSyncedAt. */
function resetToCleanSyncedState() {
  useFinanceStore.setState({
    profile: makeCleanProfile(),
    categories: [],
    incomeSources: [],
    transactions: [],
    userRules: [],
    budgets: [],
    accounts: [
      {
        id: "acc-principal",
        name: "Principal",
        currency: "ARS",
        updatedAt: OLDER_AT,
        deletedAt: null,
      },
    ],
    lastSyncedAt: CLEAN_SYNCED_AT,
  });
  globalThis.localStorage.clear();
}

describe("hasPendingLocalChanges", () => {
  beforeEach(resetToCleanSyncedState);

  it("is false when every entity is older than or equal to lastSyncedAt", () => {
    assert.equal(hasPendingLocalChanges(), false);
  });

  it("is false for entities updated just before lastSyncedAt (no multi-minute skew window)", () => {
    // Regression: a 5-minute lookback kept the chip on "Pendiente" after every sync.
    const justBeforeSync = "2025-12-31T23:59:30.000Z";
    useFinanceStore.setState({
      transactions: [
        {
          id: "tx-recent",
          type: "gasto",
          amount: 10,
          currency: "ARS",
          date: "2025-12-31",
          method: "efectivo",
          categoryId: null,
          incomeSourceId: null,
          note: "",
          weekIso: "2025-W01",
          month: "2025-12",
          origin: "manual",
          title: "Recent",
          isAutoCategorized: false,
          isFixed: false,
          deletedAt: null,
          updatedAt: justBeforeSync,
        },
      ],
      lastSyncedAt: CLEAN_SYNCED_AT,
    });
    assert.equal(hasPendingLocalChanges(), false);
  });

  it("is true when a transaction updatedAt is after lastSyncedAt", () => {
    useFinanceStore.setState({
      transactions: [
        {
          id: "tx-dirty",
          type: "gasto",
          amount: 10,
          currency: "ARS",
          date: "2026-06-01",
          method: "efectivo",
          categoryId: null,
          incomeSourceId: null,
          note: "",
          weekIso: "2026-W23",
          month: "2026-06",
          origin: "manual",
          title: "Dirty",
          isAutoCategorized: false,
          isFixed: false,
          deletedAt: null,
          updatedAt: NEWER_AT,
        },
      ],
    });

    assert.equal(hasPendingLocalChanges(), true);
  });

  it("treats soft-deleted tombstones as pending when updated after sync", () => {
    useFinanceStore.setState({
      transactions: [
        {
          id: "tx-tombstone",
          type: "gasto",
          amount: 10,
          currency: "ARS",
          date: "2026-06-01",
          method: "efectivo",
          categoryId: null,
          incomeSourceId: null,
          note: "",
          weekIso: "2026-W23",
          month: "2026-06",
          origin: "manual",
          title: "Gone",
          isAutoCategorized: false,
          isFixed: false,
          deletedAt: NEWER_AT,
          updatedAt: NEWER_AT,
        },
      ],
    });

    assert.equal(hasPendingLocalChanges(), true);
  });

  it("is true when lastSyncedAt is null (never synced)", () => {
    useFinanceStore.setState({ lastSyncedAt: null });
    assert.equal(hasPendingLocalChanges(), true);
  });

  it("is true when an entity is missing updatedAt", () => {
    useFinanceStore.setState({
      categories: [
        {
          id: "cat-legacy",
          name: "Legacy",
          icon: "?",
          color: "#000000",
          kind: "variable",
          keywords: [],
        },
      ],
    });

    assert.equal(hasPendingLocalChanges(), true);
  });
});

describe("pushPullSync", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(resetToCleanSyncedState);

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("skips the network when navigator reports offline", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("should not fetch");
    }) as typeof fetch;

    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false },
      configurable: true,
    });

    const result = await pushPullSync();
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /conexión/i);
    assert.equal(fetchCalls, 0);

    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { navigator?: unknown }).navigator;
  });

  it("applies remote changes and updates lastSyncedAt on success", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
    });

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          serverTime: "2026-07-01T00:00:00.000Z",
          changes: {
            transactions: [
              {
                id: "tx-remote",
                type: "ingreso",
                amount: 500,
                currency: "ARS",
                date: "2026-07-01",
                method: "transferencia",
                categoryId: null,
                incomeSourceId: null,
                note: "",
                weekIso: "2026-W27",
                month: "2026-07",
                origin: "manual",
                title: "Remote pay",
                isAutoCategorized: false,
                isFixed: false,
                deletedAt: null,
                updatedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    const result = await pushPullSync();
    assert.equal(result.ok, true);
    assert.equal(
      useFinanceStore.getState().lastSyncedAt,
      "2026-07-01T00:00:00.000Z",
    );
    assert.ok(
      useFinanceStore
        .getState()
        .transactions.some((tx) => tx.id === "tx-remote"),
    );

    delete (globalThis as { navigator?: unknown }).navigator;
  });

  it("returns a session error on 401", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
    });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      })) as typeof fetch;

    const result = await pushPullSync();
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /sesión/i);

    delete (globalThis as { navigator?: unknown }).navigator;
  });
});
