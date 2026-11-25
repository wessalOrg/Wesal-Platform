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
    "@/lib/demo-mode": "export const isDemoModeEnabled=()=>false;",
    "@/components/layout/LanguageProvider": `import{useSyncExternalStore}from'react';export const useUiLang=()=>useSyncExternalStore(f=>{window.addEventListener('language',f);return()=>window.removeEventListener('language',f)},()=>window.lang);`,
    "@/components/brand/MabroukFigure": "export default()=>null;",
    "@/hooks/useAccountAccess": "export const useAccountAccess=()=>({isProfessional:true,isAdmin:false,isHallOwner:false});",
    "@/lib/api": `import{ApiError}from'@/lib/api-error';import{getStoredAuth}from'@/lib/auth-storage';export const apiOrigin=()=>location.origin;
      export default{get(path,config={}){
        if(path==='/conversations/admin-account')return Promise.resolve({data:{conversationId:'admin',kind:'AdminAccount',createdAt:'2029-01-01T00:00:00Z'}});
        if(path.endsWith('/unread-count'))return Promise.resolve({data:{unreadCount:7}});
        const call={path,params:config.params||{},owner:getStoredAuth()?.user?.id};window.requests.push(call);
        return new Promise((resolve,reject)=>{call.resolve=data=>resolve({data:data??window.response(call.params)});call.reject=()=>reject(new ApiError('errors.inbox.load',500));
          config.signal?.addEventListener('abort',()=>{call.aborted=true;if(!window.ignoreAbort)call.reject()});
          if(!window.deferred){if(window.failInitial)call.reject();else call.resolve()}})}};`,
  };
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React,{useSyncExternalStore,useState}from'react';import{createRoot}from'react-dom/client';
      import{useInboxConversations}from'./src/hooks/useInboxConversations';import List from'./src/components/messages/ProfessionalInboxList';
      import GenericList from'./src/components/messages/ConversationList';
      import{readAuthenticatedAccount,subscribeAuthenticatedAccount}from'./src/lib/authenticated-account';
      import{setAccessToken}from'./src/lib/auth-token';import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';
      window.requests=[];window.total=window.seedTotal??230;window.lang='ar';window.selected=null;
      window.row=n=>({conversationId:'chat-'+String(n).padStart(3,'0'),kind:'CustomerProvider',hallId:null,hallName:'',
        otherParticipantId:'client-'+n,otherParticipantName:location.search.includes('platform-team')&&n===1?'فريق وصال - الإدارة':location.search.includes('platform-team')&&n===2?'Admin':'Client '+n,lastMessagePreview:'message '+n,
        lastMessageAt:new Date(Date.UTC(2030,0,1,0,0,230-n)).toISOString(),createdAt:'2029-01-01T00:00:00Z',messageCount:1,unreadMessageCount:n===1?2:0,isUnread:n===1});
      window.response=params=>{const page=Number(params.page)||1,pageSize=Math.min(100,Number(params.pageSize)||10),totalPages=Math.ceil(total/pageSize);
        const items=Array.from({length:total},(_,i)=>row(i+1)).slice((page-1)*pageSize,page*pageSize);
        return{items,pageNumber:page,pageSize,totalCount:total,totalPages,hasNextPage:page<totalPages,hasPreviousPage:page>1}};
      window.actions={login(id,role='Photographer'){const token=id+'-token';setAccessToken(token);setStoredAuth({token,user:{id,role}})},logout:clearAuthSession,
        language(lang){window.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';window.dispatchEvent(new Event('language'))}};
      actions.login('A');actions.language(new URLSearchParams(location.search).get('lang')||'ar');
      function Harness(){const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount);const inbox=useInboxConversations(account?.userId||null,true,!location.search.includes('no-admin'));window.inbox=inbox;
        const[selected,setSelected]=useState(null);const onSelect=id=>{window.selected=id;setSelected(id)};
        const props={status:inbox.status,conversations:inbox.conversations,error:inbox.error,selectedId:selected,onSelect,onRetry:inbox.retry,
          pagination:{hasMore:inbox.hasMore,loading:inbox.loadingMore,error:inbox.loadMoreError,totalCount:inbox.totalCount,onLoadMore:inbox.loadMore}};
        return <><button id='refresh' onClick={inbox.refresh}>Refresh</button><output id='state'>{JSON.stringify({count:inbox.conversations.length,status:inbox.status})}</output>
          {location.search.includes('generic')?<GenericList {...props}/>:<List {...props}/>}</>}
      let root=createRoot(document.getElementById('root'));root.render(<Harness/>);
      window.remount=()=>{root.unmount();root=createRoot(document.getElementById('root'));root.render(<Harness/>)};` },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "professional-inbox-api", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

async function mount(page: Page, query = "", total = 230, deferred = false, responsive = false) {
  await page.route("**/*", route => new URL(route.request().url()).pathname === "/inbox-pagination"
    ? route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div></body></html>' }) : route.abort());
  await page.goto(`http://localhost:3000/inbox-pagination${query}`);
  await page.evaluate(value => { Object.assign(window, { seedTotal: value }); }, total);
  if (query.includes("initial-error")) await page.evaluate("failInitial=true");
  await page.addScriptTag({ content: bundle });
  if (responsive) {
    expect(styles).toContain("container-wesal");
    await page.addStyleTag({ content: styles });
  }
  await expect(page.locator("#state")).toContainText('"status":"ready"');
  if (deferred) await page.evaluate("deferred=true;ignoreAbort=true");
}
const more = (page: Page) => page.getByTestId("inbox-load-more");

for (const role of ["Photographer", "Coordinator"]) {
  test(`${role}: platform team stays out of Customers; All combines customers and administration`, async ({ page }) => {
    await mount(page, "?platform-team", 3);
    if (role === "Coordinator") await page.evaluate("actions.login('coordinator', 'Coordinator')");
    await expect(page.getByRole("tab", { name: "العملاء(2)", exact: true })).toBeVisible();
    await expect(page.getByTestId("inbox-conversation")).toHaveCount(2);
    // A real customer named Admin must not acquire the platform team's branding.
    await expect(page.getByTestId("inbox-conversation").filter({ hasText: "Admin" })).toHaveCount(1);
    await expect(page.getByTestId("inbox-conversation").filter({ hasText: "فريق وصال" })).toHaveCount(0);
    await page.getByRole("tab", { name: "الإدارة(1)", exact: true }).click();
    await expect(page.getByTestId("inbox-conversation")).toHaveCount(1);
    await expect(page.getByTestId("inbox-conversation")).toHaveAttribute("data-conversation-id", "admin");
    await page.getByRole("tab", { name: "الكل(3)", exact: true }).click();
    await expect(page.getByTestId("inbox-conversation")).toHaveCount(3);
    await page.evaluate("actions.language('en')");
    await expect(page.getByRole("tab", { name: "All(3)", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Customers(2)", exact: true }).click();
    await expect(page.getByTestId("inbox-conversation")).toHaveCount(2);
  });
}

test("All preserves load-more, and platform exclusions remain stable after refresh and account switching", async ({ page }) => {
  await mount(page, "?platform-team", 102);
  await page.getByRole("tab", { name: "الكل(102)", exact: true }).click();
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(100);
  await more(page).click();
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(102);
  await expect(more(page)).toHaveCount(0);
  await page.locator("#refresh").click();
  await expect(page.getByRole("tab", { name: "العملاء(101)", exact: true })).toBeVisible();
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(102);
  await page.evaluate("actions.logout();actions.login('B')");
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(100);
  await expect(more(page)).toBeVisible();
});

test("an inbox containing only the platform team has zero customers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(page, "?platform-team", 1);
  await expect(page.getByRole("tab", { name: "العملاء(0)", exact: true })).toBeVisible();
  await expect(page.getByTestId("inbox-list-empty")).toBeVisible();
  await page.getByRole("tab", { name: "الكل(1)", exact: true }).click();
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(1);
  await expect(page.getByTestId("inbox-conversation")).toHaveAttribute("data-conversation-id", "admin");
});

test("a platform row in a later customer page is excluded without duplicating administration", async ({ page }) => {
  await mount(page, "", 102, true);
  await more(page).click();
  await page.evaluate(`const data=response({page:2,pageSize:100});data.items[0].otherParticipantName='Wesal Team - Admin';requests[1].resolve(data)`);
  await expect(page.getByRole("tab", { name: "العملاء(101)", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "الكل(102)", exact: true }).click();
  await expect(page.getByTestId("inbox-conversation")).toHaveCount(102);
  await page.locator("#refresh").click();
  await page.evaluate("requests[2].resolve()");
  await expect(page.getByRole("tab", { name: "العملاء(101)", exact: true })).toBeVisible();
});

test("more than 100 conversations remain accessible without fetching every page automatically", async ({ page }) => {
  await mount(page);
  expect(await page.evaluate("inbox.conversations.length")).toBe(101);
  await expect(more(page)).toBeVisible();
  expect(await page.evaluate("requests.map(x=>x.params.page)")).toEqual([1]);
  await more(page).click();
  await expect(page.locator("#state")).toContainText('"count":201');
  await more(page).click();
  await expect(page.locator("#state")).toContainText('"count":231');
  expect(await page.evaluate("inbox.conversations.slice(0,3).map(x=>x.conversationId)")).toEqual(["chat-001", "chat-002", "chat-003"]);
  await expect(more(page)).toHaveCount(0);
  expect(await page.evaluate("requests.map(x=>x.params.page)")).toEqual([1, 2, 3]);
});

test("fewer than 100 customers and the admin conversation do not show load-more", async ({ page }) => {
  await mount(page, "", 7);
  expect(await page.evaluate("inbox.conversations.length")).toBe(8);
  await expect(more(page)).toHaveCount(0);
});

test("professional pagination does not depend on including the separate admin conversation", async ({ page }) => {
  await mount(page, "?no-admin");
  expect(await page.evaluate("inbox.conversations.length")).toBe(100);
  await more(page).click();
  await expect(page.locator("#state")).toContainText('"count":200');
});

test("no customers keeps the empty state and separate admin conversation", async ({ page }) => {
  await mount(page, "", 0);
  await expect(page.getByTestId("inbox-list-empty")).toBeVisible();
  await expect(more(page)).toHaveCount(0);
  await page.getByRole("tab").nth(1).click();
  await expect(page.getByTestId("inbox-conversation-list")).toBeVisible();
});

test("initial customer failure preserves admin access and retries customer page one", async ({ page }) => {
  await mount(page, "?initial-error");
  expect(await page.evaluate("inbox.conversations.map(x=>x.conversationId)")).toEqual(["admin"]);
  await expect(page.getByTestId("inbox-load-more-error")).toBeVisible();
  await page.evaluate("failInitial=false");
  await more(page).click();
  await expect(page.locator("#state")).toContainText('"count":101');
  expect(await page.evaluate("requests.map(x=>x.params.page)")).toEqual([1, 1]);
});

test("a later failure preserves rows; retry and double-clicking request the same page once", async ({ page }) => {
  await mount(page, "", 230, true);
  await page.evaluate("inbox.loadMore();inbox.loadMore();inbox.loadMore()");
  await expect.poll(() => page.evaluate("requests.length")).toBe(2);
  await page.evaluate("requests[1].reject()");
  await expect(page.getByTestId("inbox-load-more-error")).toBeVisible();
  expect(await page.evaluate("inbox.conversations.length")).toBe(101);
  await more(page).click();
  await expect.poll(() => page.evaluate("requests.length")).toBe(3);
  await page.evaluate("requests[2].resolve()");
  await expect(page.locator("#state")).toContainText('"count":201');
  expect(await page.evaluate("requests[2].params.page")).toBe(2);
});

test("overlapping pages cannot duplicate rows or undo realtime previews and read state", async ({ page }) => {
  await mount(page, "", 230, true);
  await more(page).click();
  await expect.poll(() => page.evaluate("requests.length")).toBe(2);
  await page.evaluate(`inbox.applyPreview('chat-001','live update','2032-01-01T00:00:00Z');inbox.markLocalRead('chat-001');
    const data=response({page:2,pageSize:100});data.items.unshift(row(1));requests[1].resolve(data)`);
  await expect(page.locator("#state")).toContainText('"count":201');
  expect(await page.evaluate("inbox.conversations[0]")).toMatchObject({ conversationId: "chat-001", lastMessagePreview: "live update", unreadMessageCount: 0 });
  expect(await page.evaluate("new Set(inbox.conversations.map(x=>x.conversationId)).size")).toBe(201);
});

test("realtime updates for a not-yet-loaded conversation survive its pending page response", async ({ page }) => {
  await mount(page, "", 230, true);
  await more(page).click();
  await expect.poll(() => page.evaluate("requests.length")).toBe(2);
  await page.evaluate("inbox.applyPreview('chat-101','new live message','2032-01-01T00:00:00Z');inbox.applyUnreadCount('chat-101',9);requests[1].resolve()");
  await expect(page.locator("#state")).toContainText('"count":201');
  expect(await page.evaluate("inbox.conversations[0]")).toMatchObject({ conversationId: "chat-101", lastMessagePreview: "new live message", unreadMessageCount: 9 });
  await more(page).click();
  await expect.poll(() => page.evaluate("requests.length")).toBe(3);
  await page.evaluate(`inbox.applyPreview('chat-201','already saved','2033-01-01T00:00:00Z');
    const data=response({page:3,pageSize:100});Object.assign(data.items[0],{lastMessagePreview:'already saved',lastMessageAt:'2033-01-01T00:00:00Z',unreadMessageCount:4,isUnread:true});requests[2].resolve(data)`);
  await expect(page.locator("#state")).toContainText('"count":231');
  expect(await page.evaluate("inbox.conversations[0]")).toMatchObject({ conversationId: "chat-201", unreadMessageCount: 4 });
});

for (const transition of ["actions.login('B')", "actions.logout()", "actions.logout();actions.login('A')"]) {
  test(`late pagination stays isolated after ${transition}`, async ({ page }) => {
    await mount(page, "", 230, true);
    await more(page).click();
    await expect.poll(() => page.evaluate("requests.length")).toBe(2);
    await page.evaluate(transition);
    await expect(page.locator("#state")).toContainText('"count":0');
    await page.evaluate("requests[1].resolve()");
    await expect(page.locator("#state")).toContainText('"count":0');
    expect(await page.evaluate("requests[1].aborted")).toBe(true);
  });
}

test("unmounting aborts a page request; remount starts a separate first-page request", async ({ page }) => {
  await mount(page, "", 230, true);
  await more(page).click();
  await expect.poll(() => page.evaluate("requests.length")).toBe(2);
  await page.evaluate("remount()");
  await expect.poll(() => page.evaluate("requests.length")).toBe(3);
  await page.evaluate("requests[1].resolve();requests[2].resolve()");
  await expect(page.locator("#state")).toContainText('"count":101');
  expect(await page.evaluate("requests[1].aborted")).toBe(true);
  expect(await page.evaluate("requests[2].params.page")).toBe(1);
});

test("refresh retains loaded pages and newer unread patches while rejecting a stale page response", async ({ page }) => {
  await mount(page);
  await more(page).click();
  await expect(page.locator("#state")).toContainText('"count":201');
  await page.evaluate("deferred=true;ignoreAbort=true;inbox.loadMore()");
  await expect.poll(() => page.evaluate("requests.length")).toBe(3);
  await page.locator("#refresh").click();
  await expect.poll(() => page.evaluate("requests.length")).toBe(4);
  await page.evaluate("inbox.applyUnreadCount('chat-001',9);requests[3].resolve();requests[2].resolve()");
  await expect(page.locator("#state")).toContainText('"count":201');
  expect(await page.evaluate("inbox.conversations.find(x=>x.conversationId==='chat-001').unreadMessageCount")).toBe(9);
  await more(page).click();
  await expect.poll(() => page.evaluate("requests.length")).toBe(5);
  expect(await page.evaluate("requests[4].params.page")).toBe(3);
});

for (const lang of ["ar", "en"]) for (const width of [390, 1366]) {
  test(`${lang} at ${width}px: load more, admin filter and opening a conversation`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, `?lang=${lang}`, 230, false, true);
    await expect(more(page)).toHaveText(lang === "ar" ? "تحميل المزيد" : "Load more");
    await page.getByRole("tab").nth(1).click();
    await expect(more(page)).toHaveCount(0);
    await page.getByRole("tab").first().click();
    await more(page).focus();await page.keyboard.press("Enter");
    await expect(page.locator("#state")).toContainText('"count":201');
    expect(await page.evaluate("document.documentElement.scrollWidth<=innerWidth")).toBe(true);
    await page.locator('[data-testid="inbox-conversation-list"] button').nth(100).click();
    expect(await page.evaluate("selected")).toBe("chat-101");
  });
}

test("the generic inbox used by the floating widget also exposes pagination", async ({ page }) => {
  await mount(page, "?generic");
  await more(page).click();
  await expect(page.locator("#state")).toContainText('"count":201');
});
