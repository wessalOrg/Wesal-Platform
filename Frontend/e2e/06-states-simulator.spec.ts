import { expect, test } from "@playwright/test";
import { gotoAdmin, loginAsAdmin } from "./helpers";

test.describe.serial("studio states, simulator and history", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    page.on("dialog", (dialog) => void dialog.accept());
  });

  test("simulator answers read-only with source", async ({ page }) => {
    await gotoAdmin(page, "/admin/mabrouk/simulator");
    const sim = page.getByTestId("mabrouk-simulator");
    await expect(sim).toBeVisible();
    await sim.locator("textarea").first().fill("مين مطورين وصال؟");
    await sim.locator("button.btn-primary").click();
    const result = page.getByTestId("mabrouk-simulator-result");
    await expect(result).toBeVisible({ timeout: 60000 });
    expect(((await result.innerText()) ?? "").length).toBeGreaterThan(10);
  });

  test("analytics and history pages load", async ({ page }) => {
    await gotoAdmin(page, "/admin/mabrouk/analytics");
    await expect(page.getByTestId("mabrouk-analytics")).toBeVisible({ timeout: 30000 });
    await gotoAdmin(page, "/admin/mabrouk/history");
    await expect(page.getByTestId("mabrouk-history")).toBeVisible({ timeout: 30000 });
  });

  test("invalid history article is handled without crashing", async ({ page }) => {
    await gotoAdmin(page, "/admin/mabrouk/history?article=00000000-0000-0000-0000-000000000000");
    await expect(page.getByTestId("mabrouk-history")).toBeVisible({ timeout: 30000 });
  });

  test("gemini draft without a key degrades gracefully", async ({ page }) => {
    await gotoAdmin(page, "/admin/mabrouk/knowledge");
    const library = page.getByTestId("mabrouk-knowledge-library");
    const before = await library.locator("article").count();
    await library.locator("button.btn-primary").first().click();
    const editor = page.getByTestId("mabrouk-knowledge-editor");
    await editor.locator("textarea").first().fill("Draft question about E2E probe topic");
    await editor.locator("button.btn-outline").nth(1).click();
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.locator("button.btn-outline").first().click();
    expect(await library.locator("article").count()).toBeLessThanOrEqual(before + 1);
  });
});
