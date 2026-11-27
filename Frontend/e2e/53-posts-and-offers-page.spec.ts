import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";

let bundle: string, styles = "";
test.beforeAll(async () => {
  const chunks = path.resolve(".next/static/chunks");
  styles = fs.readdirSync(chunks).filter(file => file.endsWith(".css"))
    .map(file => fs.readFileSync(path.join(chunks, file), "utf8")).filter(css => css.includes(".container-wesal")).join("\n");
  for (const file of ["community/posts-and-offers.css", "offers/professional-offer-details.css", "offers/offer-date-range.css"])
    styles += "\n" + fs.readFileSync(path.resolve("src/components", file), "utf8");
  const mocks: Record<string, string> = {
    "next/navigation": "const router={push:p=>window.navigations.push(p)};export const useRouter=()=>router;export const usePathname=()=>location.pathname;",
    "next/link": "export default function Link({children,prefetch,...props}){return <a {...props}>{children}</a>}",
    "@/components/auth/AuthProvider": `import{useSyncExternalStore}from'react';import{readAuthenticatedAccount,subscribeAuthenticatedAccount,serverAuthenticatedAccount}from'@/lib/authenticated-account';
      export function useAuth(){const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount,serverAuthenticatedAccount);return{session:{isAuthenticated:!!account,role:account?'RegisteredUser':null,userName:account?.userId},status:'ready'}}`,
    "@/components/layout/LanguageProvider": "import{useSyncExternalStore}from'react';export const useUiLang=()=>useSyncExternalStore(f=>{window.addEventListener('language',f);return()=>window.removeEventListener('language',f)},()=>window.lang);",
    "@/i18n": `import{useUiLang}from'@/components/layout/LanguageProvider';const catalogs=${JSON.stringify({ ar, en })};export const t=(key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),catalogs[window.lang][key]??key);export const useT=()=>{useUiLang();return t};`,
    "@/lib/api": `import{ApiError}from'@/lib/api-error';import{getAccessToken}from'@/lib/auth-token';export const apiOrigin=()=>location.origin;
      async function request(method,p,body,c={}){const url=new URL(p.startsWith('/api/v1/')?p:'/api/v1'+p,location.origin);Object.entries(c.params||{}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
        const response=await fetch(url,{method,headers:{Authorization:'Bearer '+(getAccessToken()||''),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
        if(!response.ok)throw new ApiError('errors.request',response.status);return{data:c.responseType==='blob'?await response.blob():response.status===204?undefined:await response.json(),headers:{'content-type':response.headers.get('content-type')}}}
      export default{get:(p,c)=>request('GET',p,undefined,c),post:(p,b,c)=>request('POST',p,b,c),delete:(p,c)=>request('DELETE',p,undefined,c)};`,
    "@/lib/demo-mode": "export const isDemoModeEnabled=()=>false;",
  };
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `import React from'react';import{createRoot}from'react-dom/client';import View from'./src/components/community/PostsAndOffersView';
      import Details from'./src/components/posts/PostDetailsView';import{setAccessToken}from'./src/lib/auth-token';import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';
      window.lang=new URLSearchParams(location.search).get('lang')||'ar';window.navigations=[];document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.documentElement.lang=lang;
      window.actions={login(id){const token=id+'-token';setAccessToken(token);setStoredAuth({token,user:{id,role:'RegisteredUser'}})},logout:clearAuthSession,
        language(value){window.lang=value;document.documentElement.dir=value==='ar'?'rtl':'ltr';document.documentElement.lang=value;window.dispatchEvent(new Event('language'))}};
      createRoot(document.getElementById('root')).render(<main className="community-page">{location.search.includes('details=1')?<Details postId="post-1"/>:<View/>}</main>);` },
    platform: "browser", bundle: true, write: false, jsx: "automatic", loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "community-api", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

const now = Date.parse("2026-11-25T10:00:00Z");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWM4WF0PRwzEcQDUUhuxFgs8twAAAABJRU5ErkJggg==", "base64");
const post = (n: number) => ({ id: `post-${n}`, contentType: "Post", ownerUserId: `owner-${n % 2}`, content: `Post ${n}\nA complete paragraph with event inspiration.`, imageUrl: "/test-image.png", createdAt: "2026-11-20T10:00:00Z" });
const offer = (n: number) => ({ id: `offer-${n}`, contentType: "ProfessionalOffer", ownerUserId: `owner-${n % 2}`, content: `Special offer ${n}\nComplete offer description.`, oldPrice: 250, offerPrice: 200,
  imageUrl: "/test-image.png", startsAt: new Date(now - 1000).toISOString(), endsAt: new Date(now + 86400000).toISOString(), createdAt: "2026-11-20T10:00:00Z" });

async function mount(page: Page, options: { lang?: "ar" | "en"; empty?: boolean; mixedFirst?: boolean; expire?: boolean; failInitial?: string; hallOffer?: boolean; details?: boolean } = {}) {
  const calls: Array<{ filter: string; page: number; owner: string }> = [], profileCalls: string[] = [], writes: string[] = [];
  let failure: string | null = options.failInitial ?? null, failPage = 1, held: { filter: string; page: number } | null = null;
  const pending: Array<() => Promise<void>> = [];
  const saved = new Set<string>();
  const comments: Array<{ id: string; postId: string; text: string; authorUserId: string; authorName: string; createdAt: string }> = [];
  let commentReads = 0;
  await page.clock.install({ time: now });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) }).catch(() => undefined);
    if (p === "/community-test") return route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div></body></html>' });
    if (p === "/test-image.png") return route.fulfill({ contentType: "image/webp", body: fs.readFileSync(path.resolve("public/halls/featured-02.webp")) });
    if (p === "/test-font.ttf") return route.fulfill({ contentType: "font/ttf", body: fs.readFileSync(path.resolve("src/fonts/DINNextLTArabic-Regular.ttf")) });
    if (p === "/community/hero-flowers.webp") return route.fulfill({ contentType: "image/webp", body: fs.readFileSync(path.resolve("public/community/hero-flowers.webp")) });
    if (p.includes("/images/")) return route.fulfill({ contentType: "image/png", body: png });
    if (p.startsWith("/hero/")) return route.fulfill({ contentType: "image/webp", body: fs.readFileSync(path.resolve("public/hero/hall-slide-b.webp")) });
    if (p === "/api/v1/discover") {
      const filter = url.searchParams.get("filter")!, number = Number(url.searchParams.get("page")), size = Number(url.searchParams.get("pageSize"));
      const owner = request.headers().authorization ?? ""; calls.push({ filter, page: number, owner });
      const reply = async () => {
        if (failure === filter && number === failPage) return json({}, 500);
        const rows = options.empty ? [] : filter === "Offers" ? Array.from({ length: 14 }, (_, i) => offer(i + 1))
          : Array.from({ length: 26 }, (_, i) => options.mixedFirst && i < 12 ? { id: `hall-${i}`, contentType: "Hall" } : post(i + 1));
        const items = rows.slice((number - 1) * size, number * size).map(row => ({ ...row,
          ...(options.hallOffer && row.id === "offer-1" ? { contentType: "HallOffer", hallId: "hall-1", displayName: "Celebration Hall" } : {}),
          ...(options.expire && filter === "Offers" ? { endsAt: new Date(now + 10000).toISOString() } : {}),
          content: owner.includes("B-token") ? `B content ${row.id}` : "content" in row ? row.content : null }));
        return json({ items, pageNumber: number, pageSize: size, totalCount: rows.length, totalPages: Math.ceil(rows.length / size) });
      };
      if (held?.filter === filter && held.page === number) { pending.push(reply); return; }
      return reply();
    }
    if (p.startsWith("/api/v1/profile/")) {
      const id = p.split("/").pop()!; profileCalls.push(id);
      return json({ userId: id, role: "Photographer", isPubliclyAvailable: true, approvalStatus: "Approved", displayName: `Studio ${id}`, profilePictureUrl: "/test-image.png", posts: [], offers: [] });
    }
    if (p === "/api/v1/posts/post-1") return json({ ...post(1), images: [], ownerName: "Studio owner-1", ownerAvatarUrl: "/test-image.png", saveCount: 0 });
    if (p === "/api/v1/posts/post-1/comments") {
      if (request.method() === "POST") {
        writes.push(p); const created = { id: `comment-${comments.length + 1}`, postId: "post-1", text: request.postDataJSON().text,
          authorUserId: "A", authorName: "Account A", createdAt: new Date(now).toISOString() }; comments.push(created); return json(created);
      }
      commentReads++; return json({ items: comments, pageNumber: 1, pageSize: 30, totalCount: comments.length, totalPages: comments.length ? 1 : 0 });
    }
    if (/\/api\/v1\/offers\/offer-\d+$/.test(p)) return json({ ...offer(Number(p.split("-").pop())),
      content: "Full offer text\nSecond paragraph\nLast paragraph", images: [1, 2, 3].map(n => ({ id: `image-${n}`, order: n, url: `${p}/images/image-${n}` })) });
    if (p === "/api/v1/favorites" && request.method() === "GET") return json({ items: [...saved].map(id => ({ ...post(Number(id.split("-").pop())), id, images: [] })), pageNumber: 1, pageSize: 50, totalCount: saved.size, totalPages: saved.size ? 1 : 0 });
    if (/\/api\/v1\/posts\/[^/]+\/favorites$/.test(p)) { writes.push(p); const id = p.split("/").at(-2)!; if (request.method() === "POST") saved.add(id); else saved.delete(id); return route.fulfill({ status: 204 }); }
    if (p.endsWith("/conversation") || p === "/api/v1/halls/hall-1/conversations") { writes.push(p); return json({ conversationId: "conversation-1", kind: "CustomerProvider", hallId: "hall-1", providerUserId: "owner-1" }); }
    if (p.endsWith("/share-link")) return json({ shareLink: "/posts/post-1" });
    if (p.endsWith("/shares")) return route.fulfill({ status: 204 });
    throw new Error(`Unexpected request ${request.method()} ${p}`);
  });
  await page.goto(`http://localhost:3000/community-test?lang=${options.lang ?? "ar"}${options.details ? "&details=1" : ""}`);
  await page.addScriptTag({ content: bundle });
  expect(styles).toContain("container-wesal");
  await page.addStyleTag({ content: styles + "\n@font-face{font-family:WesalTest;src:url('/test-font.ttf')}body{font-family:WesalTest,Arial,sans-serif}" });
  if (options.details) await expect(page.getByTestId("post-details-post-1")).toBeVisible();
  else { await expect(page.getByTestId("posts-and-offers-page")).toBeVisible(); await expect.poll(() => calls.length).toBe(2); }
  return { calls, profileCalls, writes, pending, saved,
    commentReads: () => commentReads,
    fail(filter: string | null, number = 1) { failure = filter; failPage = number; },
    hold(filter: string, number: number) { held = { filter, page: number }; }, release() { held = null; return Promise.all(pending.splice(0).map(reply => reply())); } };
}

test("separate real feed contracts and shared publisher requests; no invented interaction counters", async ({ page }) => {
  const { calls, profileCalls } = await mount(page);
  await expect(page.getByTestId("community-offers-section").locator("article")).toHaveCount(6);
  await expect(page.getByTestId("community-posts-section").locator("article")).toHaveCount(6);
  expect(calls.map(call => call.filter).sort()).toEqual(["All", "Offers"]);
  await expect(page.getByText("Studio owner-1").first()).toBeVisible();
  expect(profileCalls.sort()).toEqual(["owner-0", "owner-1"]);
  await expect(page.getByTestId("community-post-post-1")).not.toContainText("91");
});

test("view all and load more retain ordering without duplicates or automatic full collection", async ({ page }) => {
  const { calls } = await mount(page);
  const section = page.getByTestId("community-posts-section");
  await section.getByRole("button", { name: ar["community.posts.all"], exact: true }).click();
  await expect(section.locator("article")).toHaveCount(12);
  await section.getByRole("button", { name: ar["content.pagination.more"], exact: true }).click();
  await expect(section.locator("article")).toHaveCount(24);
  await section.getByRole("button", { name: ar["content.pagination.more"], exact: true }).click();
  await expect(section.locator("article")).toHaveCount(26);
  expect(calls.filter(call => call.filter === "All").map(call => call.page)).toEqual([1, 2, 3]);
  await expect(section.getByRole("button", { name: ar["content.pagination.more"], exact: true })).toHaveCount(0);
});

test("posts beyond a mixed page of halls remain reachable", async ({ page }) => {
  await mount(page, { mixedFirst: true });
  const section = page.getByTestId("community-posts-section");
  await expect(section.getByText(ar["community.exploreMore"])).toBeVisible();
  await section.getByRole("button", { name: ar["content.pagination.more"], exact: true }).click();
  await expect(section.locator("article")).toHaveCount(12);
  await expect(section.getByTestId("community-post-post-13")).toBeVisible();
});

test("a failed later page preserves content and retries the same page once", async ({ page }) => {
  const api = await mount(page);
  const section = page.getByTestId("community-posts-section");
  api.fail("All", 2);
  await section.getByRole("button", { name: ar["content.pagination.more"], exact: true }).click();
  await expect(section.getByRole("alert")).toBeVisible();
  await expect(section.locator("article")).toHaveCount(12);
  api.fail(null);
  await section.getByRole("button", { name: ar["common.retry"], exact: true }).click();
  await expect(section.locator("article")).toHaveCount(24);
  expect(api.calls.filter(call => call.filter === "All").map(call => call.page)).toEqual([1, 2, 2]);
});

test("professional offer preview preserves full text and all images without leaving the page", async ({ page }) => {
  await mount(page);
  const original = page.url();
  await page.getByTestId("community-offer-offer-1").getByRole("button", { name: ar["offers.card.viewDetails"], exact: true }).click();
  const dialog = page.getByTestId("professional-offer-details");
  await expect(dialog.getByTestId("professional-offer-full-text")).toHaveText("Full offer text\nSecond paragraph\nLast paragraph");
  await dialog.getByRole("button", { name: ar["posts.nextImage"], exact: true }).click();
  await expect(dialog.getByTestId("content-gallery-count")).toHaveText("2/3");
  await dialog.getByRole("button", { name: ar["posts.nextImage"], exact: true }).click();
  await expect(dialog.getByTestId("content-gallery-count")).toHaveText("3/3");
  expect(page.url()).toBe(original);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
});

test("guest favorites preserve login behavior and post details links", async ({ page }) => {
  await mount(page);
  const card = page.getByTestId("community-post-post-1");
  await expect(card.locator(".community-caption")).toHaveAttribute("href", "/posts/post-1");
  await expect(card.locator(".community-cover").getByTestId("post-favorite-button")).toHaveCount(0);
  await card.locator(".community-post-actions").getByTestId("post-favorite-button").click();
  expect(await page.evaluate("navigations[0]")).toBe("/login?redirect=%2Fposts%2Fpost-1");
});

test("account-scoped favorites continue saving and removing through existing APIs", async ({ page }) => {
  const api = await mount(page);
  await page.evaluate("actions.login('A')");
  const button = page.getByTestId("community-post-post-1").getByTestId("post-favorite-button");
  await expect(button).toHaveAttribute("data-favorite-state", "unsaved");
  await button.click(); await expect(button).toHaveAttribute("data-favorite-state", "saved");
  await button.click(); await expect(button).toHaveAttribute("data-favorite-state", "unsaved");
  expect(api.writes).toEqual(["/api/v1/posts/post-1/favorites", "/api/v1/posts/post-1/favorites"]);
});

test("late page responses cannot restore another account's content", async ({ page }) => {
  const api = await mount(page); await page.evaluate("actions.login('A')");
  await expect.poll(() => api.calls.length).toBe(4);
  api.hold("All", 2);
  const section = page.getByTestId("community-posts-section");
  await section.getByRole("button", { name: ar["content.pagination.more"], exact: true }).click();
  await expect.poll(() => api.pending.length).toBe(1);
  await page.evaluate("actions.login('B')");
  await expect(section.getByTestId("community-post-post-1")).toContainText("B content post-1");
  await api.release();
  await expect(section.locator("article")).toHaveCount(12);
  await expect(section.getByTestId("community-post-post-13")).toHaveCount(0);
});

test("offer expiration removes public cards automatically", async ({ page }) => {
  await mount(page, { expire: true });
  const section = page.getByTestId("community-offers-section");
  await expect(section.locator("article")).toHaveCount(6);
  await page.clock.fastForward(10001);
  await expect(section.locator("article")).toHaveCount(0);
});

test("independent empty states do not show fabricated cards", async ({ page }) => {
  await mount(page, { empty: true });
  await expect(page.getByText(ar["community.offers.empty"])).toBeVisible();
  await expect(page.getByText(ar["community.posts.empty"])).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
});

test("an initial section error leaves the other section usable and retries independently", async ({ page }) => {
  const api = await mount(page, { failInitial: "Offers" });
  const offers = page.getByTestId("community-offers-section");
  await expect(offers.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("community-posts-section").locator("article")).toHaveCount(6);
  api.fail(null);
  await offers.getByRole("button", { name: ar["common.retry"], exact: true }).click();
  await expect(offers.locator("article")).toHaveCount(6);
  expect(api.calls.filter(call => call.filter === "All")).toHaveLength(1);
});

test("repeated load-more clicks share one request for the next page", async ({ page }) => {
  const api = await mount(page);
  api.hold("All", 2);
  const button = page.getByTestId("community-posts-section").getByRole("button", { name: ar["content.pagination.more"], exact: true });
  await button.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); element.click(); });
  await expect.poll(() => api.pending.length).toBe(1);
  await api.release();
  await expect(page.getByTestId("community-posts-section").locator("article")).toHaveCount(24);
  expect(api.calls.filter(call => call.filter === "All" && call.page === 2)).toHaveLength(1);
});

test("hall offer links and messaging use the hall contract", async ({ page }) => {
  const api = await mount(page, { hallOffer: true });
  await page.evaluate("actions.login('A')");
  const card = page.getByTestId("community-offer-offer-1");
  await expect(card.locator(".community-profile-link")).toHaveAttribute("href", "/halls/hall-1");
  const contact = card.getByTestId("hall-contact-button");
  await expect(contact).toHaveAttribute("aria-label", ar["halls.contact.aria"]);
  await contact.click();
  await expect.poll(() => api.writes).toContain("/api/v1/halls/hall-1/conversations");
  expect(api.writes.some(p => p.startsWith("/api/v1/offers/"))).toBe(false);
});

for (const lang of ["ar", "en"] as const) {
  test(`${lang}: post details have three icon actions and comments open on demand without losing a draft`, async ({ page }) => {
    const api = await mount(page, { details: true, lang });
    const details = page.getByTestId("post-details-post-1"), actions = page.getByTestId("post-details-actions");
    await expect(actions.getByRole("button")).toHaveCount(3);
    await expect(actions).toHaveText("");
    await expect(details.getByTestId("post-inquiry-button")).toHaveCount(0);
    await expect(details.getByRole("link", { name: (lang === "ar" ? ar : en)["posts.viewPublisher"], exact: true })).toHaveCount(0);
    await expect(details.getByTestId("post-comment-section")).toHaveCount(0); expect(api.commentReads()).toBe(0);
    const toggle = details.getByTestId("post-comments-toggle"); await toggle.focus(); await page.keyboard.press("Enter");
    const section = details.getByTestId("post-comment-section"), input = section.locator("textarea");
    await expect(toggle).toHaveAttribute("aria-expanded", "true"); await expect(section).toBeVisible(); await expect(input).toBeFocused();
    await input.fill("Keep this draft"); await toggle.click(); await expect(section).toBeHidden();
    await toggle.click(); await expect(input).toHaveValue("Keep this draft"); expect(api.commentReads()).toBe(1);
  });
}

test("the revealed comment form submits using the existing API and updates the list", async ({ page }) => {
  const api = await mount(page, { details: true }); await page.evaluate("actions.login('A')");
  await page.getByTestId("post-comments-toggle").click();
  const section = page.getByTestId("post-comment-section");
  await section.locator("textarea").fill("A real new comment");
  await section.getByRole("button", { name: ar["posts.comments.send"], exact: true }).click();
  await expect(section.getByText("A real new comment", { exact: true })).toBeVisible();
  await expect(section.locator("textarea")).toHaveValue("");
  expect(api.writes.filter(p => p.endsWith("/comments"))).toHaveLength(1);
});

test("guest comment submission still requires login", async ({ page }) => {
  const api = await mount(page, { details: true }); await page.getByTestId("post-comments-toggle").click();
  const section = page.getByTestId("post-comment-section"); await section.locator("textarea").fill("Guest draft");
  await section.getByRole("button", { name: ar["posts.comments.send"], exact: true }).click();
  expect(await page.evaluate("navigations[0]")).toBe("/login?redirect=%2Fposts%2Fpost-1"); expect(api.writes).toHaveLength(0);
});

test("the icon-only share button copies the existing post link", async ({ page }) => {
  await mount(page, { details: true });
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: (text: string) => { Object.assign(window, { copiedPostLink: text }); return Promise.resolve(); },
  } }));
  const share = page.getByTestId("post-share-button"); await expect(share).toHaveAccessibleName(ar["posts.share.label"]);
  await expect(share).toHaveText(""); await share.click();
  await expect.poll(() => page.evaluate("copiedPostLink")).toBe("http://localhost:3000/posts/post-1");
});

for (const lang of ["ar", "en"] as const) for (const width of [390, 768, 1366]) {
  test(`${lang} at ${width}px: theme, sections, carousel and responsive direction`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mount(page, { lang });
    const catalog = lang === "ar" ? ar : en;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(catalog["community.title"]);
    await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    const section = page.getByTestId("community-offers-section"), rail = section.locator(".community-rail");
    await section.getByRole("button", { name: catalog["community.next"], exact: true }).click();
    await page.clock.runFor(500);
    await expect.poll(() => rail.evaluate(element => Math.abs(element.scrollLeft))).toBeGreaterThan(50);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1366) await page.screenshot({ path: `.next/community-${lang}-desktop.png`, fullPage: true });
  });
}
