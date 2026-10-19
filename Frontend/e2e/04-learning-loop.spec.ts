import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { askChat, gotoAdmin, loginAsAdmin, openChat } from "./helpers";

const COMING_SOON_CAPABILITY = "هل يوجد مستشار زفاف معتمد لدى وصال؟";
const MARKER = `E2ELOOP-RAFAH-${randomBytes(8).toString("hex").replace(/[0-9]/g, "a")}`;
const UNKNOWN = `كم يساوي اثنان زائد اثنين؟ ${MARKER}`;

test.describe.serial("browser learning loop without restart", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());
  });

  test("unknown via public chat lands in the inbox", async ({ page }) => {
    await openChat(page);
    const capabilityReply = await askChat(page, COMING_SOON_CAPABILITY);
    expect(capabilityReply).toContain("قيد التجهيز");

    const reply = await askChat(page, UNKNOWN);
    expect(reply.length).toBeGreaterThan(10);

    await loginAsAdmin(page);
    await gotoAdmin(page, "/admin/mabrouk/unanswered");
    const inbox = page.getByTestId("mabrouk-unanswered");
    await expect(inbox).toContainText(UNKNOWN, { timeout: 30000 });
    await expect(inbox).not.toContainText(COMING_SOON_CAPABILITY);
  });

  test("admin answers and publishes, public chat learns immediately", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoAdmin(page, "/admin/mabrouk/unanswered");
    const inbox = page.getByTestId("mabrouk-unanswered");
    await expect(inbox).toContainText(UNKNOWN, { timeout: 30000 });
    await inbox.locator("button", { hasText: UNKNOWN }).first().click();
    const detail = page.getByTestId("mabrouk-gap-detail");
    await expect(detail).toBeVisible();
    await detail.locator("button.btn-primary").click();

    const editor = page.getByTestId("mabrouk-knowledge-editor");
    await expect(editor).toBeVisible({ timeout: 30000 });
    await editor.locator("textarea").nth(1).fill(`اثنان زائد اثنين يساوي أربعة. ${MARKER}`);
    await editor.locator("select").selectOption("Verified");
    const inputs = editor.locator("input");
    await inputs.last().fill("E2E loop publish");
    const saveDraft = editor.locator("button.btn-outline").nth(4);
    await saveDraft.click();
    const publish = editor.locator("button.btn-primary");
    await expect(publish.first()).toBeVisible({ timeout: 15000 });
    await publish.first().click();
    await expect(editor).toBeHidden({ timeout: 45000 });

    await openChat(page);
    const second = await askChat(page, UNKNOWN);
    expect(second).toContain(MARKER);

    await gotoAdmin(page, "/admin/mabrouk/unanswered");
    await expect(page.getByTestId("mabrouk-unanswered")).not.toContainText(UNKNOWN, {
      timeout: 30000,
    });
  });
});
