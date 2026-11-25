import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

const hallId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const max = 5 * 1024 * 1024;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWM4WF0PRwzEcQDUUhuxFgs8twAAAABJRU5ErkJggg==", "base64");
let jpg: Buffer, webp: Buffer, bundle: string, styles = "";
test.beforeAll(async () => {
  jpg = await readFile(path.resolve("public/providers/photo-villa-sparkle.jpg"));
  webp = await readFile(path.resolve("public/services/photo.webp"));
  const cssDir = path.resolve(".next/static/chunks");
  for (const file of await readdir(cssDir)) if (file.endsWith(".css")) {
    const css = await readFile(path.join(cssDir, file), "utf8"); if (css.includes(".container-wesal")) styles += css;
  }
  const mocks: Record<string, string> = {
    "next/navigation": "export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push(){},replace(){}});",
    "next/image": "export default function Image({src,alt}){return <img src={src} alt={alt}/>}",
    "@/components/auth/AuthProvider": "const logout=async()=>window.logout();export const useAuth=()=>({logout,session:{isAuthenticated:true,role:'HallOwner'}});",
    "@/components/layout/LanguageProvider": "export const useUiLang=()=>window.lang;",
    "@/i18n": `import ar from'./src/i18n/messages/ar';import en from'./src/i18n/messages/en';export const t=(key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),(window.lang==='ar'?ar:en)[key]??key);export const useT=()=>t;`,
    "@/components/brand/MabroukFigure": "export default function Figure(){return null}",
    "@/services/halls": "export const fetchHallById=async()=>({status:'missing'});",
    "@/hooks/useHallRegistrationForm": `import{useHallRegistrationForm as real}from'./src/hooks/useHallRegistrationForm';export function useHallRegistrationForm(options){const value=real(options);window.form=value;return value}`,
    "@/lib/api": `export const apiOrigin='http://localhost:3000';export default {get:async()=>({data:window.details,status:200}),post:(path,data)=>window.write('POST',path,data),put:(path,data)=>window.write('PUT',path,data)};`,
  };
  const result = await build({
    stdin: { contents: `import React,{StrictMode,useState}from'react';import{createRoot}from'react-dom/client';
      import{setAccessToken}from'./src/lib/auth-token';import{setStoredAuth,clearAuthSession}from'./src/lib/auth-storage';import{ApiError}from'./src/lib/api-error';
      import Registration from'./src/components/owner-management/add-hall/HallRegistrationForm';import EditForm from'./src/components/owner-management/halls/HallManagementForm';
      import{useHallOwnerHallManagement}from'./src/hooks/useHallOwnerHallManagement';import{createHall}from'./src/services/hall-registration';
      import{partitionHallImages}from'./src/lib/hall-image-validation';
      window.partition=partitionHallImages;window.directCreate=createHall;
      window.reads=[];const slice=File.prototype.slice;
      File.prototype.slice=function(...args){const blob=slice.apply(this,args);return window.delayReads&&this.name.startsWith('slow')?{arrayBuffer:()=>new Promise(resolve=>window.reads.push(()=>blob.arrayBuffer().then(resolve)))}:blob};
      window.login=id=>{const token='test.'+btoa(JSON.stringify({sub:id,role:'HallOwner',exp:Date.now()/1000+3600}))+'.test';setAccessToken(token);setStoredAuth({token,user:{id,role:'HallOwner'}})};
      window.logout=clearAuthSession;window.login('A');window.calls=[];window.created=[];window.revoked=[];window.premature=[];window.fail=false;window.block=false;
      const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
      URL.createObjectURL=file=>{const url=create(file);window.created.push({url,name:file.name});return url};
      URL.revokeObjectURL=url=>{if([...document.querySelectorAll('img')].some(img=>img.getAttribute('src')===url))window.premature.push(url);window.revoked.push(url);revoke(url)};
      window.details={hallId:${JSON.stringify(hallId)},hallName:'Original Hall',status:'Approved',isEditable:true,paymentStatus:'Paid',region:'Gaza',address:'الرمال',contactPhone:'0599123456',capacity:100,price:100,showPrice:true,description:'Original description',features:[],photos:[{id:'persisted',url:'https://images.example.test/existing.jpg',displayOrder:0}],mainImageUrl:'https://images.example.test/existing.jpg'};
      window.write=(method,path,data)=>new Promise((resolve,reject)=>{const photos=data instanceof FormData?data.getAll('photos'):[],cover=data instanceof FormData?data.get('mainPhoto'):null;
        const call={method,path,names:photos.map(file=>file.name),cover:cover?.name,resolve,reject};window.calls.push(call);
        const finish=()=>{if(window.fail){window.fail=false;reject(new ApiError('Validation failed',400,{Photos:['Backend photo rejection']}));return}
          if(method==='PUT')window.details={...window.details,photos:[...window.details.photos,...photos.map((file,i)=>({id:'added-'+i,url:'https://images.example.test/'+file.name,displayOrder:i+1}))]};
          resolve({data:method==='POST'?{hallId:${JSON.stringify(hallId)}}:window.details,status:method==='POST'?201:200})};
        window.finish=finish;if(!window.block)queueMicrotask(finish)});
      function Editor({id}){const value=useHallOwnerHallManagement(id);window.form={...value,addPhotos:value.addNewPhotos,removePhoto:value.removeNewPhoto};
        if(!value.values)return <p>Loading</p>;return <EditForm values={value.values} fieldErrors={value.fieldErrors} formError={value.formError} editability={value.details.editability}
          isSubmitting={value.isSubmitting} isSuccess={value.isSuccess} controlsDisabled={value.controlsDisabled} onPatch={value.patchValues} onRemoveExistingPhoto={value.removeExistingPhoto}
          onSetCover={value.setCoverPhoto} onAddNewPhotos={value.addNewPhotos} onRemoveNewPhoto={value.removeNewPhoto} onSubmit={()=>void value.submit()}/>}
      function Harness(){const[shown,setShown]=useState(true),[id,setId]=useState(${JSON.stringify(hallId)});window.choose=id=>{window.details={...window.details,hallId:id};setId(id)};
        return <main dir={window.lang==='ar'?'rtl':'ltr'} data-testid="workspace"><button onClick={()=>setShown(false)}>Unmount</button><button onClick={()=>setShown(true)}>Remount</button>{shown&&(window.mode==='edit'?<Editor id={id}/>:<Registration/>)}</main>}
      createRoot(document.getElementById('root')).render(<StrictMode><Harness/></StrictMode>);`, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env": "{}", "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"', "process.env.NEXT_PUBLIC_DEMO_MODE": '"false"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "hall-image-io", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "mock" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  }); bundle = result.outputFiles[0].text;
});
type Form = { values: { photos: File[]; mainPhoto: File | null }; patchValues(value: unknown): void; removePhoto(index: number): void; removeExistingPhoto(id: string): void; submit(): Promise<boolean> };
type HarnessWindow = Window & { form: Form; calls: Array<{ method: string; names: string[]; cover?: string }>; created: Array<{ url: string; name: string }>; revoked: string[]; premature: string[];
  fail: boolean; block: boolean; finish(): void; login(id: string): void; logout(): void; choose(id: string): void; partition(files: File[]): Promise<{ accepted: File[]; rejected: unknown[] }>;
  directCreate(data: FormData): Promise<unknown>; delayReads: boolean; reads: Array<() => Promise<void>>; attempt: Promise<string> };
type FilePayload = { name: string; mimeType: string; buffer: Buffer };
const file = (name = "photo.png", mimeType = "image/png", buffer = png): FilePayload => ({ name, mimeType, buffer });
async function mount(page: Page, mode = "create", lang = "en") {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().isNavigationRequest() ? route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }) : route.abort());
  await page.goto("http://localhost:3000/hall-images-isolated");
  await page.evaluate(({ mode, lang }) => Object.assign(window, { mode, lang }), { mode, lang });
  await page.addStyleTag({ content: styles + "body{margin:0}" }); await page.addScriptTag({ content: bundle });
  await expect(page.locator("#hall-name")).toBeVisible();
  expect(errors).toEqual([]);
  if (mode === "create") {
    await page.evaluate(() => (window as HarnessWindow).form.patchValues({ hallName: "My Hall", ownerPhone: "0599123456", region: "Gaza", address: "الرمال", guestCapacity: "100", rentalPrice: "100", description: "Retained description" }));
    await expect(page.locator("#hall-name")).toHaveValue("My Hall");
  }
  return errors;
}
const gallery = (page: Page, mode: string) => page.locator(mode === "create" ? "input#hall-photos" : "#hall-mgmt-photos-add");
async function names(page: Page) { return page.evaluate(() => (window as HarnessWindow).form.values.photos.map(file => file.name)); }
async function choose(page: Page, mode: string, files: FilePayload[]) {
  if (files.some(file => !file.mimeType)) {
    // setInputFiles infers MIME from .png when its argument is empty. Construct a
    // genuine empty-MIME File so this case tests the intended browser value.
    await gallery(page, mode).evaluate((input: HTMLInputElement, files) => {
      const transfer = new DataTransfer();
      for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.mimeType }));
      input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true }));
    }, files.map(file => ({ name: file.name, mimeType: file.mimeType, bytes: [...file.buffer] })));
  } else await gallery(page, mode).setInputFiles(files);
}
async function submit(page: Page) { await page.evaluate(() => { void (window as HarnessWindow).form.submit(); }); }

for (const mode of ["create", "edit"]) for (const kind of ["jpeg", "png", "webp"]) test(`${mode}: valid ${kind} is previewed and uploaded`, async ({ page }) => {
  const errors = await mount(page, mode); const image = kind === "jpeg" ? file("photo.jpg", "image/jpeg", jpg) : kind === "webp" ? file("photo.webp", "image/webp", webp) : file();
  await choose(page, mode, [image]); await expect.poll(() => names(page)).toEqual([image.name]);
  await expect(page.getByRole("img", { name: image.name })).toBeVisible();
  await expect.poll(() => page.getByRole("img", { name: image.name }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await submit(page); await expect.poll(() => page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(1);
  expect(await page.evaluate(() => (window as HarnessWindow).calls[0].names)).toEqual([image.name]);
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).revoked.length)).toBe(1);
  expect(await page.evaluate(() => (window as HarnessWindow).premature)).toEqual([]); expect(errors).toEqual([]);
});
const invalid = [
  ["GIF", () => file("bad.gif", "image/gif", Buffer.from("GIF89a"))],
  ["SVG", () => file("bad.svg", "image/svg+xml", Buffer.from("<svg/>"))],
  ["PDF", () => file("bad.pdf", "application/pdf", Buffer.from("%PDF-1.4"))],
  ["empty", () => file("empty.png", "image/png", Buffer.alloc(0))],
  ["oversized", () => file("large.png", "image/png", Buffer.alloc(max + 1))],
  ["extension mismatch", () => file("mismatch.jpg", "image/png")],
  ["missing MIME", () => file("missing.png", "")],
  ["forged content", () => file("forged.png", "image/png", Buffer.from("not a PNG file"))],
] as const;
for (const mode of ["create", "edit"]) for (const [label, make] of invalid) test(`${mode}: rejects ${label} and identifies the file`, async ({ page }) => {
  await mount(page, mode); const rejected = make(); await choose(page, mode, [rejected]);
  await expect(page.getByRole("alert").first()).toContainText(rejected.name); expect(await names(page)).toEqual([]);
  expect(await page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(0);
  await expect(page.locator("#hall-name")).toHaveValue(mode === "create" ? "My Hall" : "Original Hall");
});
for (const mode of ["create", "edit"]) test(`${mode}: exactly 5 MiB is accepted`, async ({ page }) => {
  await mount(page, mode); const buffer = Buffer.alloc(max); png.copy(buffer);
  await choose(page, mode, [file("boundary.png", "image/png", buffer)]); await expect.poll(() => names(page)).toEqual(["boundary.png"]);
  await submit(page); await expect.poll(() => page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(1);
});
for (const mode of ["create", "edit"]) test(`${mode}: mixed selection preserves valid images and unrelated values`, async ({ page }) => {
  await mount(page, mode); await choose(page, mode, [file("first.png")]); await expect.poll(() => names(page)).toEqual(["first.png"]);
  await choose(page, mode, [file("bad.gif", "image/gif"), file("second.png"), file("bad-content.png", "image/png", Buffer.from("wrong header"))]);
  await expect.poll(() => names(page)).toEqual(["first.png", "second.png"]); await expect(page.getByRole("alert").first()).toContainText("bad.gif");
  await submit(page); await expect.poll(() => page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(1);
  expect(await page.evaluate(() => (window as HarnessWindow).calls[0].names)).toEqual(["first.png", "second.png"]);
});
test("creation rejects an eleventh gallery image but allows ten plus a cover", async ({ page }) => {
  await mount(page); await choose(page, "create", Array.from({ length: 11 }, (_, index) => file(`gallery-${index}.png`)));
  await expect.poll(async () => (await names(page)).length).toBe(11); await submit(page);
  await expect(page.getByRole("alert").first()).toContainText("10"); expect(await page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(0);
  await page.evaluate(() => (window as HarnessWindow).form.removePhoto(10));
  await page.locator("#hall-main-photo").setInputFiles(file("cover.png"));
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).form.values.mainPhoto?.name)).toBe("cover.png");
  await submit(page); await expect.poll(() => page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(1);
  expect(await page.evaluate(() => (window as HarnessWindow).calls[0].cover)).toBe("cover.png");
});
test("editing does not invent the create-only ten-image maximum", async ({ page }) => {
  await mount(page, "edit"); await choose(page, "edit", Array.from({ length: 11 }, (_, index) => file(`extra-${index}.png`)));
  await expect.poll(async () => (await names(page)).length).toBe(11); await submit(page);
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(1);
});
for (const mode of ["create", "edit"]) test(`${mode}: invalid cover replacement preserves the previous valid cover`, async ({ page }) => {
  await mount(page, mode); await page.locator("#hall-main-photo").setInputFiles(file("cover.png"));
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).form.values.mainPhoto?.name)).toBe("cover.png");
  await page.locator("#hall-main-photo").setInputFiles(file("invalid.jpg", "image/png"));
  await expect(page.locator("#hall-main-photo-error")).toContainText("invalid.jpg");
  expect(await page.evaluate(() => (window as HarnessWindow).form.values.mainPhoto?.name)).toBe("cover.png");
});
for (const mode of ["create", "edit"]) test(`${mode}: preview URLs survive rerenders and are released only after removal and unmount`, async ({ page }) => {
  const errors = await mount(page, mode); await choose(page, mode, [file("first.png"), file("second.png")]);
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).created.length)).toBe(2);
  await page.locator("#hall-name").fill("Changed name"); expect(await page.evaluate(() => (window as HarnessWindow).created.length)).toBe(2);
  await page.evaluate(() => (window as HarnessWindow).form.removePhoto(0));
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).revoked.length)).toBe(1);
  await expect(page.getByRole("img", { name: "second.png" })).toBeVisible();
  await page.getByRole("button", { name: "Unmount", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).revoked.length)).toBe(2);
  expect(await page.evaluate(() => (window as HarnessWindow).premature)).toEqual([]); expect(errors).toEqual([]);
});
for (const mode of ["create", "edit"]) test(`${mode}: backend rejection preserves the draft and permits retry without duplicate submissions`, async ({ page }) => {
  await mount(page, mode); await choose(page, mode, [file()]); await expect.poll(() => names(page)).toEqual(["photo.png"]);
  await page.evaluate(() => { const w = window as HarnessWindow; w.fail = true; w.block = true; void w.form.submit(); void w.form.submit(); });
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(1);
  await page.evaluate(() => { (window as HarnessWindow).finish(); }); await expect(page.getByRole("alert").first()).toContainText("Backend photo rejection");
  expect(await page.evaluate(() => (window as HarnessWindow).revoked)).toEqual([]);
  expect(await names(page)).toEqual(["photo.png"]); await expect(page.locator("#hall-name")).toHaveValue(mode === "create" ? "My Hall" : "Original Hall");
  await page.evaluate(() => { (window as HarnessWindow).block = false; }); await submit(page);
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(2);
});
test("the service boundary rejects forged images even if the picker is bypassed", async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(async () => { const w = window as HarnessWindow, data = new FormData(); data.append("photos", new File(["bad bytes"], "forged.png", { type: "image/png" }));
    try { await w.directCreate(data); return "unexpected"; } catch { return "rejected"; } });
  expect(result).toBe("rejected"); expect(await page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(0);
});
test("editing also rejects forged bytes if generic form patching bypasses selection", async ({ page }) => {
  await mount(page, "edit");
  await page.evaluate(() => (window as HarnessWindow).form.patchValues({ photos: [new File(["forged data"], "forged.png", { type: "image/png" })] }));
  await submit(page); await expect(page.getByRole("alert").first()).toContainText("forged.png");
  expect(await page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(0);
});
for (const mode of ["create", "edit"]) test(`${mode}: submission waits for image checking instead of sending an incomplete selection`, async ({ page }) => {
  await mount(page, mode); await page.evaluate(() => { (window as HarnessWindow).delayReads = true; });
  await choose(page, mode, [file("slow.png")]); await expect.poll(() => page.evaluate(() => (window as HarnessWindow).reads.length)).toBe(1);
  await submit(page); expect(await page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(0);
  await page.evaluate(() => { const w = window as HarnessWindow; w.delayReads = false; return w.reads.shift()!(); });
  await expect.poll(() => names(page)).toEqual(["slow.png"]); await submit(page);
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(1);
});
test("a delayed selection cannot append into another hall", async ({ page }) => {
  await mount(page, "edit"); await page.evaluate(() => { (window as HarnessWindow).delayReads = true; });
  await choose(page, "edit", [file("slow.png")]); await expect.poll(() => page.evaluate(() => (window as HarnessWindow).reads.length)).toBe(1);
  await page.evaluate(() => (window as HarnessWindow).choose("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
  await page.evaluate(() => (window as HarnessWindow).reads.shift()!());
  await expect(page.locator("#hall-name")).toBeVisible(); expect(await names(page)).toEqual([]);
  expect(await page.evaluate(() => (window as HarnessWindow).created)).toEqual([]);
});
test("account switching invalidates pending file reads and resets the prior owner's draft", async ({ page }) => {
  await mount(page); await page.evaluate(() => { (window as HarnessWindow).delayReads = true; });
  await choose(page, "create", [file("slow.png")]); await expect.poll(() => page.evaluate(() => (window as HarnessWindow).reads.length)).toBe(1);
  await page.evaluate(() => (window as HarnessWindow).login("B"));
  await page.evaluate(() => (window as HarnessWindow).reads.shift()!());
  await expect(page.locator("#hall-name")).toHaveValue(""); expect(await names(page)).toEqual([]);
});
test("a cover removed while it is being checked cannot reappear", async ({ page }) => {
  await mount(page); await page.evaluate(() => { (window as HarnessWindow).delayReads = true; });
  await page.locator("#hall-main-photo").setInputFiles(file("slow-cover.png"));
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).reads.length)).toBe(1);
  await page.evaluate(() => { const w = window as HarnessWindow; w.form.patchValues({ mainPhoto: null }); return w.reads.shift()!(); });
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).form.values.mainPhoto)).toBeNull();
  expect(await page.evaluate(() => (window as HarnessWindow).created)).toEqual([]);
});
test("an account change during the service's content check cannot upload with the new credentials", async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { const w = window as HarnessWindow; w.delayReads = true; const data = new FormData();
    data.append("photos", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "slow.png", { type: "image/png" }));
    w.attempt = w.directCreate(data).then(() => "uploaded", () => "rejected"); });
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).reads.length)).toBe(1);
  await page.evaluate(() => { const w = window as HarnessWindow; w.login("B"); return w.reads.shift()!(); });
  expect(await page.evaluate(() => (window as HarnessWindow).attempt)).toBe("rejected");
  expect(await page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(0);
});
test("replacing a rejected file with valid bytes under the same name clears the error", async ({ page }) => {
  await mount(page); await choose(page, "create", [file("same.png", "image/png", Buffer.from("bad bytes"))]);
  await expect(page.getByRole("alert").first()).toContainText("same.png"); await choose(page, "create", [file("same.png")]);
  await expect.poll(() => names(page)).toEqual(["same.png"]); await expect(page.getByRole("alert")).toHaveCount(0);
});
for (const mode of ["create", "edit"]) test(`${mode}: replacing and removing a valid cover releases only obsolete previews`, async ({ page }) => {
  await mount(page, mode); await page.locator("#hall-main-photo").setInputFiles(file("cover-a.png"));
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).created.length)).toBe(1);
  await page.locator("#hall-main-photo").setInputFiles(file("cover-b.png"));
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).revoked.length)).toBe(1);
  await expect(page.getByRole("img", { name: "cover-b.png" })).toBeVisible();
  await page.evaluate(() => (window as HarnessWindow).form.patchValues({ mainPhoto: null }));
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).revoked.length)).toBe(2);
  expect(await page.evaluate(() => (window as HarnessWindow).premature)).toEqual([]);
  expect(await page.evaluate(() => (window as HarnessWindow).revoked.every(url => url.startsWith("blob:")))).toBe(true);
});
test("repeated opening and closing cannot accumulate local preview URLs", async ({ page }) => {
  await mount(page);
  for (let round = 1; round <= 3; round += 1) {
    await choose(page, "create", [file(`round-${round}.png`)]);
    await expect.poll(() => page.evaluate(() => (window as HarnessWindow).created.length)).toBe(round);
    await page.getByRole("button", { name: "Unmount", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as HarnessWindow).revoked.length)).toBe(round);
    await page.getByRole("button", { name: "Remount", exact: true }).click();
    await expect(page.locator("#hall-name")).toBeVisible();
  }
  expect(await page.evaluate(() => (window as HarnessWindow).premature)).toEqual([]);
});
test("editing preserves the backend's minimum gallery rule independently of the cover", async ({ page }) => {
  await mount(page, "edit"); await page.evaluate(() => (window as HarnessWindow).form.removeExistingPhoto("persisted"));
  await page.locator("#hall-main-photo").setInputFiles(file("only-cover.png"));
  await expect.poll(() => page.evaluate(() => (window as HarnessWindow).form.values.mainPhoto?.name)).toBe("only-cover.png");
  await submit(page); await expect(page.getByRole("alert").first()).toContainText("photo");
  expect(await page.evaluate(() => (window as HarnessWindow).calls.length)).toBe(0);
});
for (const lang of ["ar", "en"]) for (const width of [390, 768, 1366]) test(`${lang}: localized file feedback and responsive layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page, "create", lang);
  await choose(page, "create", [file("bad.gif", "image/gif")]);
  await expect(page.getByRole("alert").first()).toContainText("bad.gif");
  await expect(page.getByRole("alert").first()).toContainText(lang === "ar" ? "اختَر صورة" : "Choose a JPEG");
  await expect(page.getByTestId("workspace")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(gallery(page, "create")).toHaveAttribute("accept", /image\/jpeg,image\/png,image\/webp/);
});
