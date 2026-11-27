import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

const postId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let bundle: string;
let styles = "";
test.beforeAll(async () => {
  const cssDir = path.resolve(".next/static/chunks");
  for (const name of await readdir(cssDir)) if (name.endsWith(".css")) {
    const css = await readFile(path.join(cssDir, name), "utf8");
    if (css.includes(".container-wesal")) styles += css;
  }
  const mocks: Record<string, string> = {
    "next/navigation": "const router={push:p=>window.navigations.push(p),replace(){}};export const useRouter=()=>router;",
    "next/link": "export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}",
    "next/image": "export default function Image({src,alt}){return <img src={src} alt={alt}/>}",
    "@/components/auth/AuthProvider": `import{useSyncExternalStore}from'react';import{readAuthenticatedAccount,subscribeAuthenticatedAccount,serverAuthenticatedAccount}from'./src/lib/authenticated-account';import{getStoredAuth}from'./src/lib/auth-storage';
      export function useAuth(){const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount,serverAuthenticatedAccount);return{session:{isAuthenticated:!!account,role:getStoredAuth()?.user.role??null,userName:account?.userId??null},status:'ready'}}`,
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>window.lang;",
    "@/i18n": `import ar from'./src/i18n/messages/ar';import en from'./src/i18n/messages/en';export const t=(key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),(window.lang==='ar'?ar:en)[key]??key);export const useT=()=>t;`,
    "@/lib/api": `export const apiOrigin='http://localhost:3000';export default{get:(p,c)=>window.apiRequest('GET',p,c).then(data=>({data})),post:p=>window.apiRequest('POST',p).then(data=>({data})),delete:p=>window.apiRequest('DELETE',p).then(data=>({data}))};`,
    "@/services/public-profile": "export const fetchPublicProfessionalProfile=async()=>({role:'Photographer',displayName:'Professional',profilePictureUrl:null});",
    "@/services/halls": "export const fetchHallById=async()=>({status:'missing'});",
    "@/services/hall-favorites": "export const hasHallFavoritesSession=()=>true;export const fetchFavoriteHallIds=async()=>[];export const addFavoriteHall=async()=>{};export const removeFavoriteHall=async()=>{};",
    "@/components/brand/MabroukFigure": "export default function Figure(){return null}",
    "@/components/posts/PostCommentSection": "export default function Comments(){return <div>Comments</div>}",
    "@/components/posts/PostInquiryButton": "export default function Inquiry(){return null}",
    "@/components/posts/PostActionsMenu": "export default function Actions(){return null}",
    "@/components/posts/PostShareButton": "export default function Share(){return null}",
  };
  const result = await build({
    stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import{setStoredAuth,getStoredAuth,clearAuthSession}from'./src/lib/auth-storage';import{setAccessToken}from'./src/lib/auth-token';
      import{ApiError}from'./src/lib/api-error';import{mapPost}from'./src/services/posts';
      import Details from'./src/components/posts/PostDetailsView';import FavoriteButton from'./src/components/posts/PostFavoriteButton';
      import Card from'./src/components/discover/DiscoverExploreCard';import Favorites from'./src/components/seeker-dashboard/SeekerFavoritesPage';
      import{useFavoritePostIds}from'./src/hooks/useFavoritePostIds';
      window.requests=[];window.navigations=[];window.hold={};window.fail={};window.badMetadata=false;
      const target=${JSON.stringify(postId)};
      window.login=(id,role=window.initialRole)=>{const token='test.'+btoa(JSON.stringify({sub:id,role,exp:Date.now()/1000+3600}))+'.test';setAccessToken(token);setStoredAuth({token,user:{id,name:id,role}})};
      window.logout=clearAuthSession;
      window.post=id=>({id,ownerUserId:'professional',content:id===target?'Complete post content':id,saveCount:8,shareCount:0,images:[],createdAt:'2026-01-01T10:00:00Z'});
      window.favorite=id=>({...window.post(id),ownerName:'Professional',ownerAvatarUrl:null,savedAt:'2026-01-01T12:00:00Z'});
      window.apiRequest=(method,path,config={})=>new Promise((resolve,reject)=>{
        const owner=getStoredAuth()?.user.id,params=config.params??{},number=params.page??1,size=params.pageSize??20;
        const ids=[...(window.server[owner]??[])],isList=path==='/favorites',isMutation=method!=='GET';
        const data=isList?(window.badMetadata?{items:[]}:{items:ids.slice((number-1)*size,number*size).map((id,index)=>({...window.favorite(id),savedAt:new Date(Date.UTC(2026,0,1,12)-((number-1)*size+index)*60000).toISOString()})),pageNumber:number,pageSize:size,totalCount:ids.length,totalPages:Math.ceil(ids.length/size)}):window.post(path.split('/').pop());
        const req={method,path,owner,params,data,done:false,finish:(failure=false,status=500)=>{if(req.done)return;req.done=true;
          if(failure){reject(new ApiError('PRIVATE BACKEND DETAIL',status));return;}
          if(isMutation){const id=path.split('/')[2],saved=window.server[owner]??[];window.server[owner]=method==='POST'?[id,...saved.filter(value=>value!==id)]:saved.filter(value=>value!==id)}
          resolve(data)} };window.requests.push(req);
        const failed=window.fail[method];if(failed)window.fail[method]--;
        if(!((isList&&window.hold.page===number)||(isMutation&&window.hold.mutation)))queueMicrotask(()=>req.finish(!!failed,window.failureStatus??500));
      });
      window.mapPost=mapPost;
      function Probe(){const favorites=useFavoritePostIds({hydrate:false});window.favorites=favorites;return <output id="state">{JSON.stringify({ids:[...favorites.ids],ready:favorites.ready,error:favorites.errorKey,pending:[...favorites.pending]})}</output>}
      function Harness(){const[shown,setShown]=useState(true),[tick,setTick]=useState(0),[details,setDetails]=useState(window.mode!=='favorites');window.rerender=()=>setTick(v=>v+1);
        return <main dir={window.lang==='ar'?'rtl':'ltr'} data-testid="workspace" data-tick={tick}>
          <button onClick={()=>setShown(false)}>Unmount</button><button onClick={()=>setShown(true)}>Remount</button><button onClick={()=>setDetails(true)}>Open details</button>
          {shown&&<><Probe/>{window.mode==='cards'?<><Card item={{id:target,contentType:'Post',displayName:'Post',content:'Post preview',location:null,imageUrl:null}} initialSaved={true}/><FavoriteButton postId={target} saveCount={8} initialSaved={true}/></>:
            <>{window.mode==='favorites'||window.mode==='combined'?<Favorites/>:null}{details&&<Details postId={target}/>}</>}
          </>}
        </main>}
      if(!window.guest)window.login('A');createRoot(document.getElementById('root')).render(<Harness/>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", loader: { ".css": "empty" }, tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "post-favorite-io", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  }); bundle = result.outputFiles[0].text;
});

type Request = { method: string; path: string; owner: string; params: { page?: number; pageSize?: number }; done: boolean; finish(failed?: boolean, status?: number): void };
type HarnessWindow = Window & {
  requests: Request[]; server: Record<string, string[]>; navigations: string[]; hold: { page?: number; mutation?: boolean }; fail: Record<string, number>;
  login(id: string, role?: string): void; logout(): void; rerender(): void;
  badMetadata: boolean; failureStatus?: number;
  favorites: { refresh(): Promise<void>; setSaved(id: string, saved: boolean): Promise<boolean>; captureRead(): unknown; observePage(page: unknown, read: unknown): void };
  mapPost(raw: unknown): { isSavedByCurrentUser: boolean | null };
};
type MountOptions = { mode?: string; lang?: string; role?: string; guest?: boolean; saved?: string[]; holdPage?: number; failure?: boolean; badMetadata?: boolean };
async function inject(page: Page, options: MountOptions) {
  await page.evaluate(({ mode = "details", lang = "en", role = "RegisteredUser", guest = false, saved = [], holdPage, failure, badMetadata }) => {
    Object.assign(window, { mode, lang, initialRole: role, guest, server: { A: saved, B: [] } });
    // Configuration is applied before React's passive effects issue API requests.
    Object.defineProperty(window, "hold", { configurable: true, get: () => windowHold, set: () => {} });
    const windowHold = { page: holdPage };
    Object.defineProperty(window, "fail", { configurable: true, get: () => windowFail, set: () => {} });
    const windowFail = { GET: failure ? 1 : 0 };
    if (badMetadata) Object.defineProperty(window, "badMetadata", { configurable: true, get: () => true, set: () => {} });
  }, options);
  await page.addStyleTag({ content: styles + "\noutput{display:block;overflow-wrap:anywhere}body{margin:0}" });
  await page.addScriptTag({ content: bundle });
}
async function mount(page: Page, options: MountOptions = {}) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
  await page.goto("http://localhost:3000/posts/" + postId);
  await inject(page, options); return errors;
}
async function pending(page: Page, method: string, route = "/favorites", number?: number, owner = "A") {
  const find = () => page.evaluate(({ method, route, number, owner }) => (window as HarnessWindow).requests.findIndex(r =>
    !r.done && r.method === method && r.path === route && r.owner === owner && (number === undefined || r.params.page === number)), { method, route, number, owner });
  await expect.poll(find).toBeGreaterThanOrEqual(0); return find();
}
async function finish(page: Page, index: number, failed = false, status = 500) {
  await page.evaluate(({ index, failed, status }) => (window as HarnessWindow).requests[index].finish(failed, status), { index, failed, status });
}
async function expectState(page: Page, saved: boolean) {
  await expect(page.getByTestId("post-favorite-button").first()).toHaveAttribute("aria-pressed", String(saved));
}
const many = Array.from({ length: 150 }, (_, index) => "bbbbbbbb-bbbb-4bbb-8bbb-" + String(index).padStart(12, "0"));

test("actual public DTO keeps absent favorite state unknown", async ({ page }) => {
  await mount(page); expect(await page.evaluate(id => (window as HarnessWindow).mapPost({ id, images: [] }).isSavedByCurrentUser, postId)).toBeNull();
});
test("opening a saved post directly hydrates the details heart from favorites", async ({ page }) => {
  const errors = await mount(page, { saved: [postId] }); await expectState(page, true);
  await expect(page.getByTestId("post-favorite-button")).toHaveCount(1);
  for (const button of await page.getByTestId("post-favorite-button").all()) await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => (window as HarnessWindow).requests.filter(r => r.path === "/favorites").length)).toBe(1); expect(errors).toEqual([]);
});
test("a complete empty favorites response establishes an unsaved post", async ({ page }) => {
  await mount(page); await expectState(page, false);
});
test("refreshing the document restores saved state from the API", async ({ page }) => {
  await mount(page, { saved: [postId] }); await expectState(page, true);
  await page.reload(); await inject(page, { saved: [postId] }); await expectState(page, true);
});
test("save and remove synchronize the details heart and preserve displayed counts", async ({ page }) => {
  await mount(page); const buttons = page.getByTestId("post-favorite-button"); await expectState(page, false);
  await buttons.first().click(); await expect(buttons).toHaveAttribute("aria-pressed", "true"); await expect(page.getByTestId("post-save-count")).toContainText("9");
  await expect(buttons.first()).toBeEnabled(); await buttons.last().click(); await expectState(page, false);
  await expect(page.getByTestId("post-save-count")).toContainText("8");
  expect(await page.evaluate(() => (window as HarnessWindow).requests.filter(r => r.method !== "GET").map(r => r.method))).toEqual(["POST", "DELETE"]);
});
test("Discover and details share state instead of trusting stale initialSaved props", async ({ page }) => {
  await mount(page, { mode: "cards" }); await expectState(page, false);
  const card = page.getByTestId("discover-favorite-" + postId); await expect(card).toHaveAttribute("aria-pressed", "false");
  await card.click(); await expectState(page, true); await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("post-favorite-button").click(); await expect(card).toHaveAttribute("aria-pressed", "false");
});
test("a saved post after the first 100 remains loading until its page arrives", async ({ page }) => {
  await mount(page, { saved: [...many, postId], holdPage: 2 }); const second = await pending(page, "GET", "/favorites", 2);
  const button = page.getByTestId("post-favorite-button").first(); await expect(button).not.toHaveAttribute("aria-pressed");
  await expect(button).toHaveAttribute("data-favorite-state", "loading");
  await finish(page, second); await expectState(page, true);
  expect(await page.evaluate(() => (window as HarnessWindow).requests.filter(r => r.path === "/favorites").map(r => r.params.page))).toEqual([1, 2]);
});
test("a later-page failure preserves positive evidence but cannot establish absence", async ({ page }) => {
  await mount(page, { saved: [...many, postId], holdPage: 2 }); await finish(page, await pending(page, "GET", "/favorites", 2), true);
  const button = page.getByTestId("post-favorite-button").first(); await expect(button).toHaveAttribute("data-favorite-state", "unknown");
  await expect(button).not.toHaveAttribute("aria-pressed"); await expect(page.getByRole("alert").first()).toBeVisible();
  await page.evaluate(() => { delete (window as HarnessWindow).hold.page; });
  await button.click(); await expectState(page, true);
});
test("missing pagination metadata is unknown rather than a fabricated unsaved state", async ({ page }) => {
  await mount(page, { badMetadata: true }); await expect(page.getByTestId("post-favorite-button").first()).toHaveAttribute("data-favorite-state", "unknown");
  await expect(page.getByTestId("post-favorite-button").first()).not.toHaveAttribute("aria-pressed");
});
for (const status of [401, 403]) test(`favorites HTTP ${status} stays unknown and preserves authentication versus permission handling`, async ({ page }) => {
  await mount(page, { holdPage: 1 }); await finish(page, await pending(page, "GET"), true, status);
  const button = page.getByTestId("post-favorite-button").first();
  await expect(button).toHaveAttribute("data-favorite-state", "unknown");
  if (status === 403) await page.evaluate(() => { delete (window as HarnessWindow).hold.page; });
  await button.click();
  if (status === 401) expect(await page.evaluate(() => (window as HarnessWindow).navigations[0])).toContain("/login?redirect=");
  else { await expectState(page, false); expect(await page.evaluate(() => (window as HarnessWindow).navigations)).toEqual([]); }
});
for (const saved of [false, true]) for (const lang of ["ar", "en"]) test(`${lang}: failed ${saved ? "remove" : "save"} rolls back every button with localized feedback`, async ({ page }) => {
  await mount(page, { saved: saved ? [postId] : [], lang }); await expectState(page, saved);
  await page.evaluate(method => { (window as HarnessWindow).fail[method] = 1; }, saved ? "DELETE" : "POST");
  await page.getByTestId("post-favorite-button").first().click(); await expectState(page, saved);
  await expect(page.getByRole("alert").first()).toBeVisible(); await expect(page.getByRole("alert").first()).not.toContainText("PRIVATE");
  expect(await page.getByRole("alert").first().textContent()).not.toContain("posts.favorites.errors");
});
test("same-turn rapid clicks and multiple controls share one pending mutation", async ({ page }) => {
  await mount(page); await expectState(page, false);
  await page.evaluate(() => { (window as HarnessWindow).hold.mutation = true; });
  await page.getByTestId("post-favorite-button").first().evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await page.getByTestId("post-favorite-button").last().evaluate((button: HTMLButtonElement) => button.click());
  const mutation = await pending(page, "POST", `/posts/${postId}/favorites`);
  expect(await page.evaluate(() => (window as HarnessWindow).requests.filter(r => r.method === "POST").length)).toBe(1);
  await finish(page, mutation); await expectState(page, true);
});
test("a stale refresh cannot undo a successful newer save", async ({ page }) => {
  await mount(page); await expectState(page, false);
  await page.evaluate(() => { (window as HarnessWindow).hold.page = 1; void (window as HarnessWindow).favorites.refresh(); });
  const old = await pending(page, "GET", "/favorites", 1);
  await page.getByTestId("post-favorite-button").first().click(); await expectState(page, true);
  await page.evaluate(() => { delete (window as HarnessWindow).hold.page; }); await finish(page, old);
  await expect(page.locator("#state")).toContainText('"ready":true'); await expectState(page, true);
});
test("an older favorites page cannot overwrite a newer complete API refresh", async ({ page }) => {
  await mount(page, { saved: [postId] }); await expectState(page, true);
  await page.evaluate(async id => {
    const w = window as HarnessWindow, old = w.favorites.captureRead(); w.server.A = [];
    await w.favorites.refresh();
    w.favorites.observePage({ items: [{ id }], pageNumber: 1, pageSize: 50, totalCount: 1, totalPages: 1 }, old);
  }, postId);
  await expectState(page, false);
});
test("a removal during pagination restarts the shifted collection without losing the boundary post", async ({ page }) => {
  await mount(page, { saved: [postId, ...many], holdPage: 2 }); const old = await pending(page, "GET", "/favorites", 2);
  await expectState(page, true); await page.getByTestId("post-favorite-button").first().click();
  await page.evaluate(() => { delete (window as HarnessWindow).hold.page; }); await finish(page, old);
  await expectState(page, false); await expect(page.locator("#state")).toContainText('"ready":true');
  await expect(page.locator("#state")).toContainText(many[99]);
});
test("same-role switching clears cached favorite state and ignores delayed old-account lists", async ({ page }) => {
  await mount(page, { saved: [postId], holdPage: 1 }); const old = await pending(page, "GET");
  await page.evaluate(() => (window as HarnessWindow).login("B")); const next = await pending(page, "GET", "/favorites", 1, "B");
  await finish(page, next); await expectState(page, false); await finish(page, old); await expectState(page, false);
});
test("rapid A to B to A switching rejects both abandoned sessions and late errors", async ({ page }) => {
  await mount(page, { saved: [postId], holdPage: 1 }); const first = await pending(page, "GET");
  await page.evaluate(() => (window as HarnessWindow).login("B")); const second = await pending(page, "GET", "/favorites", 1, "B");
  await page.evaluate(() => { const w = window as HarnessWindow; w.server.A = []; w.login("A"); });
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).requests.filter(r => r.path === "/favorites").length)).toBe(3);
  const latest = await page.evaluate(() => (window as HarnessWindow).requests.findLastIndex(r => r.path === "/favorites" && r.owner === "A"));
  await finish(page, latest); await expectState(page, false); await finish(page, first); await finish(page, second, true);
  await expectState(page, false); await expect(page.getByRole("alert")).toHaveCount(0);
});
test("same-turn saving then switching accounts cannot dispatch the write with new credentials", async ({ page }) => {
  await mount(page); await expectState(page, false);
  await page.evaluate(id => { const w = window as HarnessWindow; void w.favorites.setSaved(id, true); w.login("B"); }, postId);
  await expectState(page, false);
  expect(await page.evaluate(() => (window as HarnessWindow).requests.filter(r => r.method === "POST").length)).toBe(0);
});
for (const transition of ["switch", "logout"]) test(`${transition} during saving cannot update the next session`, async ({ page }) => {
  await mount(page); await expectState(page, false); await page.evaluate(() => { (window as HarnessWindow).hold.mutation = true; });
  await page.getByTestId("post-favorite-button").first().click(); const old = await pending(page, "POST", `/posts/${postId}/favorites`);
  await page.evaluate(transition => { const w = window as HarnessWindow; if (transition === "switch") w.login("B"); else w.logout(); }, transition);
  if (transition === "switch") await expectState(page, false);
  else await expect(page.getByTestId("post-favorite-button").first()).not.toHaveAttribute("aria-pressed");
  await finish(page, old); await expect(page.getByTestId("post-favorite-button").first()).not.toHaveAttribute("aria-pressed", "true");
});
test("unmount and remount share a valid current-account hydration without stale component callbacks", async ({ page }) => {
  const errors = await mount(page, { saved: [postId], holdPage: 1 }); const read = await pending(page, "GET");
  await page.getByRole("button", { name: "Unmount", exact: true }).click();
  await page.getByRole("button", { name: "Remount", exact: true }).click();
  await finish(page, read); await expectState(page, true); expect(errors).toEqual([]);
});
test("favorites page removal synchronizes open details and refreshes the visible list", async ({ page }) => {
  await mount(page, { mode: "combined", saved: [postId] }); await expectState(page, true);
  await page.getByTestId("seeker-favorite-post-" + postId).getByRole("button").click();
  await page.getByTestId("remove-favorite-modal").getByRole("button", { name: "Remove", exact: true }).click();
  await expectState(page, false); await expect(page.getByTestId("seeker-favorite-post-" + postId)).toHaveCount(0);
});
test("saving from details updates an already open favorites page", async ({ page }) => {
  await mount(page, { mode: "combined" }); await expectState(page, false);
  await page.getByTestId("post-favorite-button").first().click();
  await expect(page.getByTestId("seeker-favorite-post-" + postId)).toBeVisible(); await expectState(page, true);
});
test("failed favorites-page removal restores its card and every open details button", async ({ page }) => {
  await mount(page, { mode: "combined", saved: [postId] }); await expectState(page, true);
  await page.evaluate(() => { (window as HarnessWindow).fail.DELETE = 1; });
  const card = page.getByTestId("seeker-favorite-post-" + postId); await card.getByRole("button").click();
  await page.getByTestId("remove-favorite-modal").getByRole("button", { name: "Remove", exact: true }).click();
  await expectState(page, true); await expect(card).toBeVisible(); await expect(page.getByRole("alert").last()).toBeVisible();
});
test("a partial favorites page establishes saved rows but never unsaved absence", async ({ page }) => {
  await mount(page, { mode: "favorites", saved: [...many, postId] });
  await expect(page.getByTestId("seeker-favorite-post-" + many[0])).toBeVisible();
  expect(await page.evaluate(() => (window as HarnessWindow).requests.filter(r => r.path === "/favorites").map(r => r.params.pageSize))).toEqual([50]);
  await page.getByRole("button", { name: "Open details", exact: true }).click(); await expectState(page, true);
});
test("guests keep the login redirect and send no favorite API requests", async ({ page }) => {
  await mount(page, { guest: true }); await page.getByTestId("post-favorite-button").first().click();
  expect(await page.evaluate(() => (window as HarnessWindow).requests.some(r => r.path === "/favorites" || r.path.endsWith("/favorites")))).toBe(false);
  expect(await page.evaluate(() => (window as HarnessWindow).navigations[0])).toContain("/login?redirect=");
});
for (const role of ["RegisteredUser", "HallOwner", "EventCoordinator", "Photographer", "Admin"]) test(`${role}: existing authenticated-user favorites permission is preserved`, async ({ page }) => {
  await mount(page, { role }); await expectState(page, false); await page.getByTestId("post-favorite-button").first().click(); await expectState(page, true);
});
for (const lang of ["ar", "en"]) for (const width of [390, 768, 1366]) test(`${lang} favorite state and layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page, { lang, saved: [postId] }); await expectState(page, true);
  await expect(page.getByTestId("workspace")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByTestId("post-favorite-button").first()).toHaveAccessibleName(lang === "ar" ? "إزالة من المفضلة" : "Remove from favorites");
});
