import { expect, test } from "@playwright/test";
import { gotoAdmin, loginAsAdmin } from "./helpers";

test("default Arabic renders RTL", async ({ page }) => {
  await loginAsAdmin(page);
  await gotoAdmin(page, "/admin/mabrouk");
  expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("ar");
  await expect(page.getByTestId("admin-nav-mabrouk")).toBeVisible();
});

test("English renders LTR with translated navigation", async ({ page }) => {
  await page.goto("/login");
  await loginAsAdmin(page);
  await page.evaluate(() => {
    window.localStorage.setItem("wesal_ui_lang", "en");
    window.dispatchEvent(new Event("wesal-lang-change"));
  });
  await page.reload();
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dir), { timeout: 15000 })
    .toBe("ltr");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await expect(page.getByTestId("admin-nav-mabrouk")).toBeVisible();
  await expect(page.getByTestId("mabrouk-overview")).toBeVisible();
});

test("mobile viewport keeps studio usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);
  await gotoAdmin(page, "/admin/mabrouk");
  await expect(page.getByTestId("mabrouk-overview")).toBeVisible();
  await expect(page.getByTestId("admin-nav-mabrouk")).toBeAttached();
  await gotoAdmin(page, "/admin/mabrouk/unanswered");
  await expect(page.getByTestId("mabrouk-unanswered")).toBeVisible({ timeout: 30000 });
});
