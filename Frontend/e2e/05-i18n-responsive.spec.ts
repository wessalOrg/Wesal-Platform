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
  await gotoAdmin(page, "/admin/mabrouk");
  await page.evaluate(() => {
    const browserWindow = window as Window & { __wesalLanguageEventSeen?: boolean };
    browserWindow.__wesalLanguageEventSeen = false;
    window.addEventListener(
      "wesal-lang-change",
      () => {
        browserWindow.__wesalLanguageEventSeen = true;
      },
      { once: true },
    );
  });
  const savedLanguage = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" && new URL(response.url()).pathname.endsWith("/language"),
    { timeout: 15000 },
  );
  await page.getByTestId("language-toggle").click();
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem("wesal_ui_lang")))
    .toBe("en");
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => (window as Window & { __wesalLanguageEventSeen?: boolean }).__wesalLanguageEventSeen,
        ),
    )
    .toBe(true);
  expect((await savedLanguage).status()).toBe(200);
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dir), { timeout: 15000 })
    .toBe("ltr");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  await expect(page.getByTestId("admin-nav-mabrouk")).toContainText("Mabrouk");

  await page.reload();
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dir), { timeout: 15000 })
    .toBe("ltr");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
  expect(await page.evaluate(() => window.localStorage.getItem("wesal_ui_lang"))).toBe("en");
  await expect(page.getByTestId("admin-nav-mabrouk")).toContainText("Mabrouk");
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
