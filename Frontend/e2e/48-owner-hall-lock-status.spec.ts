import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

let bundle: string;
let styles = "";
test.beforeAll(async () => {
  const cssDir = path.resolve(".next/static/chunks");
  for (const name of await readdir(cssDir)) {
    if (!name.endsWith(".css")) continue;
    const css = await readFile(path.join(cssDir, name), "utf8");
    if (css.includes(".container-wesal")) styles += css;
  }
  const mocks: Record<string, string> = {
    "next/navigation": "export const useRouter=()=>({push(){},replace(){}});export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/profile/halls';",
    "next/link": "export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}",
    "next/image": "export default function Image({src,alt}){return <img src={src} alt={alt}/>}",
    "@/components/auth/AuthProvider": "const logout=async()=>window.logout();export const useAuth=()=>({logout});",
    "@/hooks/useAccountAccess": `import{useSyncExternalStore}from'react';import{subscribeAuthenticatedAccount,readAuthenticatedAccount,serverAuthenticatedAccount}from'./src/lib/authenticated-account';
      export function useAccountAccess(){const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount,serverAuthenticatedAccount);return{ready:true,authenticated:!!account,isHallOwner:!!account}}`,
    "@/hooks/useAddHallInitiation": "export const useAddHallInitiation=()=>({isInitiating:false,startAddHall(){}});",
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>window.lang;",
    "@/i18n": `import ar from'./src/i18n/messages/ar';import en from'./src/i18n/messages/en';export const t=key=>(window.lang==='ar'?ar:en)[key]??key;export const useT=()=>t;`,
    "@/lib/api": `export const apiOrigin='http://localhost:3000';export default{get:(path)=>window.enqueue(path).then(data=>({data}))};`,
    "@/services/hall-owner-hall-management": `import{mapOwnerHallDetailsDto}from'./src/lib/hall-owner-hall-management-mapper';export const fetchOwnerHallDetails=id=>window.enqueue('/details/'+id).then(data=>mapOwnerHallDetailsDto(data,id));export const updateOwnerHall=async()=>{};`,
    "@/services/halls": "export const fetchHallById=async()=>({status:'missing'});",
  };
  const result = await build({
    stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import{setStoredAuth,getStoredAuth,clearAuthSession}from'./src/lib/auth-storage';import{setAccessToken}from'./src/lib/auth-token';
      import{mapHallOwnerHallDto}from'./src/lib/hall-owner-halls-mapper';import{mapOwnerHallDetailsDto}from'./src/lib/hall-owner-hall-management-mapper';
      import{mapHallSubscription}from'./src/lib/hall-subscription';
      import{hallAccessFromUnknown,mergeHallAccess,getHallLockStatus,getManagementAccess,canAccessMessaging}from'./src/lib/hall-access';
      import{useOwnedHallAccess}from'./src/hooks/useOwnedHallAccess';import{useHallOwnerHalls,reportOwnedHallSystemLocked}from'./src/hooks/useHallOwnerHalls';
      import{useHallSubscriptionStatus}from'./src/hooks/useHallSubscriptionStatus';
      import{useHallOwnerHallManagement}from'./src/hooks/useHallOwnerHallManagement';
      import Notice from'./src/components/halls/HallLockStatusNotice';import Subscription from'./src/components/halls/subscription/OwnerSubscriptionStatus';
      import Days from'./src/components/halls/subscription/OwnerPaidSubscriptionDays';import Halls from'./src/components/owner-management/OwnerHallsPage';
      window.requests=[];window.enqueue=path=>new Promise((resolve,reject)=>requests.push({path,owner:getStoredAuth()?.user.id,resolve,reject}));
      window.login=id=>{const token='test.'+btoa(JSON.stringify({sub:id,role:'HallOwner',exp:Date.now()/1000+3600}))+'.test';setAccessToken(token);setStoredAuth({token,user:{id,name:id,role:'HallOwner'}})};
      window.logout=()=>clearAuthSession();window.login('A');
      window.inspect=dto=>{const hall=mapHallOwnerHallDto(dto);const access=hallAccessFromUnknown(dto);return{hall,details:mapOwnerHallDetailsDto(dto,dto.hallId),access,lock:getHallLockStatus(access),management:getManagementAccess(access),messaging:canAccessMessaging(access)}};
      window.merge=(...values)=>mergeHallAccess(...values.map(hallAccessFromUnknown));window.mapSubscription=mapHallSubscription;
      window.reportSystem=reportOwnedHallSystemLocked;
      function Probe({id}){const value=useHallSubscriptionStatus(id,true);return <output data-testid="subscription-probe">{JSON.stringify(value)}</output>}
      function Edit({id}){const value=useHallOwnerHallManagement(id,true);return <output id="edit-state">{JSON.stringify({details:value.details,canEdit:value.canEdit,loadStatus:value.loadStatus})}</output>}
      function Workspace({id}){const{access,flagsReady}=useOwnedHallAccess(id);const halls=useHallOwnerHalls();window.refetch=halls.refetch;
        return <><output id="access">{JSON.stringify({access,flagsReady,lock:getHallLockStatus(access),halls:halls.halls,status:halls.status})}</output><Notice access={access} loading={!flagsReady}/>
        {window.mode==='subscription'?<><Subscription hallId={id}/><Probe id={id}/><Days hallId={id}/></>:window.mode==='cards'?<Halls/>:window.mode==='edit'?<Edit id={id}/>:null}</>}
      function Harness(){const[id,setId]=useState('hall-a'),[visible,setVisible]=useState(true),[tick,setTick]=useState(0);window.choose=setId;window.rerender=()=>setTick(v=>v+1);
        return <div dir={window.lang==='ar'?'rtl':'ltr'} data-testid="workspace" data-tick={tick}>
          <button onClick={()=>setVisible(false)}>Unmount</button><button onClick={()=>setVisible(true)}>Remount</button>{visible&&<Workspace id={id}/>}</div>}
      createRoot(document.getElementById('root')).render(<Harness/>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", loader: { ".css": "empty" }, tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "owner-lock-io", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

type HarnessWindow = Window & {
  requests: Array<{ path: string; owner: string; done?: boolean; resolve(value: unknown): void; reject(error: Error): void }>;
  login(id: string): void; logout(): void; choose(id: string): void; rerender(): void; refetch(): void; reportSystem(id: string): void;
  inspect(dto: unknown): { hall: { adminLocked: boolean | null; systemLocked: boolean | null }; details: { adminLocked: boolean | null }; lock: string; management: { allowed: boolean; reason?: string }; messaging: boolean };
  merge(...values: unknown[]): { adminLocked: boolean | null; systemLocked: boolean | null };
  mapSubscription(dto: unknown, id: string): { isPaid: boolean | null; status: string };
};
const hall = (id = "hall-a", flags: Record<string, unknown> = {}) => ({ hallId: id, hallName: id, status: "Approved", paymentStatus: "Paid", ...flags });
const subscription = (id = "hall-a", status = "Active", days = 12) => ({ hallId: id, hallName: id, status, nextBillingDate: "2030-01-10", daysRemaining: days });
async function mount(page: Page, mode = "access", lang = "en") {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
  await page.goto("http://localhost:3000/owner-lock-isolated");
  await page.addStyleTag({ content: styles + "\noutput{display:block;overflow-wrap:anywhere}" });
  await page.evaluate(({ mode, lang }) => Object.assign(window, { mode, lang }), { mode, lang });
  await page.addScriptTag({ content: bundle });
  return errors;
}
async function request(page: Page, route: string, owner = "A") {
  const find = () => page.evaluate(({ route, owner }) => (window as HarnessWindow).requests.findIndex(r => !r.done && r.path === route && r.owner === owner), { route, owner });
  await expect.poll(find).toBeGreaterThanOrEqual(0); return find();
}
async function settle(page: Page, index: number, data: unknown, failed = false) {
  await page.evaluate(({ index, data, failed }) => { const r = (window as HarnessWindow).requests[index]; r.done = true;
    if (failed) r.reject(Error("private backend detail")); else r.resolve(data);
  }, { index, data, failed });
}
async function loadHalls(page: Page, rows = [hall()], owner = "A") { await settle(page, await request(page, "/owner/halls", owner), rows); }

test("actual owner DTO reproduces the missing flags contract without fabricating false", async ({ page }) => {
  await mount(page); const value = await page.evaluate(dto => (window as HarnessWindow).inspect(dto), hall());
  expect(value.hall.adminLocked).toBeNull(); expect(value.hall.systemLocked).toBeNull(); expect(value.details.adminLocked).toBeNull();
  expect(value.lock).toBe("unknown"); expect(value.management.allowed).toBe(true);
});
for (const [flags, lock, reason] of [
  [{ adminLocked: true, systemLocked: false }, "locked", "ADMIN_LOCKED"],
  [{ adminLocked: false, systemLocked: true }, "locked", "SYSTEM_LOCKED"],
  [{ adminLocked: true, systemLocked: true }, "locked", "ADMIN_AND_SYSTEM_LOCKED"],
  [{ adminLocked: false, systemLocked: false }, "unlocked", undefined],
] as const) test(`explicit flags preserve ${reason ?? lock}`, async ({ page }) => {
  await mount(page); const value = await page.evaluate(dto => (window as HarnessWindow).inspect(dto), hall("hall-a", flags));
  expect(value.lock).toBe(lock); expect(value.management.reason).toBe(reason);
});

test("missing, null, blank, malformed, and partial flags remain unknown", async ({ page }) => {
  await mount(page);
  for (const flags of [{}, { adminLocked: null }, { adminLocked: "" }, { adminLocked: "invalid" }, { adminLocked: false }]) {
    const result = await page.evaluate(dto => (window as HarnessWindow).inspect(dto), hall("hall-a", flags));
    expect(result.lock).toBe("unknown"); expect(result.hall.systemLocked).toBeNull();
  }
});
test("merging missing flags cannot erase a known lock or manufacture an unlocked flag", async ({ page }) => {
  await mount(page); const result = await page.evaluate(() => (window as HarnessWindow).merge({ adminLocked: true }, {}));
  expect(result).toMatchObject({ adminLocked: true, systemLocked: null });
});
test("approval and payment restrictions remain independent of unknown lock flags", async ({ page }) => {
  await mount(page); const result = await page.evaluate(dto => (window as HarnessWindow).inspect(dto), hall("hall-a", { paymentStatus: "Unpaid" }));
  expect(result.lock).toBe("unknown"); expect(result.management.reason).toBe("PAYMENT_REQUIRED"); expect(result.messaging).toBe(true);
});
test("loading and missing owner responses are visibly distinct from unlocked", async ({ page }) => {
  await mount(page); await expect(page.getByTestId("hall-lock-status")).toHaveAttribute("data-lock-status", "loading");
  await loadHalls(page); await expect(page.getByTestId("hall-lock-status")).toHaveAttribute("data-lock-status", "unknown");
});
for (const status of ["Active", "PaymentPending", "Expired", "Locked"]) test(`subscription ${status} does not invent system lock or payment flags`, async ({ page }) => {
  await mount(page, "subscription"); await loadHalls(page);
  await settle(page, await request(page, "/owner/halls/hall-a/subscription"), subscription("hall-a", status));
  await expect(page.locator("#access")).toContainText('"adminLocked":' + (status === "Locked" ? "true" : "null"));
  await expect(page.locator("#access")).toContainText('"systemLocked":null');
  const mapped = await page.evaluate(dto => (window as HarnessWindow).mapSubscription(dto, "hall-a"), subscription("hall-a", status));
  expect(mapped.isPaid).toBeNull();
});
test("simultaneous subscription and owner consumers share pending requests", async ({ page }) => {
  await mount(page, "subscription"); await request(page, "/owner/halls/hall-a/subscription");
  const paths = await page.evaluate(() => (window as HarnessWindow).requests.map(r => r.path));
  expect(paths.filter(p => p === "/owner/halls/hall-a/subscription")).toHaveLength(1);
  expect(paths.filter(p => p === "/owner/halls")).toHaveLength(1);
});
test("an authoritative admin lock arriving before the owner list is retained", async ({ page }) => {
  await mount(page, "subscription");
  await settle(page, await request(page, "/owner/halls/hall-a/subscription"), subscription("hall-a", "Locked"));
  await loadHalls(page);
  await expect(page.locator("#access")).toContainText('"adminLocked":true');
});
test("subscription failure shows retry and leaves unknown locks unknown", async ({ page }) => {
  const errors = await mount(page, "subscription"); await loadHalls(page);
  await settle(page, await request(page, "/owner/halls/hall-a/subscription"), null, true);
  await expect(page.getByTestId("hall-subscription-status")).toHaveAttribute("data-load-status", "error");
  await expect(page.locator("#access")).toContainText('"adminLocked":null');
  await page.getByTestId("hall-subscription-status").getByRole("button").click();
  await settle(page, await request(page, "/owner/halls/hall-a/subscription"), subscription("hall-a", "Locked"));
  await expect(page.locator("#access")).toContainText('"adminLocked":true'); expect(errors).toEqual([]);
});
test("a mismatched subscription hall response becomes an error without applying its lock", async ({ page }) => {
  await mount(page, "subscription"); await loadHalls(page);
  await settle(page, await request(page, "/owner/halls/hall-a/subscription"), subscription("another-hall", "Locked"));
  await expect(page.getByTestId("hall-subscription-status")).toHaveAttribute("data-load-status", "error");
  await expect(page.locator("#access")).toContainText('"adminLocked":null');
});
for (const failed of [false, true]) test(`late subscription ${failed ? "error" : "response"} is isolated after hall switching`, async ({ page }) => {
  await mount(page, "subscription"); await loadHalls(page, [hall(), hall("hall-b")]);
  const old = await request(page, "/owner/halls/hall-a/subscription");
  await page.evaluate(() => (window as HarnessWindow).choose("hall-b"));
  await settle(page, await request(page, "/owner/halls/hall-b/subscription"), subscription("hall-b", "Active"));
  await settle(page, old, subscription("hall-a", "Locked"), failed);
  await expect(page.getByTestId("hall-subscription-status")).toHaveAttribute("data-hall-id", "hall-b");
  await expect(page.getByTestId("hall-subscription-status")).toHaveAttribute("data-load-status", "ready");
  await expect(page.locator("#access")).not.toContainText('"adminLocked":true');
});
test("same-role account switch rejects pending subscription and list responses", async ({ page }) => {
  await mount(page, "subscription"); const oldList = await request(page, "/owner/halls"); const oldSub = await request(page, "/owner/halls/hall-a/subscription");
  await page.evaluate(() => (window as HarnessWindow).login("B"));
  await loadHalls(page, [hall()], "B");
  await settle(page, await request(page, "/owner/halls/hall-a/subscription", "B"), subscription());
  await settle(page, oldList, [hall("hall-a", { adminLocked: true })]); await settle(page, oldSub, subscription("hall-a", "Locked"));
  await expect(page.locator("#access")).not.toContainText('"adminLocked":true');
});
test("logout and unmount cannot apply a delayed subscription lock", async ({ page }) => {
  const errors = await mount(page, "subscription"); await loadHalls(page);
  const old = await request(page, "/owner/halls/hall-a/subscription");
  await page.getByRole("button", { name: "Unmount", exact: true }).click();
  await page.evaluate(() => (window as HarnessWindow).logout());
  await settle(page, old, subscription("hall-a", "Locked"));
  await page.getByRole("button", { name: "Remount", exact: true }).click();
  await expect(page.locator("#access")).not.toContainText('"adminLocked":true'); expect(errors).toEqual([]);
});
test("a partial list refresh cannot erase a confirmed system lock", async ({ page }) => {
  await mount(page); await loadHalls(page);
  await page.evaluate(() => { (window as HarnessWindow).reportSystem("hall-a"); });
  await expect(page.locator("#access")).toContainText('"systemLocked":true');
  await loadHalls(page); await expect(page.locator("#access")).toContainText('"systemLocked":true');
});
test("zero remaining days today is not presented as an expired subscription", async ({ page }) => {
  await mount(page, "subscription"); await loadHalls(page);
  await settle(page, await request(page, "/owner/halls/hall-a/subscription"), subscription("hall-a", "Active", 0));
  await expect(page.getByTestId("hall-subscription-ended-note")).toHaveCount(0);
  await expect(page.getByTestId("hall-subscription-days-note")).toBeVisible();
});
test("a system lock does not fabricate an expired subscription", async ({ page }) => {
  await mount(page, "cards"); await loadHalls(page, [hall("hall-a", { adminLocked: false, systemLocked: true })]);
  await settle(page, await request(page, "/details/hall-a"), hall("hall-a", { isEditable: true, photos: [] }));
  await settle(page, await request(page, "/owner/halls/hall-a/subscription"), subscription("hall-a", "Active", 12));
  await expect(page.getByTestId("owner-halls-page")).not.toContainText("Subscription expired");
  await expect(page.getByTestId("owner-halls-page").getByTestId("hall-subscription-days-note")).toBeVisible();
});
test("unknown locks do not disable an otherwise editable owned hall", async ({ page }) => {
  await mount(page, "edit"); await loadHalls(page);
  await settle(page, await request(page, "/details/hall-a"), hall("hall-a", { isEditable: true, photos: [] }));
  await expect(page.locator("#edit-state")).toContainText('"canEdit":true');
  await expect(page.locator("#edit-state")).toContainText('"adminLocked":null');
});
test("pending hall details cannot restore previous-account lock or edit state", async ({ page }) => {
  await mount(page, "edit"); await loadHalls(page); const old = await request(page, "/details/hall-a");
  await page.evaluate(() => (window as HarnessWindow).login("B"));
  await loadHalls(page, [hall()], "B");
  await settle(page, await request(page, "/details/hall-a", "B"), hall("hall-a", { hallName: "B hall", isEditable: true }));
  await settle(page, old, hall("hall-a", { hallName: "A private", adminLocked: true, isEditable: true }));
  await expect(page.locator("#edit-state")).toContainText("B hall");
  await expect(page.locator("#edit-state")).not.toContainText("A private");
});
for (const lang of ["ar", "en"]) for (const width of [390, 768, 1366]) test(`${lang} owner cards retain actions and unknown status at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const errors = await mount(page, "cards", lang); await loadHalls(page);
  await settle(page, await request(page, "/details/hall-a"), hall("hall-a", { isEditable: true, photos: [] }));
  await expect(page.getByTestId("workspace")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  await expect(page.getByTestId("owner-halls-page")).toContainText(lang === "ar" ? "حالة القفل غير معروفة" : "Lock status unknown");
  await expect(page.getByTestId("owner-halls-page").getByRole("link", { name: lang === "ar" ? "تعديل البيانات" : "Edit details" })).toHaveAttribute("href", /hall-a/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
