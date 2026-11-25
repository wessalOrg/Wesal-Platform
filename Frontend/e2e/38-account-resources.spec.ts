import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "next/navigation": "const router={push:path=>window.navigations.push(path),replace(){}};export const usePathname=()=>'/discover';export const useRouter=()=>router;",
    "next/link": "export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}",
    "next/image": "export default function Image({src,alt}){return <img src={src} alt={alt}/>}",
    "@/components/brand/MabroukFigure": "export default function Figure(){return null}",
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>'en';",
    "@/i18n": "export const t=key=>key;export const useT=()=>t;",
    "@/services/auth": "export const logoutAccount=async()=>{};",
    "@/services/session": "import{readLocalSession}from'./src/lib/local-session';export const fetchSession=async()=>readLocalSession()??{isAuthenticated:false,role:null,userName:null};",
    "@/services/post-interactions": `export const fetchFavoritePosts=(page,size)=>window.enqueue('favorites',{page,size});
      export const addPostFavorite=async()=>{};export const removePostFavorite=id=>window.enqueue('remove',{id});`,
    "@/services/statistics": "export const fetchMyStatistics=()=>window.enqueue('statistics');",
    "@/services/hall-owner-halls": "export const fetchHallOwnerHalls=()=>window.enqueue('owned-halls');",
    "@/services/halls": "export const fetchHallById=async()=>({status:'missing'});",
    "@/services/hall-favorites": `export const hasHallFavoritesSession=()=>true;
      export const fetchFavoriteHallIds=()=>window.enqueue('saved-halls');
      export const addFavoriteHall=async()=>{};export const removeFavoriteHall=async()=>{};`,
    "@/lib/api": "export const apiOrigin='http://localhost:3000';export default {get:path=>window.enqueue('api',{path}).then(data=>({data})),post:path=>window.enqueue('api',{path}).then(data=>({data}))};",
    "@/services/conversation-realtime": "export const subscribeIncomingMessages=callback=>{window.incoming=callback;window.retired.push(callback);return()=>{if(window.incoming===callback)window.incoming=null}};",
    "@/hooks/useUnreadCount": "export const refreshUnreadCount=async()=>0;",
    "@/components/messages/MessagesInboxProvider": `import{useAuth}from'@/components/auth/AuthProvider';import{getStoredAuth}from'./src/lib/auth-storage';
      const conversations=[];const openInbox=id=>window.navigations.push('inbox:'+id),selectConversation=id=>window.navigations.push('select:'+id);
      export function useMessagesInbox(){const{session}=useAuth();return{isOpen:false,selectedId:null,canUseMessaging:session.isAuthenticated,
        currentUserId:getStoredAuth()?.user.id??null,conversations,openInbox,selectConversation}};`,
  };
  const result = await build({
    stdin: { contents: `import React,{StrictMode,useState,useEffect,useSyncExternalStore}from'react';import{createRoot}from'react-dom/client';
      import{AuthProvider,useAuth}from'./src/components/auth/AuthProvider';import{setAccessToken}from'./src/lib/auth-token';
      import{setStoredAuth,getStoredAuth}from'./src/lib/auth-storage';
      import{useFavoritePostIds}from'./src/hooks/useFavoritePostIds';import{useProfessionalStatistics}from'./src/hooks/useProfessionalStatistics';
      import{useUserBookings,warmUserBookings}from'./src/hooks/useUserBookings';import{useHallOwnerHalls}from'./src/hooks/useHallOwnerHalls';
      import{loadRememberedBookings}from'./src/lib/user-bookings-store';
      import{hydrateSavedHallsFromServer,readSavedHallIds,subscribeSavedHalls,getServerSavedHallIds,toggleSavedHall}from'./src/lib/saved-halls';
      import Favorites from'./src/components/seeker-dashboard/SeekerFavoritesPage';import Alert from'./src/hooks/useIncomingMessageAlert';
      window.requests=[];window.navigations=[];window.retired=[];
      window.enqueue=(kind,input)=>new Promise((resolve,reject)=>requests.push({kind,input,owner:getStoredAuth()?.user.id,resolve,reject}));
      window.login=(id,role=window.initialRole)=>{const token='test.'+btoa(JSON.stringify({sub:id,role,exp:Date.now()/1000+3600}))+'.test';
        setAccessToken(token);setStoredAuth({token,user:{id,name:id,role}})};
      window.settle=(index,data,failed=false)=>{const req=requests[index];req.done=true;if(failed)req.reject(Error('offline'));else req.resolve(data)};
      window.remembered=loadRememberedBookings;window.warm=warmUserBookings;window.hydrate=hydrateSavedHallsFromServer;window.toggleHall=toggleSavedHall;
      function Resources(){const favorites=useFavoritePostIds(),stats=useProfessionalStatistics();window.resources={favorites,stats};
        return <output id="state">{JSON.stringify({ids:[...favorites.ids],ready:favorites.ready,stats:stats.stats,status:stats.status})}</output>}
      function Bookings(){const value=useUserBookings();window.bookings=value;return <output id="state">{JSON.stringify(value)}</output>}
      function Halls(){const value=useHallOwnerHalls();window.halls=value;return <output id="state">{JSON.stringify(value)}</output>}
      function Saved(){const ids=useSyncExternalStore(subscribeSavedHalls,readSavedHallIds,getServerSavedHallIds),{session}=useAuth();
        useEffect(()=>{void hydrateSavedHallsFromServer()},[session]);return <output id="state">{JSON.stringify(ids)}</output>}
      function Workspace(){window.auth=useAuth();return window.mode==='resources'?<Resources/>:window.mode==='bookings'?<Bookings/>:
        window.mode==='halls'?<Halls/>:window.mode==='saved'?<Saved/>:window.mode==='favorites'?<Favorites/>:<Alert/>}
      function Harness(){const[shown,setShown]=useState(true);return <><button id="logout" onClick={()=>void window.auth.logout({redirect:false})}>Logout</button>
        <button id="unmount" onClick={()=>setShown(false)}>Unmount</button><button id="remount" onClick={()=>setShown(true)}>Remount</button>{shown&&<Workspace/>}</>}
      window.login('A');createRoot(document.getElementById('root')).render(<StrictMode><AuthProvider><Harness/></AuthProvider></StrictMode>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "account-resources-io", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  }); bundle = result.outputFiles[0].text;
});

type HarnessWindow = Window & {
  requests: Array<{ kind: string; owner: string; done?: boolean; input?: { page?: number; path?: string } }>;
  login: (id: string) => void;
  settle: (index: number, data: unknown, failed?: boolean) => void;
};
async function mount(page: Page, mode: string, role = "Photographer", legacy = false) {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", route => new URL(route.request().url()).pathname === "/account-resources"
    ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
  await page.goto("http://localhost:3000/account-resources");
  await page.evaluate(({ mode, role, legacy }) => {
    Object.assign(window, { mode, initialRole: role });
    if (legacy) {
      localStorage.setItem("wesal-saved-halls", '["legacy-hall"]');
      sessionStorage.setItem("wesal-user-bookings", JSON.stringify([{ bookingId: "legacy", hallId: "private", period: "FirstPeriod" }]));
    }
  }, { mode, role, legacy });
  await page.addScriptTag({ content: bundle });
  return errors;
}
async function request(page: Page, kind: string, owner: string, number?: number) {
  const find = () => page.evaluate(({ kind, owner, number }) => (window as HarnessWindow).requests.findIndex(req =>
    !req.done && req.kind === kind && req.owner === owner && (number === undefined || req.input?.page === number)), { kind, owner, number });
  await expect.poll(find).toBeGreaterThanOrEqual(0); return find();
}
async function reply(page: Page, index: number, data: unknown, failed = false) {
  await page.evaluate(({ index, data, failed }) => (window as HarnessWindow).settle(index, data, failed), { index, data, failed });
}
async function login(page: Page, id: string) { await page.evaluate(id => (window as HarnessWindow).login(id), id); }
const favorites = (ids: string[], number = 1, pages = 1) => ({ items: ids.map(id => ({ id, ownerUserId: "professional", ownerName: "Professional",
  content: id, savedAt: "2026-01-01T00:00:00Z", images: [], price: null })), pageNumber: number, pageSize: 50, totalPages: pages, totalCount: pages * 50 });
const booking = (id: string) => ({ bookingId: id, hallId: "hall-" + id, hallName: "Hall " + id, date: "2030-01-01", slotStarts: ["12:00:00"], status: "Confirmed" });

for (const failed of [false, true]) {
  test(`late statistics and favorites ${failed ? "errors" : "responses"} cannot affect the next account`, async ({ page }) => {
    const errors = await mount(page, "resources");
    const oldFavorites = await request(page, "favorites", "A"), oldStats = await request(page, "statistics", "A");
    await login(page, "B");
    await reply(page, await request(page, "favorites", "B"), favorites(["B-post"]));
    await reply(page, await request(page, "statistics", "B"), { totalPosts: 22 });
    await reply(page, oldFavorites, favorites(["A-private"]), failed); await reply(page, oldStats, { totalPosts: 11 }, failed);
    await expect(page.locator("#state")).toContainText("B-post");
    await expect(page.locator("#state")).toContainText('"totalPosts":22');
    await expect(page.locator("#state")).not.toContainText("A-private"); expect(errors).toEqual([]);
  });
}

test("Discover hydrates favorite IDs beyond 100 without duplicates", async ({ page }) => {
  await mount(page, "resources");
  await reply(page, await request(page, "favorites", "A", 1), favorites(Array.from({ length: 100 }, (_, i) => "p" + i), 1, 2));
  await reply(page, await request(page, "favorites", "A", 2), favorites(["p99", "p100"], 2, 2));
  await expect(page.locator("#state")).toContainText("p100");
  expect(await page.evaluate("window.resources.favorites.ids.size")).toBe(101);
});

test("local favorite changes during hydration survive the older response", async ({ page }) => {
  await mount(page, "resources"); const pending = await request(page, "favorites", "A");
  await page.evaluate("resources.favorites.markSaved('new-save',true)");
  await reply(page, pending, favorites(["existing"]));
  await expect(page.locator("#state")).toContainText("new-save"); await expect(page.locator("#state")).toContainText("existing");
});

test("a booking cache is never reused by another account, including a remount", async ({ page }) => {
  await mount(page, "bookings", "RegisteredUser", true);
  await reply(page, await request(page, "api", "A"), [booking("A-private")]);
  await expect(page.locator("#state")).toContainText("A-private");
  await page.click("#unmount"); await login(page, "B"); await page.click("#remount");
  await expect(page.locator("#state")).not.toContainText("A-private");
  await expect(page.locator("#state")).not.toContainText("legacy");
  await reply(page, await request(page, "api", "B"), [booking("B-only")]);
  await expect(page.locator("#state")).toContainText("B-only");
});

for (const failed of [false, true]) {
  test(`late booking service ${failed ? "failure" : "success"} cannot write into B's remembered list`, async ({ page }) => {
    await mount(page, "bookings", "RegisteredUser"); const old = await request(page, "api", "A");
    await login(page, "B"); await reply(page, await request(page, "api", "B"), [booking("B-only")]);
    await reply(page, old, [booking("A-private")], failed);
    await expect(page.locator("#state")).toContainText("B-only");
    expect(await page.evaluate("remembered().map(x=>x.bookingId)")).toEqual(["B-only"]);
  });
}

test("same-role hall owners see only their own halls after out-of-order loading", async ({ page }) => {
  const errors = await mount(page, "halls", "HallOwner"); const old = await request(page, "owned-halls", "A");
  await login(page, "B"); await reply(page, await request(page, "owned-halls", "B"), [{ id: "B-hall", name: "B-hall", status: "Approved" }]);
  await reply(page, old, [{ id: "A-private", name: "A-private", status: "Approved" }]);
  await expect(page.locator("#state")).toContainText("B-hall"); await expect(page.locator("#state")).not.toContainText("A-private");
  expect(errors).toEqual([]);
});

test("loaded hall-owner data is cleared before the next owner's request completes", async ({ page }) => {
  await mount(page, "halls", "HallOwner");
  await reply(page, await request(page, "owned-halls", "A"), [{ id: "A-private", status: "Approved" }]);
  await expect(page.locator("#state")).toContainText("A-private");
  await login(page, "B");
  await expect(page.locator("#state")).not.toContainText("A-private");
  await request(page, "owned-halls", "B");
});

test("a late cancellation cannot modify B's list or clear B's pending cancellation", async ({ page }) => {
  await mount(page, "bookings", "RegisteredUser");
  await reply(page, await request(page, "api", "A"), [{ ...booking("A-private"), status: "Pending" }]);
  await expect(page.locator("#state")).toContainText("A-private");
  await page.evaluate("void bookings.cancelBooking(bookings.bookings[0])");
  const old = await request(page, "api", "A");
  await login(page, "B");
  await reply(page, await request(page, "api", "B"), [{ ...booking("B-only"), status: "Pending" }]);
  await expect(page.locator("#state")).toContainText("B-only");
  await page.evaluate("void bookings.cancelBooking(bookings.bookings[0])");
  const current = await request(page, "api", "B");
  await reply(page, old, { bookingId: "A-private", hallId: "hall-A-private", status: "Cancelled" });
  await expect(page.locator("#state")).toContainText('"cancellingId":"B-only"');
  expect(await page.evaluate("remembered().map(x=>x.bookingId)")).toEqual(["B-only"]);
  await reply(page, current, { bookingId: "B-only", hallId: "hall-B-only", status: "Cancelled" });
  await expect(page.locator("#state")).toContainText('"cancelSuccessId":"B-only"');
});

test("saved halls ignore legacy data, isolate hydration and preserve each account's scoped storage", async ({ page }) => {
  await mount(page, "saved", "RegisteredUser", true);
  await expect(page.locator("#state")).not.toContainText("legacy");
  const old = await request(page, "saved-halls", "A");
  await login(page, "B"); await reply(page, await request(page, "saved-halls", "B"), ["B-hall"]);
  await reply(page, old, ["A-private"]);
  await expect(page.locator("#state")).toHaveText('["B-hall"]');
  await page.evaluate("toggleHall('B-local')");
  await login(page, "A");
  await expect(page.locator("#state")).not.toContainText("B-hall");
  await reply(page, await request(page, "saved-halls", "A"), ["A-valid"]);
  await login(page, "B");
  await expect(page.locator("#state")).toContainText("B-local");
});

test("message popups disappear on account switch and ignore retired real-time callbacks", async ({ page }) => {
  await mount(page, "banner");
  await expect.poll(() => page.evaluate("Boolean(window.incoming)")).toBe(true);
  const emit = "({conversationId:'A-thread',message:{senderUserId:'peer',senderName:'A private sender',content:'private message',sentAt:new Date().toISOString()}})";
  await page.evaluate(`window.oldIncoming=window.incoming;window.incoming(${emit})`);
  await expect(page.getByTestId("message-notification-banner")).toContainText("private message");
  await login(page, "B");
  await expect(page.getByTestId("message-notification-banner")).toHaveCount(0);
  await page.evaluate(`oldIncoming(${emit})`);
  await expect(page.getByTestId("message-notification-banner")).toHaveCount(0);
  expect(await page.evaluate("navigations")).toEqual([]);
});

test("new-account message popups retain grouping and correct conversation navigation", async ({ page }) => {
  await mount(page, "banner"); await login(page, "B");
  await expect.poll(() => page.evaluate("Boolean(window.incoming)")).toBe(true);
  await page.evaluate("incoming({conversationId:'B-thread',message:{senderUserId:'peer',senderName:'B sender',content:'B message',sentAt:new Date().toISOString()}})");
  await page.getByTestId("message-notification-banner").getByRole("button").first().click();
  expect(await page.evaluate("navigations")).toContain("select:B-thread");
  expect((await page.evaluate("navigations")) as string[]).toContain("inbox:B-thread");
});

test("saved posts load beyond 50 and keep prior cards visible while loading more", async ({ page }) => {
  const errors = await mount(page, "favorites", "RegisteredUser");
  await reply(page, await request(page, "saved-halls", "A"), []);
  await reply(page, await request(page, "favorites", "A", 1), favorites(Array.from({ length: 50 }, (_, i) => "post-" + i), 1, 2));
  await page.getByRole("button", { name: "content.pagination.more" }).click();
  await expect(page.getByTestId("seeker-favorite-post-post-0")).toBeVisible();
  await reply(page, await request(page, "favorites", "A", 2), favorites(["post-50"], 2, 2));
  await expect(page.getByTestId("seeker-favorite-post-post-50")).toBeVisible();
  expect(errors).toEqual([]);
});

test("saved posts cannot leak when accounts change during pagination", async ({ page }) => {
  await mount(page, "favorites", "RegisteredUser"); const old = await request(page, "favorites", "A");
  await login(page, "B"); await reply(page, await request(page, "saved-halls", "B"), []);
  await reply(page, await request(page, "favorites", "B"), favorites(["B-only"]));
  await reply(page, old, favorites(["A-private"]));
  await expect(page.getByTestId("seeker-favorite-post-B-only")).toBeVisible();
  await expect(page.getByTestId("seeker-favorite-post-A-private")).toHaveCount(0);
});
