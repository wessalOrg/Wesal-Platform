import { expect, test, type Locator, type Page } from "@playwright/test";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";
import { getOfferFieldErrors } from "../src/lib/offer-form-validation";
import { validateProfessionalPostContent } from "../src/lib/professional-post-validation";

const owner = "format-owner";
const postId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const offerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const createdId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const texts = {
  ar: { single: "تصوير مناسبات وصال", multi: "عنوان العرض\nالفقرة الأولى\nالسطر الثاني\n\nالفقرة الثانية", edit: "فقرة إضافية بعد التعديل" },
  en: { single: "Wesal event photography", multi: "Offer title\nFirst paragraph\nSecond line\n\nSecond paragraph", edit: "An additional edited paragraph" },
};
type Lang = "ar" | "en";
function contentField(body: string) {
  // Multipart normalizes text line endings to CRLF; compare logical paragraphs as LF.
  return /name="content"\r\n\r\n([\s\S]*?)\r\n--/.exec(body)?.[1]?.replace(/\r\n/g, "\n") ?? "";
}

async function setup(page: Page, lang: Lang, initialText = texts[lang].multi) {
  const role = lang === "ar" ? "Photographer" : "EventCoordinator";
  const posts = [{ id: postId, ownerUserId: owner, ownerName: "Content Owner", ownerRole: role,
    content: initialText, price: null, images: [], createdAt: "2029-01-01T00:00:00Z" }];
  const offers = [{ id: offerId, ownerUserId: owner, content: initialText, oldPrice: 200, offerPrice: 100,
    startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", images: [], stoppedAt: null }];
  const writes: Array<{ path: string; method: string; content: string }> = [];
  await page.clock.setFixedTime(new Date("2030-01-10T10:00:00Z"));
  await page.addInitScript(({ lang, owner, role }) => {
    localStorage.setItem("wesal_ui_lang", lang);
    const token = `test.${btoa(JSON.stringify({ sub: owner, role, exp: Date.now() / 1000 + 3600 }))}.test`;
    sessionStorage.setItem("wesal-access-token", token);
    sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: owner, name: "Content Owner", role } }));
  }, { lang, owner, role });
  await page.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } });
    if (url.pathname.startsWith("/hubs/")) return json({}, 404);
    if (!url.pathname.startsWith("/api/v1/")) return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
    const path = url.pathname.slice(7);
    if (request.method() === "OPTIONS") return json({});
    if (path === "/session") return json({ isAuthenticated: true, role });
    if (path === "/profile") return json({ id: owner, fullName: "Content Owner", isSetupComplete: true, approvalStatus: "Approved", isLocked: false, concurrencyStamp: "test" });
    if (path === "/language") return json({ language: lang });
    if (path === `/profile/${owner}`) return json({ userId: owner, role, displayName: "Content Owner", isPubliclyAvailable: true, approvalStatus: "Approved", posts, offers });
    if (["POST", "PUT"].includes(request.method()) && (path === "/posts" || path.startsWith("/posts/") || path === "/offers" || path.startsWith("/offers/"))) {
      const content = contentField(request.postDataBuffer()?.toString("utf8") ?? "");
      writes.push({ path, method: request.method(), content });
      // This deliberately echoes text unchanged: frontend regression tests do not emulate/fix backend sanitization.
      const collection = path.startsWith("/posts") ? posts : offers;
      if (request.method() === "PUT") collection[0].content = content;
      else if (path === "/posts") posts.unshift({ ...posts[0], id: createdId, content });
      else offers.unshift({ ...offers[0], id: createdId, content });
      return request.method() === "PUT" ? route.fulfill({ status: 204 }) : json({ id: createdId }, 201);
    }
    if (path === `/posts/profile/${owner}`) return json({ items: posts, totalCount: posts.length, totalPages: 1, pageSize: 12 });
    if (path === "/offers/mine" || path === `/offers/profile/${owner}`) return json({ items: offers, totalCount: offers.length, totalPages: 1, pageSize: 12 });
    if (path === `/posts/${postId}` || path === `/posts/${createdId}`) return json(posts.find((row) => path.endsWith(row.id)));
    if (path === `/offers/${offerId}` || path === `/offers/${createdId}`) return json(offers.find((row) => path.endsWith(row.id)));
    if (path === "/discover") return json({ items: [{ ...offers[0], contentType: "ProfessionalOffer", createdAt: "2029-01-01T00:00:00Z" }], totalCount: 1, totalPages: 1, pageSize: 12 });
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [], totalCount: 0 });
  });
  return { posts, offers, writes, catalog: lang === "ar" ? ar : en };
}
async function exactMultiline(locator: Locator, text: string) {
  await expect.poll(() => locator.textContent()).toBe(text);
  await expect(locator).toHaveCSS("white-space", "pre-wrap");
}
async function selectDates(page: Page, form: Locator, catalog: typeof ar) {
  for (const [index, day] of [[0, 15], [1, 20]]) {
    await form.locator(".wesal-datetime-trigger").nth(index).click();
    const panel = page.locator(".wesal-datetime-panel");
    await panel.locator(".wesal-datetime-day").filter({ hasText: new RegExp(`^${day}$`) }).click();
    await panel.getByRole("button", { name: catalog["common.ok"], exact: true }).click();
  }
}

test("text validation still counts line breaks toward existing length limits", () => {
  expect(validateProfessionalPostContent(texts.ar.multi)).toBeNull();
  expect(validateProfessionalPostContent("x".repeat(1999) + "\n")).toBeNull();
  expect(validateProfessionalPostContent("x".repeat(1999) + "\nx")).toBe("tooLong");
  const fields = { oldPrice: "200", offerPrice: "100", startsAt: "2030-01-15T10:00", endsAt: "2030-01-20T10:00", content: texts.en.multi };
  expect(getOfferFieldErrors(fields, new Date("2030-01-10T10:00:00Z"))).toEqual({});
  expect(getOfferFieldErrors({ ...fields, content: "x".repeat(1999) + "\nx" }).content).toBe("offers.validation.titleMax");
});

for (const lang of ["ar", "en"] as const) {
  test(`${lang}: post creation and editing preserve paragraphs and empty lines in requests`, async ({ page }) => {
    const state = await setup(page, lang);
    await page.goto("/profile/posts");
    await page.getByTestId("dashboard-post-create").click();
    let form = page.getByTestId("professional-post-form");
    await form.locator("textarea").fill(texts[lang].single);
    await form.getByTestId("professional-post-submit").click();
    await expect(form).toHaveCount(0);
    expect(state.writes[0].content).toBe(texts[lang].single);
    await page.getByTestId("dashboard-post-card").first().getByRole("button", { name: state.catalog["professionals.posts.editAction"], exact: true }).click();
    form = page.getByTestId("professional-post-form");
    await form.locator("textarea").fill(texts[lang].multi);
    await form.getByTestId("professional-post-submit").click();
    await expect(form).toHaveCount(0);
    expect(state.writes[1]).toEqual({ path: `/posts/${createdId}`, method: "PUT", content: texts[lang].multi });
    await exactMultiline(page.getByTestId("dashboard-post-card").first().locator(".professional-post-row-content"), texts[lang].multi);
  });

  test(`${lang}: professional offer editing and creation keep the title, description and paragraphs`, async ({ page }) => {
    const state = await setup(page, lang);
    await page.goto("/profile/offers");
    const row = page.getByTestId(`pro-offer-row-${offerId}`);
    await expect(row.locator("h2")).toHaveText(texts[lang].multi.split("\n")[0]);
    await exactMultiline(row.locator(".pro-offers-description"), texts[lang].multi.split("\n").slice(1).join("\n"));
    await row.getByRole("button", { name: state.catalog["offers.actions.edit"], exact: true }).click();
    let form = page.getByTestId("professional-offer-form");
    const content = form.getByTestId("offer-field-content");
    await expect(content).toHaveValue(texts[lang].multi);
    await expect(content).toHaveAttribute("maxlength", "2000");
    const edited = texts[lang].multi + "\n\n" + texts[lang].edit;
    await content.fill(edited);
    await form.getByRole("button", { name: state.catalog["offers.form.save"], exact: true }).click();
    await expect(form).toHaveCount(0);
    expect(state.writes[0]).toEqual({ path: `/offers/${offerId}`, method: "PUT", content: edited });
    await page.getByTestId("pro-offers-add").click();
    form = page.getByTestId("professional-offer-form");
    await form.getByTestId("offer-field-content").fill(texts[lang].multi);
    await form.getByTestId("offer-field-oldPrice").fill("200");
    await form.getByTestId("offer-field-offerPrice").fill("100");
    await selectDates(page, form, state.catalog);
    await form.locator('button[type="submit"]').click();
    await expect(form).toHaveCount(0);
    expect(state.writes[1]).toEqual({ path: "/offers", method: "POST", content: texts[lang].multi });
  });

  test(`${lang}: inline offers retain multiline request content`, async ({ page }) => {
    const state = await setup(page, lang);
    await page.goto(`/professionals/${owner}`);
    await page.getByTestId("professional-offer-create-open").click();
    const form = page.getByTestId("professional-offer-form");
    await form.getByTestId("offer-field-content").fill(texts[lang].multi);
    await form.getByTestId("offer-field-oldPrice").fill("200");
    await form.getByTestId("offer-field-offerPrice").fill("100");
    await selectDates(page, form, state.catalog);
    await form.getByTestId("professional-offer-submit").click();
    await expect(form).toHaveCount(0);
    expect(state.writes[0]).toEqual({ path: "/offers", method: "POST", content: texts[lang].multi });
  });

  test(`${lang}: API-returned multiline posts and offers render with preserved line breaks`, async ({ page }) => {
    await setup(page, lang);
    await page.goto(`/professionals/${owner}`);
    await exactMultiline(page.getByTestId("professional-post-card").locator("p.line-clamp-3"), texts[lang].multi);
    await page.getByTestId("professional-post-open").click();
    await exactMultiline(page.locator('p.whitespace-pre-wrap').filter({ hasText: texts[lang].multi.split("\n")[0] }).first(), texts[lang].multi);
    await page.goto(`/professionals/${owner}`);
    await page.getByTestId("professional-tab-offers").click();
    await exactMultiline(page.getByTestId("professional-offer-card").locator("p.line-clamp-3"), texts[lang].multi);
    await page.getByTestId(`professional-offer-open-${offerId}`).click();
    await exactMultiline(page.getByTestId("professional-offer-full-text"), texts[lang].multi);
    await page.goto("/discover?filter=Offers");
    await exactMultiline(page.getByTestId(`discover-offer-${offerId}`).locator("h3"), texts[lang].multi);
  });
}

test("API text is rendered as text and never interpreted as HTML", async ({ page }) => {
  const text = 'Offer title\n<img src=x onerror="window.a12Executed=true">\n\n<script>window.a12Executed=true</script>';
  await setup(page, "en", text);
  await page.goto(`/professionals/${owner}`);
  await page.getByTestId("professional-tab-offers").click();
  await page.getByTestId(`professional-offer-open-${offerId}`).click();
  const content = page.getByTestId("professional-offer-full-text");
  await exactMultiline(content, text);
  await expect(content.locator("img,script")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { a12Executed?: boolean }).a12Executed)).toBeUndefined();
});

test("single-line offers retain their title and do not gain an empty description", async ({ page }) => {
  const state = await setup(page, "en", texts.en.single);
  await page.goto("/profile/offers");
  const row = page.getByTestId(`pro-offer-row-${offerId}`);
  await expect(row.locator("h2")).toHaveText(texts.en.single);
  await expect(row.locator(".pro-offers-description")).toHaveCount(0);
  await row.getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
  const form = page.getByTestId("professional-offer-form");
  await expect(form.getByTestId("offer-field-content")).toHaveValue(texts.en.single);
  await form.getByRole("button", { name: en["offers.form.save"], exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(state.writes[0].content).toBe(texts.en.single);
});

test("CRLF API content keeps logical paragraphs when edited and displayed", async ({ page }) => {
  const state = await setup(page, "en", texts.en.multi.replace(/\n/g, "\r\n"));
  await page.goto("/profile/offers");
  const row = page.getByTestId(`pro-offer-row-${offerId}`);
  await exactMultiline(row.locator(".pro-offers-description"), texts.en.multi.split("\n").slice(1).join("\n"));
  await row.getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
  const form = page.getByTestId("professional-offer-form");
  const text = form.getByTestId("offer-field-content");
  await expect(text).toHaveValue(texts.en.multi);
  await text.fill(texts.en.multi + "\n\n" + texts.en.edit);
  await form.getByRole("button", { name: en["offers.form.save"], exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(state.writes[0].content).toBe(texts.en.multi + "\n\n" + texts.en.edit);
});
