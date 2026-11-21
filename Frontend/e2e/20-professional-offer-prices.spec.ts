import { expect, test } from "@playwright/test";
import { mapProfessionalOffer } from "../src/services/professional-offers";
import { mapDiscoverItem } from "../src/services/discover";
import { mapProfessionalProfileContentPage, mapPublicProfessionalProfile } from "../src/lib/professional-profile-mapper";
import { parseProfessionalPostPrice } from "../src/lib/professional-post-validation";
import { mapHallOffer } from "../src/services/hall-offers";
import en from "../src/i18n/messages/en";

const offer = { id: "professional-offer", ownerUserId: "professional", oldPrice: 200, offerPrice: 125,
  startsAt: "2030-01-01T00:00:00Z", endsAt: "2030-02-01T00:00:00Z", images: [] };

test("professional offer mapping contains only its two prices, ignoring legacy response values", () => {
  for (const legacy of [{ priceBox: 99 }, { PriceBox: 99 }, { price: 99 }, { Price: 99 }]) {
    const mapped = mapProfessionalOffer({ ...offer, ...legacy });
    expect(mapped).toMatchObject({ oldPrice: 200, offerPrice: 125 });
    expect(mapped).not.toHaveProperty("priceBox");
    expect(mapped).not.toHaveProperty("PriceBox");
    expect(mapped).not.toHaveProperty("price");
  }
});

test("public profile offers ignore legacy price while optional post prices are unchanged", () => {
  const profile = mapPublicProfessionalProfile({ userId: "professional", role: "Photographer", isPubliclyAvailable: true,
    posts: [{ id: "priced-post", content: "Optional post price", price: 0 }], offers: [{ ...offer, price: 99 }] });
  expect(profile?.posts[0].price).toBe(0);
  expect(profile?.offers[0]).toMatchObject({ price: null, oldPrice: 200, offerPrice: 125 });
  expect(mapProfessionalProfileContentPage({ items: [{ ...offer, Price: 99 }] }, "offer").items[0].price).toBeNull();
  expect(mapProfessionalProfileContentPage({ items: [{ id: "post", price: 15.25 }] }).items[0].price).toBe(15.25);
  expect(parseProfessionalPostPrice("")).toMatchObject({ value: null, issue: null });
  expect(parseProfessionalPostPrice("0")).toMatchObject({ value: 0, issue: null });
  expect(parseProfessionalPostPrice("15.25")).toMatchObject({ value: 15.25, issue: null });
});

test("Discover preserves both offer prices without borrowing a post or hall price", () => {
  const mapped = mapDiscoverItem({ ...offer, contentType: "ProfessionalOffer", price: 99 });
  expect(mapped).toMatchObject({ price: null, oldPrice: 200, offerPrice: 125 });
  expect(mapDiscoverItem({ id: "post", contentType: "Post", price: 15.25 })?.price).toBe(15.25);
  expect(mapDiscoverItem({ id: "hall", contentType: "Hall", price: 500 })?.price).toBe(500);
  expect(mapHallOffer({ ...offer, hallId: "hall", oldBookingPrice: 250 })).toMatchObject({ oldBookingPrice: 250, offerPrice: 125 });
});

for (const role of ["Photographer", "EventCoordinator"] as const) {
  test(`${role}: two-price offers remain visible and can be stopped from management`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2030-01-10T00:00:00Z"));
    await page.addInitScript((role) => {
      localStorage.setItem("wesal_ui_lang", "en");
      const token = `test.${btoa(JSON.stringify({ sub: "professional", role, exp: Date.now() / 1000 + 3600 }))}.test`;
      sessionStorage.setItem("wesal-access-token", token);
      sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: "professional", name: "Professional", role } }));
    }, role);
    let stoppedAt: string | null = null;
    const writes: Array<{ path: string; body: string | null }> = [];
    await page.route("**/*", async (route) => {
      const request = route.request(), url = new URL(request.url());
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } });
      if (url.pathname.startsWith("/hubs/")) return json({}, 404);
      if (!url.pathname.startsWith("/api/v1/")) return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
      const path = url.pathname.slice(7);
      if (request.method() === "OPTIONS") return json({});
      if (path === "/session") return json({ isAuthenticated: true, role });
      if (path === "/profile") return json({ id: "professional", fullName: "Professional", role, isSetupComplete: true, approvalStatus: "Approved", concurrencyStamp: "test" });
      if (path === "/offers/mine") return json({ items: [{ ...offer, stoppedAt }], totalCount: 1 });
      if (path === `/offers/${offer.id}/stop` && request.method() === "POST") {
        writes.push({ path, body: request.postData() }); stoppedAt = "2030-01-10T00:00:00Z";
        return route.fulfill({ status: 204 });
      }
      if (path === "/language") return json({ language: "en" });
      if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
      return json({ items: [], totalCount: 0 });
    });
    await page.goto("/profile/offers");
    const row = page.getByTestId(`pro-offer-row-${offer.id}`);
    await expect(row).toContainText("200");
    await expect(row).toContainText("125");
    await row.getByRole("button", { name: en["offers.actions.stop"], exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: en["offers.stop.confirm"], exact: true }).click();
    await expect(page.getByTestId("pro-offers-filter-stopped")).toContainText("(1)");
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toBeNull();
    await expect(row.getByRole("button", { name: en["offers.actions.stop"], exact: true })).toHaveCount(0);
  });
}
