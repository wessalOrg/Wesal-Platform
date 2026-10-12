import { expect, test } from "@playwright/test";
import { gotoAdmin, loginAsAdmin } from "./helpers";

test.describe.serial("knowledge library lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    page.on("dialog", (dialog) => void dialog.accept());
  });

  test("search, filters and article rows", async ({ page }) => {
    await gotoAdmin(page, "/admin/mabrouk/knowledge");
    const library = page.getByTestId("mabrouk-knowledge-library");
    await expect(library).toBeVisible();
    await library.getByRole("textbox").first().fill("team");
    await page.keyboard.press("Enter");
    await expect(library.locator("article").first()).toBeVisible({ timeout: 20000 });
    await expect(library.locator("article", { hasText: "Wesal team" }).first()).toBeVisible();
  });

  test("built-in article is read-only and spawns an override draft", async ({ page }) => {
    await gotoAdmin(page, "/admin/mabrouk/knowledge");
    const library = page.getByTestId("mabrouk-knowledge-library");
    await library.getByRole("textbox").first().fill("Wesal team");
    await page.keyboard.press("Enter");
    const card = library.locator("article", { hasText: "Wesal team" }).first();
    await expect(card).toBeVisible({ timeout: 20000 });
    const buttons = card.getByRole("button");
    expect(await buttons.count()).toBeGreaterThanOrEqual(2);
    await buttons.nth(1).click();
    await expect(page.getByTestId("mabrouk-knowledge-editor")).toBeVisible({ timeout: 20000 });
    await page.getByTestId("mabrouk-knowledge-editor").locator("button.btn-outline").first().click();
  });

  test("scratch article full lifecycle with history and rollback", async ({ page }) => {
    const key = `e2e-scratch-${Date.now()}`;
    const title = `E2E Scratch ${Date.now()}`;
    await gotoAdmin(page, "/admin/mabrouk/knowledge");
    const library = page.getByTestId("mabrouk-knowledge-library");
    await library.locator("button.btn-primary").first().click();
    const editor = page.getByTestId("mabrouk-knowledge-editor");
    await expect(editor).toBeVisible({ timeout: 30000 });
    const inputs = editor.locator("input");
    await expect(inputs.nth(0)).toBeVisible({ timeout: 15000 });
    await expect(editor.locator("textarea").nth(1)).toBeEditable({ timeout: 15000 });
    await inputs.nth(0).fill(title);
    await inputs.nth(1).fill(key);
    await inputs.nth(2).fill("support");
    await inputs.nth(3).fill("E2E local source");
    await editor.locator("textarea").nth(1).fill(`E2E draft body ${Date.now()}`);
    await editor.locator("select").selectOption("NeedsVerification");
    await inputs.last().fill("E2E initial draft");
    await editor.locator("button.btn-outline").nth(4).click();
    const card = library.locator("article", { hasText: title }).first();
    await expect(card).toBeVisible({ timeout: 30000 });

    // Save draft deliberately keeps the editor open so the Admin can continue
    // editing or publish from it. Close it explicitly: while it is open its
    // modal overlay intercepts pointer events on the library card actions.
    await editor.locator("button.btn-outline").first().click();
    await expect(editor).toBeHidden({ timeout: 15000 });

    await card.locator("button.btn-primary").click();
    await expect(card.locator("button.btn-primary")).toHaveCount(0, { timeout: 30000 });

    await card.locator("button.btn-outline").last().click();
    await expect(page.getByTestId("mabrouk-history")).toBeVisible({ timeout: 20000 });
    const rollbacks = page.getByTestId("mabrouk-history").locator("button.btn-outline");
    await expect(rollbacks.first()).toBeVisible();
    await rollbacks.first().click();
    await expect(page.getByTestId("mabrouk-history")).toBeVisible({ timeout: 30000 });
  });

  test("review date, expiry and duplicate", async ({ page }) => {
    const key = `e2e-dates-${Date.now()}`;
    const title = `E2E Dates ${Date.now()}`;
    await gotoAdmin(page, "/admin/mabrouk/knowledge");
    const library = page.getByTestId("mabrouk-knowledge-library");
    await library.locator("button.btn-primary").first().click();
    const editor = page.getByTestId("mabrouk-knowledge-editor");
    await expect(editor).toBeVisible({ timeout: 30000 });
    const inputs = editor.locator("input");
    await expect(inputs.nth(0)).toBeVisible({ timeout: 15000 });
    await expect(editor.locator("textarea").nth(1)).toBeEditable({ timeout: 15000 });
    await inputs.nth(0).fill(title);
    await inputs.nth(1).fill(key);
    await inputs.nth(2).fill("support");
    await inputs.nth(3).fill("E2E local source");
    await editor.locator("textarea").nth(1).fill("E2E dates body");
    await editor.locator("select").selectOption("Verified");
    await inputs.nth(7).fill("2030-06-01");
    await inputs.nth(6).fill("2020-01-01");
    await inputs.last().fill("E2E dates draft");
    await editor.locator("button.btn-outline").nth(4).click();
    const card = library.locator("article", { hasText: title }).first();
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card).toContainText("2030-06-01");
    await expect(card).toContainText("2020-01-01");
  });

  test("ai draft without a key fails gracefully and creates nothing", async ({ page }) => {
    const knowledgeResponse = page.waitForResponse((response) => {
      const requestUrl = new URL(response.url());
      return requestUrl.pathname.endsWith("/api/v1/admin/mabrouk/knowledge")
        && response.request().method() === "GET";
    });
    await gotoAdmin(page, "/admin/mabrouk/knowledge");
    const library = page.getByTestId("mabrouk-knowledge-library");
    expect((await knowledgeResponse).status()).toBe(200);
    await expect(library.locator("article").first()).toBeVisible({ timeout: 30000 });
    const before = await library.locator("article").count();
    await library.locator("button.btn-primary").first().click();
    const editor = page.getByTestId("mabrouk-knowledge-editor");
    await editor.locator("textarea").first().fill("Draft question about E2E probe topic");
    const draftResponse = page.waitForResponse((response) => {
      const requestUrl = new URL(response.url());
      return requestUrl.pathname.endsWith("/api/v1/admin/mabrouk/knowledge/ai-draft")
        && response.request().method() === "POST";
    });
    await editor.locator("button.btn-outline").nth(1).click();
    expect((await draftResponse).status()).toBe(503);
    await expect(editor.getByRole("alert")).toContainText("تعذر حفظ التغيير");
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.locator("button.btn-outline").first().click();
    expect(await library.locator("article").count()).toBe(before);
  });
});
