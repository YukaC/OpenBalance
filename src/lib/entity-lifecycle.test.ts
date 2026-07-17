import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeEntities,
  ensureLifecycle,
  isActive,
  touch,
} from "./entity-lifecycle";

describe("isActive", () => {
  it("treats missing or null deletedAt as active", () => {
    assert.equal(isActive({}), true);
    assert.equal(isActive({ deletedAt: null }), true);
    assert.equal(isActive({ deletedAt: undefined }), true);
  });

  it("treats a tombstone timestamp as inactive", () => {
    assert.equal(isActive({ deletedAt: "2026-01-01T00:00:00.000Z" }), false);
  });
});

describe("touch", () => {
  it("sets updatedAt without dropping other fields", () => {
    const before = Date.now();
    const result = touch({
      id: "x",
      deletedAt: null,
      updatedAt: "2000-01-01T00:00:00.000Z",
    });
    const after = Date.now();

    assert.equal(result.id, "x");
    assert.equal(result.deletedAt, null);
    assert.ok(typeof result.updatedAt === "string");
    const touchedAt = Date.parse(result.updatedAt);
    assert.ok(touchedAt >= before - 1000);
    assert.ok(touchedAt <= after + 1000);
  });
});

describe("ensureLifecycle", () => {
  it("fills missing updatedAt and normalizes undefined deletedAt to null", () => {
    const nowIso = "2026-03-01T12:00:00.000Z";
    const result = ensureLifecycle(
      { id: "legacy" } as { id: string; updatedAt?: string; deletedAt?: string | null },
      nowIso,
    );

    assert.equal(result.id, "legacy");
    assert.equal(result.updatedAt, nowIso);
    assert.equal(result.deletedAt, null);
  });

  it("preserves existing updatedAt and deletedAt", () => {
    const result = ensureLifecycle(
      {
        id: "kept",
        updatedAt: "2025-01-01T00:00:00.000Z",
        deletedAt: "2025-02-01T00:00:00.000Z",
      } as {
        id: string;
        updatedAt?: string;
        deletedAt?: string | null;
      },
      "2026-03-01T12:00:00.000Z",
    );

    assert.equal(result.updatedAt, "2025-01-01T00:00:00.000Z");
    assert.equal(result.deletedAt, "2025-02-01T00:00:00.000Z");
  });

  it("replaces empty-string updatedAt with nowIso", () => {
    const nowIso = "2026-03-01T12:00:00.000Z";
    const result = ensureLifecycle({ updatedAt: "" }, nowIso);
    assert.equal(result.updatedAt, nowIso);
  });
});

describe("activeEntities", () => {
  it("filters out soft-deleted rows", () => {
    const result = activeEntities([
      { id: "a", deletedAt: null },
      { id: "b", deletedAt: "2026-01-01T00:00:00.000Z" },
      { id: "c" },
    ]);

    assert.deepEqual(
      result.map((item) => item.id),
      ["a", "c"],
    );
  });
});
