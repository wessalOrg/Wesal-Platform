import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { createRequestScope } from "../src/lib/request-scope";
import en from "../src/i18n/messages/en";

const halls = ["hall-a", "hall-b"].map((id) => ({ id, name: id, status: "Approved", paymentStatus: "Paid", adminLocked: false, systemLocked: false }));
const offer = (hallId: string) => ({ id: `${hallId}-offer`, hallId, oldBookingPrice: 200, offerPrice: 100,
  startsAt: "2020-01-01T10:00:00Z", endsAt: "2099-01-01T10:00:00Z" });
const post = (id: string) => ({ id: `${id}-post`, ownerUserId: id, content: `${id} content`, images: [] });
const publicProfile = (id: string) => ({ userId: id, displayName: id, role: "Photographer", isPubliclyAvailable: true,
  approvalStatus: "Approved", posts: [post(id)], offers: [] });

// Mount the real components in one React root. Only app-shell providers are stubbed;
// forms, hooks, services, mapping, HTTP and context changes run their production code.
let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/i18n": `const catalog = ${JSON.stringify(en)}; export const useT=()=> (key,vars={}) => Object.entries(vars).reduce((text,[k,v])=>text.replaceAll('{'+k+'}',String(v)),catalog[key]??key);`,
    "@/components/layout/LanguageProvider": `export const useUiLang=()=>"en";`,
    "@/hooks/useAccountAccess": `export const useAccountAccess=()=>({ready:true,authenticated:true,userId:"pro-a",isAdmin:false});`,
    "@/hooks/useProfessionalAccountAccess": `export const useProfessionalAccountAccess=()=>({canPublish:true,statusLoading:false});`,
    "@/hooks/useAccountPublishingLock": `export const useAccountPublishingLock=()=>({isLocked:false});`,
    "@/hooks/useStartProfessionalConversation": `export const useStartProfessionalConversation=()=>({start:async()=>null,starting:false,error:null});`,
    "@/hooks/useHallOwnerHalls": `const halls=${JSON.stringify(halls)}; export const useHallOwnerHalls=()=>({halls,isLoading:false});`,
    "next/link": `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
    "next/navigation": `export const useRouter=()=>({push(){},replace(){},refresh(){}}); export const usePathname=()=>'/'; export const useSearchParams=()=>new URLSearchParams();`,
    "@/components/posts/PostInquiryButton": `export default function PostInquiryButton(){return null}`,
  };
  const output = await build({
    stdin: { contents: `import React,{StrictMode,useState} from 'react';import {createRoot} from 'react-dom/client';
      import Profile from './src/components/professionals/ProfessionalPublicProfileView';
      import Halls from './src/components/offers/HallOwnerOffersPage';
      function Harness(){const [id,setId]=useState('pro-a');const [n,setN]=useState(0);return <>
      <button id="pro-a" onClick={()=>setId('pro-a')}>A</button><button id="pro-b" onClick={()=>setId('pro-b')}>B</button>
      <button id="rerender" onClick={()=>setN(n+1)}>Refresh shell {n}</button>
      {location.pathname.includes('halls-test')?<Halls/>:<Profile userId={id}/>}</>}
      createRoot(document.getElementById('root')).render(<StrictMode><Harness/></StrictMode>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"), loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "shell-stubs", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = output.outputFiles[0].text;
});

type Pending = { path: string; method: string; body: string | null; reply: (body: unknown, status?: number) => Promise<void> };
async function mount(page: Page, mode: "halls" | "profiles") {
  const pending: Pending[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    await new Promise<void>((done) => {
      pending.push({ path: new URL(request.url()).pathname.slice(7), method: request.method(), body: request.postData(),
        reply: async (body, status = 200) => { await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); done(); } });
    });
  });
  await page.route("**/*-test", (route) => route.fulfill({ contentType: "text/html", body: '<html lang="en" dir="ltr"><body><div id="root"></div></body></html>' }));
  await page.goto(`http://localhost:3000/${mode}-test`);
  await page.addScriptTag({ content: bundle });
  const take = async (url: string, method = "GET") => {
    await expect.poll(() => {
      expect(errors).toEqual([]);
      return pending.findIndex((r) => r.path === url && r.method === method);
    }).toBeGreaterThanOrEqual(0);
    return pending.splice(pending.findIndex((r) => r.path === url && r.method === method), 1)[0];
  };
  return { take, pending };
}
async function selectHall(page: Page, id: string) {
  await page.getByTestId("owner-offers-hall-select").click({ force: true });
  await page.getByRole("option", { name: id, exact: true }).click({ force: true });
}
const hallPath = (id: string) => `/owner/halls/${id}/offers`;

test("request scopes reject obsolete generations, keep lanes independent and survive StrictMode cleanup", () => {
  const a = createRequestScope(); a.activate();
  const first = a.latest("posts"), offers = a.latest("offers"), newest = a.latest("posts");
  expect(first()).toBe(false); expect(offers()).toBe(true); expect(newest()).toBe(true);
  const save = a.capture(); a.dispose(); a.activate();
  expect(save()).toBe(false); expect(newest()).toBe(false); expect(a.latest("posts")()).toBe(true);
});

test("profile responses arriving out of order cannot replace the current identity", async ({ page }) => {
  const api = await mount(page, "profiles");
  const a = await api.take("/profile/pro-a");
  await page.locator("#pro-b").click();
  const b = await api.take("/profile/pro-b");
  await b.reply(publicProfile("pro-b"));
  await (await api.take("/posts/profile/pro-b")).reply({ items: [post("pro-b")] });
  await a.reply(publicProfile("pro-a"));
  await expect(page.getByRole("heading", { name: "pro-b", exact: true })).toBeVisible();
  await expect(page.getByText("pro-a content", { exact: true })).toHaveCount(0);
  expect(api.pending.some((r) => r.path === "/posts/profile/pro-a")).toBe(false);
});

for (const resource of ["posts", "offers"] as const) {
  test(`late ${resource} list success/failure cannot leak into another professional`, async ({ page }) => {
    const api = await mount(page, "profiles");
    await (await api.take("/profile/pro-a")).reply(publicProfile("pro-a"));
    const aPosts = await api.take("/posts/profile/pro-a");
    let old = aPosts;
    if (resource === "offers") {
      await aPosts.reply({ items: [post("pro-a")] });
      await page.getByTestId("professional-tab-offers").click();
      old = await api.take("/offers/mine");
    }
    await page.locator("#pro-b").click();
    await expect(page.getByTestId("professional-profile-loading")).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("pro-a content", { exact: true })).toHaveCount(0);
    await (await api.take("/profile/pro-b")).reply(publicProfile("pro-b"));
    await (await api.take("/posts/profile/pro-b")).reply({ items: [post("pro-b")] });
    if (resource === "offers") {
      await page.getByTestId("professional-tab-offers").click();
      await (await api.take("/offers/profile/pro-b")).reply({ items: [] });
      await old.reply({ title: "Old profile failure" }, 500);
      await expect(page.getByText(en["professionals.offers.empty"], { exact: true })).toBeVisible();
    } else await old.reply({ items: [post("pro-a")] });
    await expect(page.getByRole("heading", { name: "pro-b", exact: true })).toBeVisible();
    await expect(page.getByText("pro-a content", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("post edit drafts close on owner change, but survive a same-context shell render", async ({ page }) => {
  const api = await mount(page, "profiles");
  await (await api.take("/profile/pro-a")).reply(publicProfile("pro-a"));
  await (await api.take("/posts/profile/pro-a")).reply({ items: [post("pro-a")] });
  await page.getByTestId("professional-post-edit").click();
  const text = page.locator("textarea"); await text.fill("Unsaved owner A draft");
  await page.locator("#rerender").click(); await expect(text).toHaveValue("Unsaved owner A draft");
  await page.locator("#pro-b").click();
  await (await api.take("/profile/pro-b")).reply(publicProfile("pro-b"));
  await (await api.take("/posts/profile/pro-b")).reply({ items: [post("pro-b")] });
  await expect(page.locator("textarea")).toHaveCount(0);
});

test("a newer list refresh wins over an older response for the same professional", async ({ page }) => {
  const api = await mount(page, "profiles");
  await (await api.take("/profile/pro-a")).reply(publicProfile("pro-a"));
  const older = await api.take("/posts/profile/pro-a");
  await page.getByTestId("professional-tab-offers").click();
  const otherTab = await api.take("/offers/mine");
  await page.getByTestId("professional-tab-posts").click();
  const newer = await api.take("/posts/profile/pro-a");
  await newer.reply({ items: [{ ...post("pro-a"), content: "Newest post content" }] });
  await older.reply({ items: [post("pro-a")] });
  await otherTab.reply({ title: "Offer list failed" }, 500);
  await expect(page.getByText("Newest post content", { exact: true })).toBeVisible();
  await expect(page.getByText("pro-a content", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByTestId("professional-tab-offers").click();
  await (await api.take("/offers/mine")).reply({ title: "Current offer failure" }, 500);
  await expect(page.getByRole("alert")).toContainText(en["professionals.offers.errors.loadFailed"]);
});

for (const fail of [false, true]) {
  test(`a pending professional post save ${fail ? "failure" : "success"} stays in its original owner context`, async ({ page }) => {
    const api = await mount(page, "profiles");
    await (await api.take("/profile/pro-a")).reply(publicProfile("pro-a"));
    await (await api.take("/posts/profile/pro-a")).reply({ items: [post("pro-a")] });
    await page.getByTestId("professional-post-edit").click();
    await page.locator("textarea").fill("Owner A saved draft");
    await page.getByTestId("professional-post-submit").click();
    const save = await api.take("/posts/pro-a-post", "PUT");
    expect(save.body).toContain("Owner A saved draft");
    await page.locator("#pro-b").click();
    await (await api.take("/profile/pro-b")).reply(publicProfile("pro-b"));
    await (await api.take("/posts/profile/pro-b")).reply({ items: [post("pro-b")] });
    await save.reply(fail ? { title: "Old save failure" } : {}, fail ? 500 : 200);
    await expect(page.getByText("pro-b content", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByTestId("professional-post-form")).toHaveCount(0);
    expect(api.pending.some((r) => r.path === "/profile/pro-a")).toBe(false);
  });
}

for (const fail of [false, true]) {
  test(`hall loading isolates a late ${fail ? "failure" : "success"}, including A to B to A`, async ({ page }) => {
    const api = await mount(page, "halls");
    const a = await api.take(hallPath("hall-a"));
    await selectHall(page, "hall-b");
    const b = await api.take(hallPath("hall-b"));
    await b.reply({ items: [offer("hall-b")] });
    await a.reply(fail ? { title: "Old hall failure" } : { items: [offer("hall-a")] }, fail ? 500 : 200);
    await expect(page.getByTestId("owner-offer-card-hall-b-offer")).toBeVisible();
    await expect(page.getByTestId("owner-offer-card-hall-a-offer")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await selectHall(page, "hall-a");
    await expect(page.getByTestId("owner-offer-card-hall-b-offer")).toHaveCount(0);
    await (await api.take(hallPath("hall-a"))).reply({ items: [] });
    await expect(page.getByText(en["offers.owner.empty"], { exact: true })).toBeVisible();
  });
}

test("changing halls discards the old edit context and binds the next edit to hall B", async ({ page }) => {
  const api = await mount(page, "halls");
  await (await api.take(hallPath("hall-a"))).reply({ items: [offer("hall-a")] });
  await page.getByTestId("owner-offers-search").fill("100");
  await page.getByTestId("owner-offer-card-hall-a-offer").getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
  const input = page.getByTestId("offer-field-oldPrice"); await input.fill("333");
  await page.locator("#rerender").click({ force: true }); await expect(input).toHaveValue("333");
  await selectHall(page, "hall-b");
  await expect(page.getByTestId("owner-offers-search")).toHaveValue("100");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await (await api.take(hallPath("hall-b"))).reply({ items: [offer("hall-b")] });
  await page.getByTestId("owner-offer-card-hall-b-offer").getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
  await expect(input).toHaveValue("200");
  await page.getByRole("button", { name: en["offers.form.save"], exact: true }).click();
  const save = await api.take(`${hallPath("hall-b")}/hall-b-offer`, "PUT");
  expect(JSON.parse(save.body!)).toMatchObject({ oldBookingPrice: 200, offerPrice: 100 });
  await save.reply({});
  await (await api.take(hallPath("hall-b"))).reply({ items: [offer("hall-b")] });
});

test("returning to hall A does not reactivate the abandoned A request", async ({ page }) => {
  const api = await mount(page, "halls");
  const abandoned = await api.take(hallPath("hall-a"));
  await selectHall(page, "hall-b");
  await (await api.take(hallPath("hall-b"))).reply({ items: [offer("hall-b")] });
  await selectHall(page, "hall-a");
  await (await api.take(hallPath("hall-a"))).reply({ items: [] });
  await abandoned.reply({ items: [offer("hall-a")] });
  await expect(page.getByText(en["offers.owner.empty"], { exact: true })).toBeVisible();
  await expect(page.getByTestId("owner-offer-card-hall-a-offer")).toHaveCount(0);
});

for (const action of ["save", "stop"] as const) for (const fail of [false, true]) {
  test(`pending hall ${action} ${fail ? "failure" : "success"} cannot reset B or refresh A`, async ({ page }) => {
    const api = await mount(page, "halls");
    await (await api.take(hallPath("hall-a"))).reply({ items: [offer("hall-a")] });
    const card = page.getByTestId("owner-offer-card-hall-a-offer");
    await card.getByRole("button", { name: en[action === "save" ? "offers.actions.edit" : "offers.actions.stop"], exact: true }).click();
    await page.getByRole(action === "save" ? "dialog" : "alertdialog").getByRole("button", { name: en[action === "save" ? "offers.form.save" : "offers.stop.confirm"], exact: true }).click();
    const write = await api.take(`${hallPath("hall-a")}/hall-a-offer${action === "stop" ? "/stop" : ""}`, action === "save" ? "PUT" : "POST");
    await selectHall(page, "hall-b");
    await (await api.take(hallPath("hall-b"))).reply({ items: [offer("hall-b")] });
    await page.getByTestId("owner-offers-add").click();
    const input = page.getByTestId("offer-field-oldPrice"); await input.fill("444");
    await write.reply(fail ? { title: "Old mutation failure" } : {}, fail ? 500 : 200);
    await expect(input).toHaveValue("444");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(api.pending.some((r) => r.path === hallPath("hall-a"))).toBe(false);
  });
}
