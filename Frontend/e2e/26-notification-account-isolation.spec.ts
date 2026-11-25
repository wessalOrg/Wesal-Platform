import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/i18n": "export const t=k=>k; export const useT=()=>t;",
    "next/navigation": "export const useRouter=()=>({push(path){window.openedPaths.push(path)}});",
    "@/hooks/useUserIdentity": `import{useSyncExternalStore}from'react';
      import{getStoredAuth,AUTH_CHANGE_EVENT}from'@/lib/auth-storage';
      const subscribe=f=>{window.addEventListener(AUTH_CHANGE_EVENT,f);return()=>window.removeEventListener(AUTH_CHANGE_EVENT,f)};
      export function useUserIdentity(){const raw=useSyncExternalStore(subscribe,()=>JSON.stringify(getStoredAuth()?.user??null));
        const user=JSON.parse(raw);return{authenticated:!!user,isAdmin:user?.role==='Admin',isHallOwner:user?.role==='HallOwner'}};`,
    "@microsoft/signalr": `export const HubConnectionState={Connected:'Connected',Disconnected:'Disconnected'};
      export const LogLevel={Trace:0,Debug:1,Information:2,Warning:3,Error:4,Critical:5,None:6};
      export class HubConnectionBuilder{withUrl(url,options){this.url=url;this.options=options;return this}
        withAutomaticReconnect(){return this}configureLogging(){return this}build(){const handlers={};
          const hub={url:this.url,options:this.options,state:'Disconnected',stops:0,joins:[],
            on(name,fn){handlers[name]=fn},onreconnected(fn){this.reconnect=fn},
            start(){return new Promise(resolve=>{this.finishStart=()=>{this.state='Connected';resolve()};if(!window.holdHubStarts)this.finishStart()})},
            stop(){this.stops++;this.state='Disconnected';return Promise.resolve()},
            invoke(name){this.joins.push(name);return Promise.resolve()},emit(name,event){handlers[name]?.(event)}};
          window.hubs.push(hub);return hub}}`,
  };
  const result = await build({
    stdin: { contents: `import React,{useState,useEffect,useSyncExternalStore}from'react';import{createRoot}from'react-dom/client';
      import{useNotifications}from'./src/hooks/useNotifications';
      import{useProfessionalReviewNotes}from'./src/hooks/useProfessionalReviewNotes';
      import ToastHost from'./src/components/notifications/NotificationToastHost';
      import{readNotificationAccount,subscribeNotificationAccount}from'./src/lib/notification-account';
      import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';import{setAccessToken}from'./src/lib/auth-token';
      import*as store from'./src/lib/platform-notifications-store';
      import{subscribePlatformNotificationRealtime}from'./src/services/platform-notification-realtime';
      import{subscribeOwnerBookingRequestEvents}from'./src/services/booking-notification-realtime';
      window.hubs=[];window.openedPaths=[];window.ownerEvents=[];
      function Probe(){const h=useNotifications();window.currentNotifications=h;return <>
        <output data-testid="notification-state">{JSON.stringify({user:h.account?.userId??null,items:h.items.map(i=>({id:i.id,title:i.title,read:i.is_read})),unread:h.unreadCount})}</output>
        <button onClick={h.markAllRead}>Read all</button><button onClick={()=>h.items[0]&&h.markRead(h.items[0].id)}>Read first</button>
        <button onClick={()=>h.items[0]&&h.openNotification(h.items[0])}>Open first</button></>}
      function Realtime(){const account=useSyncExternalStore(subscribeNotificationAccount,readNotificationAccount,()=>null);
        useEffect(()=>{if(!account)return;const a=subscribePlatformNotificationRealtime();
          const b=subscribeOwnerBookingRequestEvents(e=>window.ownerEvents.push(e));return()=>{a();b()}},[account]);return null}
      function Review(){const notes=useProfessionalReviewNotes('rejected');return <output data-testid="review-notes">{JSON.stringify(notes)}</output>}
      function Harness(){const[shown,setShown]=useState(true);return <><button id="toggle" onClick={()=>setShown(v=>!v)}>Toggle</button>
        {shown&&<><Probe/><ToastHost/><Realtime/>{location.search.includes('review')&&<Review/>}</>}</>}
      window.notificationTest={store,readNotificationAccount,login(id,role='RegisteredUser',version=''){
        const token='account-'+id+version;setAccessToken(token);setStoredAuth({token,user:{id,role}})},logout:clearAuthSession,
        partialToken(token){setAccessToken(token);window.dispatchEvent(new Event('wesal-auth-change'))},
        push(id,audience='seeker'){return store.pushPlatformNotification({type:'booking_accepted',audience,title:'Private '+id,body:'Booking '+id,
          action_url:'/profile/bookings',actionLabel:'Open',metadata:{booking_id:id},toast:true})}};
      createRoot(document.getElementById('root')).render(<Harness/>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.VERCEL_ENV": "undefined", "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"' },
    plugins: [{ name: "notification-shell", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

type Held = { token: string; path: string; reply: (body: unknown) => Promise<void> };
type Options = { hold?: "list" | "unread" | "write"; unread?: Record<string, number>; failUnread?: boolean; serverA?: boolean; review?: boolean };
async function mount(page: Page, options: Options = {}) {
  const held: Held[] = [], requests: Array<{ token: string; path: string; method: string }> = [], errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/notifications-isolation-test") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
    if (!url.pathname.startsWith("/api/v1/")) throw new Error(`Unexpected network: ${url.pathname}`);
    const token = route.request().headers().authorization ?? "", requestPath = url.pathname.slice(7), method = route.request().method();
    requests.push({ token, path: requestPath, method });
    const reply = async (body: unknown) => {
      // Match the real PagedResult contract for the small, complete mock inboxes.
      const items = body && typeof body === "object" ? (body as { items?: unknown[] }).items : null;
      if (requestPath === "/notifications" && Array.isArray(items)) {
        body = { pageNumber: 1, pageSize: 40, totalCount: items.length, totalPages: items.length ? 1 : 0,
          hasPreviousPage: false, hasNextPage: false, ...body as object };
      }
      // Aborted old-account HTTP requests may already have been detached by the browser.
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) }).catch(() => undefined);
    };
    const hold = options.hold === "list" && requestPath === "/notifications" ||
      options.hold === "unread" && requestPath === "/notifications/unread-count" || options.hold === "write" && method === "PUT";
    if (hold && token === "Bearer account-A") { held.push({ token, path: requestPath, reply }); return; }
    if (requestPath === "/notifications") return reply(options.serverA && token === "Bearer account-A" ? apiA : { items: [] });
    if (requestPath === "/notifications/unread-count") {
      if (options.failUnread) return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return reply(options.unread?.[token] ?? 0);
    }
    return reply({});
  });
  await page.goto(`http://localhost:3000/notifications-isolation-test${options.review ? "?review" : ""}`);
  await page.evaluate(() => { Object.assign(window, { process: { env: {} } }); });
  await page.addScriptTag({ content: bundle });
  const state = page.getByTestId("notification-state");
  await expect(state).toContainText('"user":null');
  return { state, held, requests, errors };
}
async function login(page: Page, id: string, role = "RegisteredUser", version = "") {
  await page.evaluate(`notificationTest.login(${JSON.stringify(id)},${JSON.stringify(role)},${JSON.stringify(version)})`);
  await expect(page.getByTestId("notification-state")).toContainText(`"user":"${id}"`);
}
const apiA = { items: [{ id: "11111111-1111-1111-1111-111111111111", type: "BookingAcceptedForRequester",
  title: "API Private A", body: "A booking", createdAt: "2030-01-01T00:00:00Z", isRead: false }] };

for (const [role, audience] of [["RegisteredUser", "seeker"], ["HallOwner", "owner"], ["Admin", "admin"],
  ["EventCoordinator", "seeker"], ["Photographer", "seeker"]]) {
  test(`${role}: local notifications, read state and empty merges stay inside their account`, async ({ page }) => {
    const { state, errors } = await mount(page, { failUnread: true });
    await login(page, "A", role);
    await page.evaluate(`notificationTest.push('A', '${audience}')`);
    await expect(state).toContainText('"title":"Private A"');
    await expect(state).toContainText('"unread":1');
    await page.evaluate("notificationTest.logout()");
    await expect(state).toContainText('"items":[]');
    await expect(page.getByTestId("platform-notification-toast")).toHaveCount(0);
    await login(page, "B", role);
    await page.evaluate("notificationTest.store.replacePlatformNotifications([])");
    await expect(state).not.toContainText("Private A");
    await page.evaluate(`notificationTest.push('B', '${audience}')`);
    await page.getByRole("button", { name: "Read all", exact: true }).click();
    await expect(state).toContainText('"read":true');
    await login(page, "A", role);
    await expect(state).toContainText('"title":"Private A","read":false');
    await expect(state).not.toContainText("Private B");
    await expect(page.getByTestId("platform-notification-toast")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("legacy storage, missing ID and partial token transitions expose no notifications or old popup", async ({ page }) => {
  const { state } = await mount(page);
  await page.evaluate(`localStorage.setItem('wesal-platform-notifications',JSON.stringify([{id:'notify-legacy',type:'booking_accepted',
    audience:'seeker',title:'Legacy private',body:'private',metadata:{},is_read:false}]));notificationTest.push('Guest')`);
  await expect(state).toContainText('"items":[]');
  await login(page, "A"); await page.evaluate("notificationTest.push('A')");
  await expect(page.getByTestId("platform-notification-toast")).toContainText("Private A");
  await page.evaluate("notificationTest.login('')");
  await expect(state).toContainText('"user":null');
  await expect(page.getByTestId("platform-notification-toast")).toHaveCount(0);
  await login(page, "A");
  await page.evaluate("notificationTest.partialToken('different-token');notificationTest.push('Partial')");
  await expect(state).toContainText('"user":null');
  await login(page, "B");
  await expect(state).not.toContainText("Legacy private");
  await expect(state).not.toContainText("Private A");
  expect(await page.evaluate("localStorage.getItem('wesal-platform-notifications')")).toContain("Legacy private");
});

for (const transition of ["switch", "logout", "return", "remount"] as const) {
  test(`late list response is ignored after ${transition}`, async ({ page }) => {
    const { state, held, requests, errors } = await mount(page, { hold: "list" });
    await login(page, "A"); await expect.poll(() => held.length).toBe(1);
    await page.evaluate("window.oldAccount=notificationTest.readNotificationAccount();window.oldActions=currentNotifications");
    if (transition === "remount") await page.locator("#toggle").click();
    await page.evaluate("notificationTest.logout()");
    if (transition !== "logout") {
      if (transition === "remount") await page.evaluate("notificationTest.login('B')");
      else await login(page, "B");
      if (transition === "return") await login(page, "A", "RegisteredUser", "-new");
    }
    if (transition === "remount") await page.locator("#toggle").click();
    await held[0].reply(apiA);
    await page.evaluate(`notificationTest.store.replacePlatformNotifications(${JSON.stringify(apiA.items)},oldAccount);oldActions.markAllRead()`);
    await expect(state).not.toContainText("API Private A");
    if (transition !== "logout") await expect.poll(() => requests.filter(r => r.path === "/notifications" && r.token !== "Bearer account-A").length)
      .toBe(transition === "return" ? 2 : 1);
    expect(errors).toEqual([]);
  });
}

test("same-account unmount/remount invalidates its old request and starts an independent request", async ({ page }) => {
  const { held, requests, state } = await mount(page, { hold: "list" });
  await login(page, "A"); await expect.poll(() => held.length).toBe(1);
  await page.locator("#toggle").click(); await page.locator("#toggle").click();
  await expect.poll(() => held.length).toBe(2);
  await held[0].reply(apiA); await held[1].reply({ items: [] });
  await expect(state).not.toContainText("API Private A");
  expect(requests.filter(r => r.path === "/notifications")).toHaveLength(2);
});

test("logging back into A with the identical token cannot revive the first login's response or popup", async ({ page }) => {
  const { held, state } = await mount(page, { hold: "list" });
  await login(page, "A"); await expect.poll(() => held.length).toBe(1);
  await page.evaluate("notificationTest.push('A');window.firstLogin=notificationTest.readNotificationAccount()");
  await page.evaluate("notificationTest.logout()"); await login(page, "B");
  await page.evaluate("notificationTest.logout()"); await login(page, "A");
  await expect.poll(() => held.length).toBe(2);
  expect(await page.evaluate("firstLogin===notificationTest.readNotificationAccount()")).toBe(false);
  await held[0].reply(apiA); await held[1].reply({ items: [] });
  await expect(state).toContainText("Private A");
  await expect(state).not.toContainText("API Private A");
  await expect(page.getByTestId("platform-notification-toast")).toHaveCount(0);
});

test("late unread count cannot replace the new account's count", async ({ page }) => {
  const { state, held } = await mount(page, { hold: "unread", unread: { "Bearer account-B": 2 } });
  await login(page, "A"); await expect.poll(() => held.length).toBe(1);
  await login(page, "B"); await expect(state).toContainText('"unread":2');
  await held[0].reply(9);
  await expect(state).toContainText('"unread":2');
});

test("a pending mark-all response cannot reset or refetch the next account's unread state", async ({ page }) => {
  const { state, held, requests } = await mount(page, { hold: "write", unread: { "Bearer account-A": 5, "Bearer account-B": 3 } });
  await login(page, "A"); await expect(state).toContainText('"unread":5');
  await page.getByRole("button", { name: "Read all", exact: true }).click(); await expect.poll(() => held.length).toBe(1);
  await login(page, "B"); await expect(state).toContainText('"unread":3');
  await held[0].reply({}); await expect(state).toContainText('"unread":3');
  expect(requests.filter(r => r.path === "/notifications/unread-count" && r.token === "Bearer account-B")).toHaveLength(1);
});

test("local mark-read, navigation, role filtering and preferences remain intact", async ({ page }) => {
  const { state, errors } = await mount(page, { failUnread: true });
  await login(page, "A");
  await page.evaluate("localStorage.setItem('unrelated-preference','keep');notificationTest.push('A');notificationTest.push('Hidden','owner')");
  await expect(state).not.toContainText("Private Hidden");
  await page.getByRole("button", { name: "Read first", exact: true }).click();
  await expect(state).toContainText('"read":true');
  await page.getByRole("button", { name: "Open first", exact: true }).click();
  expect(await page.evaluate("openedPaths")).toEqual(["/profile/bookings"]);
  expect(await page.evaluate("localStorage.getItem('unrelated-preference')")).toBe("keep");
  expect(errors).toEqual([]);
});

test("API notifications and single-item read requests stay bound to the authenticated account", async ({ page }) => {
  const { state, requests } = await mount(page, { serverA: true, unread: { "Bearer account-A": 1 } });
  await login(page, "A"); await expect(state).toContainText("API Private A");
  await page.getByRole("button", { name: "Read first", exact: true }).click();
  await expect.poll(() => requests.filter(r => r.method === "PUT" && r.path === "/notifications/11111111-1111-1111-1111-111111111111/read").length).toBe(1);
  expect(requests.find(r => r.method === "PUT")?.token).toBe("Bearer account-A");
  await login(page, "B"); await expect(state).not.toContainText("API Private A");
});

test("review notes reuse the scoped inbox and cannot merge a rejected account's late notification into another account", async ({ page }) => {
  const { state, held, requests, errors } = await mount(page, { hold: "list", review: true });
  await login(page, "A", "Photographer"); await expect.poll(() => held.length).toBe(1);
  await login(page, "B", "Photographer");
  await held[0].reply({ items: [{ ...apiA.items[0], type: "PhotographerRejectedForPhotographer", body: 'Reason: "Private review A"' }] });
  await expect(state).not.toContainText("API Private A");
  await expect(page.getByTestId("review-notes")).not.toContainText("Private review A");
  await expect.poll(() => requests.filter(r => r.path === "/notifications" && r.token === "Bearer account-B").length).toBe(1);
  expect(errors).toEqual([]);
});

test("real-time callbacks and delayed connection starts stay bound to their original login", async ({ page }) => {
  const { state, errors } = await mount(page);
  await page.evaluate("window.holdHubStarts=true");
  await login(page, "A"); await expect.poll(() => page.evaluate("hubs.length")).toBe(2);
  await page.evaluate("hubs[1].finishStart()");
  await expect.poll(() => page.evaluate("hubs[1].joins.length")).toBe(1);
  await login(page, "B");
  await expect.poll(() => page.evaluate("hubs.filter(h=>h.url.endsWith('/hubs/notifications')).length")).toBe(2);
  await page.evaluate(`for(const h of hubs.slice(0,2)){h.finishStart();h.emit('NotificationReceived',{kind:'BookingAcceptedForRequester',title:'Stale realtime A',body:'A'});
    h.emit('BookingRequestCancelled',{id:'old-booking',hallId:'old-hall',eventType:'Cancelled'})}`);
  await expect(state).not.toContainText("Stale realtime A");
  expect(await page.evaluate("ownerEvents.length")).toBe(0);
  await expect.poll(() => page.evaluate("typeof hubs.filter(h=>h.url.endsWith('/owner-dashboard')).at(-1).finishStart")).toBe("function");
  await page.evaluate(`for(const h of hubs.slice(2))h.finishStart?.();window.currentPlatformHub=hubs.filter(h=>h.url.endsWith('/hubs/notifications')).at(-1);
    currentPlatformHub.emit('NotificationReceived',
    {kind:'BookingAcceptedForRequester',title:'Realtime B',body:'B',targetId:'B-thread'})`);
  await expect(state).toContainText("Realtime B");
  await expect(page.getByTestId("platform-notification-toast")).toContainText("Realtime B");
  await expect.poll(() => page.evaluate("hubs.filter(h=>h.url.endsWith('/owner-dashboard')).at(-1).joins.length")).toBe(1);
  await page.evaluate("hubs.filter(h=>h.url.endsWith('/owner-dashboard')).at(-1).emit('BookingRequestCancelled',{id:'B-booking',hallId:'B-hall',eventType:'Cancelled'})");
  expect(await page.evaluate("ownerEvents.map(e=>e.id)")).toEqual(["B-booking"]);
  await page.evaluate("notificationTest.logout()");
  await expect(page.getByTestId("platform-notification-toast")).toHaveCount(0);
  await page.evaluate("currentPlatformHub.emit('NotificationReceived',{kind:'BookingAcceptedForRequester',title:'After logout',body:'B'})");
  await expect(state).toContainText('"items":[]');
  expect(errors).toEqual([]);
});
