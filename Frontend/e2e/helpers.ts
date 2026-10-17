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

/**
 * Server-rendered inputs are visible long before React hydrates them. Text typed
 * into a controlled input before hydration reaches the DOM but never React state
 * (the submit button then stays disabled forever), so wait until React has
 * actually attached to the element instead of sleeping for a fixed time.
 */
async function waitForHydration(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const propsKey = Object.keys(el).find((key) => key.startsWith("__reactProps$"));
      if (!propsKey) return false;
      const props = (el as HTMLElement & Record<string, unknown>)[propsKey];
      return typeof props === "object" && props !== null
        && typeof (props as { onChange?: unknown }).onChange === "function";
    },
    selector,
    { timeout: 60000 },
  );
}

export async function fillLogin(page: Page, email: string, password: string) {
  await expect(page.getByTestId("login-form-fields")).toHaveAttribute("data-ready", "true", {
    timeout: 30000,
  });
  const emailBox = page.locator('input[type="email"]');
  const passwordBox = page.locator('input[type="password"]');
  const submit = page.locator('button[type="submit"]');
  await expect(emailBox).toBeVisible({ timeout: 30000 });
  await expect(passwordBox).toBeVisible({ timeout: 30000 });
  let lastFillError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForHydration(page, 'input[type="email"]');
    await waitForHydration(page, 'input[type="password"]');
    await emailBox.fill(email);
    await passwordBox.fill(password);
    try {
      // React may finish hydrating between fields and reset an earlier DOM-only
      // edit. Confirm both controlled values and retry the pair if that happens.
      await expect(emailBox).toHaveValue(email, { timeout: 3000 });
      await expect(passwordBox).toHaveValue(password, { timeout: 3000 });
      await expect(submit).toBeEnabled({ timeout: 5000 });
      lastFillError = undefined;
      break;
    } catch (error) {
      lastFillError = error;
    }
  }
  if (lastFillError) throw lastFillError;
  await submit.click();
}

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST"
      && new URL(response.url()).pathname.endsWith("/api/v1/auth/login"),
    { timeout: 30000 },
  );
  await fillLogin(page, ADMIN_EMAIL, adminPassword());
  expect((await loginResponse).status(), "admin login request should succeed").toBe(200);
  await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/, { timeout: 30000 });
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
  const assistantReplies = panel.locator(
    '[data-testid="ai-chat-message"][data-role="assistant"]',
  );
  await input.fill(question);
  const assistantResponse = page.waitForResponse(
    (response) => {
      const requestUrl = new URL(response.url());
      return (
        response.request().method() === "POST" &&
        /^\/api\/v1\/ai\/sessions\/[^/]+\/assistant$/.test(requestUrl.pathname)
      );
    },
    { timeout: 90000 },
  );
  await page.getByTestId("ai-chat-send").click();
  const response = await assistantResponse;
  expect(response.status(), "assistant request should complete successfully").toBe(200);

  const payload = (await response.json()) as { message?: string };
  expect(typeof payload.message).toBe("string");
  expect(payload.message?.trim().length).toBeGreaterThan(0);
  // The initial greeting can mount after the composer becomes visible. Match
  // the completed response so that delayed greeting cannot satisfy this wait.
  const reply = assistantReplies.last();
  await expect(reply).toContainText(payload.message!, { timeout: 90000 });
  const text = (await reply.innerText()).trim();
  expect(text.length).toBeGreaterThan(0);
  return text;
}

export function stamp(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}
