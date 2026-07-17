import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectIncomingEntityIds,
  excludeIncomingEcho,
  shouldOverwrite,
  type SyncChanges,
  type SyncProfile,
  type SyncTransaction,
} from "./sync-server";

const OLDER = new Date("2026-01-01T00:00:00.000Z");
const NEWER = new Date("2026-06-01T00:00:00.000Z");

function makeTransaction(id: string, updatedAt: string): SyncTransaction {
  return {
    id,
    type: "gasto",
    amount: 100,
    currency: "ARS",
    date: "2026-01-15",
    method: "transferencia",
    categoryId: "cat-1",
    incomeSourceId: null,
    accountId: "acc-1",
    note: "",
    weekIso: "2026-W03",
    month: "2026-01",
    origin: "manual",
    title: "Test",
    isAutoCategorized: false,
    isFixed: false,
    updatedAt,
    deletedAt: null,
  };
}

function makeProfile(id: string): SyncProfile {
  return {
    id,
    name: "Test",
    email: "test@example.com",
    defaultCurrency: "ARS",
    payCadence: "weekly",
    paydayWeekday: "viernes",
    paydayDayOfMonth: 1,
    initials: "T",
    isSetupComplete: true,
    defaultAccountId: "acc-1",
    shouldRemindPaydayLoad: false,
    updatedAt: "2026-06-01T00:00:00.000Z",
    deletedAt: null,
  };
}

describe("shouldOverwrite (LWW)", () => {
  it("accepts newer incoming", () => {
    assert.equal(shouldOverwrite(OLDER, NEWER), true);
  });

  it("accepts equal timestamps (incoming wins ties)", () => {
    assert.equal(shouldOverwrite(NEWER, NEWER), true);
  });

  it("rejects older incoming", () => {
    assert.equal(shouldOverwrite(NEWER, OLDER), false);
  });
});

describe("excludeIncomingEcho", () => {
  it("strips entities that were just pushed and keeps remote-only ones", () => {
    const outgoing: SyncChanges = {
      transactions: [
        makeTransaction("tx-pushed", "2026-06-01T00:00:00.000Z"),
        makeTransaction("tx-remote", "2026-06-01T00:00:00.000Z"),
      ],
      accounts: [
        {
          id: "acc-pushed",
          name: "Pushed",
          currency: "ARS",
          updatedAt: "2026-06-01T00:00:00.000Z",
          deletedAt: null,
        },
        {
          id: "acc-remote",
          name: "Remote",
          currency: "ARS",
          updatedAt: "2026-06-01T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    };

    const incomingIds = collectIncomingEntityIds({
      transactions: [makeTransaction("tx-pushed", "2026-06-01T00:00:00.000Z")],
      accounts: [
        {
          id: "acc-pushed",
          name: "Pushed",
          currency: "ARS",
          updatedAt: "2026-06-01T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    });

    const filtered = excludeIncomingEcho(outgoing, incomingIds);

    assert.deepEqual(
      (filtered.transactions ?? []).map((tx) => tx.id),
      ["tx-remote"],
    );
    assert.deepEqual(
      (filtered.accounts ?? []).map((account) => account.id),
      ["acc-remote"],
    );
  });

  it("omits profile when it matches the pushed profile id", () => {
    const outgoing: SyncChanges = {
      profile: makeProfile("user-1"),
    };

    const incomingIds = collectIncomingEntityIds({
      profile: outgoing.profile!,
    });

    const filtered = excludeIncomingEcho(outgoing, incomingIds);
    assert.equal(filtered.profile, undefined);
  });

  it("keeps profile when outgoing profile id differs from push", () => {
    const outgoing: SyncChanges = {
      profile: makeProfile("user-server"),
    };

    const incomingIds = collectIncomingEntityIds({
      profile: makeProfile("user-client"),
    });

    const filtered = excludeIncomingEcho(outgoing, incomingIds);
    assert.equal(filtered.profile?.id, "user-server");
  });

  it("returns undefined list when every entity was an echo", () => {
    const outgoing: SyncChanges = {
      transactions: [makeTransaction("tx-only", "2026-06-01T00:00:00.000Z")],
    };
    const incomingIds = collectIncomingEntityIds(outgoing);
    const filtered = excludeIncomingEcho(outgoing, incomingIds);
    assert.equal(filtered.transactions, undefined);
  });
});
