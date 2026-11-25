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
    "next/navigation": "export const usePathname=()=>'/admin/help-questions';export const useRouter=()=>({prefetch(){},push(){}});",
    "next/link": "import React from'react';export default function Link({children,prefetch,...props}){return <a {...props}>{children}</a>}",
    "@/components/auth/AuthProvider": "export const useAuth=()=>({logout:window.actions.logout,isLoggingOut:false});",
    "@/components/auth/LogoutConfirmDialog": "export default()=>null;",
    "@/components/brand/WesalLogo": "export default()=>null;",
    "@/hooks/useUnreadCount": "export const useUnreadCount=()=>({count:0,ready:true});",
    "@/services/admin-mabrouk": "export const adminMabroukService={gapCount:async()=>0};",
    "@/lib/demo-mode": "export const isDemoModeEnabled=()=>!!window.demo;",
    "@/hooks/useAccountAccess": `import{useSyncExternalStore}from'react';import{readAuthenticatedAccount,subscribeAuthenticatedAccount}from'@/lib/authenticated-account';import{getStoredAuth}from'@/lib/auth-storage';
      export function useAccountAccess(){const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount);return{ready:true,authenticated:!!account,isAdmin:getStoredAuth()?.user?.role==='Admin'}}`,
    "@/components/layout/LanguageProvider": `import{useSyncExternalStore}from'react';export const useUiLang=()=>useSyncExternalStore(f=>{window.addEventListener('language',f);return()=>window.removeEventListener('language',f)},()=>window.lang);`,
    "@/lib/api": `import{getStoredAuth}from'@/lib/auth-storage';import{ApiError}from'@/lib/api-error';export default{
      get(path,config){const params=config.params,all=window.rows,pageNumber=params.page,pageSize=params.pageSize,totalCount=all.length,totalPages=Math.ceil(totalCount/pageSize);
        const snapshot={items:all.slice((pageNumber-1)*pageSize,pageNumber*pageSize).map(x=>({...x})),pageNumber,pageSize,totalCount,totalPages,hasPreviousPage:pageNumber>1,hasNextPage:pageNumber<totalPages};
        const call={path,params,owner:getStoredAuth()?.user?.id};window.requests.push(call);
        return new Promise((resolve,reject)=>{call.resolve=()=>resolve({data:snapshot});call.reject=()=>reject(new ApiError('Failure',500));config.signal?.addEventListener('abort',()=>{call.aborted=true;if(!window.ignoreAbort)call.reject()});
          if(!window.deferred){if(window.fail)call.reject();else call.resolve()}})},
      post(path,body){window.writes.push({path,body,owner:getStoredAuth()?.user?.id});
        if(window.failWrite)return Promise.reject(new Error('Failure'));
        if(path.endsWith('/read')){const userId=path.split('/').at(-2);for(const row of window.rows)if(row.userId===userId)row.adminUnread=false;return Promise.resolve({data:null})}
        const row=window.rows.find(x=>x.id===path.split('/').at(-2));Object.assign(row,{reply:body.reply,status:'replied',adminUnread:false,userUnread:true});return Promise.resolve({data:{...row}})}};`,
  };
  bundle = (await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `import React from'react';import{createRoot}from'react-dom/client';
    import Page from'./src/components/admin/help/AdminHelpCenterPage';import Sidebar from'./src/components/admin/AdminSidebar';
    import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';import{setAccessToken}from'./src/lib/auth-token';
    import{countUnreadHelpConversations}from'./src/services/help-tickets';import{HELP_CENTER_CHANGE_EVENT}from'./src/types/help-center';
    import{replaceHelpTickets}from'./src/lib/help-center-storage';
    window.requests=[];window.writes=[];window.lang=window.seedLang||'en';document.documentElement.dir=window.lang==='ar'?'rtl':'ltr';
    window.rows=Array.from({length:window.seedTotal??201},(_,i)=>({id:'ticket-'+(i+1),userId:window.duplicate?'user-'+(i%2):'user-'+(i+1),userName:'User '+(window.duplicate?i%2:i+1),question:'Question '+(i+1),createdAt:new Date(Date.UTC(2030,0,1,0,0,-i)).toISOString(),status:'open',reply:null,repliedAt:null,userUnread:false,adminUnread:true}));
    if(window.demo)replaceHelpTickets(window.rows);
    window.actions={login(id,role='Admin'){const token=(window.demo?'stub-':'')+id+'-token';setAccessToken(token);setStoredAuth({token,user:{id,role}})},logout:clearAuthSession,
      refresh(){window.dispatchEvent(new Event(HELP_CENTER_CHANGE_EVENT))},language(lang){window.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';window.dispatchEvent(new Event('language'))}};
    if(window.seedRole!=='Guest')actions.login('A',window.seedRole||'Admin');
    window.summary=countUnreadHelpConversations;
    createRoot(document.getElementById('root')).render(<><Sidebar/><Page/></>);` },
    bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "help-api", setup(b) {
      b.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "mock" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], resolveDir: process.cwd(), loader: "tsx" }));
    } }],
  })).outputFiles[0].text;
});

async function mount(page: Page, options: { total?: number; role?: string; duplicate?: boolean; lang?: string; deferred?: boolean; styled?: boolean; demo?: boolean } = {}) {
  await page.route("**/*", route => route.request().resourceType() === "document"
    ? route.fulfill({ contentType: "text/html", body: '<html><div id="root"></div></html>' }) : route.abort());
  await page.goto("http://localhost:3000/admin/help-questions");
  await page.evaluate(opts => Object.assign(window, { seedTotal: opts.total ?? 201, seedRole: opts.role ?? "Admin", seedLang: opts.lang ?? "en", duplicate: opts.duplicate ?? false, deferred: opts.deferred ?? false, demo: opts.demo ?? false }), options);
  if (options.styled) { expect(styles).toContain("container-wesal"); await page.addStyleTag({ content: styles }); }
  await page.addScriptTag({ content: bundle });
}
const list = (page: Page) => page.getByTestId("admin-help-list");
const next = (page: Page) => page.getByTestId("admin-help-next");

test("201 tickets preserve total count and expose pages 2 and 3 without scanning all pages", async ({ page }) => {
  await mount(page);
  await expect(list(page).locator("li")).toHaveCount(100);
  await expect(page.getByTestId("admin-help-total")).toContainText("201");
  expect(await page.evaluate("requests.every(x=>x.params.page===1)")).toBe(true);
  await next(page).click();
  await expect(list(page).locator("li").first()).toContainText("Question 101");
  await next(page).click();
  await expect(list(page).locator("li")).toHaveCount(1);
  await expect(list(page)).toContainText("Question 201");
  await expect(next(page)).toBeDisabled();
});

test("partial data never displays a numeric global unread counter", async ({ page }) => {
  await mount(page);
  await expect(page.getByTestId("admin-help-unread-unknown")).toBeVisible();
  await expect(page.getByTestId("admin-nav-help-questions-count")).toHaveCount(0);
  await expect(page.getByText(/Conversations show questions/)).toBeVisible();
});

test("complete data counts distinct unread users instead of tickets and reading updates the count", async ({ page }) => {
  await mount(page, { total: 12, duplicate: true });
  await expect(list(page).locator("li")).toHaveCount(2);
  await expect(page.getByTestId("admin-nav-help-questions-count")).toHaveText("2");
  await page.getByTestId("admin-help-item-user-0").click();
  await expect(page.getByTestId("admin-nav-help-questions-count")).toHaveText("1");
  expect(await page.evaluate("rows.filter(x=>x.userId==='user-0').every(x=>!x.adminUnread)")).toBe(true);
});

test("opening later-page conversations and replying preserves question and reply navigation", async ({ page }) => {
  await mount(page);
  await next(page).click();
  await page.getByTestId("admin-help-item-user-101").click();
  await page.getByTestId("admin-help-reply-ticket-101").fill("An admin reply");
  await page.getByTestId("admin-help-reply-submit-ticket-101").click();
  await expect(page.getByTestId("admin-help-question-ticket-101")).toContainText("An admin reply");
  await expect(page.getByTestId("admin-help-total")).toContainText("201");
  expect(await page.evaluate("writes.some(x=>x.path==='/admin/help/tickets/ticket-101/reply'&&x.body.reply==='An admin reply')")).toBe(true);
});

test("refresh failure preserves loaded tickets and supports retry", async ({ page }) => {
  await mount(page, { total: 12 });
  await expect(list(page).locator("li")).toHaveCount(12);
  await page.evaluate("window.fail=true;actions.refresh()");
  await expect(page.getByRole("alert")).toContainText("Could not load");
  await expect(list(page).locator("li")).toHaveCount(12);
  await page.evaluate("window.fail=false");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("later-page failures offer retry without falsely showing empty results", async ({ page }) => {
  await mount(page);
  await expect(list(page).locator("li")).toHaveCount(100);
  await page.evaluate("window.fail=true");
  await next(page).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("admin-help-empty")).toHaveCount(0);
  await page.evaluate("window.fail=false");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(list(page)).toContainText("Question 101");
});

for (const action of ["actions.login('B')", "actions.logout()", "actions.login('B','HallOwner')"]) {
  test(`late lists and errors cannot survive ${action}`, async ({ page }) => {
    await mount(page, { deferred: true });
    await expect.poll(() => page.evaluate("requests.length")).toBe(2);
    await page.evaluate(`window.ignoreAbort=true;${action}`);
    await page.evaluate("requests.filter(x=>x.owner==='A').forEach((x,i)=>i?x.reject():x.resolve())");
    await expect(list(page)).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate("requests.filter(x=>x.owner==='A').every(x=>x.aborted)")).toBe(true);
    if (action.includes("login('B')")) {
      await page.evaluate("requests.filter(x=>x.owner==='B').forEach(x=>x.resolve())");
      await expect(list(page).locator("li")).toHaveCount(100);
    }
  });
}

for (const role of ["Guest", "HallSeeker", "HallOwner", "Coordinator", "Photographer"]) {
  test(`${role} cannot send admin support requests`, async ({ page }) => {
    await mount(page, { role });
    await expect(page.getByTestId("admin-help-empty")).toBeVisible();
    expect(await page.evaluate("requests.length")).toBe(0);
  });
}

test("empty data has an exact zero unread count and no next page", async ({ page }) => {
  await mount(page, { total: 0 });
  await expect(page.getByTestId("admin-help-empty")).toBeVisible();
  await expect(page.getByTestId("admin-help-total")).toHaveText("Total tickets: 0");
  await expect(next(page)).toBeDisabled();
  await expect(page.getByTestId("admin-help-unread-unknown")).toHaveCount(0);
});

test("new support messages revalidate the current page and unread counter", async ({ page }) => {
  await mount(page, { total: 2 });
  await page.getByTestId("admin-help-item-user-1").click();
  await expect(page.getByTestId("admin-nav-help-questions-count")).toHaveText("1");
  await page.evaluate("rows[0].adminUnread=true;actions.refresh()");
  await expect(page.getByTestId("admin-nav-help-questions-count")).toHaveText("2");
});

test("rapid next clicks produce one page request and preserve backend ordering", async ({ page }) => {
  await mount(page);
  await expect(list(page).locator("li")).toHaveCount(100);
  await page.evaluate("window.deferred=true;document.querySelector('[data-testid=admin-help-next]').click();document.querySelector('[data-testid=admin-help-next]')?.click()");
  await expect.poll(() => page.evaluate("requests.filter(x=>x.params.page===2).length")).toBe(1);
  await page.evaluate("requests.filter(x=>x.params.page===2).forEach(x=>x.resolve())");
  await expect(list(page).locator("li").first()).toContainText("Question 101");
  await expect(list(page).locator("li").last()).toContainText("Question 200");
});

test("old page response after account change cannot populate the new account", async ({ page }) => {
  await mount(page);
  await expect(list(page).locator("li")).toHaveCount(100);
  await page.evaluate("window.deferred=true;window.ignoreAbort=true");
  await next(page).click();
  await expect.poll(() => page.evaluate("requests.filter(x=>x.params.page===2).length")).toBe(1);
  await page.evaluate("actions.login('B');rows=rows.slice(0,2)");
  await page.evaluate("requests.filter(x=>x.owner==='A'&&x.params.page===2).forEach(x=>x.resolve())");
  await expect(list(page)).toHaveCount(0);
  await page.evaluate("requests.filter(x=>x.owner==='B').forEach(x=>x.resolve())");
  expect(await page.evaluate("requests.filter(x=>x.owner==='B').every(x=>x.params.page===1)")).toBe(true);
  await expect(list(page)).not.toContainText("Question 101");
});

test("read failures show retry without changing the shared unread state", async ({ page }) => {
  await mount(page, { total: 2 });
  await expect(list(page).locator("li")).toHaveCount(2);
  await page.evaluate("window.failWrite=true");
  await page.getByTestId("admin-help-item-user-1").click();
  await expect(page.getByRole("alert")).toContainText("Could not mark");
  await expect(page.getByTestId("admin-nav-help-questions-count")).toHaveText("2");
  await page.evaluate("window.failWrite=false");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("admin-nav-help-questions-count")).toHaveText("1");
});

test("reply failure preserves input and supports a successful retry", async ({ page }) => {
  await mount(page, { total: 1 });
  await page.getByTestId("admin-help-item-user-1").click();
  await page.evaluate("window.failWrite=true");
  await page.getByTestId("admin-help-reply-ticket-1").fill("Preserved reply");
  await page.getByTestId("admin-help-reply-submit-ticket-1").click();
  await expect(page.getByRole("alert")).toContainText("Could not save");
  await expect(page.getByTestId("admin-help-reply-ticket-1")).toHaveValue("Preserved reply");
  await page.evaluate("window.failWrite=false");
  await page.getByTestId("admin-help-reply-submit-ticket-1").click();
  await expect(page.getByTestId("admin-help-question-ticket-1")).toContainText("Preserved reply");
});

test("partial-page zero is unknown, not a complete zero unread count", async ({ page }) => {
  await mount(page, { total: 101 });
  expect(await page.evaluate("summary({pageNumber:1,hasNextPage:true,totalCount:101,items:rows.slice(0,100).map(x=>({...x,adminUnread:false}))})")).toBeNull();
});

test("local demo tickets retain pagination without making backend requests", async ({ page }) => {
  await mount(page, { demo: true });
  await expect(list(page).locator("li")).toHaveCount(100);
  await next(page).click();
  await expect(list(page)).toContainText("Question 101");
  expect(await page.evaluate("requests.length")).toBe(0);
});

test("local demo conversations retain reading and replies", async ({ page }) => {
  await mount(page, { demo: true, total: 1 });
  await page.getByTestId("admin-help-item-user-1").click();
  await expect(page.getByTestId("admin-nav-help-questions-count")).toHaveCount(0);
  await page.getByTestId("admin-help-reply-ticket-1").fill("Demo reply");
  await page.getByTestId("admin-help-reply-submit-ticket-1").click();
  await expect(page.getByTestId("admin-help-question-ticket-1")).toContainText("Demo reply");
  expect(await page.evaluate("requests.length+writes.length")).toBe(0);
});

for (const lang of ["ar", "en"]) for (const width of [390, 768, 1366]) {
  test(`${lang} support pagination at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, { lang, styled: true });
    await expect(next(page)).toHaveText(lang === "ar" ? "التالي" : "Next");
    expect(await page.locator("html").getAttribute("dir")).toBe(lang === "ar" ? "rtl" : "ltr");
    await next(page).click();
    await expect(list(page)).toContainText("Question 101");
  });
}
