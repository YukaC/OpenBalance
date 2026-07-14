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
      if (normalized.includes(keyword.toLowerCase())) {
        return { categoryId: category.id, isAuto: true };
      }
    }
  }

  return { categoryId: null, isAuto: false };
}
