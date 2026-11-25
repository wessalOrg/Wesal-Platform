import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import ar from "../src/i18n/messages/ar";

let bundle = "", styles = "";
const sources = ["Halls", "EventCoordinators", "Photographers"] as const;
const types = { Halls: "Hall", EventCoordinators: "EventCoordinator", Photographers: "Photographer" };
const rows = (filter: typeof sources[number]) => Array.from({ length: filter === "Halls" ? 62 : 17 }, (_, index) => ({
  id: `${filter}-${String(index).padStart(3, "0")}`, contentType: types[filter], hallId: filter === "Halls" ? `hall-${index}` : null,
  ownerUserId: `owner-${filter}-${index}`, displayName: `${filter} ${index}`, imageUrl: null,
  createdAt: new Date(Date.UTC(2026, 10, 25, 10, 0, 60 - index)).toISOString(),
}));

test.beforeAll(async () => {
  const chunks = path.resolve(".next/static/chunks");
  styles = fs.readdirSync(chunks).filter(file => file.endsWith(".css")).map(file => fs.readFileSync(path.join(chunks, file), "utf8"))
    .filter(css => css.includes(".container-wesal")).join("\n");
  const mocks: Record<string, string> = {
    "next/navigation": "const router={replace:p=>window.redirects.push(p),push:p=>window.redirects.push(p)};export const useRouter=()=>router;export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);",
    "next/link": "export default function Link({children,prefetch,...props}){return <a {...props}>{children}</a>}",
    "@/components/auth/AuthProvider": "export const useAuth=()=>({session:{isAuthenticated:false,role:null},status:'ready'});",
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>window.lang;",
    "@/components/brand/MabroukFigure": "export default()=>null;",
    "@/i18n": `import ar from'./src/i18n/messages/ar';import en from'./src/i18n/messages/en';export const t=(key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),(window.lang==='ar'?ar:en)[key]??key);export const useT=()=>t;`,
    "@/lib/api": `import{ApiError}from'@/lib/api-error';export const apiOrigin=()=>location.origin;export default{async get(p,c={}){const url=new URL('/api/v1'+p,location.origin);Object.entries(c.params||{}).forEach(([k,v])=>url.searchParams.set(k,String(v)));const r=await fetch(url);if(!r.ok)throw new ApiError('discover.errors.loadFailed',r.status);return{data:await r.json()}}};`,
  };
  const result = await build({ stdin: { contents: `import React from'react';import{createRoot}from'react-dom/client';import View from'./src/components/discover/DiscoverPageView';window.lang=new URLSearchParams(location.search).get('lang')||'ar';document.documentElement.dir=lang==='ar'?'rtl':'ltr';window.redirects=[];createRoot(document.getElementById('root')).render(<View/>);`, resolveDir: process.cwd(), loader: "tsx" },
    platform: "browser", bundle: true, write: false, jsx: "automatic", loader: { ".css": "empty" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "directory", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], resolveDir: process.cwd(), loader: "tsx" }));
    } }],
  }); bundle = result.outputFiles[0].text;
});

async function mount(page: Page, query = "", failInitially = "") {
  let failed = failInitially, held = "";
  const calls: Array<{ filter: string; page: number; size: number; query: string; endpoint: string }> = [], pending: Array<() => Promise<void>> = [];
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/directory-test") return route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div></body></html>' });
    if (url.pathname === "/api/v1/discover" || url.pathname === "/api/v1/search") {
      const filter = url.searchParams.get("filter")!, number = Number(url.searchParams.get("page")), size = Number(url.searchParams.get("pageSize")), term = url.searchParams.get("query") || "";
      calls.push({ filter, page: number, size, query: term, endpoint: url.pathname });
      if (!sources.includes(filter as typeof sources[number])) throw Error(`Unsupported directory filter ${filter}`);
      const reply = async () => {
        const records = rows(filter as typeof sources[number]).filter(row => !term || row.displayName.includes(term));
        await route.fulfill({ status: failed === filter ? 500 : 200, contentType: "application/json", body: JSON.stringify({
          items: records.slice((number - 1) * size, number * size), pageNumber: number, pageSize: size, totalCount: records.length, totalPages: Math.ceil(records.length / size),
        }) });
      };
      if (held === filter) { pending.push(reply); return; }
      return reply();
    }
    return route.abort();
  });
  await page.goto(`http://localhost:3000/directory-test${query}`);
  await page.addScriptTag({ content: bundle }); await page.addStyleTag({ content: styles });
  return { calls, pending, fail(value: string) { failed = value; }, hold(value: string) { held = value; },
    async release() { held = ""; await Promise.all(pending.splice(0).map(reply => reply())); } };
}
const cards = (page: Page) => page.getByTestId("discover-explore-grid").locator("article");

test("All combines only the three directory types and authoritative totals", async ({ page }) => {
  const api = await mount(page);
  await expect(cards(page)).toHaveCount(12);
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByTestId("discover-filter-Offers")).toHaveCount(0);
  await expect(page.getByText(ar["discover.resultsFound"].replace("{count}", "96"))).toBeVisible();
  expect(api.calls.map(call => call.filter).sort()).toEqual([...sources].sort());
  const ids = await cards(page).evaluateAll(elements => elements.map(e => e.getAttribute("data-testid")));
  for (const source of sources) expect(ids.some(id => id?.includes(source))).toBe(true);
});

for (const filter of sources) test(`${filter} returns only that content type and resets pagination`, async ({ page }) => {
  const api = await mount(page);
  await expect(cards(page)).toHaveCount(12);
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByTestId(`discover-filter-${filter}`).click();
  await expect(page.getByRole("button", { name: "1", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(cards(page)).toHaveCount(12);
  expect(await cards(page).evaluateAll(elements => elements.every(e => e.getAttribute("data-testid")?.includes("discover-card-")))).toBe(true);
  const ids = await cards(page).evaluateAll(elements => elements.map(e => e.getAttribute("data-testid")));
  expect(ids.every(id => id?.includes(filter))).toBe(true);
  expect(api.calls.at(-1)).toMatchObject({ filter, page: 1, size: 12 });
});

test("later All pages preserve global ordering without missing rows or refetching cached prefixes", async ({ page }) => {
  const api = await mount(page);
  await expect(cards(page)).toHaveCount(12);
  await page.getByRole("button", { name: "5", exact: true }).click();
  await expect(page.getByRole("button", { name: "5", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(cards(page)).toHaveCount(12);
  const expected = sources.flatMap(source => rows(source)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    || a.contentType.localeCompare(b.contentType) || a.id.localeCompare(b.id)).slice(48, 60).map(row => `discover-card-${row.id}`);
  expect(await cards(page).evaluateAll(elements => elements.map(e => e.getAttribute("data-testid")))).toEqual(expected);
  expect(api.calls).toHaveLength(4); expect(api.calls.at(-1)).toMatchObject({ filter: "Halls", page: 2, size: 50 });
});

test("All search queries each supported source; specific search keeps its filter", async ({ page }) => {
  const api = await mount(page); await expect(cards(page)).toHaveCount(12);
  await page.getByTestId("discover-search-input").fill("Photographers"); await page.getByTestId("discover-search-submit").click();
  await expect(cards(page)).toHaveCount(12);
  await expect(page.getByText(ar["discover.resultsFound"].replace("{count}", "17"))).toBeVisible();
  expect(api.calls.filter(call => call.endpoint.endsWith("/search")).map(call => call.filter).sort()).toEqual([...sources].sort());
  await page.getByTestId("discover-filter-Halls").click();
  await expect(cards(page)).toHaveCount(0);
  expect(api.calls.at(-1)).toMatchObject({ filter: "Halls", query: "Photographers", page: 1 });
});

test("late responses from a previous filter cannot replace the selected results", async ({ page }) => {
  const api = await mount(page); await expect(cards(page)).toHaveCount(12);
  api.hold("Halls"); await page.getByTestId("discover-filter-Halls").click();
  await expect.poll(() => api.pending.length).toBe(1);
  await page.getByTestId("discover-filter-Photographers").click(); await expect(cards(page)).toHaveCount(12);
  await api.release();
  expect(await cards(page).evaluateAll(elements => elements.every(e => e.getAttribute("data-testid")?.includes("Photographers")))).toBe(true);
});

test("partial All failure shows an error instead of an incomplete total and retries safely", async ({ page }) => {
  const api = await mount(page, "", "Photographers");
  await expect(page.getByRole("alert")).toBeVisible(); await expect(cards(page)).toHaveCount(0);
  api.fail(""); await page.getByRole("button", { name: ar["common.retry"], exact: true }).click();
  await expect(cards(page)).toHaveCount(12);
  expect(api.calls.filter(call => call.filter === "Halls")).toHaveLength(1);
  expect(api.calls.filter(call => call.filter === "Photographers")).toHaveLength(2);
});

test("old offers URLs move to the dedicated posts and offers page", async ({ page }) => {
  const api = await mount(page, "?filter=Offers&offer=old-offer");
  await expect.poll(() => page.evaluate("redirects[0]")).toBe("/posts-and-offers"); expect(api.calls).toHaveLength(0);
});

for (const lang of ["ar", "en"]) for (const width of [390, 1366]) test(`${lang} ${width}px: only directory filters and responsive cards`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page, `?lang=${lang}`); await expect(cards(page)).toHaveCount(12);
  await expect(page.getByRole("tab")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('[data-testid="discover-card-Halls-000"] a').first()).toHaveAttribute("href", "/halls/hall-0");
});
