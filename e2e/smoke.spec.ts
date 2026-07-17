import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home shows app shell, auth, or onboarding", async ({ page }) => {
    await page.goto("/");

    // Brand appears on shell, auth gate, and onboarding.
    await expect(page.getByText("OpenBalance").first()).toBeVisible({
      timeout: 30_000,
    });

    // One of the primary surfaces should be present.
    const shellOrGate = page
      .getByRole("heading", { name: /Resumen|Transacciones|Configuración|Iniciar sesión|Crear cuenta/i })
      .or(page.getByText(/Tu nombre|Continuar|Cobro semanal/i));

    await expect(shellOrGate.first()).toBeVisible({ timeout: 15_000 });
  });
});
