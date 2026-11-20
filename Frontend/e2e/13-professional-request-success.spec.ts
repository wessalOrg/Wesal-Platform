import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page, type: "coordinator" | "photographer", resubmit: boolean, fail = false) {
  const role = type === "coordinator" ? "EventCoordinator" : "Photographer";
  let submitted = false;
  let refreshed = 0;
  await page.addInitScript((role) => {
    const token = `test.${btoa(JSON.stringify({ sub: "request-user", role, exp: Date.now() / 1000 + 3600 }))}.test`;
    sessionStorage.setItem("wesal-access-token", token);
    sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: "request-user", name: "Test User", role } }));
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
    if (route.request().method() === "OPTIONS") return json({});
    if (path === "/session") return json({ isAuthenticated: true, role });
    if (path === "/profile") {
      if (submitted) refreshed += 1;
      return json({ id: "request-user", fullName: "Test User", concurrencyStamp: "test",
        isSetupComplete: submitted || resubmit,
        approvalStatus: !submitted && resubmit ? "NeedsChanges" : "Pending" });
    }
    if (path === `/${type}/setup${resubmit ? "/resubmit" : ""}` && route.request().method() === "POST") {
      if (fail) return json({ title: "Submission failed" }, 500);
      submitted = true;
      return json({ isSetupComplete: true, approvalStatus: "Pending" });
    }
    if (path === "/language") return json({ language: "ar" });
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [] });
  });
  return { refreshed: () => refreshed };
}

async function fillRequest(page: Page, type: "coordinator" | "photographer") {
  const image = { name: "test.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+1sAAAAASUVORK5CYII=", "base64") };
  if (type === "coordinator") {
    await page.getByTestId("coordinator-shop-name").fill("Test Shop");
    await page.getByTestId("coordinator-shop-location").fill("Ramallah");
    await page.getByTestId("coordinator-shop-photo").locator('input[type="file"]').setInputFiles(image);
  } else {
    await page.getByTestId("photographer-type-independent").click();
    await page.getByTestId("photographer-full-name").fill("Test Photographer");
  }
  await page.getByTestId(`${type}-phone`).fill("0591234567");
  await page.getByTestId(`${type}-identity`).locator('input[type="file"]').setInputFiles(image);
}

for (const type of ["coordinator", "photographer"] as const) {
  for (const resubmit of [false, true]) {
    test(`${type}: ${resubmit ? "resubmission" : "initial submission"} confirmation survives the profile refresh`, async ({ page }) => {
      const state = await setup(page, type, resubmit);
      await page.goto(`/register/${type}-setup${resubmit ? "?mode=edit" : ""}`);
      await fillRequest(page, type);
      await page.getByTestId(`${type}-setup-submit`).click();
      await expect(page.getByTestId("coordinator-setup-pending-success")).toBeVisible();
      await expect.poll(state.refreshed).toBeGreaterThan(0);
      await expect(page.getByTestId("coordinator-setup-pending-success")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/register/${type}-setup`));
      await page.getByTestId("coordinator-setup-home").click();
      await expect(page).toHaveURL(/\/profile$/);
      await expect(page.getByTestId("coordinator-setup-pending-success")).toHaveCount(0);
    });
  }
  test(`${type}: failed submission does not show success`, async ({ page }) => {
    await setup(page, type, false, true);
    await page.goto(`/register/${type}-setup`);
    await fillRequest(page, type);
    await page.getByTestId(`${type}-setup-submit`).click();
    await expect(page.getByTestId(`${type}-setup-form`).getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("coordinator-setup-pending-success")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/register/${type}-setup`));
  });
}
