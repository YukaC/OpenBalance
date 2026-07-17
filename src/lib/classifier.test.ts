import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestCategoryId } from "./classifier";
import type { Category, UserCategoryRule } from "./types";

const categories: Category[] = [
  {
    id: "cat-food",
    name: "Comida",
    icon: "🍽️",
    color: "#9a4a32",
    kind: "variable",
    keywords: ["almuerzo", "ok", "xy", "super"],
  },
  {
    id: "cat-trans",
    name: "Transporte",
    icon: "🚌",
    color: "#2a7d58",
    kind: "variable",
    keywords: ["uber", "taxi"],
  },
  {
    id: "cat-club",
    name: "Superclub",
    icon: "⭐",
    color: "#4a6a9a",
    kind: "variable",
    keywords: ["superclub"],
  },
];

describe("suggestCategoryId", () => {
  it("matches category keywords of length >= 3", () => {
    const result = suggestCategoryId("pago uber centro", categories, []);
    assert.equal(result.categoryId, "cat-trans");
    assert.equal(result.isAuto, true);
  });

  it("skips category keywords shorter than 3 characters", () => {
    const result = suggestCategoryId("todo ok xy", categories, []);
    assert.equal(result.categoryId, null);
    assert.equal(result.isAuto, false);
  });

  it("prefers user rules over category keywords", () => {
    const rules: UserCategoryRule[] = [
      { id: "r1", pattern: "almuerzo", categoryId: "cat-food" },
    ];
    const result = suggestCategoryId("almuerzo laburo", categories, rules);
    assert.equal(result.categoryId, "cat-food");
    assert.equal(result.isAuto, true);
  });

  it("picks the longest matching category keyword", () => {
    const result = suggestCategoryId("compra en superclub", categories, []);
    assert.equal(result.categoryId, "cat-club");
    assert.equal(result.isAuto, true);
  });

  it("picks the longest matching user rule pattern", () => {
    const rules: UserCategoryRule[] = [
      { id: "r-short", pattern: "super", categoryId: "cat-food" },
      { id: "r-long", pattern: "superclub", categoryId: "cat-club" },
    ];
    const result = suggestCategoryId("pago superclub", categories, rules);
    assert.equal(result.categoryId, "cat-club");
    assert.equal(result.isAuto, true);
  });

  it("still prefers any user rule over a longer category keyword", () => {
    const rules: UserCategoryRule[] = [
      { id: "r1", pattern: "super", categoryId: "cat-food" },
    ];
    const result = suggestCategoryId("pago superclub", categories, rules);
    assert.equal(result.categoryId, "cat-food");
    assert.equal(result.isAuto, true);
  });
});
