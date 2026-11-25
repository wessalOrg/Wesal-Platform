import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/components/auth/AuthProvider": "export const useAuth=()=>({session:{isAuthenticated:!window.hookGuest,role:'Photographer'},status:'ready'});",
    "@/services/language": "export const fetchLanguagePreference=async()=>null;export const updateLanguagePreference=async()=>{};",
    "@/services/post-interactions": "export const fetchFavoritePosts=async()=>({items:[{id:'B'}],pageNumber:1,pageSize:100,totalCount:1,totalPages:1});export const addPostFavorite=async(id)=>{window.favoriteWrites.push(id)};export const removePostFavorite=async(id)=>{window.favoriteWrites.push(id)};",
    "@/services/statistics": "export const fetchMyStatistics=async()=>{if(window.statsFailure)throw Error('offline');return {totalBookings:5}};",
    "next/navigation": "export const useRouter=()=>({push(){}});",
    "@/components/brand/MabroukFigure": "export default function Figure(){return null}",
  };
  const result = await build({
    stdin: { contents: `import React,{useRef,useState}from'react';import{createRoot}from'react-dom/client';
      import{LanguageProvider,useLanguage}from'./src/components/layout/LanguageProvider';
      import DeletePostModal from'./src/components/admin/moderation/DeletePostModal';
      import RestrictionModal from'./src/components/admin/moderation/RestrictionModal';
      import AnchoredPanel from'./src/components/ui/AnchoredPanel';
      import PostFavoriteButton from'./src/components/posts/PostFavoriteButton';
      import{useFavoritePostIds}from'./src/hooks/useFavoritePostIds';
      import{useProfessionalStatistics}from'./src/hooks/useProfessionalStatistics';
      import{setAccessToken}from'./src/lib/auth-token';import{setStoredAuth}from'./src/lib/auth-storage';
      window.favoriteWrites=[];
      if(!window.hookGuest){setAccessToken('hooks-owner-token');setStoredAuth({token:'hooks-owner-token',user:{id:'hooks-owner',role:'Photographer'}})}
      function Harness(){const[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[panel,setPanel]=useState(false),[tick,setTick]=useState(0),[post,setPost]=useState('A'),anchor=useRef(null),language=useLanguage(),favorites=useFavoritePostIds(),statistics=useProfessionalStatistics();
        return <><button id='open' onClick={()=>setOpen(true)}>Open</button><button id='close' onClick={()=>setOpen(false)}>Close</button>
          <output id='favorite-ids'>{favorites.ready?Array.from(favorites.ids).join(','):'loading'}</output><button id='local-save' onClick={()=>favorites.markSaved('local',true)}>Local save</button><button id='refresh' onClick={()=>favorites.refresh()}>Refresh</button>
          <output id='statistics'>{statistics.status}:{statistics.stats?'data':'empty'}:{statistics.errorKey||''}</output><button id='reload-statistics' onClick={()=>statistics.reload()}>Reload statistics</button>
          <button id='busy' onClick={()=>setBusy(v=>!v)}>Busy</button><button id='rerender' onClick={()=>setTick(v=>v+1)}>Render {tick}</button>
          <button id='language' onClick={()=>language.toggleLanguage()}>Language</button><output id='lang'>{language.lang}:{language.status}</output>
          <button id='anchor' ref={anchor} style={{position:'absolute',right:20,top:300,width:110,height:40}} onClick={()=>setPanel(v=>!v)}>Panel</button>
          <AnchoredPanel open={panel} anchorRef={anchor} options={{width:180}} data-testid='panel'>Content</AnchoredPanel>
          <button id='post' onClick={()=>setPost(v=>v==='A'?'B':'A')}>Change post</button>
          <section id='favorite'><PostFavoriteButton postId={post} initialSaved={post==='B'} saveCount={post==='A'?2:8}/></section>
          {window.modalKind==='restriction'?<RestrictionModal open={open} busy={busy} user={{userId:'owner',displayName:'Owner',roleLabel:'Photographer'}} onClose={()=>setOpen(false)} onConfirm={()=>{}}/>:
            <DeletePostModal open={open} busy={busy} onClose={()=>setOpen(false)} onConfirm={()=>{}}/>}
        </>}
      createRoot(document.getElementById('root')).render(<LanguageProvider><Harness/></LanguageProvider>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "hooks-regression-mocks", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = result.outputFiles[0].text;
});

async function mount(page: Page, kind = "delete", lang = "en", blockedStorage = false, guest = false) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/hooks-regression", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("http://localhost:3000/hooks-regression");
  await page.evaluate(({ kind, lang, blockedStorage, guest }) => {
    Object.assign(window, { modalKind: kind, hookGuest: guest });
    localStorage.setItem("wesal_ui_lang", lang);
    if (blockedStorage) {
      Storage.prototype.getItem = () => { throw new Error("Storage unavailable"); };
      Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); };
    }
  }, { kind, lang, blockedStorage, guest });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator("#lang")).toContainText(":ready");
  return errors;
}

for (const kind of ["delete", "restriction"]) {
  test(`${kind}: parent rerenders and busy changes preserve the reason; reopening resets it`, async ({ page }) => {
    const errors = await mount(page, kind);
    await page.locator("#open").click();
    const reason = page.getByRole("textbox");
    await reason.fill("Entered moderation reason");
    // External parent changes must not be mistaken for a new form session.
    await page.locator("#rerender").evaluate((element: HTMLButtonElement) => element.click());
    await expect(reason).toHaveValue("Entered moderation reason");
    await page.locator("#busy").evaluate((element: HTMLButtonElement) => element.click());
    await expect(reason).toHaveValue("Entered moderation reason");
    await page.locator("#busy").evaluate((element: HTMLButtonElement) => element.click());
    await page.locator("#close").evaluate((element: HTMLButtonElement) => element.click());
    await page.locator("#open").click();
    await expect(reason).toHaveValue("");
    expect(errors).toEqual([]);
  });
}

for (const width of [390, 768, 1366]) test(`${width}px: body portal measures its anchor on open, resize and reopen`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors = await mount(page);
  const panel = page.getByTestId("panel"), anchor = page.locator("#anchor");
  await anchor.click(); await expect(panel).toBeVisible();
  expect(await panel.evaluate(element => element.parentElement === document.body)).toBe(true);
  const box = await anchor.boundingBox();
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe((box?.y ?? 0) + (box?.height ?? 0) + 6);
  await page.setViewportSize({ width: width - 20, height: 850 });
  await expect.poll(async () => {
    const current = await panel.boundingBox(); return Boolean(current && current.x >= 8 && current.x + current.width <= width - 28);
  }).toBe(true);
  await anchor.click(); await expect(panel).toHaveCount(0);
  await anchor.click(); await expect(panel).toBeVisible();
  expect(errors).toEqual([]);
});

test("favorite state preserves local interactions and uses the selected post's API state", async ({ page }) => {
  const errors = await mount(page);
  const favorite = page.locator("#favorite button");
  await expect(favorite).toContainText("2"); await favorite.click();
  await expect(favorite).toContainText("3"); await page.locator("#rerender").click();
  await expect(favorite).toContainText("3"); await page.locator("#post").click();
  await expect(favorite).toContainText("8"); await favorite.click();
  await expect(favorite).toContainText("7");
  expect(await page.evaluate("window.favoriteWrites")).toEqual(["A", "B"]);
  expect(errors).toEqual([]);
});

for (const blocked of [false, true]) test(`language initialization and switching with ${blocked ? "unavailable" : "available"} storage`, async ({ page }) => {
  const errors = await mount(page, "delete", "en", blocked);
  await expect(page.locator("#lang")).toHaveText(blocked ? "ar:ready" : "en:ready");
  await page.locator("#language").click();
  await expect(page.locator("#lang")).toHaveText(blocked ? "en:ready" : "ar:ready");
  await expect(page.locator("html")).toHaveAttribute("dir", blocked ? "ltr" : "rtl");
  expect(errors).toEqual([]);
});

test("guests cannot fabricate account-owned favorite IDs and statistics remain forbidden", async ({ page }) => {
  const errors = await mount(page, "delete", "en", false, true);
  await expect(page.locator("#favorite-ids")).toBeEmpty();
  await page.locator("#local-save").click(); await expect(page.locator("#favorite-ids")).toBeEmpty();
  await page.locator("#refresh").click(); await expect(page.locator("#favorite-ids")).toBeEmpty();
  await expect(page.locator("#statistics")).toHaveText("forbidden:empty:");
  await page.locator("#reload-statistics").click();
  await expect(page.locator("#statistics")).toHaveText("forbidden:empty:");
  expect(errors).toEqual([]);
});

test("statistics initialization, failed reload and recovery preserve their existing states", async ({ page }) => {
  const errors = await mount(page);
  await expect(page.locator("#statistics")).toHaveText("ready:data:");
  await page.evaluate("window.statsFailure=true"); await page.locator("#reload-statistics").click();
  await expect(page.locator("#statistics")).toHaveText("error:empty:statistics.errors.loadFailed");
  await page.evaluate("window.statsFailure=false"); await page.locator("#reload-statistics").click();
  await expect(page.locator("#statistics")).toHaveText("ready:data:");
  expect(errors).toEqual([]);
});
