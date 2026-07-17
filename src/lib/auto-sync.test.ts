import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDLE_ONLINE_RETRY_DELAYS_MS,
  IDLE_SYNC_MS,
  getIdleOnlineRetryDelayMs,
} from "./auto-sync";
import { KEEPALIVE_MAX_BODY_BYTES } from "./sync-client";

describe("IDLE_ONLINE_RETRY_DELAYS_MS", () => {
  it("uses 2s → 8s → 30s backoff (3 retries capped)", () => {
    assert.deepEqual([...IDLE_ONLINE_RETRY_DELAYS_MS], [2000, 8000, 30000]);
  });
});

describe("getIdleOnlineRetryDelayMs", () => {
  it("returns delay for each in-range retry index", () => {
    assert.equal(getIdleOnlineRetryDelayMs(0), 2000);
    assert.equal(getIdleOnlineRetryDelayMs(1), 8000);
    assert.equal(getIdleOnlineRetryDelayMs(2), 30000);
  });

  it("returns null when retry index is out of range (cap)", () => {
    assert.equal(getIdleOnlineRetryDelayMs(-1), null);
    assert.equal(getIdleOnlineRetryDelayMs(3), null);
    assert.equal(getIdleOnlineRetryDelayMs(99), null);
  });

  it("accepts a custom delay schedule", () => {
    assert.equal(getIdleOnlineRetryDelayMs(0, [100, 200]), 100);
    assert.equal(getIdleOnlineRetryDelayMs(1, [100, 200]), 200);
    assert.equal(getIdleOnlineRetryDelayMs(2, [100, 200]), null);
  });
});

describe("IDLE_SYNC_MS", () => {
  it("is ten minutes", () => {
    assert.equal(IDLE_SYNC_MS, 10 * 60 * 1000);
  });
});

describe("O4 keepalive leave flush threshold", () => {
  it("keeps the safe chunk threshold at 50KB (below browser ~64KB cap)", () => {
    assert.equal(KEEPALIVE_MAX_BODY_BYTES, 50_000);
  });
});
