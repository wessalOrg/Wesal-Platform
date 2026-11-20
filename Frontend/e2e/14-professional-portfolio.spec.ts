import { expect, test, type Page } from "@playwright/test";

const userId = "portfolio-user";
const activeOffer = { id: "active-offer", ownerUserId: userId, content: "Active public offer",
  startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", oldPrice: 250, offerPrice: 150, images: [] };
const stoppedOffer = { ...activeOffer, id: "stopped-offer", content: "Stopped private offer", stoppedAt: "2026-01-01T00:00:00Z" };

async function setup(page: Page, role: string) {
  let bio = "My professional biography";
  await page.addInitScript(({ role, userId }) => {
    const token = `test.${btoa(JSON.stringify({ sub: userId, role, exp: Date.now() / 1000 + 3600 }))}.test`;
    sessionStorage.setItem("wesal-access-token", token);
    sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: userId, name: "Test Professional", role } }));
  }, { role, userId });
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
    if (path === "/profile") return json({ id: userId, fullName: "Test Professional", concurrencyStamp: "test", isSetupComplete: true, approvalStatus: "Approved" });
    if (path === "/profile/bio" && route.request().method() === "PUT") {
      bio = route.request().postDataJSON().bio;
      return json({});
    }
    const posts = [1, 2, 3].map((id) => ({ id: `post-${id}`, ownerUserId: userId,
      content: `Professional work ${id}`, price: 120, createdAt: "2026-11-20T10:00:00Z",
      images: [{ id: `image-${id}`, url: "http://localhost:3000/home/photographers-venue.jpg", order: 0 }] }));
    if (path === `/profile/${userId}`) return json({ userId, role, approvalStatus: "Approved", isPubliclyAvailable: true,
      displayName: "Test Professional", bio, phoneNumber: "0591234567", shopLocation: "Ramallah", studioLocation: "Ramallah", posts, offers: [activeOffer] });
    if (path === `/posts/profile/${userId}`) return json({ items: posts, totalCount: posts.length });
    if (path === "/offers/mine") return json({ items: [activeOffer, stoppedOffer] });
    if (path === `/offers/profile/${userId}`) return json({ items: [activeOffer] });
    if (path === "/language") return json({ language: "ar" });
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [] });
  });
}

for (const [role, width, height] of [["Photographer", 1366, 900], ["EventCoordinator", 390, 844]] as const) {
  test(`${role}: dashboard profile supports editing and a visitor preview`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await setup(page, role);
    await page.goto("/profile/professional-profile");
    await expect(page.getByTestId("seeker-nav-portfolio")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("professional-post-card")).toHaveCount(3);
    await page.getByTestId("professional-bio-edit-open").click();
    await page.locator("textarea").fill("Updated professional biography");
    await page.getByTestId("professional-bio-save").click();
    await expect(page.locator(".ppp-bio-inline")).toHaveText("Updated professional biography");
    await page.getByTestId("professional-tab-offers").click();
    await expect(page.getByTestId("professional-offer-card")).toHaveCount(2);
    await page.getByTestId("portfolio-visitor-toggle").click();
    await expect(page.getByTestId("portfolio-preview-notice")).toBeVisible();
    await expect(page.getByTestId("professional-post-card")).toHaveCount(3);
    await expect(page.getByTestId("professional-picture-change")).toHaveCount(0);
    await expect(page.getByTestId("professional-bio-edit-open")).toHaveCount(0);
    await expect(page.getByTestId("professional-post-create-open")).toHaveCount(0);
    await expect(page.getByTestId("professional-contact")).toBeDisabled();
    await page.getByTestId("professional-tab-offers").click();
    await expect(page.getByTestId("professional-offer-card")).toHaveCount(1);
    await expect(page.getByTestId("professional-offer-stop")).toHaveCount(0);
    await page.getByTestId("portfolio-visitor-toggle").click();
    await expect(page.getByTestId("professional-picture-change")).toBeVisible();
    await expect(page.getByTestId("professional-post-card")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath("portfolio.png"), fullPage: true });
  });
}

test("Seeker accounts do not get a professional profile menu or editing tools", async ({ page }) => {
  await setup(page, "RegisteredUser");
  await page.goto("/profile/professional-profile");
  await expect(page.getByText("الملف المهني متاح للمصورين والمنسقين فقط.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("seeker-nav-portfolio")).toHaveCount(0);
  await expect(page.getByTestId("professional-picture-change")).toHaveCount(0);
});
