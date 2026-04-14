import { test, expect } from "../fixtures/auth";
import { AdminPage } from "../pages/AdminPage";

test.describe("Admin – Integraciones Partner", () => {
  test("Plataformas carga credenciales y acciones base", async ({ adminPage: page }) => {
    const admin = new AdminPage(page);
    await admin.gotoPartnerPlatforms();
    await admin.assertPageLoaded(/plataformas/i);

    await expect(page.getByRole("tab", { name: /credenciales/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /mapeos y sync/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /guardar configuración/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sincronizar disponibilidad/i })).toBeVisible();
  });

  test("Plataformas muestra sección de mapeos", async ({ adminPage: page }) => {
    const admin = new AdminPage(page);
    await admin.gotoPartnerPlatforms();
    await admin.assertPageLoaded(/plataformas/i);

    await page.getByRole("tab", { name: /mapeos y sync/i }).click();

    await expect(
      page.getByText(/clases próximas/i).or(
        page.getByText(/no hay clases próximas/i)
      )
    ).toBeVisible();
  });

  test("Check-ins partners carga filtros y tabla", async ({ adminPage: page }) => {
    const admin = new AdminPage(page);
    await admin.gotoPartnerCheckins();
    await admin.assertPageLoaded(/check-ins partners/i);

    await expect(page.getByText(/filtros/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /actualizar/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });
});
