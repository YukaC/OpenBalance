/**
 * Lightweight a11y smoke (F8) — no Chromatic / Playwright.
 *
 * Full axe runs need a real DOM (jsdom or browser). This suite:
 * 1. Confirms `axe-core` resolves under node:test.
 * 2. Skips the fixture run when `document` is missing (see docs/A11Y.md).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("a11y smoke (axe-core)", () => {
  it("imports axe-core", async () => {
    const axeModule = await import("axe-core");
    const axe = axeModule.default ?? axeModule;
    assert.equal(typeof axe.run, "function");
  });

  it("runs axe against a minimal HTML fixture when a DOM is available", async (t) => {
    if (typeof globalThis.document === "undefined") {
      t.skip(
        "No DOM in node:test (jsdom not installed). Manual checklist: docs/A11Y.md · scripts/a11y-check.mjs",
      );
      return;
    }

    const axeModule = await import("axe-core");
    const axe = axeModule.default ?? axeModule;

    document.body.innerHTML = `
      <main>
        <h1>Rinde a11y fixture</h1>
        <label for="amount">Monto</label>
        <input id="amount" type="text" aria-invalid="false" />
        <button type="button">Guardar</button>
      </main>
    `;

    const results = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa"],
      },
    });

    assert.equal(
      results.violations.length,
      0,
      results.violations
        .map((violation) => `${violation.id}: ${violation.help}`)
        .join("; "),
    );
  });
});
