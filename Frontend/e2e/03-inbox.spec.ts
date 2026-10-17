import { expect, test } from "@playwright/test";
import { gotoAdmin, loginAsAdmin } from "./helpers";

const API = "http://127.0.0.1:5298/api/v1";
const GAP_A = "هل يوجد خصم لمجموعات الضيوف الكبيرة؟";
const GAP_B = "ما هي شروط كفالة العريس؟";

async function seedGap(question: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const sessionRes = await fetch(`${API}/ai/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "ar" }),
    });
    if (!sessionRes.ok) continue;
    const session = (await sessionRes.json()) as { sessionId?: string };
    if (!session.sessionId) continue;
    const turnRes = await fetch(`${API}/ai/sessions/${session.sessionId}/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question }),
    });
    if (!turnRes.ok) continue;
    const turn = (await turnRes.json()) as { message?: unknown };
    if (turn && typeof turn.message === "string" && turn.message.length > 0) return;
  }
  throw new Error(`gap seed turn failed for: ${question}`);
}

test.describe.serial("unanswered inbox", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    page.on("dialog", (dialog) => void dialog.accept());
  });

  test("seeded gaps appear with detail, badge, review and ignore", async ({ page }) => {
    await seedGap(GAP_A);
    await seedGap(GAP_B);
    await gotoAdmin(page, "/admin/mabrouk/unanswered");
    const inbox = page.getByTestId("mabrouk-unanswered");
    await expect(inbox).toBeVisible();
    await expect(inbox).toContainText(GAP_A, { timeout: 30000 });
    await expect(inbox).toContainText(GAP_B);
    await expect(page.getByTestId("admin-nav-mabrouk-gaps")).toBeVisible();

    const cardA = inbox.locator("button", { hasText: GAP_A }).first();
    await cardA.click();
    const detail = page.getByTestId("mabrouk-gap-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(GAP_A);

    const cardB = inbox.locator("button", { hasText: GAP_B }).first();
    await cardB.click();
    await expect(page.getByTestId("mabrouk-gap-detail")).toContainText(GAP_B);
    const outlines = page.getByTestId("mabrouk-gap-detail").locator("button.btn-outline");
    await outlines.nth(2).click();
    await expect(inbox).not.toContainText(GAP_B, { timeout: 30000 });
    await expect(inbox).toContainText(GAP_A);
  });

  test("create-answer failures are shown beside the action", async ({ page }) => {
    const question = "E2E: فشل إنشاء مسودة الإجابة";
    await seedGap(question);
    await gotoAdmin(page, "/admin/mabrouk/unanswered");
    const inbox = page.getByTestId("mabrouk-unanswered");
    await expect(inbox).toContainText(question, { timeout: 30000 });
    await inbox.locator("button", { hasText: question }).first().click();

    await page.route("**/admin/mabrouk/unanswered/*/create-article", (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "TestFailure" }),
    }));
    const detail = page.getByTestId("mabrouk-gap-detail");
    await detail.locator("button.btn-primary").click();
    await expect(page.getByTestId("mabrouk-create-answer-error")).toBeVisible();
  });
});
