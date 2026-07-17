import { isActive } from "./entity-lifecycle";
import type { Category, UserCategoryRule } from "./types";

/** Corrections needed before a user rule gets elevated priority (G1). */
export const CATEGORY_CORRECTION_CONFIRM_THRESHOLD = 2;

/** Priority assigned once the same pattern→category is confirmed N times. */
export const USER_RULE_CONFIRMED_PRIORITY = 100;

export function suggestCategoryId(
  text: string,
  categories: Category[],
  userRules: UserCategoryRule[],
): { categoryId: string | null; isAuto: boolean } {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return { categoryId: null, isAuto: false };

  let bestRuleMatch: {
    categoryId: string;
    length: number;
    priority: number;
  } | null = null;
  for (const rule of userRules) {
    if (!isActive(rule)) continue;
    const pattern = rule.pattern.toLowerCase().trim();
    if (!pattern) continue;
    if (!normalized.includes(pattern)) continue;
    const priority = rule.priority ?? 0;
    if (
      !bestRuleMatch ||
      priority > bestRuleMatch.priority ||
      (priority === bestRuleMatch.priority &&
        pattern.length > bestRuleMatch.length)
    ) {
      bestRuleMatch = {
        categoryId: rule.categoryId,
        length: pattern.length,
        priority,
      };
    }
  }
  if (bestRuleMatch) {
    return { categoryId: bestRuleMatch.categoryId, isAuto: true };
  }

  let bestKeywordMatch: { categoryId: string; length: number } | null = null;
  for (const category of categories) {
    if (!isActive(category)) continue;
    for (const keyword of category.keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();
      if (normalizedKeyword.length < 3) continue;
      if (!normalized.includes(normalizedKeyword)) continue;
      if (
        !bestKeywordMatch ||
        normalizedKeyword.length > bestKeywordMatch.length
      ) {
        bestKeywordMatch = {
          categoryId: category.id,
          length: normalizedKeyword.length,
        };
      }
    }
  }
  if (bestKeywordMatch) {
    return { categoryId: bestKeywordMatch.categoryId, isAuto: true };
  }

  return { categoryId: null, isAuto: false };
}

/** Build a short pattern from title/note for user category memory (§5 v2). */
export function extractCategoryPattern(title: string, note: string): string {
  const raw = (note.trim() || title.trim()).toLowerCase();
  if (!raw) return "";

  const tokens = raw
    .split(/[\s,.;:/|+-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  if (tokens.length === 0) return raw.slice(0, 40).trim();
  return tokens.slice(0, 2).join(" ");
}

/**
 * Upsert user-rule memory for a correction. Same pattern→categoryId twice
 * elevates priority so the personal override wins stably over keywords.
 */
export function applyCategoryCorrectionMemory(
  rules: UserCategoryRule[],
  pattern: string,
  categoryId: string,
  createId: () => string,
  nowIso: string = new Date().toISOString(),
): UserCategoryRule[] {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized || !categoryId) return rules;

  const existing = rules.find(
    (rule) => isActive(rule) && rule.pattern.toLowerCase() === normalized,
  );

  if (existing && existing.categoryId === categoryId) {
    const nextCount = (existing.confirmCount ?? 1) + 1;
    const nextPriority =
      nextCount >= CATEGORY_CORRECTION_CONFIRM_THRESHOLD
        ? Math.max(existing.priority ?? 0, USER_RULE_CONFIRMED_PRIORITY)
        : (existing.priority ?? 0);
    return rules.map((rule) =>
      rule.id === existing.id
        ? {
            ...rule,
            confirmCount: nextCount,
            priority: nextPriority,
            updatedAt: nowIso,
            deletedAt: null,
          }
        : rule,
    );
  }

  const withoutActiveSamePattern = rules.map((rule) =>
    isActive(rule) && rule.pattern.toLowerCase() === normalized
      ? { ...rule, deletedAt: nowIso, updatedAt: nowIso }
      : rule,
  );

  return [
    {
      id: createId(),
      pattern: normalized,
      categoryId,
      confirmCount: 1,
      priority: 0,
      updatedAt: nowIso,
      deletedAt: null,
    },
    ...withoutActiveSamePattern,
  ];
}
