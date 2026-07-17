import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getClockSkewMs,
  hasPendingLocalChanges,
  isChangedSince,
  pushPullSync,
  resetSyncClientClockStateForTests,
  updateClockSkewFromServerTime,
} from "./sync-client";
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

function makeTransaction(overrides: {
  id: string;
  title: string;
  updatedAt: string;
  deletedAt?: string | null;
}) {
  return {
    id: overrides.id,
    type: "gasto" as const,
    amount: 10,
    currency: "ARS" as const,
    date: "2026-06-01",
    method: "efectivo" as const,
    categoryId: null,
    incomeSourceId: null,
    note: "",
    weekIso: "2026-W23",
    month: "2026-06",
    origin: "manual" as const,
    title: overrides.title,
    isAutoCategorized: false,
    isFixed: false,
    deletedAt: overrides.deletedAt ?? null,
    updatedAt: overrides.updatedAt,
  };
}

/**
 * Measure clockSkewMs as if Date.now() were `clientNowIso` when the server
 * returned `serverTimeIso` (positive skew ⇒ client clock behind server).
 */
function simulateClockSkewFromSync(
  serverTimeIso: string,
  clientNowIso: string,
): void {
  const realNow = Date.now;
  Date.now = () => Date.parse(clientNowIso);
  try {
    updateClockSkewFromServerTime(serverTimeIso);
  } finally {
    Date.now = realNow;
  }
}

/** Empty collections with timestamps so nothing looks dirty vs lastSyncedAt. */
function resetToCleanSyncedState() {
  resetSyncClientClockStateForTests();
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
  afterEach(() => {
    resetSyncClientClockStateForTests();
  });

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

  it("marks pending when client clock is behind server (A5 clock skew)", () => {
    // Client wall clock lags server by 5 minutes. touch() stamps updatedAt with
    // client time, so without skew adjustment the edit looks older than
    // lastSyncedAt (server cursor) and would never sync.
    const clientNowAtSync = "2026-07-17T12:00:00.000Z";
    const serverTime = "2026-07-17T12:05:00.000Z";
    // Edit a few seconds after sync on the client clock (past SKEW_EPSILON_MS).
    const clientEditAt = "2026-07-17T12:00:05.000Z";

    simulateClockSkewFromSync(serverTime, clientNowAtSync);
    assert.ok(getClockSkewMs() > 0, "skew should be positive when client is behind");

    const dirtyTx = makeTransaction({
      id: "tx-skew-behind",
      title: "Behind clock edit",
      updatedAt: clientEditAt,
    });

    useFinanceStore.setState({
      lastSyncedAt: serverTime,
      transactions: [dirtyTx],
    });

    // Naïve compare (no skew): client stamp is before lastSyncedAt → would drop.
    assert.equal(
      isChangedSince(dirtyTx, serverTime, 0),
      false,
      "without skew the behind-clock edit must look stale",
    );

    // With measured skew: same edit is pending and included in the next push.
    assert.equal(isChangedSince(dirtyTx, serverTime), true);
    assert.equal(hasPendingLocalChanges(), true);
  });
});

describe("pushPullSync", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(resetToCleanSyncedState);

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetSyncClientClockStateForTests();
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

  it("pushes local edits when client clock is behind server (A5)", async () => {
    const clientNowAtSync = "2026-07-17T12:00:00.000Z";
    const serverTime = "2026-07-17T12:05:00.000Z";
    const clientEditAt = "2026-07-17T12:00:05.000Z";

    simulateClockSkewFromSync(serverTime, clientNowAtSync);

    const dirtyTx = makeTransaction({
      id: "tx-skew-push",
      title: "Skew push",
      updatedAt: clientEditAt,
    });

    useFinanceStore.setState({
      lastSyncedAt: serverTime,
      transactions: [dirtyTx],
    });

    assert.equal(hasPendingLocalChanges(), true);

    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
    });

    let pushedTransactionIds: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        changes?: { transactions?: Array<{ id: string }> };
      };
      pushedTransactionIds =
        body.changes?.transactions?.map((tx) => tx.id) ?? [];
      return new Response(
        JSON.stringify({
          serverTime: "2026-07-17T12:05:10.000Z",
          changes: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await pushPullSync();
    assert.equal(result.ok, true);
    assert.deepEqual(pushedTransactionIds, ["tx-skew-push"]);

    delete (globalThis as { navigator?: unknown }).navigator;
  });
});
