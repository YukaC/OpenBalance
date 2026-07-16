import type { Category, UserCategoryRule } from "./types";

export function suggestCategoryId(
  text: string,
  categories: Category[],
  userRules: UserCategoryRule[],
): { categoryId: string | null; isAuto: boolean } {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return { categoryId: null, isAuto: false };

  for (const rule of userRules) {
    if (normalized.includes(rule.pattern.toLowerCase())) {
      return { categoryId: rule.categoryId, isAuto: true };
    }
  }

  for (const category of categories) {
    for (const keyword of category.keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();
      if (normalizedKeyword.length < 3) continue;
      if (normalized.includes(normalizedKeyword)) {
        return { categoryId: category.id, isAuto: true };
      }
    }
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
