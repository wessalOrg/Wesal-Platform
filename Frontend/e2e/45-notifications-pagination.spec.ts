import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

let bundle: string;
let styles = "";
test.beforeAll(async () => {
  const chunks = path.resolve(".next/static/chunks");
  if (fs.existsSync(chunks)) styles = fs.readdirSync(chunks).filter(f => f.endsWith(".css"))
    .map(f => fs.readFileSync(path.join(chunks, f), "utf8")).filter(css => css.includes(".container-wesal")).join("\n");
  const mocks: Record<string, string> = {
    "next/navigation": "export const useRouter=()=>({push:href=>window.opened.push(href)});",
    "@/lib/demo-mode": "export const isDemoModeEnabled=()=>false;",
    "@/hooks/useUserIdentity": `import{useSyncExternalStore}from'react';import{readNotificationAccount,subscribeNotificationAccount}from'@/lib/notification-account';import{getStoredAuth}from'@/lib/auth-storage';
      export function useUserIdentity(){const account=useSyncExternalStore(subscribeNotificationAccount,readNotificationAccount);return{authenticated:!!account,isAdmin:getStoredAuth()?.user?.role==='Admin',isHallOwner:getStoredAuth()?.user?.role==='HallOwner'}}`,
    "@/components/layout/LanguageProvider": `import{useSyncExternalStore}from'react';export const useUiLang=()=>useSyncExternalStore(f=>{window.addEventListener('language',f);return()=>window.removeEventListener('language',f)},()=>window.lang);`,
    "@/lib/api": `import{getStoredAuth}from'@/lib/auth-storage';import{ApiError}from'@/lib/api-error';export const apiOrigin=()=>location.origin;
      export default{get(path,config={}){const owner=getStoredAuth()?.user?.id;const call={path,params:config.params,owner};window.requests.push(call);
        let data;if(path.endsWith('/unread-count'))data=window.rows.filter(x=>!x.isRead).length;else{const pageNumber=config.params.page,pageSize=config.params.pageSize,totalCount=window.rows.length,totalPages=Math.ceil(totalCount/pageSize);
          const items=window.rows.slice((pageNumber-1)*pageSize,pageNumber*pageSize).map(x=>({...x}));if(window.overlap&&pageNumber>1)items.unshift({...window.rows[(pageNumber-1)*pageSize-1]});
          data={items,pageNumber,pageSize,totalCount,totalPages,hasNextPage:pageNumber<totalPages,hasPreviousPage:pageNumber>1};if(window.missingMetadata)delete data.totalCount;}
        return new Promise((resolve,reject)=>{call.resolve=()=>resolve({data});call.reject=()=>reject(new ApiError('Failure',500));
          config.signal?.addEventListener('abort',()=>{call.aborted=true;if(!window.ignoreAbort)call.reject()});
          if(!(window.deferred&&path==='/notifications')&&!(window.holdUnread&&path.endsWith('/unread-count'))){if(window.fail&&path==='/notifications')call.reject();else call.resolve()}})},
        put(path){const call={path,owner:getStoredAuth()?.user?.id};window.writes.push(call);return new Promise(resolve=>{call.resolve=()=>{if(path.endsWith('/read-all'))window.rows.forEach(x=>x.isRead=true);else{const id=path.split('/').at(-2),row=window.rows.find(x=>x.id===id);if(row)row.isRead=true;}resolve({data:{updatedCount:1}})};if(!window.holdWrite)call.resolve()})}};`,
  };
  bundle = (await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';
    import Feed from'./src/components/notifications/NotificationsFeed';import{useNotifications}from'./src/hooks/useNotifications';
    import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';import{setAccessToken}from'./src/lib/auth-token';
    import{applyServerNotification}from'./src/services/platform-notification-realtime';import*as store from'./src/lib/platform-notifications-store';
    window.requests=[];window.writes=[];window.opened=[];window.lang=window.seedLang||'en';
    window.id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
    window.kind=window.seedRole==='Admin'?'HallSubmittedForAdmin':window.seedRole==='HallOwner'?'BookingRequestCreatedForOwner':'BookingRequestSentToRequester';
    window.make=(n,createdAt)=>({id:id(n),type:kind,title:'Notification '+n,body:'Body '+n,createdAt:createdAt||new Date(Date.UTC(2020,0,1,0,0,-n)).toISOString(),isRead:false,readAt:null,actionTarget:kind==='HallSubmittedForAdmin'?'AdminHallRequests':kind==='BookingRequestCreatedForOwner'?'BookingRequestDetails':'MyBookings',targetId:id(999)});
    window.rows=Array.from({length:window.seedTotal??85},(_,i)=>make(i+1));
    window.actions={login(id,role=window.seedRole||'RegisteredUser',version=''){const token='account-'+id+version;setAccessToken(token);setStoredAuth({token,user:{id,role}})},logout:clearAuthSession,
      refreshSession(){actions.login('A',window.seedRole||'RegisteredUser','-renewed')},
      language(lang){window.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';window.dispatchEvent(new Event('language'))},
      incoming(){const row={...make(9999,new Date().toISOString()),type:'BookingCancelledForRequester'};rows.unshift(row);applyServerNotification({kind:row.type,title:row.title,body:row.body,targetId:row.targetId,actionTarget:row.actionTarget})}};
    actions.login('A');actions.language(lang);
    function Probe(){const h=useNotifications();window.currentNotifications=h;return <><output data-testid="state">{JSON.stringify({user:h.account?.userId,ids:h.items.map(x=>x.id),unread:h.unreadCount,total:h.totalCount,hasMore:h.hasMore})}</output><button onClick={()=>h.markRead(id(60))}>Read older</button><button onClick={h.markAllRead}>Read all</button></>}
    function App(){const[shown,setShown]=useState(true);window.toggle=()=>setShown(v=>!v);return <div className="mx-auto max-w-2xl p-4">{shown&&<><Probe/><Feed/></>}</div>}
    createRoot(document.getElementById('root')).render(<App/>);` },
    bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "notification-api", setup(b) {
      b.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "mock" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], resolveDir: process.cwd(), loader: "tsx" }));
    } }],
  })).outputFiles[0].text;
});
async function mount(page: Page, options: { total?: number; lang?: string; role?: string; deferred?: boolean; styled?: boolean } = {}) {
  await page.route("**/*", route => route.request().resourceType() === "document"
    ? route.fulfill({ contentType: "text/html", body: '<html><div id="root"></div></html>' }) : route.abort());
  await page.goto("http://localhost:3000/notifications");
  await page.evaluate(opts => Object.assign(window, { seedTotal: opts.total ?? 85, seedLang: opts.lang ?? "en", seedRole: opts.role ?? "RegisteredUser", deferred: opts.deferred ?? false }), options);
  if (options.styled) { expect(styles).toContain("container-wesal"); await page.addStyleTag({ content: styles }); }
  await page.addScriptTag({ content: bundle });
}
const feed = (page: Page) => page.getByTestId("platform-notifications-feed");
const more = (page: Page) => page.getByTestId("notifications-load-more");
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

test("85 notifications load only the first page, then all older pages with authoritative totals", async ({ page }) => {
  await mount(page);
  await expect(feed(page).locator("li")).toHaveCount(40);
  await expect(page.getByTestId("notifications-total")).toHaveText("Total saved notifications: 85");
  expect(await page.evaluate("requests.filter(x=>x.path==='/notifications').map(x=>x.params.page)")).toEqual([1]);
  await more(page).click();
  await expect(feed(page).locator("li")).toHaveCount(80);
  await more(page).click();
  await expect(feed(page).locator("li")).toHaveCount(85);
  await expect(more(page)).toHaveCount(0);
  expect(await page.evaluate("requests.filter(x=>x.path==='/notifications').map(x=>x.params.page)")).toEqual([1, 2, 3]);
  expect(await page.evaluate("JSON.parse(localStorage.getItem('wesal-platform-notifications:v2:A')).length")).toBe(40);
});

test("fewer than 40 notifications and the empty inbox need no load-more request", async ({ page }) => {
  await mount(page, { total: 12 });
  await expect(feed(page).locator("li")).toHaveCount(12);
  await expect(more(page)).toHaveCount(0);
});

test("empty inbox has an empty state after loading", async ({ page }) => {
  await mount(page, { total: 0 });
  await expect(page.getByTestId("platform-notifications-empty")).toBeVisible();
  await expect(more(page)).toHaveCount(0);
});

test("overlapping pages deduplicate IDs and preserve newest-first ordering", async ({ page }) => {
  await mount(page);
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.overlap=true");
  await more(page).click();
  await expect(feed(page).locator("li")).toHaveCount(80);
  const ids = await page.evaluate("currentNotifications.items.map(x=>x.id)");
  expect(ids).toEqual(Array.from({ length: 80 }, (_, i) => id(i + 1)));
});

test("later-page failure retains loaded notifications and retries the same page", async ({ page }) => {
  await mount(page);
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.fail=true"); await more(page).click();
  await expect(page.getByRole("alert")).toContainText("Could not load");
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.fail=false"); await page.getByTestId("notifications-retry").click();
  await expect(feed(page).locator("li")).toHaveCount(80);
  expect(await page.evaluate("requests.filter(x=>x.path==='/notifications').map(x=>x.params.page)")).toEqual([1, 2, 2]);
});

test("initial failure has retry rather than a false empty state", async ({ page }) => {
  await mount(page, { deferred: true });
  await page.evaluate("requests.filter(x=>x.path==='/notifications').forEach(x=>x.reject())");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("platform-notifications-empty")).toHaveCount(0);
  await page.evaluate("window.deferred=false"); await page.getByTestId("notifications-retry").click();
  await expect(feed(page).locator("li")).toHaveCount(40);
});

test("rapid repeated clicks share one pending page request", async ({ page }) => {
  await mount(page);
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.deferred=true;currentNotifications.loadMore();currentNotifications.loadMore();currentNotifications.loadMore()");
  await expect.poll(() => page.evaluate("requests.filter(x=>x.params?.page===2).length")).toBe(1);
  await page.evaluate("requests.filter(x=>x.params?.page===2).forEach(x=>x.resolve())");
  await expect(feed(page).locator("li")).toHaveCount(80);
});

test("older notifications remain readable and navigate using the existing route", async ({ page }) => {
  await mount(page); await more(page).click();
  const older = page.getByTestId(`platform-notification-${id(60)}`);
  await expect(older).toHaveAttribute("data-read", "false");
  await older.click();
  await expect(older).toHaveAttribute("data-read", "true");
  await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(84);
  expect(await page.evaluate("writes.map(x=>x.path)")).toContain(`/notifications/${id(60)}/read`);
  expect(await page.evaluate("opened")).toEqual(["/profile/bookings"]);
});

test("mark-all covers unloaded pages and cannot be undone by a pending page response", async ({ page }) => {
  await mount(page);
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.deferred=true;currentNotifications.loadMore()");
  await page.getByRole("button", { name: "Read all", exact: true }).click();
  await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(0);
  await page.evaluate("requests.filter(x=>x.params?.page===2).forEach(x=>x.resolve())");
  await expect(feed(page).locator("li")).toHaveCount(80);
  expect(await page.evaluate("currentNotifications.items.every(x=>x.is_read)")).toBe(true);
  await page.evaluate("window.deferred=false"); await more(page).click();
  await expect(feed(page).locator("li")).toHaveCount(85);
  expect(await page.evaluate("currentNotifications.items.every(x=>x.is_read)")).toBe(true);
});

test("realtime notification during pagination survives the delayed page and revalidates unread count", async ({ page }) => {
  await mount(page);
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.deferred=true;currentNotifications.loadMore();actions.incoming()");
  await expect(feed(page)).toContainText("Notification 9999");
  await page.evaluate("requests.filter(x=>x.params?.page===2).forEach(x=>x.resolve())");
  await expect(feed(page).locator("li")).toHaveCount(81);
  await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(86);
  await page.evaluate("window.deferred=false;currentNotifications.retry()");
  await expect(page.getByTestId(`platform-notification-${id(9999)}`)).toHaveCount(1);
  await expect(feed(page).locator("li")).toHaveCount(81);
});

test("read state wins over an overlapping pending page snapshot", async ({ page }) => {
  await mount(page);
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.overlap=true;window.deferred=true;currentNotifications.loadMore();currentNotifications.markRead(id(40))");
  await page.evaluate("requests.filter(x=>x.params?.page===2).forEach(x=>x.resolve())");
  await expect(feed(page).locator("li")).toHaveCount(80);
  await expect(page.getByTestId(`platform-notification-${id(40)}`)).toHaveAttribute("data-read", "true");
});

test("a pre-write unread-count response cannot undo mark-all", async ({ page }) => {
  await mount(page);
  await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(85);
  await page.evaluate("window.holdUnread=true;actions.incoming()");
  await expect.poll(() => page.evaluate("requests.filter(x=>x.path.endsWith('/unread-count')).length")).toBe(2);
  await page.getByRole("button", { name: "Read all", exact: true }).click();
  await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(0);
  await page.evaluate("window.holdUnread=false;requests.filter(x=>x.path.endsWith('/unread-count')).at(-1).resolve()");
  await expect.poll(() => page.evaluate("requests.filter(x=>x.path.endsWith('/unread-count')).length")).toBe(3);
  await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(0);
});

test("a page of unsupported notification kinds cannot hide older supported notifications", async ({ page }) => {
  await mount(page, { deferred: true });
  await page.evaluate("rows.slice(0,40).forEach(x=>x.type='UnsupportedExistingKind');requests[0].reject();window.deferred=false");
  await page.getByTestId("notifications-retry").click();
  await expect(more(page)).toBeVisible();
  await more(page).click();
  await expect(feed(page).locator("li")).toHaveCount(40);
  await expect(page.getByTestId(`platform-notification-${id(41)}`)).toBeVisible();
});

test("missing pagination metadata produces a retryable error without an invented total", async ({ page }) => {
  await mount(page, { deferred: true });
  await page.evaluate("requests[0].reject();window.missingMetadata=true;window.deferred=false");
  await page.getByTestId("notifications-retry").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("notifications-total")).toHaveCount(0);
});

test("returning to the tab refreshes the head while retaining older loaded notifications", async ({ page }) => {
  await mount(page); await more(page).click();
  await expect(feed(page).locator("li")).toHaveCount(80);
  await page.evaluate("actions.incoming();document.dispatchEvent(new Event('visibilitychange'))");
  await expect(page.getByTestId(`platform-notification-${id(9999)}`)).toHaveCount(1);
  await expect(feed(page).locator("li")).toHaveCount(81);
  await expect(more(page)).toBeVisible();
});

for (const action of ["actions.login('B')", "actions.logout()", "actions.refreshSession()", "actions.logout();actions.login('A')"]) {
  test(`pending pagination is isolated after ${action}`, async ({ page }) => {
    await mount(page);
    await expect(feed(page).locator("li")).toHaveCount(40);
    await page.evaluate("window.deferred=true;window.ignoreAbort=true;currentNotifications.loadMore()");
    await page.evaluate(action);
    await page.evaluate("requests.filter(x=>x.owner==='A'&&x.params?.page===2).forEach(x=>x.resolve())");
    await expect(page.getByTestId(`platform-notification-${id(60)}`)).toHaveCount(0);
    expect(await page.evaluate("requests.find(x=>x.params?.page===2).aborted")).toBe(true);
  });
}

test("unmount aborts pending pages and remount starts an independent page one", async ({ page }) => {
  await mount(page);
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.deferred=true;window.ignoreAbort=true;currentNotifications.loadMore();toggle()");
  await page.evaluate("requests.filter(x=>x.params?.page===2).forEach(x=>x.resolve());toggle()");
  await expect.poll(() => page.evaluate("requests.filter(x=>x.params?.page===1).length")).toBe(2);
  await expect(feed(page)).not.toContainText("Notification 60");
});

for (const role of ["HallOwner", "Admin", "EventCoordinator", "Photographer"]) {
  test(`${role} can load its older notifications`, async ({ page }) => {
    await mount(page, { role }); await more(page).click();
    await expect(feed(page).locator("li")).toHaveCount(80);
  });
}

for (const lang of ["ar", "en"]) for (const width of [390, 768, 1366]) {
  test(`${lang} notifications pagination at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, { lang, styled: true });
    await expect(more(page)).toHaveText(lang === "ar" ? "تحميل إشعارات أقدم" : "Load older notifications");
    expect(await page.locator("html").getAttribute("dir")).toBe(lang === "ar" ? "rtl" : "ltr");
    await more(page).click(); await expect(feed(page).locator("li")).toHaveCount(80);
  });
}
