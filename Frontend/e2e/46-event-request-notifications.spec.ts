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
      export function useUserIdentity(){const account=useSyncExternalStore(subscribeNotificationAccount,readNotificationAccount);return{authenticated:!!account,role:getStoredAuth()?.user?.role,isAdmin:getStoredAuth()?.user?.role==='Admin',isHallOwner:getStoredAuth()?.user?.role==='HallOwner'}}`,
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
    import{applyServerNotification}from'./src/services/platform-notification-realtime';import{mapServerNotification}from'./src/lib/platform-notification-mapper';import{resolveNotificationActionUrl}from'./src/lib/platform-notification-routes';import{readNotificationAccount}from'./src/lib/notification-account';import{currentNotificationRequests}from'./src/lib/notification-requests';import*as store from'./src/lib/platform-notifications-store';
    window.refreshUnread=()=>currentNotificationRequests(readNotificationAccount())?.refreshUnread();window.mapper=mapServerNotification;window.resolve=resolveNotificationActionUrl;window.live=applyServerNotification;window.account=readNotificationAccount;window.requests=[];window.writes=[];window.opened=[];window.lang=window.seedLang||'en';
    window.id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
    window.kind=window.seedRole==='HallOwner'?'EVENT_REQUEST_HALL':window.seedRole==='EventCoordinator'?'EVENT_REQUEST_DECORATION_GIFTS':'EVENT_REQUEST_PHOTOGRAPHY';
    window.make=(n,createdAt)=>({id:id(n),type:kind,title:'Notification '+n,body:'Body '+n,createdAt:createdAt||new Date(Date.UTC(2020,0,1,0,0,-n)).toISOString(),isRead:false,readAt:null,actionTarget:'Conversation',targetId:id(999),conversationId:id(999),payloadJson:JSON.stringify({eventRequestId:id(n+1000),seekerId:'seeker-user',fullName:'سلمى',eventDate:'2026-12-01',eventType:'WEDDING',serviceType:kind==='EVENT_REQUEST_HALL'?'HALL':kind==='EVENT_REQUEST_DECORATION_GIFTS'?'DECORATION_GIFTS':'PHOTOGRAPHY'})});
    window.restTitle=window.lang==='ar'?'طلب مناسبة جديد':'New event request';
    window.restBody=window.lang==='ar'?'الباحث "سلمى" يبحث عن '+(kind==='EVENT_REQUEST_HALL'?'صالة':kind==='EVENT_REQUEST_DECORATION_GIFTS'?'محلات تزيين وهدايا':'مصورين')+' في تاريخ "2026-12-01" بمناسبة "زفاف". انقر هنا للتواصل معه عن '+(kind==='EVENT_REQUEST_HALL'?'قاعتك':kind==='EVENT_REQUEST_DECORATION_GIFTS'?'منتجاتك':'تصويرك')+' وعروضك.':'A seeker is looking for '+(kind==='EVENT_REQUEST_HALL'?'a hall':kind==='EVENT_REQUEST_DECORATION_GIFTS'?'decoration and gift shops':'photographers')+' on 2026-12-01 for زفاف.';
    window.rows=Array.from({length:window.seedTotal??1},(_,i)=>({...make(i+1),title:restTitle,body:restBody}));
    window.actions={login(id,role=window.seedRole||'RegisteredUser',version=''){const token='account-'+id+version;setAccessToken(token);setStoredAuth({token,user:{id,role}})},logout:clearAuthSession,
      refreshSession(){actions.login('A',window.seedRole||'RegisteredUser','-renewed')},
      language(lang){window.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';window.dispatchEvent(new Event('language'))},
      incoming(){const row={...make(9999,new Date().toISOString()),title:restTitle,body:restBody};rows.unshift(row);applyServerNotification({kind:row.type,title:row.title,body:row.body,targetId:row.targetId,actionTarget:row.actionTarget,occurredAt:row.createdAt})}};
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
  await page.evaluate(opts => Object.assign(window, { seedTotal: opts.total ?? 1, seedLang: opts.lang ?? "en", seedRole: opts.role ?? "Photographer", deferred: opts.deferred ?? false }), options);
  if (options.styled) { expect(styles).toContain("container-wesal"); await page.addStyleTag({ content: styles }); }
  await page.addScriptTag({ content: bundle });
}
const feed = (page: Page) => page.getByTestId("platform-notifications-feed");
const more = (page: Page) => page.getByTestId("notifications-load-more");
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const recipients = [
  { role: "HallOwner", type: "event_request_hall", icon: "hall", base: "/owner/messages", service: "HALL" },
  { role: "EventCoordinator", type: "event_request_decoration_gifts", icon: "gifts", base: "/profile/messages", service: "DECORATION_GIFTS" },
  { role: "Photographer", type: "event_request_photography", icon: "photography", base: "/profile/messages", service: "PHOTOGRAPHY" },
] as const;

for (const recipient of recipients) for (const lang of ["ar", "en"]) {
  test(`${recipient.role}: ${lang} REST content, metadata, icon, read state and customer conversation link`, async ({ page }) => {
    await mount(page, { role: recipient.role, lang });
    const row = page.getByTestId(`platform-notification-${id(1)}`);
    await expect(row).toHaveAttribute("data-type", recipient.type);
    await expect(row).toContainText(lang === "ar" ? "طلب مناسبة جديد" : "New event request");
    await expect(row).toContainText("2026-12-01");
    await expect(row).toContainText("زفاف");
    await expect(row.getByTestId(`event-request-${recipient.icon}-icon`)).toBeVisible();
    expect(await page.evaluate("currentNotifications.items[0].metadata")).toMatchObject({
      conversation_id: id(999), event_request_id: id(1001), seeker_id: "seeker-user", user_name: "سلمى",
      date: "2026-12-01", event_type: "WEDDING", service_type: recipient.service,
    });
    expect(await page.evaluate("currentNotifications.items[0].created_at===rows[0].createdAt")).toBe(true);
    await expect(row).toHaveAttribute("data-read", "false");
    await row.click();
    await expect(row).toHaveAttribute("data-read", "true");
    expect(await page.evaluate("opened")).toEqual([`${recipient.base}?conversation_id=${id(999)}`]);
    expect(await page.evaluate("writes.map(x=>x.path)")).toContain(`/notifications/${id(1)}/read`);
    await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(0);
  });
}

for (const recipient of recipients) {
  test(`${recipient.role}: missing or malformed conversation identifiers fall back to its inbox`, async ({ page }) => {
    await mount(page, { role: recipient.role, deferred: true });
    await page.evaluate("requests[0].reject();rows[0].conversationId={bad:true};rows[0].targetId='not-a-guid';window.deferred=false");
    await page.getByTestId("notifications-retry").click();
    await page.getByTestId(`platform-notification-${id(1)}`).click();
    expect(await page.evaluate("opened")).toEqual([recipient.base]);
    expect(await page.evaluate("currentNotifications.items[0].metadata.conversation_id")).toBeUndefined();
  });

  test(`${recipient.role}: realtime invalidation uses durable IDs without local duplicates`, async ({ page }) => {
    await mount(page, { role: recipient.role });
    await expect(feed(page).locator("li")).toHaveCount(1);
    await page.evaluate("actions.incoming()");
    const row = page.getByTestId(`platform-notification-${id(9999)}`);
    await expect(row).toBeVisible();
    await expect(feed(page).locator("li")).toHaveCount(2);
    expect(await page.evaluate("currentNotifications.items.every(x=>!x.id.startsWith('notify-'))")).toBe(true);
    expect(await page.evaluate("currentNotifications.items.find(x=>x.id===id(9999)).created_at===rows[0].createdAt")).toBe(true);
    await page.evaluate("live({kind,targetId:id(999),actionTarget:'Conversation',title:restTitle,body:restBody});live({kind,targetId:id(999),actionTarget:'Conversation',title:restTitle,body:restBody})");
    await expect(feed(page).locator("li")).toHaveCount(2);
    await row.click();
    expect(await page.evaluate("opened")).toEqual([`${recipient.base}?conversation_id=${id(999)}`]);
    expect(await page.evaluate("writes.map(x=>x.path)")).toContain(`/notifications/${id(9999)}/read`);
  });
}

test("TargetId alone is the actual realtime conversation contract, not an event-request ID", async ({ page }) => {
  await mount(page);
  const result = await page.evaluate("mapper({kind,title:restTitle,body:restBody,targetId:id(999),actionTarget:'Conversation',payloadJson:JSON.stringify({eventRequestId:id(1001)})})");
  expect(result.metadata.conversation_id).toBe(id(999));
  expect(await page.evaluate(`resolve('${result.type}',${JSON.stringify(result.metadata)})`)).toBe(`/profile/messages?conversation_id=${id(999)}`);
  const missing = await page.evaluate("mapper({kind,title:restTitle,body:restBody,payloadJson:JSON.stringify({eventRequestId:id(1001),seekerId:'other-user'})})");
  expect(missing.metadata.conversation_id).toBeUndefined();
});

test("explicit ConversationId wins over a conflicting TargetId and untrusted action URLs are ignored", async ({ page }) => {
  await mount(page);
  const mapped = await page.evaluate("mapper({kind,title:restTitle,body:restBody,conversationId:id(8),targetId:id(9),actionTarget:'Conversation'})");
  expect(mapped.metadata.conversation_id).toBe(id(8));
  expect(await page.evaluate(`resolve('${mapped.type}',${JSON.stringify(mapped.metadata)},'https://outside.example/')`)).toBe(`/profile/messages?conversation_id=${id(8)}`);
});

test("malformed optional payloads and unknown kinds cannot crash the mapper", async ({ page }) => {
  await mount(page);
  for (const value of [null, "not-json", "[]", "null", '{"eventRequestId":{},"eventDate":123}']) {
    const result = await page.evaluate(`mapper({kind,title:restTitle,body:restBody,targetId:id(999),actionTarget:'Conversation',payloadJson:${JSON.stringify(value)}})`);
    expect(result.metadata.conversation_id).toBe(id(999));
    expect(result.body).toContain("2026-12-01");
  }
  expect(await page.evaluate("mapper({kind,title:12,body:34})")).toBeNull();
  expect(await page.evaluate("mapper({kind:123,title:'Text'})")).toBeNull();
  expect(await page.evaluate("mapper({kind:'__proto__',title:'Text'})")).toBeNull();
  expect(await page.evaluate("mapper(null)")).toBeNull();
  expect(await page.evaluate("mapper({kind:'Unrecognized',title:'Text'})")).toBeNull();
});

test("each service notification remains hidden from a different recipient role", async ({ page }) => {
  await mount(page, { role: "Photographer" });
  await expect(feed(page).locator("li")).toHaveCount(1);
  await page.evaluate("actions.login('B','EventCoordinator')");
  await expect(page.getByTestId("platform-notifications-empty")).toBeVisible();
  expect(await page.evaluate("currentNotifications.items.length")).toBe(0);
});

test("already-read REST rows keep their read state and timestamp", async ({ page }) => {
  await mount(page, { deferred: true });
  await page.evaluate("requests[0].reject();rows[0].isRead=true;rows[0].readAt='2020-02-01T00:00:00Z';window.deferred=false");
  await page.getByTestId("notifications-retry").click();
  await expect(page.getByTestId(`platform-notification-${id(1)}`)).toHaveAttribute("data-read", "true");
  expect(await page.evaluate("currentNotifications.items[0].created_at===rows[0].createdAt")).toBe(true);
});

test("different persisted requests sharing one conversation are not collapsed", async ({ page }) => {
  await mount(page, { total: 3 });
  await expect(feed(page).locator("li")).toHaveCount(3);
  expect(await page.evaluate("new Set(currentNotifications.items.map(x=>x.id)).size")).toBe(3);
  expect(await page.evaluate("new Set(currentNotifications.items.map(x=>x.metadata.conversation_id)).size")).toBe(1);
});

test("realtime refresh queued behind pagination preserves all loaded rows and cursor", async ({ page }) => {
  await mount(page, { total: 85 });
  await expect(feed(page).locator("li")).toHaveCount(40);
  await page.evaluate("window.deferred=true;currentNotifications.loadMore();actions.incoming();live({kind,targetId:id(999),actionTarget:'Conversation'})");
  await page.evaluate("window.deferred=false;requests.filter(x=>x.params?.page===2).forEach(x=>x.resolve())");
  await expect(page.getByTestId(`platform-notification-${id(9999)}`)).toHaveCount(1);
  await expect(feed(page).locator("li")).toHaveCount(81);
  await expect(more(page)).toBeVisible();
  await more(page).click();
  await expect(feed(page).locator("li")).toHaveCount(86);
  expect(await page.evaluate("requests.filter(x=>x.path==='/notifications').map(x=>x.params.page)")).toEqual([1, 2, 1, 3]);
});

test("a new event arriving during a pending head refresh gets a subsequent bounded refresh", async ({ page }) => {
  await mount(page); await expect(feed(page).locator("li")).toHaveCount(1);
  await page.evaluate("window.deferred=true;actions.incoming()");
  await page.evaluate("rows.unshift({...make(8888,new Date().toISOString()),title:restTitle,body:restBody});live({kind,targetId:id(999),actionTarget:'Conversation'})");
  await page.evaluate("window.deferred=false;requests.filter(x=>x.path==='/notifications').at(-1).resolve()");
  await expect(page.getByTestId(`platform-notification-${id(8888)}`)).toHaveCount(1);
  await expect(feed(page).locator("li")).toHaveCount(3);
});

for (const action of ["actions.login('B')", "actions.logout()", "actions.refreshSession()"]) {
  test(`pending realtime refresh cannot survive ${action}`, async ({ page }) => {
    await mount(page); await expect(feed(page).locator("li")).toHaveCount(1);
    await page.evaluate("window.oldAccount=account();window.deferred=true;window.ignoreAbort=true;actions.incoming();window.pendingOld=requests.filter(x=>x.path==='/notifications').at(-1)");
    await page.evaluate(action);
    await page.evaluate("pendingOld.resolve()");
    await expect(page.getByTestId(`platform-notification-${id(9999)}`)).toHaveCount(0);
    const count = await page.evaluate("requests.length");
    await page.evaluate("live({kind,targetId:id(999),actionTarget:'Conversation'},oldAccount)");
    expect(await page.evaluate("requests.length")).toBe(count);
  });
}

test("realtime API failure retains existing notifications and gives a safe retry", async ({ page }) => {
  await mount(page); await expect(feed(page).locator("li")).toHaveCount(1);
  await page.evaluate("window.fail=true;actions.incoming()");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(feed(page).locator("li")).toHaveCount(1);
  await page.evaluate("window.fail=false"); await page.getByTestId("notifications-retry").click();
  await expect(feed(page).locator("li")).toHaveCount(2);
});

test("a pre-event unread response cannot replace the refreshed event-request count", async ({ page }) => {
  await mount(page);
  await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(1);
  await page.evaluate("window.holdUnread=true;refreshUnread();window.oldUnread=requests.filter(x=>x.path.endsWith('/unread-count')).at(-1);actions.incoming()");
  await expect(page.getByTestId(`platform-notification-${id(9999)}`)).toHaveCount(1);
  await page.evaluate("window.holdUnread=false;oldUnread.resolve()");
  await expect.poll(() => page.evaluate("currentNotifications.unreadCount")).toBe(2);
});

test("existing booking types and navigation remain unchanged", async ({ page }) => {
  await mount(page);
  const mapped = await page.evaluate("mapper({kind:'BookingRequestSentToRequester',title:'Request sent',body:'Existing booking',actionTarget:'MyBookings',targetId:id(123)})");
  expect(mapped.type).toBe("booking_submitted");
  expect(await page.evaluate(`resolve('${mapped.type}',${JSON.stringify(mapped.metadata)},${JSON.stringify(mapped.action_url)},'seeker')`)).toBe("/profile/bookings");
});

for (const lang of ["ar", "en"]) for (const width of [390, 768, 1366]) {
  test(`${lang} event-request notifications remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, { lang, styled: true });
    const row = page.getByTestId(`platform-notification-${id(1)}`);
    await expect(row).toBeVisible();
    expect(await page.locator("html").getAttribute("dir")).toBe(lang === "ar" ? "rtl" : "ltr");
    await row.click();
    expect(await page.evaluate("opened")).toEqual([`/profile/messages?conversation_id=${id(999)}`]);
  });
}

