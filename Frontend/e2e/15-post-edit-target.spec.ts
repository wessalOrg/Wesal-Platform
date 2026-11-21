import { expect, test, type Page } from "@playwright/test";

const userId = "post-edit-owner";
const postA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const postB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const imageB = "22222222-2222-4222-8222-222222222222";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+1sAAAAASUVORK5CYII=", "base64");

type Save = { id: string; body: string };

async function setup(page: Page, role: string, options: { delayed?: boolean; fail?: boolean } = {}) {
  const posts = [
    { id: postA, ownerUserId: userId, content: "Post A original", price: 111, images: [] },
    { id: postB, ownerUserId: userId, content: "Post B original", price: 222,
      images: [{ id: imageB, url: "/a01-image.png", order: 0 }] },
  ];
  const saves: Save[] = [];
  let releaseSave!: () => void;
  const gate = new Promise<void>((resolve) => { releaseSave = resolve; });
  await page.addInitScript(({ userId, role }) => {
    const token = `test.${btoa(JSON.stringify({ sub: userId, role, exp: Date.now() / 1000 + 3600 }))}.test`;
    sessionStorage.setItem("wesal-access-token", token);
    sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: userId, name: "Post Owner", role } }));
  }, { userId, role });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status,
      contentType: "application/json", body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "*" },
    });
    if (url.pathname === "/a01-image.png") return route.fulfill({ contentType: "image/png", body: png });
    if (url.pathname.startsWith("/hubs/")) return json({}, 404);
    if (!url.pathname.startsWith("/api/v1/")) {
      return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
    }
    const path = url.pathname.slice("/api/v1".length);
    if (request.method() === "OPTIONS") return json({});
    if (path === "/session") return json({ isAuthenticated: true, role });
    if (path === "/profile") return json({ id: userId, fullName: "Post Owner", isSetupComplete: true,
      approvalStatus: "Approved", concurrencyStamp: "test" });
    if (path === `/profile/${userId}`) return json({ userId, role, approvalStatus: "Approved",
      isPubliclyAvailable: true, displayName: "Post Owner", posts, offers: [] });
    if (path === `/posts/profile/${userId}`) return json({ items: posts, totalCount: posts.length, totalPages: 1 });
    if (path.startsWith("/posts/") && request.method() === "PUT") {
      saves.push({ id: path.slice("/posts/".length), body: request.postDataBuffer()?.toString("utf8") ?? "" });
      if (options.delayed) await gate;
      if (options.fail) return json({ title: "Save failed" }, 500);
      return route.fulfill({ status: 204 });
    }
    if (path === "/language") return json({ language: "ar" });
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [] });
  });
  return { saves, releaseSave };
}

function field(body: string, name: string) {
  return new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`).exec(body)?.[1];
}

for (const role of ["Photographer", "EventCoordinator"]) {
  test(`${role}: switching post targets resets text, price and images before saving`, async ({ page }) => {
    const state = await setup(page, role);
    await page.goto("/profile/professional-profile");
    const edit = page.getByTestId("professional-post-edit");
    await expect(edit).toHaveCount(2);
    await edit.nth(0).click();
    const form = page.getByTestId("professional-post-form");
    await form.locator("textarea").fill("Unsaved A draft");
    await form.locator('input[inputmode="decimal"]').fill("999");
    await form.locator('input[type="file"]').setInputFiles({ name: "a-draft.png", mimeType: "image/png", buffer: png });
    await expect(form.locator(".post-editor-previews li")).toHaveCount(1);

    await edit.nth(1).click();
    await expect(form.locator("textarea")).toHaveValue("Post B original");
    await expect(form.locator('input[inputmode="decimal"]')).toHaveValue("222");
    await expect(form.locator(".post-editor-previews li")).toHaveCount(1);
    await expect(form.locator(".post-editor-previews img")).toHaveAttribute("src", /a01-image\.png$/);
    // Add a new image to B: no selection or retained ID may leak from A.
    await form.locator('input[type="file"]').setInputFiles({ name: "b-new.png", mimeType: "image/png", buffer: png });
    await form.getByTestId("professional-post-submit").click();
    await expect(form).toHaveCount(0);
    expect(state.saves).toHaveLength(1);
    expect(state.saves[0].id).toBe(postB);
    expect(field(state.saves[0].body, "content")).toBe("Post B original");
    expect(field(state.saves[0].body, "price")).toBe("222");
    expect(field(state.saves[0].body, "keepImageIds")).toBe(imageB);
    expect(state.saves[0].body).toContain('filename="b-new.png"');
    expect(state.saves[0].body).not.toContain("Unsaved A draft");
    expect(state.saves[0].body).not.toContain('filename="a-draft.png"');
  });
}

test("switching between edit and create starts the correct draft", async ({ page }) => {
  await setup(page, "Photographer");
  await page.goto(`/professionals/${userId}`);
  const edit = page.getByTestId("professional-post-edit");
  await edit.nth(1).click();
  const form = page.getByTestId("professional-post-form");
  await form.locator("textarea").fill("Unsaved B draft");
  await page.getByTestId("professional-post-create-open").click();
  await expect(form.locator("textarea")).toHaveValue("");
  await expect(form.locator('input[inputmode="decimal"]')).toHaveValue("");
  await expect(form.locator(".post-editor-previews li")).toHaveCount(0);
  await edit.nth(0).click();
  await expect(form.locator("textarea")).toHaveValue("Post A original");
  await expect(form.locator('input[inputmode="decimal"]')).toHaveValue("111");
  await expect(form.locator(".post-editor-previews li")).toHaveCount(0);
});

test("dashboard edit actions cannot change the target while saving", async ({ page }) => {
  const state = await setup(page, "EventCoordinator", { delayed: true });
  try {
    await page.goto("/profile/posts");
    const cards = page.getByTestId("dashboard-post-card");
    await expect(cards).toHaveCount(2);
    await cards.nth(0).locator("button").click();
    const form = page.getByTestId("professional-post-form");
    await form.getByTestId("professional-post-submit").click();
    await expect.poll(() => state.saves.length).toBe(1);
    await expect(cards.nth(1).locator("button")).toBeDisabled();
    await cards.nth(1).locator("button").dispatchEvent("click");
    await expect(form.locator("textarea")).toHaveValue("Post A original");
    expect(state.saves[0].id).toBe(postA);
    state.releaseSave();
    await expect(form).toHaveCount(0);
    await expect(cards.nth(1).locator("button")).toBeEnabled();
  } finally {
    state.releaseSave();
  }
});

for (const fail of [false, true]) {
  test(`saving locks target changes until ${fail ? "failure" : "success"}`, async ({ page }) => {
    const state = await setup(page, "Photographer", { delayed: true, fail });
    try {
      await page.goto(`/professionals/${userId}`);
      const edit = page.getByTestId("professional-post-edit");
      await expect(edit).toHaveCount(2);
      await edit.nth(0).click();
      const form = page.getByTestId("professional-post-form");
      await form.locator("textarea").fill("Saving A draft");
      await form.getByTestId("professional-post-submit").click();
      await expect.poll(() => state.saves.length).toBe(1);
      await expect(edit.nth(1)).toBeDisabled();
      await expect(page.getByTestId("professional-post-create-open")).toBeDisabled();
      await expect(page.getByTestId("professional-offer-create-open")).toBeDisabled();
      await expect(form.locator(".post-editor-cancel")).toBeDisabled();
      await expect(form.getByTestId("professional-post-submit")).toBeDisabled();
      await edit.nth(1).dispatchEvent("click");
      await page.getByTestId("professional-post-create-open").dispatchEvent("click");
      await expect(form.locator("textarea")).toHaveValue("Saving A draft");
      expect(state.saves[0].id).toBe(postA);
      expect(field(state.saves[0].body, "content")).toBe("Saving A draft");
      expect(field(state.saves[0].body, "price")).toBe("111");
      expect(state.saves).toHaveLength(1);
      state.releaseSave();
      if (fail) {
        await expect(form.getByRole("alert")).toBeVisible();
        await expect(form.locator("textarea")).toHaveValue("Saving A draft");
        await expect(form.getByTestId("professional-post-submit")).toBeEnabled();
      } else {
        await expect(form).toHaveCount(0);
      }
      await expect(edit.nth(1)).toBeEnabled();
      await edit.nth(1).click();
      await expect(page.getByTestId("professional-post-form").locator("textarea")).toHaveValue("Post B original");
    } finally {
      state.releaseSave();
    }
  });
}
