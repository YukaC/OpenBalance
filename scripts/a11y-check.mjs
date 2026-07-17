#!/usr/bin/env node
/**
 * Manual a11y regression helper (F8) — no Chromatic, no Playwright.
 *
 * Automated coverage today:
 * - ESLint: `eslint-config-next` → `next/core-web-vitals` includes jsx-a11y
 *   (see eslint.config.mjs — a11y rules are not disabled).
 * - `pnpm test` → src/lib/a11y-smoke.test.ts imports axe-core; full axe.run
 *   is skipped until a DOM (jsdom) is available.
 *
 * Manual process (run before a release that touches Auth / PIN / forms):
 *
 * 1. pnpm dev
 * 2. Open Chrome DevTools → Lighthouse → Accessibility (or axe DevTools extension)
 * 3. Spot-check these surfaces:
 *    - Auth (login / register)
 *    - PIN unlock
 *    - TransactionForm (open from FAB)
 *    - ConfirmDialog (delete a category or transaction)
 *    - MonthJumpCalendar (keyboard: Tab into grid, arrows move focus)
 * 4. Fail the release if: missing labels, focus trap broken, contrast fails,
 *    or errors lack aria-invalid / aria-describedby.
 *
 * Checklist detail: docs/A11Y.md
 */

console.log(`OpenBalance a11y check (manual)

1. Ensure lint a11y is on:  pnpm lint
2. Confirm axe-core resolves:  pnpm test -- src/lib/a11y-smoke.test.ts
3. Follow the manual Lighthouse / axe DevTools steps in docs/A11Y.md

No headless browser is wired in CI yet (keeps the toolchain light).
`);
