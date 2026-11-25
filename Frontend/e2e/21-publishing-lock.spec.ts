import { expect, test, type Page } from "@playwright/test";
import { buildPublishingLockHarness } from "./helpers/publishing-lock-harness";
import { resolvePublishingLock } from "../src/lib/publishing-lock";
import { MAX_TIMEOUT_MS } from "../src/lib/offer-lifecycle";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";

const base = Date.parse("2030-01-01T00:00:00Z");
const until = (seconds: number) => new Date(base + seconds * 1000).toISOString();
const post = { id: "post-a", ownerUserId: "lock-owner", content: "Original post", price: 15, images: [] };
const offer = { id: "offer-a", ownerUserId: "lock-owner", content: "Original offer", oldPrice: 200, offerPrice: 125,
  startsAt: until(-100), endsAt: until(86400), images: [] };
type Mode = "posts" | "offers" | "public" | "probe";
type Profile = { isLocked: boolean; lockedUntil: string | null; approvalStatus: string; isSetupComplete: boolean };
let bundle: string;
test.beforeAll(async () => { bundle = await buildPublishingLockHarness(); });

async function mount(page: Page, mode: Mode, role = "Photographer", initial: Partial<Profile> = {}, failInitial = false, privateWhileLocked = false) {
  await page.clock.install({ time: new Date(base) });
  let profile: Profile = { isLocked: true, lockedUntil: until(10), approvalStatus: "Approved", isSetupComplete: true, ...initial };
  let fail = failInitial, hold = false, count = 0, publicCount = 0;
  const held: Array<() => Promise<void>> = [], writes: Array<{ path: string; method: string; body: string | null }> = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const lang = role === "EventCoordinator" ? "ar" : "en";
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname.slice(7);
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/profile") {
      count += 1;
      const snapshot = { id: "lock-owner", fullName: "Lock Owner", concurrencyStamp: "test", ...profile };
      const status = fail ? 500 : 200;
      if (hold) {
        hold = false;
        await new Promise<void>((done) => { held.push(async () => { await json(snapshot, status); done(); }); });
        return;
      }
      return json(snapshot, status);
    }
    if (path === "/profile/lock-owner") {
      publicCount += 1;
      return json({ userId: "lock-owner", role, displayName: "Lock Owner", isPubliclyAvailable: !privateWhileLocked || !profile.isLocked, posts: [post], offers: [offer] });
    }
    if (path === "/posts/profile/lock-owner") return json({ items: [post], totalCount: 1, totalPages: 1 });
    if (path === "/offers/mine" || path === "/offers/profile/lock-owner") return json({ items: [offer], totalCount: 1 });
    if (path === "/offers/offer-a") {
      if (request.method() === "GET") return json(offer);
    }
    if (["POST", "PUT"].includes(request.method())) {
      writes.push({ path, method: request.method(), body: request.postData() });
      return request.method() === "PUT" ? route.fulfill({ status: 204 }) : json({ id: "created" }, 201);
    }
    return json({});
  });
  await page.route("**/publishing-lock/**", (route) => route.fulfill({ contentType: "text/html", body: `<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><body><div id="root"></div></body></html>` }));
  await page.goto(`http://localhost:3000/publishing-lock/${mode}?role=${role}`);
  await page.addScriptTag({ content: bundle });
  const snapshot = page.getByTestId("snapshot").first();
  await expect.poll(() => { expect(errors).toEqual([]); return count; }).toBe(1);
  return { snapshot, writes, held, requests: () => count, publicRequests: () => publicCount, set: (patch: Partial<Profile>) => { profile = { ...profile, ...patch }; },
    fail: (value: boolean) => { fail = value; }, holdNext: () => { hold = true; }, catalog: lang === "ar" ? ar : en };
}
async function resume(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus"));
  });
}
const createId = (mode: Mode) => mode === "posts" ? "dashboard-post-create" : mode === "offers" ? "pro-offers-add" : "professional-post-create-open";

test("lock resolution expires only finite deadlines and preserves restrictions without a valid end", () => {
  expect(resolvePublishingLock({ isLocked: true, lockedUntil: until(10) }, base).isLocked).toBe(true);
  expect(resolvePublishingLock({ isLocked: true, lockedUntil: until(10) }, base + 10000).isLocked).toBe(false);
  for (const lockedUntil of [null, "invalid"]) expect(resolvePublishingLock({ isLocked: true, lockedUntil }, base).isLocked).toBe(true);
  expect(resolvePublishingLock({ isLocked: false, lockedUntil: until(10) }, base).isLocked).toBe(false);
});

test("an already expired API lock never disables publishing or starts another expiry refresh", async ({ page }) => {
  const state = await mount(page, "posts", "Photographer", { lockedUntil: until(-10) });
  await expect(page.getByTestId("dashboard-post-create")).toBeEnabled();
  await expect(state.snapshot).toContainText('"rawLocked":false');
  await page.clock.runFor(1000);
  expect(state.requests()).toBe(1);
});

test("unknown permissions fail closed until profile loading succeeds", async ({ page }) => {
  const state = await mount(page, "offers", "Photographer", { isLocked: false, lockedUntil: null }, true);
  await expect(state.snapshot).toContainText('"ready":false');
  await expect(page.getByTestId("pro-offers-add")).toBeDisabled();
  state.fail(false); await resume(page);
  await expect(page.getByTestId("pro-offers-add")).toBeEnabled();
  await expect(state.snapshot).toContainText('"ready":true');
});

test("a professional profile hidden during the lock becomes available after expiry", async ({ page }) => {
  const state = await mount(page, "public", "Photographer", {}, false, true);
  await expect(page.getByTestId("professional-profile-private")).toBeVisible();
  state.set({ isLocked: false, lockedUntil: null });
  await page.clock.runFor(10000);
  await expect(page.getByTestId("professional-post-create-open")).toBeEnabled();
  await expect(page.getByTestId("professional-offer-create-open")).toBeEnabled();
  await expect(state.snapshot).toContainText('"rawLocked":false');
});

test("an independently unavailable profile stays private without repeated reloads", async ({ page }) => {
  const state = await mount(page, "public", "Photographer", {}, false, true);
  await expect(page.getByTestId("professional-profile-private")).toBeVisible();
  await page.clock.runFor(10000);
  await expect(state.snapshot).toContainText('"rawLocked":false');
  await expect.poll(state.publicRequests).toBe(2);
  await page.clock.runFor(2000);
  await expect(page.getByTestId("professional-profile-private")).toBeVisible();
  expect(state.publicRequests()).toBe(2);
});

for (const role of ["Photographer", "EventCoordinator"]) for (const mode of ["posts", "offers", "public"] as const) {
  test(`${role} ${mode}: expiry synchronizes context and restores create/edit actions`, async ({ page }) => {
    const state = await mount(page, mode, role);
    const create = page.getByTestId(createId(mode));
    const edit = page.getByRole("button", { name: state.catalog[mode === "offers" ? "offers.actions.edit" : "professionals.posts.editAction"], exact: true });
    await expect(create).toBeDisabled(); await expect(edit).toBeDisabled();
    await expect(state.snapshot).toContainText('"rawLocked":true');
    await page.clock.runFor(10000);
    await expect(create).toBeEnabled(); await expect(edit).toBeEnabled();
    await expect(state.snapshot).toContainText('"rawLocked":false');
    await expect(page.getByTestId("publishing-restriction-banner")).toHaveCount(0);
    await expect.poll(state.requests).toBe(2); // One GET for multiple hook consumers, one at expiry.
    await edit.click();
    if (mode === "offers") {
      const form = page.getByTestId("professional-offer-form");
      await form.getByTestId("offer-field-offerPrice").fill("100");
      await form.locator('button[type="submit"]').click();
    } else {
      await page.getByTestId("professional-post-form").locator("textarea").fill("Updated after unlock");
      await page.getByTestId("professional-post-submit").click();
    }
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0]).toMatchObject({ method: "PUT", path: mode === "offers" ? "/offers/offer-a" : "/posts/post-a" });
  });
}

for (const lockedUntil of [null, "invalid"]) {
  test(`an administrator restriction with ${lockedUntil ?? "no deadline"} survives failed revalidation`, async ({ page }) => {
    const state = await mount(page, "posts", "Photographer", { lockedUntil });
    await expect(page.getByTestId("dashboard-post-create")).toBeDisabled();
    await expect(state.snapshot).toContainText('"locked":true');
    state.fail(true); await resume(page);
    await expect.poll(state.requests).toBe(2);
    await page.clock.runFor(30000);
    await expect(page.getByTestId("publishing-restriction-banner")).toBeVisible();
    await expect(page.getByTestId("dashboard-post-create")).toBeDisabled();
    expect(state.writes).toHaveLength(0);
  });
}

for (const approvalStatus of ["Pending", "Rejected", "NeedsChanges"]) for (const mode of ["posts", "offers"] as const) {
  test(`${mode}: ${approvalStatus} approval remains restricted after temporary lock expiry`, async ({ page }) => {
    const state = await mount(page, mode, "EventCoordinator", { approvalStatus });
    await expect(state.snapshot).toContainText('"rawLocked":true');
    await page.clock.runFor(10000);
    await expect(state.snapshot).toContainText('"rawLocked":false');
    await expect(page.getByTestId(createId(mode))).toBeDisabled();
    expect(state.writes).toHaveLength(0);
  });
}

test("an incomplete setup stays restricted after expiry", async ({ page }) => {
  const state = await mount(page, "offers", "Photographer", { isSetupComplete: false });
  await expect(state.snapshot).toContainText('"rawLocked":true');
  await page.clock.runFor(10000);
  await expect(state.snapshot).toContainText('"rawLocked":false');
  await expect(page.getByTestId("pro-offers-add")).toBeDisabled();
});

test("a renewed lock replaces the old deadline instead of unlocking early", async ({ page }) => {
  const state = await mount(page, "posts");
  await expect(state.snapshot).toContainText('"rawLocked":true');
  await page.clock.runFor(5000);
  state.set({ lockedUntil: until(30) }); await resume(page);
  await expect.poll(state.requests).toBe(2);
  await page.clock.runFor(6000);
  await expect(page.getByTestId("dashboard-post-create")).toBeDisabled();
  await expect(state.snapshot).toContainText('"locked":true');
  await page.clock.runFor(20000);
  await expect(page.getByTestId("dashboard-post-create")).toBeEnabled();
  await expect.poll(state.requests).toBe(3);
});

test("returning after background sleep expires the canonical lock and coalesces wake requests", async ({ page }) => {
  const state = await mount(page, "posts");
  await expect(state.snapshot).toContainText('"rawLocked":true');
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.setSystemTime(new Date(base + 60000));
  await resume(page);
  await expect(page.getByTestId("dashboard-post-create")).toBeEnabled();
  await expect(state.snapshot).toContainText('"rawLocked":false');
  await expect.poll(state.requests).toBe(2);
});

test("new lock and approval decisions are read when a tab becomes active", async ({ page }) => {
  const state = await mount(page, "offers", "Photographer", { isLocked: false, lockedUntil: null });
  await expect(page.getByTestId("pro-offers-add")).toBeEnabled();
  state.set({ isLocked: true, lockedUntil: until(30) }); await resume(page);
  await expect(page.getByTestId("pro-offers-add")).toBeDisabled();
  state.set({ isLocked: false, lockedUntil: null, approvalStatus: "Rejected" }); await resume(page);
  await expect(state.snapshot).toContainText('"approval":"rejected"');
  await expect(page.getByTestId("pro-offers-add")).toBeDisabled();
});

test("an open offer edit keeps its draft and cannot submit while a new restriction is active", async ({ page }) => {
  const state = await mount(page, "offers", "Photographer", { isLocked: false, lockedUntil: null });
  await page.getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
  const form = page.getByTestId("professional-offer-form");
  const content = form.getByTestId("offer-field-content");
  await content.fill("Draft preserved during moderation");
  state.set({ isLocked: true, lockedUntil: until(10) }); await resume(page);
  await expect(form.locator('button[type="submit"]')).toBeDisabled();
  await expect(content).toHaveValue("Draft preserved during moderation");
  expect(state.writes).toHaveLength(0);
  await page.clock.runFor(10000);
  await expect(form.locator('button[type="submit"]')).toBeEnabled();
  await expect(content).toHaveValue("Draft preserved during moderation");
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body).toContain("Draft preserved during moderation");
});

test("a resume request supersedes an older pending profile response", async ({ page }) => {
  const state = await mount(page, "probe", "Photographer", { isLocked: false, lockedUntil: null });
  await expect(state.snapshot).toContainText('"allowed":true');
  state.holdNext(); await page.getByTestId("refresh-profile").first().click();
  await expect.poll(() => state.held.length).toBe(1);
  state.set({ isLocked: true, lockedUntil: until(30) }); await resume(page);
  await expect(state.snapshot).toContainText('"locked":true');
  await state.held[0]();
  await expect(state.snapshot).toContainText('"locked":true');
  expect(state.requests()).toBe(3);
});

test("long restriction timers recheck their deadline rather than clearing at the timeout cap", async ({ page }) => {
  const state = await mount(page, "probe", "Photographer", { lockedUntil: until(MAX_TIMEOUT_MS / 1000 + 3600) });
  await expect(state.snapshot).toContainText('"locked":true');
  await page.clock.fastForward(MAX_TIMEOUT_MS + 1);
  await expect(state.snapshot).toContainText('"locked":true');
  expect(state.requests()).toBe(1);
});

test("unmount removes publishing timers and resume listeners", async ({ page }) => {
  const state = await mount(page, "probe");
  await expect(state.snapshot).toContainText('"rawLocked":true');
  await page.locator("#unmount").click();
  await page.clock.runFor(30000); await resume(page);
  expect(state.requests()).toBe(1);
});
