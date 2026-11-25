import { expect, test, type Page } from "@playwright/test";
import { buildOfferLifecycleHarness } from "./helpers/offer-lifecycle-harness";
import { mergeContent } from "../src/lib/content-pagination";
import { mapProfessionalProfileContentPage } from "../src/lib/professional-profile-mapper";
import en from "../src/i18n/messages/en";
import ar from "../src/i18n/messages/ar";

const post = (id: string, owner = "pro-a") => ({ id, ownerUserId: owner, content: `Post ${id}`, images: [], price: null });
const offer = (id: string, owner = "pro-a") => ({ ...post(id, owner), content: `Offer ${id}`,
  oldPrice: 200, offerPrice: 100, startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", stoppedAt: null });
const profile = (id: string, available = true) => ({ userId: id, role: "Photographer", displayName: id,
  isPubliclyAvailable: available, approvalStatus: "Approved", posts: [], offers: [] });
type Pending = { path: string; url: URL; method: string; body: string | null; reply: (data: unknown, status?: number) => Promise<void> };
let publicBundle: string, ownerBundle: string, arabicBundle: string;
test.beforeAll(async () => {
  publicBundle = await buildOfferLifecycleHarness();
  ownerBundle = await buildOfferLifecycleHarness({ owner: true });
  arabicBundle = await buildOfferLifecycleHarness({ language: "ar" });
});

async function mount(page: Page, mode: string, bundle = publicBundle, language = "en") {
  const pending: Pending[] = [], errors: string[] = [];
  const seen: Array<{ path: string; page: number; filter: string | null }> = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.slice(7);
    seen.push({ path, page: Number(url.searchParams.get("page") ?? 1), filter: url.searchParams.get("filter") });
    pending.push({ path, url, method: request.method(), body: request.postData(), reply: (data, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) }) });
  });
  await page.route("**/pagination/**", (route) => route.fulfill({ contentType: "text/html",
    body: `<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"><body><div id="root"></div></body></html>` }));
  await page.goto(`http://localhost:3000/pagination/${mode}?filter=Offers`);
  await page.addScriptTag({ content: bundle });
  const take = async (path: string, number?: number, method = "GET") => {
    const matches = (r: Pending) => r.path === path && r.method === method &&
      (number == null || Number(r.url.searchParams.get("page") ?? 1) === number);
    await expect.poll(() => { expect(errors).toEqual([]); return pending.some(matches); }).toBe(true);
    return pending.splice(pending.findIndex(matches), 1)[0];
  };
  return { take, seen, errors };
}
function result(items: unknown[], page: number, size: number, total: number) {
  return { items, pageNumber: page, pageSize: size, totalCount: total, totalPages: Math.ceil(total / size) };
}
async function initialProfile(api: Awaited<ReturnType<typeof mount>>, owner = "pro-a", posts: unknown[] = [], total = posts.length, size = 12) {
  await (await api.take(`/profile/${owner}`)).reply(profile(owner));
  await (await api.take(`/posts/profile/${owner}`, 1)).reply(result(posts, 1, size, total));
  await (await api.take(`/offers/profile/${owner}`, 1)).reply(result([], 1, 12, 0));
}
const more = (page: Page) => page.getByRole("button", { name: en["content.pagination.more"], exact: true });

test("merging keeps stable order, removes overlaps, and does not invent absent API totals", () => {
  expect(mergeContent([post("a"), post("b")], [{ ...post("b"), content: "Updated" }, post("c")])
    .map((item) => item.id)).toEqual(["a", "b", "c"]);
  expect(mergeContent([post("a")], [{ ...post("a"), content: "Updated" }])[0].content).toBe("Updated");
  expect(mapProfessionalProfileContentPage({ items: [post("a")] }).hasTotalCount).toBe(false);
  expect(mapProfessionalProfileContentPage({ items: [post("a")], totalCount: 50 }).hasTotalCount).toBe(true);
});

test("visitors load more than 12 posts, keep the first page visible, and see authoritative totals", async ({ page }) => {
  const api = await mount(page, "profile");
  await initialProfile(api, "pro-a", Array.from({ length: 12 }, (_, i) => post(String(i))), 25);
  await expect(page.locator('.ppp-stat-value').first()).toHaveText("25");
  await more(page).click();
  const second = await api.take("/posts/profile/pro-a", 2);
  await expect(page.getByText("Post 0", { exact: true })).toBeVisible();
  await expect(page.getByTestId("content-pagination")).toHaveAttribute("aria-busy", "true");
  await second.reply(result(Array.from({ length: 12 }, (_, i) => post(String(i + 12))), 2, 12, 25));
  await expect(page.getByText("Post 23", { exact: true })).toBeVisible();
  await more(page).click();
  await (await api.take("/posts/profile/pro-a", 3)).reply(result([post("24")], 3, 12, 25));
  await expect(page.locator('a[href^="/posts/"]')).toHaveCount(25);
  await expect(more(page)).toHaveCount(0);
  await expect(page.getByText(en["content.pagination.end"], { exact: true })).toBeVisible();
});

test("public offers paginate beyond 12 and preserve complete content navigation", async ({ page }) => {
  const api = await mount(page, "profile");
  await (await api.take("/profile/pro-a")).reply(profile("pro-a"));
  await (await api.take("/posts/profile/pro-a", 1)).reply(result([], 1, 12, 0));
  await (await api.take("/offers/profile/pro-a", 1)).reply(result(Array.from({ length: 12 }, (_, i) => offer(String(i))), 1, 12, 14));
  await page.getByTestId("professional-tab-offers").click();
  await (await api.take("/offers/profile/pro-a", 1)).reply(result(Array.from({ length: 12 }, (_, i) => offer(String(i))), 1, 12, 14));
  await more(page).click();
  await (await api.take("/offers/profile/pro-a", 2)).reply(result([offer("12"), offer("13")], 2, 12, 14));
  await expect(page.getByText("Offer 13", { exact: true })).toBeVisible();
  await expect(page.locator('.ppp-stat-value').nth(1)).toHaveText("14");
  await expect(more(page)).toHaveCount(0);
});

test("an overlapping page cannot duplicate cards, and errors preserve loaded posts for retry", async ({ page }) => {
  const api = await mount(page, "profile");
  await initialProfile(api, "pro-a", [post("a"), post("b")], 4, 2);
  await more(page).click();
  await (await api.take("/posts/profile/pro-a", 2)).reply({ title: "Failure" }, 500);
  await expect(page.getByText("Post a", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: en["common.retry"], exact: true }).click();
  await (await api.take("/posts/profile/pro-a", 1)).reply(result([post("a"), post("b")], 1, 2, 4));
  await more(page).click();
  await (await api.take("/posts/profile/pro-a", 2)).reply(result([post("b"), post("c"), post("d")], 2, 2, 4));
  await expect(page.locator('a[href^="/posts/"]')).toHaveCount(4);
  await expect(page.getByText("Post b", { exact: true })).toHaveCount(1);
});

for (const fails of [false, true]) {
  test(`switching profiles rejects a pending page ${fails ? "failure" : "success"}`, async ({ page }) => {
    const api = await mount(page, "profile");
    await initialProfile(api, "pro-a", [post("a")], 24);
    await more(page).click();
    const old = await api.take("/posts/profile/pro-a", 2);
    await page.locator("#switch").click();
    await initialProfile(api, "pro-b", [post("b", "pro-b")], 1);
    await old.reply(fails ? { title: "Old failure" } : result([post("old")], 2, 12, 24), fails ? 500 : 200);
    await expect(page.getByText("Post b", { exact: true })).toBeVisible();
    await expect(page.getByText("Post a", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Post old", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator('.ppp-stat-value').first()).toHaveText("1");
  });
}

test("a new refresh supersedes an append and synchronizes deleted records and totals", async ({ page }) => {
  const api = await mount(page, "profile");
  await initialProfile(api, "pro-a", [post("deleted"), post("a")], 24);
  await more(page).click();
  const stale = await api.take("/posts/profile/pro-a", 2);
  await page.getByTestId("professional-tab-offers").click();
  await (await api.take("/offers/profile/pro-a", 1)).reply(result([], 1, 12, 0));
  await page.getByTestId("professional-tab-posts").click();
  await (await api.take("/posts/profile/pro-a", 1)).reply(result([post("a")], 1, 12, 1));
  await stale.reply(result([post("stale")], 2, 12, 24));
  await expect(page.getByText("Post deleted", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Post stale", { exact: true })).toHaveCount(0);
  await expect(page.locator('.ppp-stat-value').first()).toHaveText("1");
});

test("professional management reads beyond 50 offers and filters the complete collection", async ({ page }) => {
  const api = await mount(page, "manager");
  await (await api.take("/offers/mine", 1)).reply(result(Array.from({ length: 50 }, (_, i) => offer(String(i))), 1, 50, 51));
  const second = await api.take("/offers/mine", 2);
  await expect(page.getByTestId("pro-offers-filter-all")).toContainText("(51)");
  await expect(page.getByTestId("pro-offers-filter-scheduled")).toContainText("(…)");
  await second.reply(result([{ ...offer("scheduled"), startsAt: "2090-01-01T00:00:00Z" }], 2, 50, 51));
  await expect(page.getByTestId("pro-offers-filter-active")).toContainText("(50)");
  await expect(page.getByTestId("pro-offers-filter-scheduled")).toContainText("(1)");
  await page.getByTestId("pro-offers-filter-scheduled").click();
  await expect(page.getByTestId("pro-offer-row-scheduled")).toBeVisible();
  await expect(page.locator('[data-testid^="pro-offer-row-"]')).toHaveCount(1);
});

test("hall management reads all pages and keeps filtering and hall context isolated", async ({ page }) => {
  const api = await mount(page, "halls");
  const hallOffer = (id: string, hallId: string) => ({ ...offer(id), hallId, hallName: hallId, oldBookingPrice: 200 });
  await (await api.take("/owner/halls/hall-a/offers", 1)).reply(result(Array.from({ length: 50 }, (_, i) => hallOffer(String(i), "hall-a")), 1, 50, 51));
  const old = await api.take("/owner/halls/hall-a/offers", 2);
  await page.getByTestId("owner-offers-hall-select").click();
  await page.getByRole("option", { name: "hall-b", exact: true }).click();
  await (await api.take("/owner/halls/hall-b/offers", 1)).reply(result([hallOffer("b", "hall-b")], 1, 50, 1));
  await old.reply(result([hallOffer("a-late", "hall-a")], 2, 50, 51));
  await expect(page.getByTestId("owner-offer-card-b")).toBeVisible();
  await expect(page.getByTestId("owner-offer-card-a-late")).toHaveCount(0);
  await page.getByTestId("owner-offers-search").fill("100");
  await expect(page.getByTestId("owner-offer-card-b")).toBeVisible();
});

test("post management appends pages and refreshes totals after creating and editing", async ({ page }) => {
  const api = await mount(page, "posts", ownerBundle);
  await (await api.take("/posts/profile/pro-a", 1)).reply(result([post("a")], 1, 12, 13));
  await more(page).click();
  await (await api.take("/posts/profile/pro-a", 2)).reply(result([post("b")], 2, 12, 13));
  await expect(page.getByTestId("dashboard-post-card")).toHaveCount(2);
  await page.getByTestId("dashboard-post-create").click();
  await page.locator("textarea").fill("New content");
  await page.getByTestId("professional-post-submit").click();
  await (await api.take("/posts", undefined, "POST")).reply({ id: "new" }, 201);
  await (await api.take("/posts/profile/pro-a", 1)).reply(result([post("new"), post("a")], 1, 12, 14));
  await (await api.take("/posts/profile/pro-a", 2)).reply(result([post("b")], 2, 12, 14));
  await expect(page.getByTestId("dashboard-post-card")).toHaveCount(3);
  await page.getByTestId("dashboard-post-card").first().getByRole("button", { name: en["professionals.posts.editAction"] }).click();
  await page.locator("textarea").fill("Edited content");
  await page.getByTestId("professional-post-submit").click();
  const edit = await api.take("/posts/new", undefined, "PUT");
  expect(edit.body).toContain("Edited content");
  await edit.reply({});
  await (await api.take("/posts/profile/pro-a", 1)).reply(result([{ ...post("new"), content: "Edited content" }, post("a")], 1, 12, 14));
  await (await api.take("/posts/profile/pro-a", 2)).reply(result([post("b")], 2, 12, 14));
  await expect(page.getByTestId("dashboard-post-card").first()).toContainText("Edited content");
  await expect(page.getByText(en["dashboard.posts.total"].replace("{count}", "14"), { exact: true })).toBeVisible();
});

test("Discover offer search includes results beyond the previous 500-record ceiling", async ({ page }) => {
  const api = await mount(page, "discover");
  await (await api.take("/discover", 1)).reply(result([], 1, 12, 0));
  await page.getByRole("searchbox").fill("needle");
  await page.getByRole("searchbox").press("Enter");
  for (let number = 1; number <= 11; number++) {
    const request = await api.take("/discover", number);
    const items = number === 11 ? [{ ...offer("beyond-500"), contentType: "ProfessionalOffer", content: "needle" }]
      : Array.from({ length: 50 }, (_, i) => ({ ...offer(`${number}-${i}`), contentType: "ProfessionalOffer", content: "Other" }));
    await request.reply(result(items, number, 50, 501));
  }
  await expect(page.getByTestId("discover-offer-beyond-500")).toBeVisible();
  expect(api.seen.filter((r) => r.filter === "Offers").length).toBeGreaterThanOrEqual(11);
});

test("Discover search pagination preserves server ordering and reuses the complete matching collection", async ({ page }) => {
  const api = await mount(page, "discover");
  await (await api.take("/discover", 1)).reply(result([], 1, 12, 0));
  await page.getByRole("searchbox").fill("needle");
  await page.getByRole("searchbox").press("Enter");
  const rows = Array.from({ length: 51 }, (_, i) => ({ ...offer(String(i)), content: `needle ${i}`, contentType: "ProfessionalOffer" }));
  await (await api.take("/discover", 1)).reply(result(rows.slice(0, 50), 1, 50, 51));
  await (await api.take("/discover", 2)).reply(result(rows.slice(50), 2, 50, 51));
  await expect(page.getByTestId("discover-offer-0")).toBeVisible();
  const requests = api.seen.length;
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByTestId("discover-offer-12")).toBeVisible();
  await expect(page.getByTestId("discover-offer-0")).toHaveCount(0);
  expect(api.seen.length).toBe(requests);
  expect(api.seen.every((request) => request.filter === "Offers")).toBe(true);
});

test("public visibility guards remain enforced on additional offer pages", async ({ page }) => {
  const api = await mount(page, "profile");
  await (await api.take("/profile/pro-a")).reply(profile("pro-a"));
  await (await api.take("/posts/profile/pro-a", 1)).reply(result([], 1, 12, 0));
  await (await api.take("/offers/profile/pro-a", 1)).reply(result([offer("live")], 1, 12, 13));
  await page.getByTestId("professional-tab-offers").click();
  await (await api.take("/offers/profile/pro-a", 1)).reply(result([offer("live")], 1, 12, 13));
  await more(page).click();
  await (await api.take("/offers/profile/pro-a", 2)).reply(result([
    { ...offer("expired"), endsAt: "2020-01-02T00:00:00Z" },
    { ...offer("scheduled"), startsAt: "2090-01-01T00:00:00Z" },
    { ...offer("stopped"), stoppedAt: "2021-01-01T00:00:00Z" }, offer("visible")], 2, 12, 13));
  await expect(page.getByText("Offer visible", { exact: true })).toBeVisible();
  for (const id of ["expired", "scheduled", "stopped"]) await expect(page.getByText(`Offer ${id}`, { exact: true })).toHaveCount(0);
});

test("private profiles never request paginated public content", async ({ page }) => {
  const api = await mount(page, "profile");
  await (await api.take("/profile/pro-a")).reply(profile("pro-a", false));
  await expect(page.getByTestId("professional-profile-private")).toBeVisible();
  expect(api.seen.some((request) => request.path.includes("/posts/") || request.path.includes("/offers/"))).toBe(false);
});

test("hall management includes page-two scheduled offers in global filters and counts", async ({ page }) => {
  const api = await mount(page, "halls");
  const first = Array.from({ length: 50 }, (_, i) => ({ ...offer(String(i)), hallId: "hall-a", oldBookingPrice: 200 }));
  await (await api.take("/owner/halls/hall-a/offers", 1)).reply(result(first, 1, 50, 51));
  await (await api.take("/owner/halls/hall-a/offers", 2)).reply(result([
    { ...offer("scheduled"), hallId: "hall-a", oldBookingPrice: 200, startsAt: "2090-01-01T00:00:00Z" }], 2, 50, 51));
  await page.getByRole("button", { name: `${en["offers.filter.scheduled"]} (1)`, exact: true }).click();
  await expect(page.getByTestId("owner-offer-card-scheduled")).toBeVisible();
  await expect(page.locator('[data-testid^="owner-offer-card-"]')).toHaveCount(1);
});

test("hall details offer management reads beyond its previous 30-record limit", async ({ page }) => {
  const api = await mount(page, "section");
  const rows = Array.from({ length: 31 }, (_, i) => ({ ...offer(String(i)), hallId: "hall-a", oldBookingPrice: 200 }));
  await (await api.take("/owner/halls/hall-a/offers", 1)).reply(result(rows.slice(0, 30), 1, 30, 31));
  await (await api.take("/owner/halls/hall-a/offers", 2)).reply(result(rows.slice(30), 2, 30, 31));
  await expect(page.getByTestId("hall-offer-card")).toHaveCount(31);
});

test("a hall-details pagination failure keeps the already loaded offers visible", async ({ page }) => {
  const api = await mount(page, "section");
  const rows = Array.from({ length: 30 }, (_, i) => ({ ...offer(String(i)), hallId: "hall-a", oldBookingPrice: 200 }));
  await (await api.take("/owner/halls/hall-a/offers", 1)).reply(result(rows, 1, 30, 31));
  await (await api.take("/owner/halls/hall-a/offers", 2)).reply({ title: "Failed page" }, 500);
  await expect(page.getByTestId("hall-offer-card")).toHaveCount(30);
  await page.getByRole("button", { name: en["common.retry"], exact: true }).click();
  await (await api.take("/owner/halls/hall-a/offers", 1)).reply(result(rows, 1, 30, 31));
  await (await api.take("/owner/halls/hall-a/offers", 2)).reply(result([
    { ...offer("last"), hallId: "hall-a", oldBookingPrice: 200 }], 2, 30, 31));
  await expect(page.getByTestId("hall-offer-card")).toHaveCount(31);
});

test("legacy public offers section loads every page instead of stopping at 20", async ({ page }) => {
  const api = await mount(page, "profile-section");
  await (await api.take("/offers/profile/pro-a", 1)).reply(result(Array.from({ length: 20 }, (_, i) => offer(String(i))), 1, 20, 21));
  await more(page).click();
  await (await api.take("/offers/profile/pro-a", 2)).reply(result([offer("last")], 2, 20, 21));
  await expect(page.getByTestId("discover-offer-last")).toBeVisible();
  await expect(more(page)).toHaveCount(0);
});

test("missing total-count metadata is shown as unknown rather than as a partial page count", async ({ page }) => {
  const api = await mount(page, "profile");
  await (await api.take("/profile/pro-a")).reply(profile("pro-a"));
  await (await api.take("/posts/profile/pro-a", 1)).reply({ items: [post("a")], pageSize: 12, totalPages: 2 });
  await (await api.take("/offers/profile/pro-a", 1)).reply(result([], 1, 12, 0));
  await expect(page.locator('.ppp-stat-value').first()).toHaveText("…");
  await more(page).click();
  await (await api.take("/posts/profile/pro-a", 2)).reply({ items: [post("b")], pageSize: 12, totalPages: 2 });
  await expect(page.getByText("Post b", { exact: true })).toBeVisible();
  await expect(page.locator('.ppp-stat-value').first()).toHaveText("…");
});

test("stopping a page-two offer refreshes the complete management collection and counters", async ({ page }) => {
  const api = await mount(page, "manager");
  const first = Array.from({ length: 50 }, (_, i) => offer(String(i)));
  await (await api.take("/offers/mine", 1)).reply(result(first, 1, 50, 51));
  await (await api.take("/offers/mine", 2)).reply(result([offer("last")], 2, 50, 51));
  await page.getByTestId("pro-offer-row-last").getByRole("button", { name: en["offers.actions.stop"], exact: true }).click();
  await page.getByTestId("stop-offer-confirm").click();
  await (await api.take("/offers/last/stop", undefined, "POST")).reply({});
  await (await api.take("/offers/mine", 1)).reply(result(first, 1, 50, 51));
  await (await api.take("/offers/mine", 2)).reply(result([{ ...offer("last"), stoppedAt: "2021-01-01T00:00:00Z" }], 2, 50, 51));
  await expect(page.getByTestId("pro-offers-filter-stopped")).toContainText("(1)");
  await expect(page.getByTestId("pro-offers-filter-active")).toContainText("(50)");
  await expect(page.getByTestId("pro-offers-filter-all")).toContainText("(51)");
});

test("expiration refresh invalidates a pending append so late offers cannot return", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  const api = await mount(page, "profile");
  const expiring = { ...offer("expires"), endsAt: "2030-01-01T00:00:10Z" };
  await (await api.take("/profile/pro-a")).reply(profile("pro-a"));
  await (await api.take("/posts/profile/pro-a", 1)).reply(result([], 1, 12, 0));
  await (await api.take("/offers/profile/pro-a", 1)).reply(result([expiring], 1, 12, 13));
  await page.getByTestId("professional-tab-offers").click();
  await (await api.take("/offers/profile/pro-a", 1)).reply(result([expiring], 1, 12, 13));
  await more(page).click();
  const late = await api.take("/offers/profile/pro-a", 2);
  await page.clock.runFor(10000);
  await (await api.take("/offers/profile/pro-a", 1)).reply(result([], 1, 12, 0));
  await late.reply(result([{ ...expiring, id: "late" }], 2, 12, 13));
  await expect(page.getByTestId("professional-offer-card")).toHaveCount(0);
  await expect(page.locator('.ppp-stat-value').nth(1)).toHaveText("0");
  await expect(more(page)).toHaveCount(0);
});

for (const width of [390, 768, 1366]) {
  test(`Arabic RTL pagination is accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await mount(page, "profile", arabicBundle, "ar");
    await initialProfile(api, "pro-a", [post("ar")], 13);
    const button = page.getByRole("button", { name: ar["content.pagination.more"], exact: true });
    await expect(button).toBeEnabled();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await button.focus();
    await page.keyboard.press("Enter");
    await (await api.take("/posts/profile/pro-a", 2)).reply(result([post("ar-more")], 2, 12, 13));
    await expect(page.getByText("Post ar-more", { exact: true })).toBeVisible();
    await expect(page.getByText(ar["content.pagination.end"], { exact: true })).toBeVisible();
  });
}
