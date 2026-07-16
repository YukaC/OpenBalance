const SAFE_HEX_COLOR =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const SAFE_NAMED_COLORS = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
  "brown",
  "cyan",
  "magenta",
  "navy",
  "teal",
  "olive",
  "maroon",
  "silver",
  "gold",
]);

const UNSAFE_COLOR_PATTERN = /[;{}]|url\s*\(|expression|javascript:|@import/i;

/**
 * Accepts only safe hex colors (#rgb, #rrggbb, #rrggbbaa) or simple named colors.
 * Rejects anything that could break out of a CSS value context.
 */
export function isValidCssColor(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || UNSAFE_COLOR_PATTERN.test(trimmed)) return false;
  if (SAFE_HEX_COLOR.test(trimmed)) return true;
  return SAFE_NAMED_COLORS.has(trimmed.toLowerCase());
}

export function sanitizeCssColor(
  value: string,
  fallback = "#7a6f64",
): string {
  return isValidCssColor(value) ? value.trim() : fallback;
}
