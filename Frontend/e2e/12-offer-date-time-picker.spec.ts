import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page, role: string) {
  await page.addInitScript((role) => {
    const claims = btoa(JSON.stringify({ sub: "date-picker-user", role, exp: Date.now() / 1000 + 3600 }));
    const token = `test.${claims}.test`;
    sessionStorage.setItem("wesal-access-token", token);
    sessionStorage.setItem("wesal_auth", JSON.stringify({
      token, user: { id: "date-picker-user", name: "Date Picker User", role },
    }));
  }, role);
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status,
      contentType: "application/json", body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "*" },
    });
    if (url.pathname.startsWith("/hubs/")) return json({}, 404);
    if (!url.pathname.startsWith("/api/v1/")) {
      return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
    }
    const path = url.pathname.slice("/api/v1".length);
    if (path === "/session") return json({ isAuthenticated: true, role });
    if (path === "/profile") return json({ id: "date-picker-user", fullName: "Date Picker User",
      approvalStatus: "Approved", isSetupComplete: true, concurrencyStamp: "test" });
    if (path === "/language") return json({ language: "ar" });
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [], totalCount: 0 });
  });
}

for (const [role, width, height] of [
  ["Photographer", 1366, 900], ["EventCoordinator", 390, 844],
] as const) {
  test(`${role}: both offer calendars open above and fit the viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await setup(page, role);
    await page.goto("/profile/offers");
    await page.getByTestId("pro-offers-add").click();
    for (const field of ["pro-offer-starts-at", "pro-offer-ends-at"]) {
      const trigger = page.getByTestId(field);
      await trigger.evaluate((el) => el.scrollIntoView({ block: "end" }));
      await trigger.click();
      const panel = page.locator(".wesal-datetime-panel");
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      const anchor = await trigger.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(anchor!.y);
      await panel.locator(".wesal-datetime-day").filter({ hasText: /^15$/ }).click();
      await panel.getByLabel("الساعة", { exact: true }).selectOption("9");
      await panel.getByLabel("الدقيقة", { exact: true }).selectOption("30");
      await panel.getByLabel("فترة الحجز", { exact: true }).selectOption("pm");
      await panel.screenshot({ path: test.info().outputPath(`${field}.png`) });
      await panel.getByRole("button", { name: "حسناً", exact: true }).click();
      await expect(panel).toHaveCount(0);
      await expect(trigger).toContainText("09:30");
      await expect(trigger).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
