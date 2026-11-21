import { expect, test, type Page } from "@playwright/test";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";

const owner = "content-owner";
const multiPostId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const textPostId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const offerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const emptyOfferId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const fullPost = "تفاصيل المنشور الكاملة مع جميع الأعمال. ".repeat(22) + "POST END MARKER";
const fullOffer = "تفاصيل العرض الكاملة والخدمات المتاحة. ".repeat(22) + "OFFER END MARKER";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWM4WF0PRwzEcQDUUhuxFgs8twAAAABJRU5ErkJggg==", "base64");
const images = (kind: "posts" | "offers", id: string) => [1, 2, 3].map((n) => ({
  id: `image-${n}`, order: n, url: `/api/v1/${kind}/${id}/images/image-${n}`,
}));
const posts = [
  { id: multiPostId, ownerUserId: owner, content: fullPost, price: 150, images: images("posts", multiPostId) },
  { id: textPostId, ownerUserId: owner, content: "Text only content. ".repeat(30) + "TEXT END MARKER", price: null, images: [] },
];
const offers = [
  { id: offerId, ownerUserId: owner, content: fullOffer, oldPrice: 300, offerPrice: 200, price: 777,
    startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", images: images("offers", offerId) },
  { id: emptyOfferId, ownerUserId: owner, content: null, oldPrice: 400, offerPrice: 250, price: null,
    startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", images: [] },
];

async function setup(page: Page, lang: "ar" | "en" = "ar", options: { delayed?: boolean; badImage?: boolean } = {}) {
  let offerStatus = 200;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.addInitScript((lang) => {
    localStorage.setItem("wesal_ui_lang", lang);
    sessionStorage.removeItem("wesal-access-token");
    sessionStorage.removeItem("wesal_auth");
  }, lang);
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json",
      body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } });
    if (url.pathname.startsWith("/hubs/")) return json({}, 404);
    if (!url.pathname.startsWith("/api/v1/")) {
      return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
    }
    const path = url.pathname.slice("/api/v1".length);
    if (route.request().method() === "OPTIONS") return json({});
    if (path.includes("/images/")) {
      if (options.badImage && path.endsWith("image-2")) return json({}, 404);
      return route.fulfill({ contentType: "image/png", body: png, headers: { "access-control-allow-origin": "*" } });
    }
    if (path === "/session") return json({ isAuthenticated: false });
    if (path === "/language") return json({ language: lang });
    if (path === `/profile/${owner}`) return json({ userId: owner, displayName: "Original Publisher", role: "Photographer",
      isPubliclyAvailable: true, approvalStatus: "Approved", posts, offers });
    if (path === `/posts/profile/${owner}`) return json({ items: posts, totalCount: posts.length });
    if (path === `/offers/profile/${owner}`) return json({ items: offers, totalCount: offers.length });
    if (path === `/posts/${multiPostId}` || path === `/posts/${textPostId}`) return json(posts.find((p) => path.endsWith(p.id)));
    if (path === `/offers/${offerId}` || path === `/offers/${emptyOfferId}`) {
      if (options.delayed) await gate;
      return offerStatus === 200 ? json(offers.find((p) => path.endsWith(p.id))) : json({ title: "Unavailable" }, offerStatus);
    }
    if (path === "/discover") return json({ items: [{ ...offers[0], contentType: "ProfessionalOffer", createdAt: "2026-01-01T00:00:00Z" }], totalCount: 1 });
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [], totalCount: 0 });
  });
  return { release, setOfferStatus: (status: number) => { offerStatus = status; } };
}

async function checkGallery(page: Page, catalog: typeof ar) {
  const gallery = page.getByTestId("content-image-gallery");
  await expect(gallery.getByRole("img")).toBeVisible();
  await expect(gallery.getByTestId("content-gallery-count")).toHaveText("1/3");
  for (const number of [2, 3, 1]) {
    await gallery.getByRole("button", { name: catalog["posts.nextImage"], exact: true }).click();
    await expect(gallery.getByTestId("content-gallery-count")).toHaveText(`${number}/3`);
    await expect(gallery.getByRole("img")).toHaveAttribute("alt", catalog["posts.imageDot"].replace("{index}", String(number)));
  }
  await gallery.getByRole("button", { name: catalog["posts.prevImage"], exact: true }).click();
  await expect(gallery.getByTestId("content-gallery-count")).toHaveText("3/3");
  await gallery.getByRole("button", { name: catalog["posts.imageDot"].replace("{index}", "2"), exact: true }).click();
  await expect(gallery.getByTestId("content-gallery-count")).toHaveText("2/3");
}

for (const width of [1366, 820, 390]) {
  test(`Arabic visitors can open full multi-image posts and offers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto(`/professionals/${owner}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("professional-post-edit")).toHaveCount(0);
    await page.getByTestId("professional-post-open").first().click();
    await expect(page).toHaveURL(new RegExp(`/posts/${multiPostId}$`));
    const details = page.getByTestId(`post-details-${multiPostId}`);
    await expect(details.getByText(fullPost, { exact: true })).toBeVisible();
    expect(await details.getByText(fullPost, { exact: true }).evaluate((el) => getComputedStyle(el).webkitLineClamp)).toBe("none");
    await expect(details.getByRole("link", { name: "Original Publisher", exact: true })).toHaveAttribute("href", `/professionals/${owner}`);
    await expect(page.getByTestId("post-comment-section")).toBeVisible();
    await expect(page.getByTestId("post-favorite-button")).toHaveCount(2);
    await expect(page.getByTestId("post-share-button")).toBeVisible();
    await expect(page.getByTestId("post-inquiry-button")).toBeVisible();
    await checkGallery(page, ar);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await details.screenshot({ path: test.info().outputPath(`post-details-${width}.png`) });

    await page.goto(`/professionals/${owner}`);
    await page.getByTestId("professional-tab-offers").click();
    const open = page.getByTestId(`professional-offer-open-${offerId}`);
    await open.click();
    const dialog = page.getByTestId("professional-offer-details");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("professional-offer-full-text")).toHaveText(fullOffer);
    expect(await dialog.getByTestId("professional-offer-full-text").evaluate((el) => getComputedStyle(el).webkitLineClamp)).toBe("none");
    await expect(dialog.getByRole("link", { name: ar["offers.card.viewProfile"], exact: true })).toHaveAttribute("href", `/professionals/${owner}`);
    await expect(dialog.getByTestId("offer-inquiry-button")).toBeVisible();
    await expect(dialog).not.toContainText("777");
    await checkGallery(page, ar);
    const bounds = await dialog.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await dialog.screenshot({ path: test.info().outputPath(`offer-details-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  });
}

test("English text-only posts and empty offer media remain readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, "en");
  await page.goto(`/professionals/${owner}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByTestId("professional-post-open").nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/posts/${textPostId}$`));
  await expect(page.getByText(posts[1].content, { exact: true })).toHaveCount(2);
  await expect(page.getByTestId("content-gallery-count")).toHaveCount(0);
  await expect(page.getByTestId("content-image-gallery").getByRole("img")).toHaveCount(0);
  await page.goto(`/professionals/${owner}`);
  await page.getByTestId("professional-tab-offers").click();
  await page.getByTestId(`professional-offer-open-${emptyOfferId}`).click();
  const dialog = page.getByTestId("professional-offer-details");
  await expect(dialog.getByTestId("content-gallery-empty")).toHaveText(en["offers.card.noImage"]);
  await expect(dialog.getByTestId("professional-offer-full-text")).toHaveText(en["offers.card.untitled"]);
  await expect(dialog.getByRole("button", { name: en["common.close"], exact: true })).toBeVisible();
});

test("offer loading, not found, retry and failed images have usable states", async ({ page }) => {
  const state = await setup(page, "en", { delayed: true, badImage: true });
  try {
    state.setOfferStatus(404);
    await page.goto(`/professionals/${owner}`);
    await page.getByTestId("professional-tab-offers").click();
    await page.getByTestId(`professional-offer-open-${offerId}`).click();
    const dialog = page.getByTestId("professional-offer-details");
    await expect(dialog.getByRole("status")).toHaveText(en["common.loading"]);
    state.release();
    await expect(dialog.getByRole("alert")).toHaveText(en["offers.errors.notFound"]);
    state.setOfferStatus(200);
    await dialog.getByRole("button", { name: en["common.retry"], exact: true }).click();
    await expect(dialog.getByTestId("professional-offer-full-text")).toHaveText(fullOffer);
    const gallery = dialog.getByTestId("content-image-gallery");
    await gallery.getByRole("button", { name: en["posts.nextImage"], exact: true }).click();
    await expect(gallery.getByRole("status")).toHaveText(en["offers.card.noImage"]);
    await gallery.getByRole("button", { name: en["posts.nextImage"], exact: true }).click();
    await expect(gallery.getByRole("img")).toBeVisible();
    await expect(gallery.getByTestId("content-gallery-count")).toHaveText("3/3");
  } finally { state.release(); }
});

test("Discover reuses offer details while preserving profile navigation", async ({ page }) => {
  await setup(page, "en");
  await page.goto("/discover?filter=Offers");
  await page.getByTestId(`professional-offer-open-${offerId}`).click();
  await expect(page.getByTestId("professional-offer-full-text")).toHaveText(fullOffer);
  await checkGallery(page, en);
  await page.keyboard.press("Escape");
  await page.getByTestId(`discover-offer-open-${offerId}`).click();
  await expect(page).toHaveURL(new RegExp(`/professionals/${owner}$`));
});
