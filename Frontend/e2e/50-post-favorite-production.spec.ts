import { expect, test } from "@playwright/test";

const postId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Runs the built Next.js route with the real providers, components and services.
// HTTP and WebSocket traffic to the backend is intercepted; no live backend is used.
test("production post details restore favorite state across reloads using the real AuthProvider", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ serviceWorkers: "block", baseURL });
  const page = await context.newPage();
  let saved = true;
  let count = 8;
  let reads = 0;
  const writes: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.routeWebSocket("**/*", socket => socket.close());
  await context.addInitScript(() => {
    // A reload reuses the login. Re-seeding only localStorage would conflict with
    // the real profile provider's sessionStorage identity and correctly make it unknown.
    if (!sessionStorage.getItem("wesal_auth") && !localStorage.getItem("wesal_auth")) {
      const token = "test." + btoa(JSON.stringify({ sub: "favorite-owner", role: "RegisteredUser", exp: Date.now() / 1000 + 3600 })) + ".test";
      sessionStorage.setItem("wesal-access-token", token);
      sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: "favorite-owner", name: "Favorite Owner", role: "RegisteredUser" } }));
    }
    localStorage.setItem("wesal_ui_lang", "en");
  });
  const post = () => ({ id: postId, ownerUserId: "professional", content: "Production favorite post", price: null,
    saveCount: count, shareCount: 0, createdAt: "2026-01-01T10:00:00Z", images: [] });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin && !url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname.replace(/^\/api\/v1/, ""), method = route.request().method();
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (method === "OPTIONS") return json({});
    if (path === "/session") return json({ isAuthenticated: true, role: "RegisteredUser", userName: "Favorite Owner" });
    if (path === "/profile") return json({ id: "favorite-owner", userId: "favorite-owner", fullName: "Favorite Owner", role: "RegisteredUser" });
    if (path === "/profile/professional") return json({ userId: "professional", role: "Photographer", displayName: "Professional", isPubliclyAvailable: true, posts: [], offers: [] });
    if (path === `/posts/${postId}`) return json(post());
    if (path === `/posts/${postId}/favorites`) {
      writes.push(method); saved = method === "POST"; count += saved ? 1 : -1;
      return route.fulfill({ status: 204 });
    }
    if (path === "/favorites") {
      reads += 1;
      return json({ items: saved ? [{ ...post(), ownerName: "Professional", savedAt: "2026-01-01T12:00:00Z" }] : [],
        pageNumber: Number(url.searchParams.get("page") ?? 1), pageSize: Number(url.searchParams.get("pageSize") ?? 100),
        totalCount: saved ? 1 : 0, totalPages: saved ? 1 : 0 });
    }
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [], pageNumber: 1, pageSize: 40, totalCount: 0, totalPages: 0 });
  });
  try {
    await page.goto(`/posts/${postId}`);
    const buttons = page.getByTestId("post-favorite-button");
    await expect(buttons).toHaveCount(2);
    await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
    expect(reads).toBe(1);
    await buttons.first().click();
    await expect(buttons.last()).toHaveAttribute("aria-pressed", "false");
    await expect(buttons.first()).toBeEnabled();
    await page.reload();
    await expect(buttons.first()).toHaveAttribute("aria-pressed", "false");
    await buttons.last().click();
    await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
    await expect(buttons.last()).toBeEnabled();
    await page.reload();
    await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");
    expect(reads).toBe(3);
    expect(writes).toEqual(["DELETE", "POST"]);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
