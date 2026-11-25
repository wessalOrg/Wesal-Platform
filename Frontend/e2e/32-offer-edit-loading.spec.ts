import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/i18n": `const catalogs=${JSON.stringify({ ar, en })};export const useT=()=>key=>catalogs[window.offerLang][key]??key;`,
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>window.offerLang;",
    "@/hooks/useAccountPublishingLock": "export const useAccountPublishingLock=()=>({ready:true,isLocked:false});",
    "@/components/brand/MabroukFigure": "export default function Figure(){return null}",
    "@/hooks/useProfessionalAccountAccess": `import{useSyncExternalStore}from'react';import{subscribeAuthenticatedAccount,readAuthenticatedAccount}from'@/lib/authenticated-account';
      export const useProfessionalAccountAccess=()=>{const account=useSyncExternalStore(subscribeAuthenticatedAccount,readAuthenticatedAccount,()=>null);
        return{userId:account?.userId??null,canPublish:!!account,statusLoading:false}};`,
    "next/link": "import React from'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}",
  };
  const result = await build({
    stdin: { contents: `import React,{StrictMode,useState}from'react';import{createRoot}from'react-dom/client';
      import Manager from'./src/components/offers/ProfessionalOffersManagePage';
      import{setAccessToken}from'./src/lib/auth-token';import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';
      window.offerLang=new URLSearchParams(location.search).get('lang')||'en';
      window.offerTest={login(id){const token='test-'+id;setAccessToken(token);setStoredAuth({token,user:{id,role:window.offerRole}})},logout:clearAuthSession};
      offerTest.login('user-a');document.documentElement.dir=offerLang==='ar'?'rtl':'ltr';
      function Root(){const[shown,setShown]=useState(true);return <><button id="mount" onClick={()=>setShown(v=>!v)}>Mount</button>{shown&&<Manager/>}</>}
      createRoot(document.getElementById('root')).render(<StrictMode><Root/></StrictMode>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"), loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "offer-edit-shell", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});
type Mode = "valid" | "500" | "404" | "network" | "missing" | "wrong-id" | "wrong-owner";
const offer = (id: string, fresh = false, ownerUserId = "user-a") => ({ id, ownerUserId,
  content: `${fresh ? "Fresh" : "Listed"} ${id}\nFull offer description`, oldPrice: 200, offerPrice: 100,
  startsAt: "2030-01-01T10:00:00Z", endsAt: "2099-01-01T10:00:00Z", images: [], stoppedAt: null });
type DetailCall = { id: string; reply: (mode?: Mode) => Promise<void> };
async function mount(page: Page, options: { mode?: Mode; hold?: boolean; lang?: "ar" | "en"; role?: string; listError?: boolean; writeFailure?: boolean } = {}) {
  const details: DetailCall[] = [], writes: Array<{ path: string; body: string }> = [], errors: string[] = [];
  let mode = options.mode ?? "valid", hold = options.hold ?? false;
  let writeFailure = options.writeFailure ?? false;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (pathname === "/offer-edit-test") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
    if (!pathname.startsWith("/api/v1/")) throw new Error(`Unexpected network ${pathname}`);
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => undefined);
    if (pathname === "/api/v1/offers/mine") return options.listError ? json({ title: "PRIVATE LIST ERROR" }, 500)
      : json({ items: [offer("offer-a"), offer("offer-b")], totalCount: 2, page: 1, pageSize: 50 });
    if (request.method() === "PUT" || request.method() === "POST") {
      writes.push({ path: pathname, body: request.postDataBuffer()?.toString() ?? "" });
      return writeFailure ? json({ title: "Save unavailable" }, 500) : json({ id: "created-offer" });
    }
    const id = pathname.split("/").pop()!;
    const reply = async (response = mode) => {
      if (response === "network") return route.abort("failed").catch(() => undefined);
      if (response === "500" || response === "404") return json({ title: "PRIVATE BACKEND ERROR" }, Number(response));
      if (response === "missing") return json(null);
      return json(offer(response === "wrong-id" ? "offer-b" : id, true, response === "wrong-owner" ? "user-b" : "user-a"));
    };
    details.push({ id, reply }); if (hold) return; return reply();
  });
  await page.goto(`http://localhost:3000/offer-edit-test?lang=${options.lang ?? "en"}`);
  await page.evaluate(role => Object.assign(window, { process: { env: {} }, offerRole: role }), options.role ?? "Photographer");
  await page.addScriptTag({ content: bundle });
  if (!options.listError) await expect(page.getByTestId("pro-offer-row-offer-a")).toBeVisible();
  const catalog = options.lang === "ar" ? ar : en;
  return { details, writes, errors, catalog, setMode(next: Mode, pending = false) { mode = next; hold = pending; },
    setWriteFailure(failed: boolean) { writeFailure = failed; },
    edit(id = "offer-a") { return page.getByTestId(`pro-offer-row-${id}`).getByRole("button", { name: catalog["offers.actions.edit"], exact: true }); } };
}

test("an edit-detail HTTP 500 is visible after the list has loaded", async ({ page }) => {
  const { edit } = await mount(page, { mode: "500" }); await edit().click();
  await expect(page.getByTestId("professional-offers-page").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("pro-offer-row-offer-a")).toBeVisible();
  await expect(page.getByTestId("pro-offer-row-offer-b")).toBeVisible();
  await expect(page.getByTestId("professional-offers-form-page")).toHaveCount(0);
});

for (const lang of ["ar", "en"] as const) for (const mode of ["500", "network", "404", "missing"] as const)
  test(`${lang}: ${mode} gives safe, actionable feedback and keeps the list usable`, async ({ page }) => {
    const { edit, catalog, errors } = await mount(page, { lang, mode }); await edit().click();
    const alert = page.getByRole("alert"); await expect(alert).toBeVisible();
    await expect(alert).toContainText(catalog[mode === "404" || mode === "missing" ? "offers.errors.editNotFound" : "offers.errors.editLoadFailed"]);
    await expect(alert.getByRole("button", { name: catalog["common.retry"] })).toBeEnabled();
    await expect(page.getByTestId("pro-offer-row-offer-b")).toBeVisible(); await expect(edit("offer-b")).toBeEnabled();
    await expect(page.getByTestId("pro-offers-add")).toBeEnabled(); await expect(alert).not.toContainText("PRIVATE");
    expect(errors).toEqual([]);
  });

test("retry clears the error, suppresses duplicate requests and opens fresh details", async ({ page }) => {
  const { edit, details, catalog, setMode } = await mount(page, { mode: "500" }); await edit().click();
  await expect(page.getByRole("alert")).toBeVisible(); setMode("valid", true);
  await page.getByRole("alert").getByRole("button", { name: catalog["common.retry"] }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => details.length).toBe(2); await expect(page.getByRole("alert")).toHaveCount(0);
  await details[1].reply(); await expect(page.locator("textarea")).toHaveValue(offer("offer-a", true).content);
});

test("rapid edit clicks create just one request for the current target", async ({ page }) => {
  const { edit, details } = await mount(page, { hold: true });
  await edit().evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click(); });
  await expect.poll(() => details.length).toBe(1); await details[0].reply();
  await expect(page.locator("textarea")).toHaveValue(offer("offer-a", true).content);
});

for (const late of ["valid", "500"] as const) test(`selecting B supersedes A's late ${late} response`, async ({ page }) => {
  const { edit, details } = await mount(page, { hold: true }); await edit().click();
  await expect.poll(() => details.length).toBe(1); await edit("offer-b").click(); await expect.poll(() => details.length).toBe(2);
  await details[1].reply(); await expect(page.locator("textarea")).toHaveValue(offer("offer-b", true).content);
  await page.locator("textarea").fill("B draft changed by the user");
  await details[0].reply(late); await expect(page.locator("textarea")).toHaveValue("B draft changed by the user");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("choosing another offer clears the previous action error", async ({ page }) => {
  const { edit, setMode } = await mount(page, { mode: "500" }); await edit().click(); await expect(page.getByRole("alert")).toBeVisible();
  setMode("valid"); await edit("offer-b").click(); await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveValue(offer("offer-b", true).content);
});

for (const transition of ["offerTest.login('user-b')", "offerTest.logout()"])
  test(`account transition cannot open a previous account's editor: ${transition}`, async ({ page }) => {
    const { edit, details } = await mount(page, { hold: true }); await edit().click(); await expect.poll(() => details.length).toBe(1);
    await page.evaluate(transition); await details[0].reply(); await expect(page.getByTestId("professional-offers-form-page")).toHaveCount(0);
  });

test("unmount and remount invalidate a pending editor response", async ({ page }) => {
  const { edit, details } = await mount(page, { hold: true }); await edit().click(); await expect.poll(() => details.length).toBe(1);
  await page.locator("#mount").click(); await page.locator("#mount").click(); await details[0].reply();
  await expect(page.getByTestId("pro-offer-row-offer-a")).toBeVisible(); await expect(page.getByTestId("professional-offers-form-page")).toHaveCount(0);
});

test("creating an offer invalidates an older edit-detail request", async ({ page }) => {
  const { edit, details } = await mount(page, { hold: true }); await edit().click(); await expect.poll(() => details.length).toBe(1);
  await page.getByTestId("pro-offers-add").click(); await expect(page.locator("textarea")).toHaveValue("");
  await page.locator("textarea").fill("New draft"); await details[0].reply(); await expect(page.locator("textarea")).toHaveValue("New draft");
});

for (const mode of ["wrong-id", "wrong-owner"] as const) test(`${mode} details never become an editing target`, async ({ page }) => {
  const { edit } = await mount(page, { mode }); await edit().click(); await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("professional-offers-form-page")).toHaveCount(0);
});

for (const role of ["Photographer", "EventCoordinator"]) test(`${role}: fresh values can still be edited and saved`, async ({ page }) => {
  const { edit, writes } = await mount(page, { role }); await edit().click();
  await expect(page.locator("textarea")).toHaveValue(offer("offer-a", true).content);
  await page.locator("textarea").fill("Updated description\nSecond paragraph"); await page.locator('button[type="submit"]').click();
  await expect.poll(() => writes.length).toBe(1); expect(writes[0].path).toBe("/api/v1/offers/offer-a");
  expect(writes[0].body).toContain("Updated description"); expect(writes[0].body).toContain("Second paragraph");
  await expect(page.getByTestId("pro-offer-row-offer-a")).toBeVisible();
});

test("list loading errors remain independent of edit actions", async ({ page }) => {
  const { catalog, details } = await mount(page, { listError: true });
  await expect(page.getByTestId("content-pagination").getByRole("alert")).toContainText(catalog["content.pagination.error"]);
  expect(details).toHaveLength(0);
});

test("a late A success cannot hide B's failure or change its retry target", async ({ page }) => {
  const { edit, details, catalog } = await mount(page, { hold: true });
  await edit().click(); await expect.poll(() => details.length).toBe(1); await edit("offer-b").click();
  await expect.poll(() => details.length).toBe(2); await details[1].reply("500");
  await expect(page.getByRole("alert")).toBeVisible(); await details[0].reply();
  await expect(page.getByTestId("professional-offers-form-page")).toHaveCount(0);
  await page.getByRole("alert").getByRole("button", { name: catalog["common.retry"] }).click();
  await expect.poll(() => details.length).toBe(3); expect(details[2].id).toBe("offer-b");
  await details[2].reply(); await expect(page.locator("textarea")).toHaveValue(offer("offer-b", true).content);
});

test("opening a stop confirmation prevents a pending editor from replacing it", async ({ page }) => {
  const { edit, details, catalog } = await mount(page, { hold: true }); await edit().click(); await expect.poll(() => details.length).toBe(1);
  await page.getByTestId("pro-offer-row-offer-b").getByRole("button", { name: catalog["offers.actions.stop"], exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible(); await details[0].reply();
  await expect(page.getByRole("alertdialog")).toBeVisible(); await expect(page.getByTestId("professional-offers-form-page")).toHaveCount(0);
});

test("save failure preserves entered values and a later save still targets the same offer", async ({ page }) => {
  const { edit, writes, setWriteFailure } = await mount(page, { writeFailure: true }); await edit().click();
  await expect(page.locator("textarea")).toHaveValue(offer("offer-a", true).content);
  await page.locator("textarea").fill("Keep my unsaved changes"); await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("alert")).toContainText("Save unavailable"); await expect(page.locator("textarea")).toHaveValue("Keep my unsaved changes");
  setWriteFailure(false); await page.locator('button[type="submit"]').click(); await expect.poll(() => writes.length).toBe(2);
  expect(writes.every(write => write.path === "/api/v1/offers/offer-a" && write.body.includes("Keep my unsaved changes"))).toBe(true);
  await expect(page.getByTestId("pro-offer-row-offer-a")).toBeVisible();
});
