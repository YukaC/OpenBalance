import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildManualFxSnapshot, convertWithManualRate } from "./manual-fx";

describe("convertWithManualRate", () => {
  it("converts USD to ARS and back", () => {
    assert.equal(convertWithManualRate(10, "USD", "ARS", 1000), 10_000);
    assert.equal(convertWithManualRate(10_000, "ARS", "USD", 1000), 10);
  });

  it("returns same amount when currencies match", () => {
    assert.equal(convertWithManualRate(50, "ARS", "ARS", 1000), 50);
  });
});

describe("buildManualFxSnapshot", () => {
  it("returns equivalent when rate is set", () => {
    const snapshot = buildManualFxSnapshot({
      defaultCurrency: "ARS",
      manualExchangeRate: 1000,
      otherIncome: 100,
      otherExpense: 20,
    });
    assert.ok(snapshot);
    assert.equal(snapshot.otherCurrency, "USD");
    assert.equal(snapshot.otherBalance, 80);
    assert.equal(snapshot.rate, 1000);
    assert.equal(snapshot.equivalentBalance, 80_000);
  });

  it("returns snapshot without equivalent when rate is missing", () => {
    const snapshot = buildManualFxSnapshot({
      defaultCurrency: "ARS",
      manualExchangeRate: null,
      otherIncome: 50,
      otherExpense: 0,
    });
    assert.ok(snapshot);
    assert.equal(snapshot.rate, null);
    assert.equal(snapshot.equivalentBalance, null);
    assert.equal(snapshot.otherBalance, 50);
  });

  it("returns null when other currency has no activity", () => {
    assert.equal(
      buildManualFxSnapshot({
        defaultCurrency: "ARS",
        manualExchangeRate: 1000,
        otherIncome: 0,
        otherExpense: 0,
      }),
      null,
    );
  });
});
