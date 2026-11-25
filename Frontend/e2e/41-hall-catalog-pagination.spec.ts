import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

let bundle: string;
let catalogCss = "";
test.beforeAll(async () => {
  const chunks = path.resolve(".next/static/chunks");
  if (fs.existsSync(chunks)) catalogCss = fs.readdirSync(chunks).filter(f => f.endsWith(".css"))
    .map(file => fs.readFileSync(path.join(chunks, file), "utf8"))
    .filter(css => css.includes(".container-wesal")).join("\n");
  const mocks: Record<string, string> = {
    "next/navigation": `import{useSyncExternalStore}from'react';
      const listen=f=>{window.addEventListener('test-url',f);return()=>window.removeEventListener('test-url',f)};
      const router={replace(url){history.replaceState({},'',url);window.dispatchEvent(new Event('test-url'))},push(url){window.navigation=url}};
      export const useRouter=()=>router;export const usePathname=()=>'/catalog-test';
      export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(listen,()=>location.search));`,
    "next/link": "import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}",
    "next/dynamic": `import React from'react';export default()=>function Details({hallId,onClose}){return React.createElement('div',{role:'dialog'},hallId,React.createElement('button',{onClick:onClose},'Close'))}`,
    "@/components/halls/HallMedia": "export default()=>null;",
    "@/components/halls/HallDetailsView": "export default()=>null;",
    "@/components/auth/AuthProvider": `import{useSyncExternalStore}from'react';import{readAuthenticatedAccount,subscribeAuthenticatedAccount}from'@/lib/authenticated-account';
      export function useAuth(){const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount);return{status:'ready',session:{isAuthenticated:!!account,role:account?'RegisteredUser':null}}}`,
    "@/components/layout/LanguageProvider": `import{useSyncExternalStore}from'react';const listen=f=>{window.addEventListener('test-lang',f);return()=>window.removeEventListener('test-lang',f)};
      export const useUiLang=()=>useSyncExternalStore(listen,()=>window.testLang);`,
    "@/hooks/useHallCatalogs": "export const useHallCatalogs=()=>({addressesByRegion:{gaza:['Center']},features:[]});",
    "@/lib/demo-mode": "export const isDemoModeEnabled=()=>false;",
    "@/services/hall-favorites": `export const hasHallFavoritesSession=()=>true;export const fetchFavoriteHallIds=async()=>[];
      export const addFavoriteHall=async id=>{window.favoriteRequests.push(['add',id])};export const removeFavoriteHall=async id=>{window.favoriteRequests.push(['remove',id])};`,
    "@/lib/api": `import{getStoredAuth}from'@/lib/auth-storage';export const apiOrigin=()=>location.origin;
      const api={get(path,config={}){const params=config.params||{};const call={path,params,signal:config.signal,owner:getStoredAuth()?.user?.id};window.catalogCalls.push(call);
        return new Promise((resolve,reject)=>{call.resolve=data=>resolve({data:data??window.catalogResponse(params)});call.reject=()=>reject(new Error('HTTP 500'));
          config.signal?.addEventListener('abort',()=>{call.aborted=true;if(!window.ignoreAbort)reject(new Error('cancelled'))});
          if(!window.deferCatalog){if(window.failCatalog)call.reject();else call.resolve()}
        })}};export default api;`,
  };
  const result = await build({
    stdin: { resolveDir: process.cwd(), contents: `import React from'react';import{createRoot}from'react-dom/client';
      import View from'./src/components/halls/HallsCatalogView';import{fetchSearchHalls}from'./src/services/halls';
      import{notifyPublicHallsChanged}from'./src/lib/public-halls-events';import{setAccessToken}from'./src/lib/auth-token';
      import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';
      window.catalogCalls=[];window.favoriteRequests=[];window.testLang='ar';window.total=31;
      window.catalogResponse=params=>{const pageNumber=Number(params.pageNumber)||1,pageSize=Math.min(50,Number(params.pageSize)||12);
        let halls=Array.from({length:window.total},(_,i)=>({hallId:'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'),hallName:'Hall '+(i+1),mainImage:null,region:'Gaza',address:'Center',capacity:100,price:250,description:'Available hall'}));
        if(params.name)halls=halls.filter(x=>x.hallName.includes(params.name));
        if(params.detailedAddress)halls=halls.filter((_,i)=>i>=10);
        if(params.area&&params.area!=='Center')halls=[];
        if(params.region&&params.region!=='Gaza')halls=[];
        const totalCount=halls.length,totalPages=Math.ceil(totalCount/pageSize);
        return{items:halls.slice((pageNumber-1)*pageSize,pageNumber*pageSize),pageNumber,pageSize,totalCount,totalPages,hasPreviousPage:pageNumber>1,hasNextPage:pageNumber<totalPages}};
      window.actions={refresh:notifyPublicHallsChanged,logout:clearAuthSession,search:fetchSearchHalls,
        login(id){const token=id+'-token';setAccessToken(token);setStoredAuth({token,user:{id,role:'RegisteredUser'}})},
        language(lang){window.testLang=lang;document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';window.dispatchEvent(new Event('test-lang'))}};
      actions.language(new URLSearchParams(location.search).get('lang')||'ar');
      createRoot(document.getElementById('root')).render(React.createElement(View));` },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "catalog-contract", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], resolveDir: process.cwd(), loader: "tsx" }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const card = (page: Page, n: number) => page.getByTestId(`hall-card-${id(n)}`);
async function mount(page: Page, query = "", deferred = false, withStyles = false) {
  await page.route("**/*", route => {
    // Fonts and other real assets are outside this isolated contract test; never leave their requests pending.
    if (new URL(route.request().url()).pathname !== "/catalog-test") return route.abort();
    return route.fulfill({ contentType: "text/html", body: '<html><div id="root"></div></html>' });
  });
  await page.goto(`http://localhost:3000/catalog-test${query}`);
  await page.evaluate(value => { Object.assign(window, { deferCatalog: value }); }, deferred);
  if (withStyles) {
    expect(catalogCss, "Run the production build before responsive catalog tests").toContain("container-wesal");
    await page.addStyleTag({ content: catalogCss });
  }
  await page.addScriptTag({ content: bundle });
}

test("31 halls use authoritative totals and server pages beyond the first 12", async ({ page }) => {
  await mount(page);
  await expect(page.getByTestId("halls-catalog")).toContainText("31");
  await page.getByTestId("halls-page-3").click();
  await expect(card(page, 13)).toBeVisible();
  await expect(card(page, 1)).toHaveCount(0);
  await page.getByTestId("halls-page-6").click();
  await expect(card(page, 31)).toBeVisible();
  await expect(card(page, 31)).toHaveCSS("animation-delay", "0s");
  await expect(page.getByTestId("halls-next-page")).toBeDisabled();
  expect(await page.evaluate("catalogCalls.map(x=>x.params.pageNumber)")).toEqual([1, 3, 6]);
});

test("filtered search stays server-side even when list DTOs omit detailedAddress", async ({ page }) => {
  await mount(page, "?region=gaza&address=Center&detailed_address=garden");
  await expect(card(page, 11)).toBeVisible();
  await page.getByTestId("halls-page-2").click();
  await expect(card(page, 17)).toBeVisible();
  expect(await page.evaluate("catalogCalls.at(-1).params")).toMatchObject({ pageNumber: 2, pageSize: 6, area: "Center", detailedAddress: "garden", region: "Gaza" });
  expect(await page.evaluate("catalogCalls.every(x=>x.path==='/halls/search')")).toBe(true);
});

test("changing a filter on a later page resets to page one and keeps the debounce", async ({ page }) => {
  await mount(page);
  await page.getByTestId("halls-page-3").click();
  await expect(card(page, 13)).toBeVisible();
  await page.locator("#halls-filter-detailed-address").fill("garden");
  await expect(card(page, 11)).toBeVisible();
  expect(await page.evaluate("catalogCalls.at(-1).params.pageNumber")).toBe(1);
  await expect(page.getByTestId("halls-page-1")).toHaveAttribute("aria-current", "page");
});

test("late page responses are cancelled and cannot replace a newer page", async ({ page }) => {
  await mount(page);
  await expect(card(page, 1)).toBeVisible();
  await page.evaluate("deferCatalog=true;ignoreAbort=true");
  await page.getByTestId("halls-page-2").click();
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(2);
  await page.getByTestId("halls-page-3").click();
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(3);
  await page.evaluate("catalogCalls[2].resolve()");
  await expect(card(page, 13)).toBeVisible();
  await page.evaluate("catalogCalls[1].resolve()");
  await expect(card(page, 13)).toBeVisible();
  expect(await page.evaluate("catalogCalls[1].aborted")).toBe(true);
});

test("an empty result has no phantom pages", async ({ page }) => {
  await mount(page, "", true);
  await page.evaluate("total=0;catalogCalls[0].resolve()");
  await expect(page.getByTestId("halls-search-empty")).toBeVisible();
  await expect(page.getByTestId("halls-next-page")).toHaveCount(0);
});

test("a failed search stays filtered and retry uses the same request", async ({ page }) => {
  await mount(page, "?detailed_address=garden", true);
  await page.evaluate("catalogCalls[0].reject()");
  await expect(page.getByTestId("halls-catalog-error")).toBeVisible();
  await page.getByTestId("halls-catalog-retry").click();
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(2);
  await page.evaluate("catalogCalls[1].resolve()");
  await expect(card(page, 11)).toBeVisible();
  expect(await page.evaluate("catalogCalls.map(x=>x.path)")).toEqual(["/halls/search", "/halls/search"]);
});

test("refresh keeps the current page and corrects a page removed by a smaller total", async ({ page }) => {
  await mount(page);
  await page.getByTestId("halls-page-6").click();
  await expect(card(page, 31)).toBeVisible();
  await page.evaluate("actions.refresh()");
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(3);
  expect(await page.evaluate("catalogCalls.at(-1).params.pageNumber")).toBe(6);
  await page.evaluate("total=8;actions.refresh()");
  await expect(card(page, 7)).toBeVisible();
  expect(await page.evaluate("catalogCalls.at(-1).params.pageNumber")).toBe(2);
});

test("account switching ignores the previous account's delayed response", async ({ page }) => {
  await mount(page, "", true);
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(1);
  await page.evaluate("ignoreAbort=true;actions.login('A')");
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(2);
  await page.evaluate("actions.login('B')");
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(3);
  await page.evaluate("catalogCalls[2].resolve();catalogCalls[1].reject();catalogCalls[0].resolve()");
  await expect(card(page, 1)).toBeVisible();
  await expect(page.getByTestId("halls-catalog-error")).toHaveCount(0);
  expect(await page.evaluate("catalogCalls[2].owner")).toBe("B");
});

test("old filter errors cannot replace newer filtered results", async ({ page }) => {
  await mount(page);
  await expect(card(page, 1)).toBeVisible();
  await page.evaluate("deferCatalog=true;ignoreAbort=true");
  await page.getByTestId("halls-page-3").click();
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(2);
  await page.locator("#halls-filter-detailed-address").fill("garden");
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(3);
  await page.evaluate("catalogCalls[2].resolve();catalogCalls[1].reject()");
  await expect(card(page, 11)).toBeVisible();
  await expect(page.getByTestId("halls-catalog-error")).toHaveCount(0);
  expect(await page.evaluate("catalogCalls[1].aborted")).toBe(true);
});

test("refresh errors retain the current page and language changes do not refetch it", async ({ page }) => {
  await mount(page);
  await page.getByTestId("halls-page-2").click();
  await expect(card(page, 7)).toBeVisible();
  await page.evaluate("actions.language('en')");
  await expect(page.getByTestId("halls-next-page")).toHaveAttribute("aria-label", /next/i);
  expect(await page.evaluate("catalogCalls.length")).toBe(2);
  await page.evaluate("deferCatalog=true;actions.refresh()");
  await expect.poll(() => page.evaluate("catalogCalls.length")).toBe(3);
  await expect(card(page, 7)).toBeVisible();
  await page.evaluate("catalogCalls[2].reject()");
  await expect(page.getByTestId("halls-catalog-error")).toBeVisible();
  await expect(card(page, 7)).toBeVisible();
});

test("search forwards supported name, date and pagination with the backend size cap", async ({ page }) => {
  await mount(page);
  await expect(card(page, 1)).toBeVisible();
  const result = await page.evaluate("(async()=>{total=121;return actions.search({name:'Hall',date:'2030-06-15',pageNumber:2,pageSize:1000})})()");
  expect(result).toMatchObject({ pagination: { pageNumber: 2, pageSize: 50, totalCount: 121, totalPages: 3 } });
  expect(await page.evaluate("catalogCalls.at(-1).params")).toEqual({ name: "Hall", date: "2030-06-15", pageNumber: 2, pageSize: 50 });
});

test("missing total metadata produces an error instead of inventing a catalog count", async ({ page }) => {
  await mount(page, "", true);
  await page.evaluate("catalogCalls[0].resolve({items:catalogResponse({}).items})");
  await expect(page.getByTestId("halls-catalog-error")).toBeVisible();
  await expect(card(page, 1)).toHaveCount(0);
  await expect(page.getByTestId("halls-page-2")).toHaveCount(0);
});

for (const lang of ["ar", "en"]) for (const width of [390, 1366]) {
  test(`${lang} at ${width}px: pagination, details and favorites remain usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, `?lang=${lang}`, false, true);
    await expect(card(page, 1)).toBeVisible();
    await page.getByTestId(`hall-card-favorite-${id(1)}`).click();
    expect(await page.evaluate("navigation")).toContain("/login?redirect=");
    await page.evaluate("actions.login('A')");
    await page.getByTestId(`hall-card-favorite-${id(1)}`).click();
    await expect(page.getByTestId(`hall-card-favorite-${id(1)}`)).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate("favoriteRequests")).toEqual([["add", id(1)]]);
    await card(page, 1).getByRole("button", { name: "Hall 1", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toContainText(id(1));
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByTestId("halls-next-page").focus();
    await page.keyboard.press("Enter");
    await expect(card(page, 7)).toBeVisible();
    await expect(card(page, 7).getByRole("link")).toHaveAttribute("href", new RegExp(`/halls/${id(7)}`));
    expect(await page.evaluate("document.documentElement.dir")).toBe(lang === "ar" ? "rtl" : "ltr");
    expect(await page.evaluate("document.documentElement.scrollWidth<=innerWidth")).toBe(true);
  });
}
