import { expect, test, type Page } from "@playwright/test";

const userId = "dashboard-posts-user";
const postId = "2b20786d-9c14-4c4c-942b-cb39368976c6";

async function setup(page: Page, options: {
  role?: string;
  approval?: string;
  locked?: boolean;
  failLoad?: boolean;
  failSave?: boolean;
} = {}) {
  const role = options.role ?? "Photographer";
  const posts: Array<Record<string, unknown>> = [];
  const saves: string[] = [];
  let failLoad = options.failLoad ?? false;
  await page.addInitScript(({ userId, role }) => {
    const payload = btoa(JSON.stringify({ sub: userId, role, exp: Date.now() / 1000 + 3600 }));
    const token = `test.${payload}.test`;
    sessionStorage.setItem("wesal-access-token", token);
    sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: userId, name: "Test Professional", role } }));
  }, { userId, role });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status,
      contentType: "application/json", body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "*" },
    });
    if (url.pathname.startsWith("/hubs/")) return json({}, 404);
    if (!url.pathname.startsWith("/api/v1/")) {
      if (["localhost", "127.0.0.1"].includes(url.hostname)) return route.continue();
      return route.abort();
    }
    const path = url.pathname.slice("/api/v1".length);
    if (request.method() === "OPTIONS") return json({});
    if (path === "/session") return json({ isAuthenticated: true, role, userName: "Test Professional" });
    if (path === "/profile") return json({ id: userId, fullName: "Test Professional", isSetupComplete: true,
      approvalStatus: options.approval ?? "Approved", concurrencyStamp: "test", isLocked: options.locked ?? false,
      lockedUntil: options.locked ? "2099-01-01T00:00:00Z" : null });
    if (path === "/language") return json({ language: "ar" });
    if (path === "/notifications" || path === "/bookings") return json([]);
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    if (path === `/posts/profile/${userId}`) {
      if (failLoad) return json({ title: "Unavailable" }, 500);
      return json({ items: posts, pageNumber: 1, pageSize: 12, totalCount: posts.length, totalPages: posts.length ? 1 : 0 });
    }
    if (path === "/posts" && request.method() === "POST") {
      const body = request.postData() ?? "";
      saves.push(body);
      if (options.failSave) return json({ title: "Save failed" }, 500);
      posts.push({ id: postId, ownerUserId: userId, content: "My new work", price: 250,
        createdAt: "2026-11-18T10:00:00Z", images: [] });
      return json({ id: postId }, 201);
    }
    return json({});
  });
  return { saves, allowLoad: () => { failLoad = false; } };
}

for (const role of ["Photographer", "EventCoordinator"]) {
  test(`${role} can create a post from the dashboard and see it in the list`, async ({ page }) => {
    const state = await setup(page, { role });
    await page.goto("/profile/posts");
    await expect(page.getByTestId("seeker-nav-posts")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("dashboard-posts-empty")).toBeVisible();
    await page.getByTestId("dashboard-post-create").click();
    const form = page.getByTestId("professional-post-form");
    await form.locator("textarea").fill("My new work");
    await form.locator('input[inputmode="decimal"]').fill("250");
    await form.getByTestId("professional-post-submit").click();
    await expect(form).toHaveCount(0);
    await expect(page.getByTestId("dashboard-post-card")).toContainText("My new work");
    expect(state.saves).toHaveLength(1);
    expect(state.saves[0]).toContain('name="content"');
    expect(state.saves[0]).toContain("My new work");
    expect(state.saves[0]).toContain('name="price"');
    await page.screenshot({ path: test.info().outputPath(`${role}-posts.png`), fullPage: true });
  });
}

test("unapproved professional sees the section but cannot publish", async ({ page }) => {
  const state = await setup(page, { approval: "Pending" });
  await page.goto("/profile/posts");
  await expect(page.getByTestId("dashboard-posts-approval-required")).toBeVisible();
  await expect(page.getByTestId("dashboard-post-create")).toBeDisabled();
  expect(state.saves).toHaveLength(0);
});

test("publishing restriction disables creation", async ({ page }) => {
  await setup(page, { locked: true });
  await page.goto("/profile/posts");
  await expect(page.getByTestId("publishing-restriction-banner")).toBeVisible();
  await expect(page.getByTestId("dashboard-post-create")).toBeDisabled();
});

test("a failed save keeps the draft open and reports failure", async ({ page }) => {
  await setup(page, { failSave: true });
  await page.goto("/profile/posts");
  await expect(page.getByTestId("dashboard-post-create")).toBeEnabled();
  await page.getByTestId("dashboard-post-create").click();
  const form = page.getByTestId("professional-post-form");
  await form.locator("textarea").fill("Keep this draft");
  await form.getByTestId("professional-post-submit").click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(form.locator("textarea")).toHaveValue("Keep this draft");
  await expect(page.getByTestId("dashboard-post-card")).toHaveCount(0);
});

test("failed list request can be retried", async ({ page }) => {
  const state = await setup(page, { failLoad: true });
  await page.goto("/profile/posts");
  const error = page.getByTestId("dashboard-posts-error");
  await expect(error).toBeVisible();
  state.allowLoad();
  await error.getByRole("button").click();
  await expect(page.getByTestId("dashboard-posts-empty")).toBeVisible();
});

test("a seeker does not get posts navigation or creation access", async ({ page }) => {
  await setup(page, { role: "RegisteredUser" });
  await page.goto("/profile/posts");
  await expect(page.getByTestId("seeker-nav-posts")).toHaveCount(0);
  await expect(page.getByTestId("dashboard-post-create")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: "قسم المنشورات" })).toBeVisible();
});

test("posts workspace fits a mobile screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/profile/posts");
  await expect(page.getByTestId("dashboard-post-create")).toBeEnabled();
  await page.getByTestId("dashboard-post-create").click();
  await expect(page.getByTestId("professional-post-form")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("mobile-create-post.png"), fullPage: true });
});
