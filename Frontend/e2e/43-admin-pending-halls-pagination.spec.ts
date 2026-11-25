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
    "next/navigation": `import{useSyncExternalStore}from'react';const listen=f=>{window.addEventListener('route',f);return()=>window.removeEventListener('route',f)};
      const navigate=url=>{if(url===location.pathname+location.search)return;history.pushState({},'',url);window.dispatchEvent(new Event('route'))};
      const router={push:navigate,replace:navigate};export const useRouter=()=>router;
      export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(listen,()=>location.search));
      export const usePathname=()=>useSyncExternalStore(listen,()=>location.pathname);`,
    "next/link": `import React from'react';import{useRouter}from'next/navigation';export default function Link({href,children,prefetch,...props}){const router=useRouter();return <a href={href} {...props} onClick={e=>{e.preventDefault();router.push(href)}}>{children}</a>}`,
    "@/lib/demo-mode": "export const isDemoModeEnabled=()=>false;",
    "@/hooks/useAccountAccess": `import{useSyncExternalStore}from'react';import{readAuthenticatedAccount,subscribeAuthenticatedAccount}from'@/lib/authenticated-account';import{getStoredAuth}from'@/lib/auth-storage';
      export function useAccountAccess(){const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount);const ready=useSyncExternalStore(f=>{window.addEventListener('ready',f);return()=>window.removeEventListener('ready',f)},()=>window.authReady);
        return{ready,authenticated:!!account,isAdmin:getStoredAuth()?.user?.role==='Admin'}}`,
    "@/components/layout/LanguageProvider": `import{useSyncExternalStore}from'react';export const useUiLang=()=>useSyncExternalStore(f=>{window.addEventListener('language',f);return()=>window.removeEventListener('language',f)},()=>window.lang);`,
    "@/components/admin/halls/AdminOwnerMessageProvider": "export const useAdminOwnerMessage=()=>({openForHall:hall=>{window.contacted=hall}});",
    "@/components/admin/halls/AdminHallReviewGallery": "export default()=>null;",
    "@/components/admin/AdminSecureDocumentViewer": "export default()=>null;",
    "@/services/admin-documents": "export const fetchAdminOwnerIdentityUrl=async()=>null;",
    "@/lib/api": `import{ApiError}from'@/lib/api-error';import{getStoredAuth}from'@/lib/auth-storage';export const apiOrigin=()=>location.origin;
      export default{get(path,config={}){
        if(/\\/admin\\/halls\\/[^/]+$/.test(path)&&!path.endsWith('/pending')&&!path.endsWith('/rejected')){
          const id=path.split('/').at(-1),row=[...window.pending,...window.rejected].find(x=>x.hallId===id);
          return Promise.resolve({data:{...row,name:row?.name||'Hall',hallId:id,status:window.pending.some(x=>x.hallId===id)?'PendingReview':'Rejected',ownerId:'owner-'+id,ownerFullName:'Hall Owner',ownerPhoneNumber:'+970599123456',ownerEmail:'owner@example.test',capacity:100,price:500,paymentStatus:'Unpaid',photos:[],features:[],hasPaymentReceipt:false,ownerHasIdentityDocument:false}})}
        const call={path,params:config.params||{},owner:getStoredAuth()?.user?.id};window.requests.push(call);const snapshot=window.response(path,call.params);
        return new Promise((resolve,reject)=>{call.resolve=(data=snapshot)=>resolve({data});call.reject=()=>reject(new ApiError('admin.halls.queue.errors.loadFailed',500));
          config.signal?.addEventListener('abort',()=>{call.aborted=true;if(!window.ignoreAbort)call.reject()});
          if(!window.deferred){if(window.fail)call.reject();else call.resolve()}})},
        put(path,body){window.mutations.push({path,body});const id=path.split('/').at(-2),row=window.pending.find(x=>x.hallId===id);window.pending=window.pending.filter(x=>x.hallId!==id);
          if(path.endsWith('/reject')&&row)window.rejected.push(row);
          return Promise.resolve({data:{hallId:id,hallName:row?.name||'Hall',status:path.endsWith('/approve')?'Approved':'Rejected',isApproved:path.endsWith('/approve'),approvedAt:'2030-01-01T00:00:00Z',notificationDelivered:true,isAlreadyRejected:false}})}};`,
  };
  for (const name of ["AdminHallDeleteControls", "AdminHallLockControls", "AdminHallPaidControls", "AdminHallUnlockControls", "AdminHallLockBadge"]) {
    mocks[`@/components/admin/halls/${name}`] = "export default()=>null;";
  }
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `import React from'react';import{createRoot}from'react-dom/client';
      import Guard from'./src/components/admin/AdminManagementGuard';import Pending from'./src/components/admin/halls/AdminPendingHallsView';
      import Rejected from'./src/components/admin/halls/AdminRejectedHallsView';import Detail from'./src/components/admin/halls/AdminHallSubmissionDetailView';
      import{usePathname,useRouter}from'next/navigation';import{setAccessToken}from'./src/lib/auth-token';import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';
      import{emitHallApproved,emitHallRejected}from'./src/lib/hall-review-events';
      window.requests=[];window.mutations=[];window.authReady=window.seedReady??true;window.lang='ar';
      window.id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
      window.pending=Array.from({length:window.seedTotal??121},(_,i)=>({hallId:id(i+1),name:'Hall '+(i+1),thumbnailUrl:null,submittedAt:new Date(Date.UTC(2030,0,1,0,i)).toISOString()}));
      window.rejected=Array.from({length:12},(_,i)=>({hallId:id(2001+i),name:'Rejected '+(i+1),thumbnailUrl:null,submittedAt:'2030-01-01T00:00:00Z'}));
      window.response=(path,params)=>{const all=path.endsWith('/rejected')?rejected:pending,pageNumber=Number(params.page)||1,pageSize=Number(params.pageSize)||10,totalCount=all.length,totalPages=Math.ceil(totalCount/pageSize);
        return{items:all.slice((pageNumber-1)*pageSize,pageNumber*pageSize),pageNumber,pageSize,totalCount,totalPages,hasPreviousPage:pageNumber>1,hasNextPage:pageNumber<totalPages}};
      window.actions={login(id,role='Admin'){const token=id+'-token';setAccessToken(token);setStoredAuth({token,user:{id,role}})},logout:clearAuthSession,
        ready(){window.authReady=true;window.dispatchEvent(new Event('ready'))},language(lang){window.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';window.dispatchEvent(new Event('language'))},
        approved(id){pending=pending.filter(x=>x.hallId!==id);emitHallApproved({hallId:id,hallName:'Processed hall'})},
        rejected(id){pending=pending.filter(x=>x.hallId!==id);emitHallRejected({hallId:id,hallName:'Processed hall',reason:'Missing documents'})}};
      if(window.seedRole!=='Guest')actions.login('A',window.seedRole||'Admin');actions.language(window.seedLang||'ar');
      function App(){const path=usePathname();const router=useRouter();window.navigate=router.push;
        const view=path==='/admin/rejected-halls'?<Rejected/>:path.startsWith('/admin/halls/')?<Detail hallId={path.split('/').at(-1)}/>:<Pending/>;
        return <Guard>{view}</Guard>}
      createRoot(document.getElementById('root')).render(<App/>);` },
    bundle: true, write: false, platform: "browser", jsx: "automatic", loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "admin-hall-contract", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], resolveDir: process.cwd(), loader: "tsx" }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function mount(page: Page, options: { total?: number; query?: string; role?: string; lang?: string; ready?: boolean; deferred?: boolean; rejected?: boolean; styled?: boolean } = {}) {
  await page.route("**/*", route => route.request().resourceType() === "document"
    ? route.fulfill({ contentType: "text/html", body: '<html><div id="root"></div></html>' }) : route.abort());
  await page.goto(`http://localhost:3000/admin${options.rejected ? "/rejected-halls" : ""}${options.query || ""}`);
  await page.evaluate(opts => Object.assign(window, { seedTotal: opts.total ?? 121, seedRole: opts.role ?? "Admin", seedLang: opts.lang ?? "ar", seedReady: opts.ready ?? true, deferred: opts.deferred ?? false }), options);
  if (options.styled) { expect(styles).toContain("container-wesal"); await page.addStyleTag({ content: styles }); }
  await page.addScriptTag({ content: bundle });
}
const list = (page: Page) => page.getByTestId("admin-pending-halls-list");
const next = (page: Page) => page.getByTestId("admin-pending-next");

test("121 pending requests preserve the total and expose requests after the first 50", async ({ page }) => {
  await mount(page);
  await expect(list(page).locator("li")).toHaveCount(50);
  await expect(page.getByTestId("admin-pending-total")).toContainText("121");
  await next(page).click();
  await expect(list(page).locator("li").first()).toContainText("Hall 51");
  await next(page).click();
  await expect(list(page).locator("li")).toHaveCount(21);
  await expect(list(page).locator("li").last()).toContainText("Hall 121");
  await expect(next(page)).toBeDisabled();
  expect(await page.evaluate("requests.map(x=>x.params.page)")).toEqual([1, 2, 3]);
});

test("fewer than 50 requests have no unnecessary navigation", async ({ page }) => {
  await mount(page, { total: 7 });
  await expect(list(page).locator("li")).toHaveCount(7);
  await expect(page.getByTestId("admin-pending-total")).toContainText("7");
  await expect(next(page)).toHaveCount(0);
});

test("page changes cancel old requests and ignore their late responses", async ({ page }) => {
  await mount(page);
  await expect(list(page)).toBeVisible();
  await page.evaluate("deferred=true;ignoreAbort=true");
  await next(page).click();await expect.poll(() => page.evaluate("requests.length")).toBe(2);
  await next(page).click();await expect.poll(() => page.evaluate("requests.length")).toBe(3);
  await page.evaluate("requests[2].resolve();requests[1].resolve()");
  await expect(list(page).locator("li").first()).toContainText("Hall 101");
  expect(await page.evaluate("requests[1].aborted")).toBe(true);
});

for (const action of ["approve", "reject"] as const) {
  test(`${action} from a later page preserves the return page and refreshes the count`, async ({ page }) => {
    await mount(page, { query: "?page=2" });
    const row = list(page).locator("li").first();await expect(row).toContainText("Hall 51");
    await row.getByTestId("admin-hall-message").click();
    expect(await page.evaluate("contacted.hallId")).toBe(id(51));
    await row.getByRole("link").click();
    await expect(page.getByTestId("admin-hall-detail")).toBeVisible();
    if (action === "reject") await page.locator('[data-testid="admin-hall-reject-controls"] textarea').fill("Missing documents");
    await page.getByTestId(`admin-hall-${action}`).click();
    await expect.poll(() => page.evaluate("mutations.length")).toBe(1);
    if (action === "reject") expect(await page.evaluate("mutations[0].body.reason")).toBe("Missing documents");
    const back = page.getByTestId("admin-hall-detail").getByRole("link").first();
    await expect(back).toHaveAttribute("href", "/admin?page=2");
    await back.click();
    await expect(list(page).locator("li").first()).toContainText("Hall 52");
    await expect(page.getByTestId("admin-pending-total")).toContainText("120");
    expect(await page.evaluate("requests.at(-1).params.page")).toBe(2);
  });
}

test("processing the final request on the last page moves to the new last page", async ({ page }) => {
  await mount(page, { query: "?page=3", total: 101 });
  await expect(list(page).locator("li")).toHaveCount(1);
  await page.evaluate(`actions.approved('${id(101)}')`);
  await expect(list(page).locator("li").first()).toContainText("Hall 51");
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByTestId("admin-pending-total")).toContainText("100");
});

test("failure and retry keep the requested page; language changes do not refetch", async ({ page }) => {
  await mount(page, { query: "?page=2", deferred: true });
  await expect.poll(() => page.evaluate("requests.length")).toBe(1);
  await page.evaluate("requests[0].reject()");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("alert").getByRole("button").click();
  await expect.poll(() => page.evaluate("requests.length")).toBe(2);
  await page.evaluate("requests[1].resolve();actions.language('en')");
  await expect(list(page).locator("li").first()).toContainText("Hall 51");
  expect(await page.evaluate("requests.map(x=>x.params.page)")).toEqual([2, 2]);
});

test("a pending response from another admin cannot overwrite the next account", async ({ page }) => {
  await mount(page, { deferred: true });
  await expect.poll(() => page.evaluate("requests.length")).toBe(1);
  await page.evaluate("ignoreAbort=true;actions.login('B')");
  await expect.poll(() => page.evaluate("requests.length")).toBe(2);
  await page.evaluate("requests[1].resolve();requests[0].reject()");
  await expect(list(page)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate("requests[1].owner")).toBe("B");
});

for (const role of ["Guest", "RegisteredUser", "HallOwner", "Photographer", "EventCoordinator"]) {
  test(`${role} cannot fetch pending requests`, async ({ page }) => {
    await mount(page, { role, styled: true });
    await expect(page.getByTestId(role === "Guest" ? "admin-management-redirect-landing" : "admin-management-redirect")).toBeVisible();
    expect(await page.evaluate("requests.length")).toBe(0);
  });
}

test("authentication loading does not request or flash admin data", async ({ page }) => {
  await mount(page, { ready: false, styled: true });
  await expect(page.getByTestId("admin-management-loading")).toBeVisible();
  expect(await page.evaluate("requests.length")).toBe(0);
  await page.evaluate("actions.ready()");await expect(list(page)).toBeVisible();
});

test("empty pending requests and existing rejected pagination remain separate", async ({ page }) => {
  await mount(page, { total: 0 });
  await expect(page.getByTestId("admin-pending-halls-empty")).toBeVisible();
  await page.evaluate("navigate('/admin/rejected-halls')");
  await expect(page.getByTestId("admin-rejected-halls-list").locator("li")).toHaveCount(10);
  await page.getByRole("navigation").getByRole("button").last().click();
  await expect(page.getByTestId("admin-rejected-halls-list").locator("li")).toHaveCount(2);
  expect(await page.evaluate("requests.at(-1).path")).toBe("/admin/halls/rejected");
});

test("processing requests while refreshes are pending cannot restore their old rows or count", async ({ page }) => {
  await mount(page, { query: "?page=2" });
  await expect(list(page)).toBeVisible();
  await page.evaluate(`deferred=true;ignoreAbort=true;actions.approved('${id(51)}')`);
  await expect.poll(() => page.evaluate("requests.length")).toBe(2);
  await page.evaluate(`actions.rejected('${id(52)}')`);
  await expect.poll(() => page.evaluate("requests.length")).toBe(3);
  await page.evaluate("requests[2].resolve();requests[1].resolve()");
  await expect(list(page).locator("li").first()).toContainText("Hall 53");
  await expect(page.getByTestId("admin-pending-total")).toContainText("119");
  expect(await page.evaluate("requests[1].aborted")).toBe(true);
});

test("processing the final request in the queue produces a real empty state", async ({ page }) => {
  await mount(page, { total: 1 });
  await expect(list(page)).toBeVisible();
  await page.evaluate(`actions.rejected('${id(1)}')`);
  await expect(page.getByTestId("admin-pending-halls-empty")).toBeVisible();
  await expect(page.getByTestId("admin-pending-total")).toContainText("0");
  await expect(next(page)).toHaveCount(0);
});

test("logout aborts a pending page and hides all admin rows", async ({ page }) => {
  await mount(page, { deferred: true, styled: true });
  await expect.poll(() => page.evaluate("requests.length")).toBe(1);
  await page.evaluate("ignoreAbort=true;actions.logout();requests[0].resolve()");
  await expect(list(page)).toHaveCount(0);
  expect(await page.evaluate("requests[0].aborted")).toBe(true);
  expect(await page.evaluate("requests.length")).toBe(1);
});

test("missing total metadata is an error instead of a fabricated pending count", async ({ page }) => {
  await mount(page, { deferred: true });
  await expect.poll(() => page.evaluate("requests.length")).toBe(1);
  await page.evaluate("requests[0].resolve({items:response('/admin/halls/pending',{page:1,pageSize:50}).items})");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("admin-pending-total")).toHaveCount(0);
});

for (const lang of ["ar", "en"]) for (const width of [390, 768, 1366]) {
  test(`${lang} at ${width}px: pending requests retain responsive pagination`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, { lang, styled: true });
    await expect(next(page)).toHaveText(lang === "ar" ? "التالي" : "Next");
    await next(page).focus();await page.keyboard.press("Enter");
    await expect(list(page).locator("li").first()).toContainText("Hall 51");
    expect(await page.evaluate("document.documentElement.scrollWidth<=innerWidth")).toBe(true);
  });
}
