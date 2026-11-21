import { expect, test, type Page } from "@playwright/test";
import { buildOfferLifecycleHarness } from "./helpers/offer-lifecycle-harness";
import { MAX_TIMEOUT_MS, nextOfferBoundary, OFFER_DISCOVERY_REFRESH_MS } from "../src/lib/offer-lifecycle";
import en from "../src/i18n/messages/en";

const base = Date.parse("2030-01-01T00:00:00Z");
const iso = (seconds: number) => new Date(base + seconds * 1000).toISOString();
const professional = (id: string, start = -10, end = 10) => ({ id, ownerUserId: "pro-a", contentType: "ProfessionalOffer",
  content: `${id} full content`, oldPrice: 200, offerPrice: 100, startsAt: iso(start), endsAt: iso(end), stoppedAt: null, images: [] });
const hall = (id: string, start = -10, end = 10) => ({ ...professional(`${id}-offer`, start, end), contentType: "HallOffer", hallId: id, oldBookingPrice: 200 });
let bundle: string;
test.beforeAll(async () => { bundle = await buildOfferLifecycleHarness(); });

type Request = { path: string; method: string; url: URL; reply: (body: unknown, status?: number) => Promise<void> };
async function mount(page: Page, mode: string) {
  await page.clock.install({ time: new Date(base) });
  const pending: Request[] = [], errors: string[] = [];
  const seen: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), url = new URL(request.url());
    const path = url.pathname.slice(7); seen.push(path);
    await new Promise<void>((done) => {
      pending.push({ path, url, method: request.method(), reply: async (body, status = 200) => {
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); done();
      } });
    });
  });
  await page.route("**/lifecycle/**", (route) => route.fulfill({ contentType: "text/html", body: '<html lang="en"><body><div id="root"></div></body></html>' }));
  await page.goto(`http://localhost:3000/lifecycle/${mode}?filter=Offers`);
  await page.addScriptTag({ content: bundle });
  await page.clock.runFor(1);
  const take = async (path: string) => {
    await expect.poll(() => { expect(errors).toEqual([]); return pending.findIndex((r) => r.path === path); }).toBeGreaterThanOrEqual(0);
    return pending.splice(pending.findIndex((r) => r.path === path), 1)[0];
  };
  return { take, pending, seen };
}
const feed = (items: unknown[], page = 1, totalPages = 1) => ({ items, totalCount: items.length, pageNumber: page, totalPages });
async function visibility(page: Page, state: "visible" | "hidden") {
  await page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    document.dispatchEvent(new Event("visibilitychange"));
    if (state === "visible") window.dispatchEvent(new Event("focus"));
  }, state);
}

test("boundaries use absolute ISO time, ignore stopped/expired offers and support distant dates", () => {
  expect(nextOfferBoundary([professional("future", 10, 20)], base)).toBe(base + 10000);
  expect(nextOfferBoundary([professional("future", 10, 20)], base + 10000)).toBe(base + 20000);
  expect(nextOfferBoundary([professional("expired", -20, -1), { ...professional("stopped", 10, 20), stoppedAt: iso(-1) }], base)).toBeNull();
  expect(nextOfferBoundary([{ startsAt: "2030-01-01T02:00:10+02:00", endsAt: iso(20) }], base)).toBe(base + 10000);
  expect(nextOfferBoundary([{ startsAt: "invalid", endsAt: "invalid" }], base)).toBeNull();
  expect(nextOfferBoundary([professional("distant", MAX_TIMEOUT_MS / 1000 + 10, MAX_TIMEOUT_MS / 1000 + 20)], base)).toBeGreaterThan(base + MAX_TIMEOUT_MS);
});

test("professional dashboard transitions scheduled to active to expired without polling or losing history", async ({ page }) => {
  const api = await mount(page, "manager");
  await (await api.take("/offers/mine")).reply(feed([professional("scheduled", 10, 20), { ...professional("stopped", -10, 30), stoppedAt: iso(-1) }]));
  await expect(page.getByTestId("pro-offers-filter-scheduled")).toContainText("(1)");
  await page.clock.runFor(10000);
  await expect(page.getByTestId("pro-offers-filter-active")).toContainText("(1)");
  await expect(page.getByTestId("pro-offers-filter-scheduled")).toContainText("(0)");
  await page.clock.runFor(10000);
  await expect(page.getByTestId("pro-offers-filter-expired")).toContainText("(1)");
  await expect(page.getByTestId("pro-offers-filter-stopped")).toContainText("(1)");
  await expect(page.getByTestId("pro-offers-filter-all")).toContainText("(2)");
  await expect(page.getByTestId("pro-offer-row-scheduled")).toBeVisible();
  await expect(page.getByTestId("pro-offer-row-scheduled").getByRole("button", { name: en["offers.actions.edit"], exact: true })).toHaveCount(0);
  expect(api.seen).toEqual(["/offers/mine"]);
});

test("Discover removes professional and hall offers at expiration, including late API responses", async ({ page }) => {
  const api = await mount(page, "discover");
  const rows = [professional("photo"), hall("hall-a")];
  await (await api.take("/discover")).reply(feed(rows));
  await expect(page.getByTestId("discover-offer-photo")).toBeVisible();
  await visibility(page, "visible");
  const late = await api.take("/discover");
  await page.clock.runFor(10000);
  await expect(page.getByTestId("discover-offer-photo")).toHaveCount(0);
  await expect(page.getByTestId("discover-offer-hall-a-offer")).toHaveCount(0);
  await late.reply(feed(rows));
  await expect(page.getByTestId("discover-offers-grid")).toHaveCount(0);
  expect(api.seen.filter((p) => p === "/discover")).toHaveLength(2);
});

test("Discover discovers a scheduled offer excluded by the initial API without resetting filter or page", async ({ page }) => {
  const api = await mount(page, "discover");
  await (await api.take("/discover")).reply({ ...feed([professional("page-one", -10, 180)], 1, 2), totalCount: 2 });
  await page.getByRole("button", { name: "2", exact: true }).click();
  const initial = await api.take("/discover"); expect(initial.url.searchParams.get("page")).toBe("2");
  await initial.reply({ ...feed([professional("page-two", -10, 180)], 2, 2), totalCount: 2 });
  await page.clock.runFor(OFFER_DISCOVERY_REFRESH_MS + 1);
  const refreshed = await api.take("/discover");
  expect(refreshed.url.searchParams.get("page")).toBe("2");
  expect(refreshed.url.searchParams.get("filter")).toBe("Offers");
  await refreshed.reply({ ...feed([professional("page-two", -10, 180), professional("newly-active", 10, 120)], 2, 2), totalCount: 3 });
  await expect(page.getByTestId("discover-offer-newly-active")).toBeVisible();
  expect(api.seen.filter((p) => p === "/discover")).toHaveLength(3);
});

test("a known scheduled professional offer activates exactly at its start boundary", async ({ page }) => {
  const api = await mount(page, "profile");
  const row = professional("scheduled-public", 10, 20);
  await (await api.take("/profile/pro-a")).reply({ userId: "pro-a", role: "Photographer", displayName: "Owner A", isPubliclyAvailable: true, posts: [], offers: [] });
  await (await api.take("/posts/profile/pro-a")).reply(feed([]));
  await page.getByTestId("professional-tab-offers").click();
  await (await api.take("/offers/profile/pro-a")).reply(feed([row]));
  await page.clock.runFor(9000);
  await expect(page.getByText("scheduled-public full content", { exact: true })).toHaveCount(0);
  expect(api.seen.filter((p) => p === "/offers/profile/pro-a")).toHaveLength(1);
  await page.clock.runFor(1000);
  await expect(page.getByText("scheduled-public full content", { exact: true })).toBeVisible();
  await (await api.take("/offers/profile/pro-a")).reply(feed([row]));
  await page.clock.runFor(10000);
  await expect(page.getByText("scheduled-public full content", { exact: true })).toHaveCount(0);
  await (await api.take("/offers/profile/pro-a")).reply(feed([]));
});

test("expiration only changes the selected Discover page when that page no longer exists", async ({ page }) => {
  const api = await mount(page, "discover");
  await (await api.take("/discover")).reply({ ...feed([professional("first", -10, 180)], 1, 2), totalCount: 2 });
  await page.getByRole("button", { name: "2", exact: true }).click();
  await (await api.take("/discover")).reply({ ...feed([professional("last-page", -10, 10)], 2, 2), totalCount: 2 });
  await expect(page.getByTestId("discover-offer-last-page")).toBeVisible();
  await page.clock.runFor(10000);
  const invalidPage = await api.take("/discover");
  expect(invalidPage.url.searchParams.get("page")).toBe("2");
  await invalidPage.reply({ ...feed([], 2, 1), totalCount: 1 });
  const validPage = await api.take("/discover");
  expect(validPage.url.searchParams.get("page")).toBe("1");
  expect(validPage.url.searchParams.get("filter")).toBe("Offers");
  await validPage.reply(feed([professional("first", -10, 180)]));
  await expect(page.getByTestId("discover-offer-first")).toBeVisible();
});

test("unrelated Discover filters do not poll or revalidate offer APIs on focus", async ({ page }) => {
  const api = await mount(page, "discover");
  await (await api.take("/discover")).reply(feed([]));
  await page.getByTestId("discover-filter-Halls").click();
  await (await api.take("/discover")).reply(feed([]));
  await page.clock.runFor(OFFER_DISCOVERY_REFRESH_MS + 1);
  await visibility(page, "visible");
  expect(api.seen).toEqual(["/discover", "/discover"]);
});

for (const mode of ["profile", "profile-section"]) {
  test(`${mode}: public professional offers expire without refreshing the full profile`, async ({ page }) => {
    const api = await mount(page, mode);
    const row = professional("profile-offer");
    if (mode === "profile") {
      await (await api.take("/profile/pro-a")).reply({ userId: "pro-a", role: "Photographer", displayName: "Owner A", isPubliclyAvailable: true, posts: [], offers: [row] });
      await (await api.take("/posts/profile/pro-a")).reply(feed([]));
      await page.getByTestId("professional-tab-offers").click();
    }
    await (await api.take("/offers/profile/pro-a")).reply(feed([row]));
    await expect(page.getByText("profile-offer full content", { exact: true })).toBeVisible();
    await page.clock.runFor(10000);
    await expect(page.getByText("profile-offer full content", { exact: true })).toHaveCount(0);
    await (await api.take("/offers/profile/pro-a")).reply(feed([row]));
    await expect(page.getByText("profile-offer full content", { exact: true })).toHaveCount(0);
    if (mode === "profile") expect(api.seen.filter((p) => p === "/profile/pro-a")).toHaveLength(1);
  });
}

for (const mode of ["banner", "detail-banner"]) {
  test(`${mode}: hall offer expires and an initially excluded scheduled offer is discovered`, async ({ page }) => {
    const api = await mount(page, mode);
    await (await api.take("/halls/hall-a/offers/active")).reply(hall("hall-a"));
    const banner = page.getByTestId(mode === "banner" ? "hall-active-offer-banner" : "hall-active-offer");
    await expect(banner).toBeVisible();
    await page.clock.runFor(10000);
    await expect(banner).toHaveCount(0);
    await (await api.take("/halls/hall-a/offers/active")).reply({}, 404);
    await page.clock.runFor(OFFER_DISCOVERY_REFRESH_MS + 1);
    await (await api.take("/halls/hall-a/offers/active")).reply(hall("hall-a", 30, 180));
    await expect(banner).toBeVisible();
  });
}

test("hall management counters update locally and preserve an open edit draft", async ({ page }) => {
  const api = await mount(page, "halls");
  await (await api.take("/owner/halls/hall-a/offers")).reply(feed([hall("hall-a", 10, 20)]));
  await page.getByTestId("owner-offer-card-hall-a-offer").getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
  const input = page.getByTestId("offer-field-oldPrice"); await input.fill("333");
  await page.clock.runFor(10000);
  await expect(page.getByRole("button", { name: `${en["offers.filter.active"]} (1)`, exact: true })).toBeVisible();
  await page.clock.runFor(10000);
  await expect(input).toHaveValue("333");
  await expect(page.getByRole("button", { name: `${en["offers.filter.expired"]} (1)`, exact: true })).toBeVisible();
  expect(api.seen).toEqual(["/owner/halls/hall-a/offers"]);
});

test("inline hall management statuses update without deleting historical offers", async ({ page }) => {
  const api = await mount(page, "section");
  await (await api.take("/owner/halls/hall-a/offers")).reply(feed([hall("hall-a", 10, 20)]));
  const card = page.getByTestId("hall-offer-card");
  await expect(card).toHaveAttribute("data-offer-status", "scheduled");
  await page.clock.runFor(10000); await expect(card).toHaveAttribute("data-offer-status", "active");
  await page.clock.runFor(10000); await expect(card).toHaveAttribute("data-offer-status", "expired");
  expect(api.seen).toHaveLength(1);
});

test("returning after a background sleep recomputes expiry and deduplicates focus/visibility revalidation", async ({ page }) => {
  const api = await mount(page, "manager");
  await (await api.take("/offers/mine")).reply(feed([professional("sleeping")]));
  await visibility(page, "hidden");
  await page.clock.setSystemTime(new Date(base + 30000));
  await visibility(page, "visible");
  await expect(page.getByTestId("pro-offers-filter-expired")).toContainText("(1)");
  await (await api.take("/offers/mine")).reply(feed([professional("sleeping")]));
  expect(api.seen).toEqual(["/offers/mine", "/offers/mine"]);
});

test("lifecycle timers and resume listeners are cleaned up on unmount", async ({ page }) => {
  const api = await mount(page, "probe");
  await expect(page.locator("#probe")).toContainText("scheduled");
  await page.locator("#unmount").click();
  await page.clock.runFor(OFFER_DISCOVERY_REFRESH_MS * 2);
  await visibility(page, "visible");
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  expect(api.seen).toEqual([]);
  await expect(page.locator("#probe")).toHaveCount(0);
});

test("A06 profile isolation survives a pending lifecycle refresh and expiration", async ({ page }) => {
  const api = await mount(page, "profile");
  const profile = (id: string) => ({ userId: id, role: "Photographer", displayName: id, isPubliclyAvailable: true, posts: [], offers: [] });
  await (await api.take("/profile/pro-a")).reply(profile("pro-a"));
  await (await api.take("/posts/profile/pro-a")).reply(feed([]));
  await page.getByTestId("professional-tab-offers").click();
  await (await api.take("/offers/profile/pro-a")).reply(feed([professional("old-a")]));
  await page.clock.runFor(10000);
  const old = await api.take("/offers/profile/pro-a");
  await page.locator("#switch").click();
  await (await api.take("/profile/pro-b")).reply(profile("pro-b"));
  await (await api.take("/posts/profile/pro-b")).reply(feed([]));
  await old.reply(feed([professional("old-a", -10, 120)]));
  await expect(page.getByRole("heading", { name: "pro-b", exact: true })).toBeVisible();
  await expect(page.getByText("old-a full content", { exact: true })).toHaveCount(0);
});

test("A06 hall isolation survives a pending resume request at expiration", async ({ page }) => {
  const api = await mount(page, "halls");
  await (await api.take("/owner/halls/hall-a/offers")).reply(feed([hall("hall-a")]));
  await visibility(page, "visible");
  const old = await api.take("/owner/halls/hall-a/offers");
  await page.getByTestId("owner-offers-hall-select").click();
  await page.getByRole("option", { name: "hall-b", exact: true }).click();
  await (await api.take("/owner/halls/hall-b/offers")).reply(feed([hall("hall-b")]));
  await page.clock.runFor(10000);
  await old.reply(feed([hall("hall-a", -10, 120)]));
  await expect(page.getByTestId("owner-offer-card-hall-a-offer")).toHaveCount(0);
  await expect(page.getByTestId("owner-offer-card-hall-b-offer")).toBeVisible();
  await expect(page.getByRole("button", { name: `${en["offers.filter.expired"]} (1)`, exact: true })).toBeVisible();
});
