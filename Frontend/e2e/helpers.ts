import { randomBytes } from "node:crypto";
import { expect, Page } from "@playwright/test";

// Credentials are never committed. The local E2E runner exports the provisioned
// admin account as E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (see docs handoff).
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e.admin@wesal.test";

export function adminPassword(): string {
  const value = process.env.E2E_ADMIN_PASSWORD;
  if (!value) {
    throw new Error("E2E_ADMIN_PASSWORD is not set; start the stack with the local E2E runner.");
  }
  return value;
}

/** Throwaway per-run password for accounts the specs register themselves. */
export function randomPassword(): string {
  return `E2e!${randomBytes(9).toString("base64url")}9a`;
}

export async function fillLogin(page: Page, email: string, password: string) {
  const emailBox = page.locator('input[type="email"]');
  const passwordBox = page.locator('input[type="password"]');
  const submit = page.locator('button[type="submit"]');
  await expect(emailBox).toBeVisible({ timeout: 30000 });
  await expect(passwordBox).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await emailBox.click();
  await emailBox.pressSequentially(email, { delay: 15 });
  await passwordBox.click();
  await passwordBox.pressSequentially(password, { delay: 15 });
  await page.waitForTimeout(1500);
  await expect(submit).toBeEnabled({ timeout: 20000 });
  await submit.click();
}

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await fillLogin(page, ADMIN_EMAIL, adminPassword());
  await expect
    .poll(async () => (page.url().includes("/login") ? false : true), { timeout: 60000 })
    .toBeTruthy();
}

export async function gotoAdmin(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId("admin-nav-mabrouk")).toBeAttached({ timeout: 60000 });
}

export async function openChat(page: Page) {
  await page.goto("/");
  const fab = page.getByTestId("ai-assistant-fab");
  await expect(fab).toBeVisible({ timeout: 30000 });
  await fab.click();
  try {
    await expect(page.getByTestId("ai-assistant-panel")).toBeVisible({ timeout: 8000 });
  } catch {
    // The draggable FAB swallows plain synthetic clicks when a drag is detected.
    await page.evaluate(() => {
      (document.querySelector('[data-testid="ai-assistant-fab"]') as HTMLElement | null)?.click();
    });
    await expect(page.getByTestId("ai-assistant-panel")).toBeVisible({ timeout: 30000 });
  }
}

export async function askChat(page: Page, question: string): Promise<string> {
  const input = page.getByTestId("ai-chat-input");
  await expect(input).toBeVisible({ timeout: 60000 });
  const panel = page.getByTestId("ai-assistant-panel");
  const before = ((await panel.innerText()) ?? "").length;
  await input.fill(question);
  await page.getByTestId("ai-chat-send").click();
  await expect
    .poll(
      async () => (((await panel.innerText()) ?? "").length > before + question.length ? 1 : 0),
      { timeout: 90000 },
    )
    .toBe(1);
  return (await panel.innerText()) ?? "";
}

export function stamp(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}
