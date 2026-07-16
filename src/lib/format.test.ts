import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMoneyInput, roundAmountForCurrency } from "./format";

describe("parseMoneyInput", () => {
  it("parses plain integers", () => {
    assert.equal(parseMoneyInput("270000"), 270000);
    assert.equal(parseMoneyInput("600"), 600);
  });

  it("parses Argentine thousand separators", () => {
    assert.equal(parseMoneyInput("270.000"), 270000);
    assert.equal(parseMoneyInput("1.080.000"), 1080000);
    assert.equal(parseMoneyInput("128.500"), 128500);
    assert.equal(parseMoneyInput("16.000"), 16000);
    assert.equal(parseMoneyInput("610.000"), 610000);
  });

  it("parses Argentine decimals", () => {
    assert.equal(parseMoneyInput("49656,39"), 49656.39);
    assert.equal(parseMoneyInput("49.656,39"), 49656.39);
  });

  it("parses US-style amounts", () => {
    assert.equal(parseMoneyInput("1,080,000"), 1080000);
    assert.equal(parseMoneyInput("1,234.56"), 1234.56);
  });

  it("accepts currency symbols and spaces", () => {
    assert.equal(parseMoneyInput("$ 270.000"), 270000);
    assert.equal(parseMoneyInput(" 16.000 "), 16000);
  });

  it("keeps true decimals with one or two fraction digits", () => {
    assert.equal(parseMoneyInput("49.5"), 49.5);
    assert.equal(parseMoneyInput("49.56"), 49.56);
  });

  it("returns NaN for invalid input", () => {
    assert.ok(Number.isNaN(parseMoneyInput("")));
    assert.ok(Number.isNaN(parseMoneyInput("abc")));
  });
});

describe("roundAmountForCurrency", () => {
  it("rounds ARS to whole pesos", () => {
    assert.equal(roundAmountForCurrency(10.4, "ARS"), 10);
    assert.equal(roundAmountForCurrency(10.5, "ARS"), 11);
    assert.equal(roundAmountForCurrency(270000.2, "ARS"), 270000);
  });

  it("rounds USD to two decimals", () => {
    assert.equal(roundAmountForCurrency(10.456, "USD"), 10.46);
    assert.equal(roundAmountForCurrency(10.454, "USD"), 10.45);
    assert.equal(roundAmountForCurrency(1.1, "USD"), 1.1);
  });
});
