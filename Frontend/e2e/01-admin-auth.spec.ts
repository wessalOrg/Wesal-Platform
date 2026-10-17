import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, fillLogin, gotoAdmin, loginAsAdmin, randomPassword } from "./helpers";

const API = "http://127.0.0.1:5298/api/v1";

test("anonymous admin visit redirects to landing", async ({ page }) => {
  await page.goto("/admin/mabrouk");
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
  await expect(page.getByTestId("mabrouk-overview")).toHaveCount(0);
});

test("registered non-admin cannot open the studio", async ({ page }) => {
  const email = `e2e.user.${Date.now()}@wesal.test`;
  const password = randomPassword();
  await page.request.post(`${API}/auth/register`, {
    data: {
      fullName: "E2E User",
      email,
      password,
      confirmPassword: password,
      accountType: "RegisteredUser",
    },
  });
  await page.goto("/login");
  await fillLogin(page, email, password);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
  await page.goto("/admin/mabrouk");
  await expect(page).toHaveURL(/\/$/, { timeout: 20000 });
});

test("admin login opens the studio overview with sidebar", async ({ page }) => {
  await loginAsAdmin(page);
  await gotoAdmin(page, "/admin/mabrouk");
  await expect(page.getByTestId("mabrouk-overview")).toBeVisible();
  await expect(page.getByTestId("admin-nav-mabrouk")).toBeVisible();
});

test("admin login rejects a wrong password", async ({ page }) => {
  await page.goto("/login");
  await fillLogin(page, ADMIN_EMAIL, randomPassword());
  await expect(page).toHaveURL(/\/login/);
});
