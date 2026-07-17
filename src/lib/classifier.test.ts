import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCategoryCorrectionMemory,
  CATEGORY_CORRECTION_CONFIRM_THRESHOLD,
  suggestCategoryId,
  USER_RULE_CONFIRMED_PRIORITY,
} from "./classifier";
import type { Category, UserCategoryRule } from "./types";

const categories: Category[] = [
  {
    id: "cat-food",
    name: "Comida",
    icon: "🍽️",
    color: "#9a4a32",
    kind: "variable",
    keywords: ["almuerzo", "ok", "xy", "super", "rappi"],
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
  {
    id: "cat-delivery",
    name: "Delivery",
    icon: "🛵",
    color: "#8a4a6a",
    kind: "hormiga",
    keywords: [],
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

  it("prefers higher-priority user rule over a longer lower-priority pattern", () => {
    const rules: UserCategoryRule[] = [
      {
        id: "r-long",
        pattern: "rappi comida",
        categoryId: "cat-food",
        priority: 0,
      },
      {
        id: "r-confirmed",
        pattern: "rappi",
        categoryId: "cat-delivery",
        priority: USER_RULE_CONFIRMED_PRIORITY,
        confirmCount: CATEGORY_CORRECTION_CONFIRM_THRESHOLD,
      },
    ];
    const result = suggestCategoryId("rappi comida noche", categories, rules);
    assert.equal(result.categoryId, "cat-delivery");
    assert.equal(result.isAuto, true);
  });
});

describe("applyCategoryCorrectionMemory", () => {
  it("creates a provisional rule on first correction", () => {
    const next = applyCategoryCorrectionMemory(
      [],
      "Rappi",
      "cat-delivery",
      () => "rule-1",
      "2026-01-01T00:00:00.000Z",
    );
    assert.equal(next.length, 1);
    assert.equal(next[0]?.pattern, "rappi");
    assert.equal(next[0]?.categoryId, "cat-delivery");
    assert.equal(next[0]?.confirmCount, 1);
    assert.equal(next[0]?.priority, 0);
  });

  it("elevates priority after the same pattern→category is confirmed twice", () => {
    const first = applyCategoryCorrectionMemory(
      [],
      "rappi",
      "cat-delivery",
      () => "rule-1",
      "2026-01-01T00:00:00.000Z",
    );
    const second = applyCategoryCorrectionMemory(
      first,
      "rappi",
      "cat-delivery",
      () => "rule-2",
      "2026-01-02T00:00:00.000Z",
    );
    assert.equal(second.length, 1);
    assert.equal(second[0]?.id, "rule-1");
    assert.equal(second[0]?.confirmCount, 2);
    assert.equal(second[0]?.priority, USER_RULE_CONFIRMED_PRIORITY);

    const suggested = suggestCategoryId("pago rappi", categories, second);
    assert.equal(suggested.categoryId, "cat-delivery");
  });

  it("resets confirm count when the same pattern moves to another category", () => {
    const first = applyCategoryCorrectionMemory(
      [],
      "rappi",
      "cat-delivery",
      () => "rule-1",
      "2026-01-01T00:00:00.000Z",
    );
    const second = applyCategoryCorrectionMemory(
      first,
      "rappi",
      "cat-food",
      () => "rule-2",
      "2026-01-02T00:00:00.000Z",
    );
    const active = second.filter((rule) => rule.deletedAt == null);
    assert.equal(active.length, 1);
    assert.equal(active[0]?.id, "rule-2");
    assert.equal(active[0]?.categoryId, "cat-food");
    assert.equal(active[0]?.confirmCount, 1);
    assert.equal(active[0]?.priority, 0);
    assert.ok(second.some((rule) => rule.id === "rule-1" && rule.deletedAt));
  });
});
