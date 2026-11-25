import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "next/navigation": "export const useRouter=()=>window.router;export const usePathname=()=>'/profile/offers';",
    "next/link": "import React from'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}",
    "@/i18n": `const catalogs=${JSON.stringify({ ar, en })};export const t=(key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),catalogs[window.routeConfig?.lang||'en'][key]??key);
      export const useT=()=>t;export const translate=t;`,
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>window.routeConfig.lang||'en';",
    "@/components/brand/MabroukFigure": "export default function Figure(){return null}",
  };
  const result = await build({
    stdin: { contents: `import React from'react';import{createRoot}from'react-dom/client';
      import Offers from'./src/app/profile/offers/page';import RegularGuard from'./src/components/profile/RegularUserProfileGuard';
      import{AuthProvider,useAuth}from'./src/components/auth/AuthProvider';import{UserProfileProvider,useUserProfileStore}from'./src/components/profile/UserProfileProvider';
      import{setAccessToken}from'./src/lib/auth-token';import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';
      window.routes=[];window.router={replace(path){routes.push(path)},push(path){routes.push(path)}};
      window.routeTest={login(id,role){const token='test.'+btoa(JSON.stringify({sub:id,name:id,role,exp:Math.floor(Date.now()/1000)+3600}))+'.test';
        setAccessToken(token);setStoredAuth({token,user:{id,name:id,role}})},logout:clearAuthSession};
      if(routeConfig.role)routeTest.login('user-a',routeConfig.role);document.documentElement.dir=routeConfig.lang==='ar'?'rtl':'ltr';
      function Probe(){window.auth=useAuth();window.profile=useUserProfileStore();return <><output data-testid="auth-state">{JSON.stringify({status:auth.status,session:auth.session})}</output>
        {routeConfig.withoutLayout?<Offers/>:<RegularGuard><Offers/></RegularGuard>}</>}
      createRoot(document.getElementById('root')).render(<AuthProvider><UserProfileProvider><Probe/></UserProfileProvider></AuthProvider>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"), loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.VERCEL_ENV": "undefined", "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"' },
    plugins: [{ name: "offers-route-shell", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  }); bundle = result.outputFiles[0].text;
});

type Options = { role?: string | null; lang?: "ar" | "en"; approval?: string; setup?: boolean; locked?: boolean;
  holdSession?: boolean; holdList?: boolean; holdDetail?: boolean; detailError?: boolean; withoutLayout?: boolean };
type Call = { owner: string; path: string; method: string; reply: (status?: number) => Promise<void> };
function offer(owner: string) { return { id: "offer-" + owner, ownerUserId: owner, content: "Offer " + owner, oldPrice: 200, offerPrice: 100,
  startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", images: [] }; }
async function intercept(page: Page, options: Options, actual = false) {
  const offers: Call[] = [], sessions: Call[] = [], errors: string[] = [];
  let holdList = options.holdList ?? false, detailError = options.detailError ?? false;
  let serverRole: string | null = null;
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    if (!actual && pathname === "/profile/offers") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "*" } }).catch(() => undefined);
    if (pathname.startsWith("/hubs/")) return json({}, 404);
    if (!pathname.startsWith("/api/v1/")) {
      if (actual) return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
      throw new Error(`Unexpected network ${pathname}`);
    }
    if (request.method() === "OPTIONS") return json({});
    const token = request.headers().authorization ?? "";
    const claims = token ? JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()) : {};
    const owner = claims.sub ?? "guest", apiPath = pathname.slice(7), method = request.method();
    if (apiPath === "/session") {
      const call = { owner, path: apiPath, method, reply: () => json(token ? { isAuthenticated: true, role: serverRole ?? claims.role, userName: owner } : { isAuthenticated: false }) };
      sessions.push(call); if (options.holdSession) return; return call.reply();
    }
    if (apiPath === "/profile") return json({ id: owner, fullName: owner, role: claims.role, isSetupComplete: options.setup ?? true,
      approvalStatus: options.approval ?? "Approved", isLocked: options.locked ?? false, lockedUntil: null, concurrencyStamp: "test" });
    if (apiPath.startsWith("/offers")) {
      const reply = (status = detailError && apiPath !== "/offers/mine" ? 500 : 200) => json(status >= 400 ? { title: "PRIVATE SERVER DETAIL" }
        : apiPath === "/offers/mine" ? { items: [offer(owner)], totalCount: 1 } : offer(owner), status);
      const call = { owner, path: apiPath, method, reply }; offers.push(call);
      if ((apiPath === "/offers/mine" && holdList) || (apiPath !== "/offers/mine" && options.holdDetail)) return;
      return reply();
    }
    if (apiPath === "/language") return json({ language: options.lang ?? "en" });
    if (apiPath.endsWith("/unread-count")) return json({ unreadCount: 0 });
    return json({ items: [], totalCount: 0 });
  });
  return { offers, sessions, errors, setHoldList(held: boolean) { holdList = held; }, setDetailError(failed: boolean) { detailError = failed; },
    setServerRole(role: string) { serverRole = role; } };
}
async function mount(page: Page, options: Options = {}) {
  const api = await intercept(page, options);
  await page.goto("http://localhost:3000/profile/offers");
  await page.evaluate(config => Object.assign(window, { routeConfig: { lang: "en", ...config }, process: { env: {} } }), options);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId("auth-state")).toBeVisible();
  return api;
}
const destination = (role: string | null) => !role ? "/login?redirect=%2Fprofile%2Foffers" : role === "HallOwner" ? "/owner" : role === "Admin" ? "/admin" : "/profile";
async function denied(page: Page, role: string | null) {
  await expect.poll(() => page.evaluate("routes.at(-1)")).toBe(destination(role));
  await expect(page.getByTestId("professional-offers-page")).toHaveCount(0);
  await expect(page.getByTestId("professional-offers-form-page")).toHaveCount(0);
}

test("Hall Seeker direct navigation cannot mount management or request professional offers", async ({ page }) => {
  const api = await mount(page, { role: "RegisteredUser" }); await denied(page, "RegisteredUser"); expect(api.offers).toEqual([]);
});
for (const role of ["EventCoordinator", "Photographer"]) test(`${role} can open the route and its editor`, async ({ page }) => {
  const api = await mount(page, { role }); await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible();
  await expect(page.getByTestId("pro-offers-add")).toBeEnabled();
  await page.getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
  await expect(page.locator("textarea")).toHaveValue("Offer user-a"); expect(api.errors).toEqual([]);
});
for (const role of ["HallOwner", "Admin", null]) test(`${role ?? "Guest"} is redirected without professional offer requests`, async ({ page }) => {
  const api = await mount(page, { role }); await denied(page, role); expect(api.offers).toEqual([]);
});
test("authentication loading never flashes the professional interface or sends its requests", async ({ page }) => {
  const api = await mount(page, { role: null, holdSession: true });
  // This isolated harness omits Tailwind, so the empty skeleton has no visual height.
  await expect(page.getByTestId("profile-loading")).toHaveAttribute("aria-busy", "true"); await expect(page.getByTestId("professional-offers-page")).toHaveCount(0);
  expect(api.offers).toEqual([]); await expect.poll(() => api.sessions.length).toBe(1); await api.sessions[0].reply(); await denied(page, null);
});
for (const role of ["RegisteredUser", "HallOwner", "Admin", null])
  test(`switching from a professional to ${role ?? "Guest"} removes data and blocks new offer requests`, async ({ page }) => {
    const api = await mount(page, { role: "Photographer" }); await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible();
    const count = api.offers.length;
    await page.evaluate(role => { const w = window as unknown as { routeTest: { login(id: string, role: string): void; logout(): void } }; if (role) w.routeTest.login("user-b", role); else w.routeTest.logout(); }, role);
    await denied(page, role); expect(api.offers).toHaveLength(count);
  });
test("professional account switching rejects a late list and clears the previous editor draft", async ({ page }) => {
  const api = await mount(page, { role: "Photographer", holdList: true }); await expect.poll(() => api.offers.length).toBe(1);
  await page.evaluate("routeTest.login('user-b','EventCoordinator')"); await expect.poll(() => api.offers.length).toBe(2);
  await api.offers[1].reply(); await expect(page.getByTestId("pro-offer-row-offer-user-b")).toBeVisible(); await api.offers[0].reply();
  await expect(page.getByTestId("pro-offer-row-offer-user-a")).toHaveCount(0);
  await page.getByTestId("pro-offers-add").click(); await page.locator("textarea").fill("B private draft");
  api.setHoldList(false); await page.evaluate("routeTest.login('user-c','Photographer')");
  await expect(page.getByTestId("pro-offer-row-offer-user-c")).toBeVisible(); await expect(page.locator("textarea")).toHaveCount(0);
});
test("a role change during edit-detail loading cannot open the old editor", async ({ page }) => {
  const api = await mount(page, { role: "Photographer", holdDetail: true }); await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible();
  await page.getByRole("button", { name: en["offers.actions.edit"], exact: true }).click(); await expect.poll(() => api.offers.length).toBe(2);
  await page.evaluate("routeTest.login('user-b','RegisteredUser')"); await denied(page, "RegisteredUser"); await api.offers[1].reply();
  await expect(page.getByTestId("professional-offers-form-page")).toHaveCount(0);
});
test("logout/login with identical credentials creates a fresh workspace", async ({ page }) => {
  await mount(page, { role: "Photographer" }); await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible();
  await page.getByTestId("pro-offers-add").click(); await page.locator("textarea").fill("Previous login draft");
  await page.evaluate("routeTest.logout();routeTest.login('user-a','Photographer')");
  await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible(); await expect(page.locator("textarea")).toHaveCount(0);
});
for (const approval of ["Pending", "Rejected", "NeedsChanges"]) test(`${approval} professionals retain role access with publishing disabled`, async ({ page }) => {
  await mount(page, { role: "Photographer", approval }); await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible();
  await expect(page.getByTestId("pro-offers-add")).toBeDisabled(); await expect(page.getByRole("button", { name: en["offers.actions.edit"], exact: true })).toBeDisabled();
});
for (const option of [{ setup: false }, { locked: true }]) test(`${JSON.stringify(option)} preserves the existing publishing restriction`, async ({ page }) => {
  await mount(page, { role: "EventCoordinator", ...option }); await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible();
  await expect(page.getByTestId("pro-offers-add")).toBeDisabled();
});
test("ordinary permission/profile refresh preserves an authorized user's draft", async ({ page }) => {
  await mount(page, { role: "Photographer" }); await expect(page.getByTestId("pro-offers-add")).toBeEnabled();
  await page.getByTestId("pro-offers-add").click(); await page.locator("textarea").fill("Keep this draft"); await page.evaluate("profile.refetch()");
  await expect(page.locator("textarea")).toHaveValue("Keep this draft");
});
for (const lang of ["ar", "en"] as const) test(`${lang}: authorized route preserves F07 feedback and retry`, async ({ page }) => {
  const api = await mount(page, { role: "EventCoordinator", lang, detailError: true }); const catalog = lang === "ar" ? ar : en;
  await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible(); await page.getByRole("button", { name: catalog["offers.actions.edit"], exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(catalog["offers.errors.editLoadFailed"]); api.setDetailError(false);
  await page.getByRole("alert").getByRole("button", { name: catalog["common.retry"] }).click(); await expect(page.locator("textarea")).toHaveValue("Offer user-a");
});

for (const role of ["RegisteredUser", "HallOwner", "Admin", null])
  test(`the route guard independently rejects ${role ?? "Guest"} without the parent layout`, async ({ page }) => {
    const api = await mount(page, { role, withoutLayout: true }); await denied(page, role); expect(api.offers).toEqual([]);
  });
test("the route guard itself blocks pending authentication before mounting the manager", async ({ page }) => {
  const api = await mount(page, { role: null, holdSession: true, withoutLayout: true });
  await expect(page.getByTestId("professional-offers-loading")).toHaveAttribute("aria-busy", "true");
  expect(api.offers).toEqual([]); await expect.poll(() => api.sessions.length).toBe(1); await api.sessions[0].reply(); await denied(page, null);
});
test("a server-confirmed role change overrides the cached professional role and removes the workspace", async ({ page }) => {
  const api = await mount(page, { role: "Photographer" }); await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible();
  const count = api.offers.length; api.setServerRole("RegisteredUser"); await page.evaluate("auth.refreshSession()");
  await denied(page, "RegisteredUser"); expect(api.offers).toHaveLength(count);
});

for (const nextRole of ["RegisteredUser", "Photographer", null])
  test(`pending image validation cannot send the previous account's save after ${nextRole ?? "logout"}`, async ({ page }) => {
    const api = await mount(page, { role: "Photographer" }); await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible();
    await page.getByRole("button", { name: en["offers.actions.edit"], exact: true }).click(); await expect(page.locator("textarea")).toHaveValue("Offer user-a");
    await page.locator('input[type="file"]').setInputFiles({ name: "preview.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XcAAAAASUVORK5CYII=", "base64") });
    await page.evaluate(`window.originalBlobRead=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=function(){const blob=this;
      return new Promise((resolve,reject)=>window.finishImageRead=()=>originalBlobRead.call(blob).then(resolve,reject))}`);
    await page.locator('button[type="submit"]').click(); await expect.poll(() => page.evaluate("typeof window.finishImageRead")).toBe("function");
    await page.evaluate(role => {
      const w = window as unknown as { routeTest: { login(id: string, role: string): void; logout(): void } };
      if (role) w.routeTest.login("user-b", role); else w.routeTest.logout();
    }, nextRole);
    if (nextRole === "Photographer") await expect(page.getByTestId("pro-offer-row-offer-user-b")).toBeVisible(); else await denied(page, nextRole);
    await page.evaluate("Blob.prototype.arrayBuffer=originalBlobRead;finishImageRead()");
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
    expect(api.offers.filter(call => call.method !== "GET")).toEqual([]);
  });

test.describe("real Next.js route navigation with mocked APIs", () => {
  const baseURL = process.env.WESAL_AUTHORIZATION_DEVELOPMENT_URL;
  test.skip(!baseURL, "Requires the frontend development server; never starts the backend.");
  for (const role of ["RegisteredUser", "HallOwner", "Admin", null, "Photographer", "EventCoordinator"])
    test(`${role ?? "Guest"}: direct URL navigation`, async ({ page }) => {
      const api = await intercept(page, { role, lang: "ar" }, true);
      if (role) await page.addInitScript(role => {
        const token = `test.${btoa(JSON.stringify({ sub: "user-a", name: "user-a", role, exp: Date.now() / 1000 + 3600 }))}.test`;
        sessionStorage.setItem("wesal-access-token", token); sessionStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: "user-a", name: "user-a", role } }));
      }, role);
      await page.goto(baseURL + "/profile/offers");
      if (role === "Photographer" || role === "EventCoordinator") {
        await expect(page.getByTestId("pro-offer-row-offer-user-a")).toBeVisible(); expect(api.offers.length).toBeGreaterThan(0);
      } else {
        await expect.poll(() => new URL(page.url()).pathname).toBe(destination(role).split("?")[0]);
        await expect(page.getByTestId("professional-offers-page")).toHaveCount(0); expect(api.offers).toEqual([]);
      }
    });
});
