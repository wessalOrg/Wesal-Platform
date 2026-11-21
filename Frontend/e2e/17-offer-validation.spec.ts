import { expect, test, type Locator, type Page } from "@playwright/test";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";
import { getOfferFieldErrors, offerImageMetadataError, validateOfferImageFiles } from "../src/lib/offer-form-validation";
import { OFFER_MAX_MONEY, parseOfferMoney } from "../src/lib/offer-validation";

const userId = "validation-user";
const hallId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const offerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWM4WF0PRwzEcQDUUhuxFgs8twAAAABJRU5ErkJggg==", "base64");
const valid = { oldPrice: "200", offerPrice: "100", startsAt: "2030-01-15T10:00", endsAt: "2030-01-20T10:00" };
const now = new Date("2030-01-10T10:00:00Z");

test("shared required money rules match positive decimal backend amounts", () => {
  for (const amount of ["0.01", "200", "200.000", "0.0100", String(OFFER_MAX_MONEY)]) {
    expect(parseOfferMoney(amount).issue).toBeNull();
  }
  for (const [amount, issue] of [["", "required"], ["0", "nonPositive"], ["-1", "nonPositive"],
    ["10000000000", "tooLarge"], ["1.001", "decimals"], ["1e3", "invalid"], ["abc", "invalid"]]) {
    expect(parseOfferMoney(amount).issue).toBe(issue);
  }
});

test("shared fields reject invalid dates and prices, and permit past starts and image-only content", () => {
  expect(getOfferFieldErrors(valid, now)).toEqual({});
  expect(getOfferFieldErrors({ ...valid, startsAt: "2030-01-01T10:00" }, now)).toEqual({});
  expect(getOfferFieldErrors({ ...valid, offerPrice: "200" }, now).offerPrice).toBe("offers.validation.offerBelowOld");
  expect(getOfferFieldErrors({ ...valid, startsAt: "" }, now).startsAt).toBe("offers.validation.startRequired");
  expect(getOfferFieldErrors({ ...valid, startsAt: "2030-02-30T10:00" }, now).startsAt).toBe("offers.validation.datesInvalid");
  expect(getOfferFieldErrors({ ...valid, endsAt: valid.startsAt }, now).endsAt).toBe("offers.validation.endAfterStart");
  expect(getOfferFieldErrors({ ...valid, startsAt: "2030-01-01", endsAt: "2030-01-02" }, now).endsAt).toBe("offers.validation.endNotFuture");
  expect(getOfferFieldErrors({ ...valid, content: "" }, now).content).toBe("offers.validation.contentOrImage");
  expect(getOfferFieldErrors({ ...valid, content: "", existingImageCount: 1 }, now)).toEqual({});
  expect(getOfferFieldErrors({ ...valid, content: "x".repeat(2001) }, now).content).toBe("offers.validation.titleMax");
});

test("image checks enforce MIME, extension, size, retained count and backend signatures", async () => {
  const image = new File([new Uint8Array(png)], "photo.png", { type: "image/png" });
  expect(await validateOfferImageFiles([image])).toBeNull();
  expect(await validateOfferImageFiles([new File([new Uint8Array([255, 216, 255])], "photo.jpg", { type: "image/jpeg" })])).toBeNull();
  expect(await validateOfferImageFiles([new File(["RIFF0000WEBP"], "photo.webp", { type: "image/webp" })])).toBeNull();
  expect(offerImageMetadataError(Array(10).fill(image))).toBeNull();
  expect(offerImageMetadataError([image, image], 9)).toBe("offers.validation.image.tooMany");
  expect(offerImageMetadataError([new File([], "empty.png", { type: "image/png" })])).toBe("offers.validation.image.emptyFile");
  expect(offerImageMetadataError([new File([new Uint8Array(5 * 1024 * 1024)], "max.png", { type: "image/png" })])).toBeNull();
  expect(offerImageMetadataError([new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })])).toBe("offers.validation.image.tooLarge");
  expect(offerImageMetadataError([new File(["pdf"], "file.pdf", { type: "application/pdf" })])).toBe("offers.validation.image.type");
  expect(offerImageMetadataError([new File([new Uint8Array(png)], "file.exe", { type: "image/png" })])).toBe("offers.validation.image.type");
  expect(await validateOfferImageFiles([new File(["fake png"], "fake.png", { type: "image/png" })])).toBe("offers.validation.image.signature");
});

async function setup(page: Page, role: string, lang: "ar" | "en", editing = false) {
  const saves: Array<{ method: string; body: string }> = [];
  const existing = { id: offerId, ownerUserId: userId, hallId, oldPrice: 200, oldBookingPrice: 200,
    offerPrice: 100, startsAt: "2030-01-15T10:00:00Z", endsAt: "2030-01-20T10:00:00Z",
    images: Array.from({ length: 9 }, (_, index) => ({ id: `cccccccc-cccc-4ccc-8ccc-${String(index + 1).padStart(12, "0")}`,
      url: `/api/v1/offers/${offerId}/images/${index + 1}`, order: index })) };
  await page.clock.setFixedTime(now);
  await page.addInitScript(({ role, lang }) => {
    localStorage.setItem("wesal_ui_lang", lang);
    const token = `test.${btoa(JSON.stringify({ sub: "validation-user", role, exp: Date.now() / 1000 + 3600 }))}.test`;
    sessionStorage.setItem("wesal-access-token", token);
    sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: "validation-user", name: "Validation User", role } }));
  }, { role, lang });
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } });
    if (url.pathname.startsWith("/hubs/")) return json({}, 404);
    if (!url.pathname.startsWith("/api/v1/")) return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
    const path = url.pathname.slice("/api/v1".length);
    if (request.method() === "OPTIONS") return json({});
    if (path.includes("/images/")) return route.fulfill({ contentType: "image/png", body: png, headers: { "access-control-allow-origin": "*" } });
    if (path === "/session") return json({ isAuthenticated: true, role });
    if (path === "/profile") return json({ id: userId, fullName: "Validation User", role, isSetupComplete: true, approvalStatus: "Approved", concurrencyStamp: "test" });
    if (path === `/profile/${userId}`) return json({ userId, role, displayName: "Validation User", isPubliclyAvailable: true, approvalStatus: "Approved", posts: [], offers: [] });
    if (path === "/owner/halls") return json([{ id: hallId, name: "Test Hall", status: "Approved", paymentStatus: "Paid", daysRemaining: 30, adminLocked: false, systemLocked: false }]);
    if ((path === "/offers" || path.startsWith("/offers/") || path.startsWith(`/owner/halls/${hallId}/offers`)) && ["POST", "PUT"].includes(request.method())) {
      saves.push({ method: request.method(), body: request.postDataBuffer()?.toString("utf8") ?? "" });
      return request.method() === "PUT" ? route.fulfill({ status: 204 }) : json({ id: offerId }, 201);
    }
    if (path === `/offers/${offerId}`) return json(existing);
    if (path === "/offers/mine" || path === `/owner/halls/${hallId}/offers`) return json({ items: editing ? [existing] : [], totalCount: editing ? 1 : 0 });
    if (path === "/language") return json({ language: lang });
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [], totalCount: 0 });
  });
  return saves;
}

async function dates(page: Page, form: Locator, lang: "ar" | "en", days = [15, 20]) {
  const catalog = lang === "ar" ? ar : en;
  for (const [index, day] of [[0, days[0]], [1, days[1]]]) {
    await form.locator(".wesal-datetime-trigger").nth(index).click();
    const panel = page.locator(".wesal-datetime-panel");
    await panel.locator(".wesal-datetime-day").filter({ hasText: new RegExp(`^${day}$`) }).click();
    await panel.getByRole("button", { name: catalog["common.ok"], exact: true }).click();
  }
}

for (const [role, lang] of [["Photographer", "ar"], ["EventCoordinator", "en"]] as const) {
  test(`${role}: main offer form blocks invalid values and files without a third price field`, async ({ page }) => {
    await page.setViewportSize({ width: role === "Photographer" ? 1366 : 390, height: 900 });
    const saves = await setup(page, role, lang);
    const catalog = lang === "ar" ? ar : en;
    await page.goto("/profile/offers");
    await page.getByTestId("pro-offers-add").click();
    const form = page.getByTestId("professional-offer-form");
    const submit = form.locator('button[type="submit"]');
    await expect(form.getByTestId("offer-price-box")).toHaveCount(0);
    await expect(form.locator('input[type="checkbox"]')).toHaveCount(0);
    await form.getByTestId("offer-field-content").fill("Preserved offer content");
    await form.getByTestId("offer-field-oldPrice").fill("10000000000");
    await form.getByTestId("offer-field-offerPrice").fill("80");
    await submit.click();
    await expect(form.getByTestId("offer-error-oldPrice")).toHaveText(catalog["offers.validation.money.tooLarge"]);
    await expect(form.getByTestId("offer-error-startsAt")).toHaveText(catalog["offers.validation.startRequired"]);
    await form.getByTestId("offer-field-oldPrice").fill("100.001");
    await submit.click();
    await expect(form.getByTestId("offer-error-oldPrice")).toHaveText(catalog["offers.validation.money.decimals"]);
    await form.getByTestId("offer-field-oldPrice").fill("100");
    await form.getByTestId("offer-field-offerPrice").fill("100");
    await submit.click();
    await expect(form.getByTestId("offer-error-offerPrice")).toHaveText(catalog["offers.validation.offerBelowOld"]);
    await form.getByTestId("offer-field-offerPrice").fill("80");
    await dates(page, form, lang);
    await form.locator('input[type="file"]').setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("fake image") });
    await submit.click();
    await expect(form.getByTestId("offer-error-images")).toHaveText(catalog["offers.validation.image.signature"]);
    expect(saves).toHaveLength(0);
    await expect(form.getByTestId("offer-field-content")).toHaveValue("Preserved offer content");
    await form.getByRole("button", { name: catalog["offers.form.removeImage"], exact: true }).click();
    await form.locator('input[type="file"]').setInputFiles({ name: "valid.png", mimeType: "image/png", buffer: png });
    await submit.click();
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0].body).not.toContain('name="priceBox"');
    expect(saves[0].body).toContain('filename="valid.png"');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("main professional form reports unsupported, oversized and excess images before upload", async ({ page }) => {
  const saves = await setup(page, "Photographer", "en");
  await page.goto("/profile/offers");
  await page.getByTestId("pro-offers-add").click();
  const form = page.getByTestId("professional-offer-form"), files = form.locator('input[type="file"]');
  const remove = () => form.getByRole("button", { name: en["offers.form.removeImage"], exact: true }).first().click();
  await files.setInputFiles({ name: "bad.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf") });
  await expect(form.getByTestId("offer-error-images")).toHaveText(en["offers.validation.image.type"]);
  await remove();
  await files.setInputFiles({ name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(form.getByTestId("offer-error-images")).toHaveText(en["offers.validation.image.tooLarge"]);
  await remove();
  await files.setInputFiles(Array.from({ length: 11 }, (_, i) => ({ name: `${i}.png`, mimeType: "image/png", buffer: png })));
  await expect(form.getByTestId("offer-error-images")).toHaveText(en["offers.validation.image.tooMany"]);
  expect(saves).toHaveLength(0);
  await remove();
  await form.getByTestId("offer-field-oldPrice").fill("100");
  await form.getByTestId("offer-field-offerPrice").fill("80");
  await dates(page, form, "en");
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].body.match(/name="images"/g)).toHaveLength(10);
  expect(saves[0].body).not.toContain('name="content"');
});

test("date errors identify the end field, allow a past start with only the two required prices", async ({ page }) => {
  const saves = await setup(page, "Photographer", "en");
  await page.goto("/profile/offers");
  await page.getByTestId("pro-offers-add").click();
  const form = page.getByTestId("professional-offer-form"), submit = form.locator('button[type="submit"]');
  await form.getByTestId("offer-field-content").fill("Text-only offer with dates");
  await form.getByTestId("offer-field-oldPrice").fill("100");
  await form.getByTestId("offer-field-offerPrice").fill("80");
  await dates(page, form, "en", [15, 14]);
  await submit.click();
  await expect(form.getByTestId("offer-error-endsAt")).toHaveText(en["offers.validation.endAfterStart"]);
  await dates(page, form, "en", [5, 9]);
  await submit.click();
  await expect(form.getByTestId("offer-error-endsAt")).toHaveText(en["offers.validation.endNotFuture"]);
  expect(saves).toHaveLength(0);
  await expect(form.getByTestId("offer-field-content")).toHaveValue("Text-only offer with dates");
  await dates(page, form, "en", [5, 20]);
  await submit.click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].body).not.toContain('name="priceBox"');
});

for (const editing of [false, true]) {
  test(`hall owner main ${editing ? "edit" : "create"} validates fields and submits the existing JSON contract`, async ({ page }) => {
    const saves = await setup(page, "HallOwner", "en", editing);
    await page.goto("/owner/offers");
    if (editing) await page.getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
    else await page.getByTestId("owner-offers-add").click();
    const form = page.getByTestId("hall-offer-form-modal"), submit = form.locator('button[type="submit"]');
    await form.getByTestId("offer-field-oldPrice").fill("0");
    await form.getByTestId("offer-field-offerPrice").fill("80.001");
    await submit.click();
    await expect(form.getByTestId("offer-error-oldPrice")).toHaveText(en["offers.validation.money.nonPositive"]);
    await expect(form.getByTestId("offer-error-offerPrice")).toHaveText(en["offers.validation.money.decimals"]);
    expect(saves).toHaveLength(0);
    await form.getByTestId("offer-field-oldPrice").fill("200");
    await form.getByTestId("offer-field-offerPrice").fill("100");
    if (!editing) await dates(page, form, "en");
    await submit.click();
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0].method).toBe(editing ? "PUT" : "POST");
    expect(JSON.parse(saves[0].body)).toMatchObject({ oldBookingPrice: 200, offerPrice: 100 });
    expect(Object.keys(JSON.parse(saves[0].body)).sort()).toEqual(["endsAt", "offerPrice", "oldBookingPrice", "startsAt"]);
  });
}

for (const role of ["Photographer", "EventCoordinator"] as const) {
test(`${role}: professional edit submits only the two required prices and blocks invalid values`, async ({ page }) => {
  const saves = await setup(page, role, "en", true);
  await page.goto("/profile/offers");
  await page.getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
  const form = page.getByTestId("professional-offer-form");
  await expect(form.getByTestId("offer-price-box")).toHaveCount(0);
  await form.getByTestId("offer-field-content").fill("Edited text-only offer");
  await form.getByTestId("offer-field-offerPrice").fill("300");
  await form.locator('button[type="submit"]').click();
  await expect(form.getByTestId("offer-error-offerPrice")).toBeVisible();
  expect(saves).toHaveLength(0);
  await form.getByTestId("offer-field-offerPrice").fill("100");
  await form.locator('input[type="file"]').setInputFiles([
    { name: "new-a.png", mimeType: "image/png", buffer: png },
    { name: "new-b.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(form.getByTestId("offer-error-images")).toHaveText(en["offers.validation.image.tooMany"]);
  await form.locator('button[type="submit"]').click();
  expect(saves).toHaveLength(0);
  await form.getByRole("button", { name: en["offers.form.removeImage"], exact: true }).nth(9).click();
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].method).toBe("PUT");
  expect(saves[0].body).not.toContain('name="priceBox"');
  expect(saves[0].body.match(/name="keepImageIds"/g)).toHaveLength(9);
  expect(saves[0].body).toContain('filename="new-b.png"');
  expect(saves[0].body).not.toContain('filename="new-a.png"');
});

}

for (const role of ["Photographer", "EventCoordinator", "HallOwner"] as const) {
  test(`${role}: inline form shares validation and preserves its create contract`, async ({ page }) => {
    const saves = await setup(page, role, "ar");
    await page.goto(role !== "HallOwner" ? `/professionals/${userId}` : `/owner/halls/${hallId}/offers`);
    await page.getByTestId(role !== "HallOwner" ? "professional-offer-create-open" : "hall-offer-create-open").click();
    const form = page.getByTestId(role !== "HallOwner" ? "professional-offer-form" : "hall-offer-form");
    const submit = form.getByTestId(role !== "HallOwner" ? "professional-offer-submit" : "hall-offer-submit");
    await form.getByTestId("offer-field-oldPrice").fill("10000000000");
    await form.getByTestId("offer-field-offerPrice").fill("50");
    await submit.click();
    await expect(form.getByTestId("offer-error-oldPrice")).toHaveText(ar["offers.validation.money.tooLarge"]);
    expect(saves).toHaveLength(0);
    await form.getByTestId("offer-field-oldPrice").fill("100");
    if (role !== "HallOwner") await form.getByTestId("offer-field-content").fill("Inline text-only offer");
    await dates(page, form, "ar");
    await submit.click();
    await expect.poll(() => saves.length).toBe(1);
    if (role !== "HallOwner") expect(saves[0].body).not.toContain('name="priceBox"');
    else expect(JSON.parse(saves[0].body)).toMatchObject({ oldBookingPrice: 100, offerPrice: 50 });
  });
}
