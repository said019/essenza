import { test, expect } from "../fixtures/auth";
import { AdminPage } from "../pages/AdminPage";

test.describe("Admin – Pagos Mercado Pago", () => {
  test("Settings de pagos muestra campos y vistas previas base", async ({ adminPage: page }) => {
    const admin = new AdminPage(page);
    await admin.gotoPaymentSettings();
    await admin.assertPageLoaded(/pagos/i);

    await expect(page.getByLabel(/access token/i)).toBeVisible();
    await expect(page.getByLabel(/public key/i)).toBeVisible();
    await expect(page.getByLabel(/webhook secret/i)).toBeVisible();
    await expect(page.getByText(/checkout activo hoy/i)).toBeVisible();
    await expect(page.getByText(/webhook final/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /guardar configuración/i })).toBeVisible();
  });
});
