import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { buildOfferLifecycleHarness } from "./helpers/offer-lifecycle-harness";
import en from "../src/i18n/messages/en";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWM4WF0PRwzEcQDUUhuxFgs8twAAAABJRU5ErkJggg==", "base64");
const image = (name = "photo.png") => ({ name, mimeType: "image/png", buffer: png });
const existing = { id: "existing", ownerUserId: "pro-a", content: "Existing offer", oldPrice: 200, offerPrice: 100,
  startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z", stoppedAt: null,
  images: [{ id: "server-a", url: "/uploads/server-a.png", order: 0 }, { id: "server-b", url: "/uploads/server-b.png", order: 1 }] };
type Audit = { created: string[]; revoked: string[]; inUse: string[] };
let bundle: string;
test.beforeAll(async () => { bundle = await buildOfferLifecycleHarness({ owner: true }); });

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const audit = { created: [] as string[], revoked: [] as string[], inUse: [] as string[] };
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = create(blob); audit.created.push(url); return url; };
    URL.revokeObjectURL = (url) => {
      if ([...document.querySelectorAll("img")].some((img) => img.getAttribute("src") === url)) audit.inUse.push(url);
      audit.revoked.push(url); revoke(url);
    };
    Object.assign(window, { previewAudit: audit });
  });
}

async function mount(page: Page, mode: "main" | "inline", editing = false) {
  await instrument(page);
  const writes: Array<{ path: string; body: string; method: string }> = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/uploads/*.png", (route) => route.fulfill({ contentType: "image/png", body: png }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname.slice(7);
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (["POST", "PUT"].includes(request.method())) {
      writes.push({ path, method: request.method(), body: request.postDataBuffer()?.toString("utf8") ?? "" });
      return json({ id: "saved" }, 201);
    }
    if (path === "/profile/pro-a") return json({ userId: "pro-a", role: "Photographer", displayName: "Owner", isPubliclyAvailable: true, posts: [], offers: [] });
    if (path === "/offers/existing") return json(existing);
    if (path === "/offers/mine") return json({ items: editing ? [existing] : [], totalCount: editing ? 1 : 0, totalPages: editing ? 1 : 0 });
    return json({ items: [], totalCount: 0, totalPages: 0 });
  });
  await page.route("**/preview-cleanup/**", (route) => route.fulfill({ contentType: "text/html", body: '<html lang="en"><body><div id="root"></div></body></html>' }));
  await page.goto(`http://localhost:3000/preview-cleanup/${mode === "main" ? "manager" : "profile"}`);
  await page.addScriptTag({ content: bundle });
  const open = async () => {
    if (mode === "inline") await page.getByTestId("professional-offer-create-open").click();
    else if (editing) await page.getByTestId("pro-offer-row-existing").getByRole("button", { name: en["offers.actions.edit"], exact: true }).click();
    else await page.getByTestId("pro-offers-add").click();
    await expect(page.getByTestId("professional-offer-form")).toBeVisible();
  };
  const close = async () => {
    await page.getByTestId("professional-offer-form").getByRole("button", { name: en[mode === "main" ? "offers.form.cancel" : "professionals.offers.cancel"], exact: true }).click();
    await expect(page.getByTestId("professional-offer-form")).toHaveCount(0);
  };
  await open();
  return { open, close, writes, errors };
}
async function audit(page: Page): Promise<Audit> {
  return page.evaluate(() => (window as unknown as { previewAudit: Audit }).previewAudit);
}
async function assertReleased(page: Page) {
  await expect.poll(async () => { const a = await audit(page); return a.created.filter((url) => !a.revoked.includes(url)); }).toEqual([]);
  const a = await audit(page);
  expect(a.inUse).toEqual([]);
  expect(new Set(a.revoked).size).toBe(a.revoked.length);
}

for (const mode of ["main", "inline"] as const) {
  test(`${mode}: closing releases all selected preview URLs`, async ({ page }) => {
    const form = await mount(page, mode);
    await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles([image("a.png"), image("b.png")]);
    await expect.poll(async () => (await audit(page)).created.length).toBe(2);
    await expect.poll(() => page.locator('img[src^="blob:"]').evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await form.close(); await assertReleased(page);
    expect(form.errors).toEqual([]);
  });

  test(`${mode}: adding and removing images retains live URLs and releases only obsolete ones`, async ({ page }) => {
    await mount(page, mode);
    await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image("a.png"));
    const first = (await audit(page)).created[0];
    await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image("b.png"));
    let a = await audit(page);
    expect(a.created).toHaveLength(2); expect(a.revoked).toEqual([]);
    const remove = page.getByTestId("professional-offer-form").getByRole("button", { name: en[mode === "main" ? "offers.form.removeImage" : "professionals.posts.removeImage"], exact: true });
    await remove.first().click();
    a = await audit(page);
    expect(a.revoked).toEqual([first]); expect(a.created).toHaveLength(2); expect(a.inUse).toEqual([]);
    await expect(page.locator(`img[src="${a.created[1]}"]`).first()).toBeVisible();
    await page.locator("#unmount").click(); await assertReleased(page);
  });

  test(`${mode}: repeated opening, selection, cancellation, and unmount never accumulate URLs`, async ({ page }) => {
    const form = await mount(page, mode);
    for (let index = 0; index < 8; index++) {
      if (index) await form.open();
      await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image(`${index}.png`));
      await form.close(); await assertReleased(page);
    }
    await form.open();
    await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image("last.png"));
    await page.locator("#unmount").click(); await assertReleased(page);
    expect((await audit(page)).created).toHaveLength(9);
  });
}

test("editing keeps server images and image IDs unchanged while cleaning only temporary previews", async ({ page }) => {
  const form = await mount(page, "main", true);
  await expect(page.locator('img[src$="server-a.png"]').first()).toBeVisible();
  await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles([image("new-a.png"), image("new-b.png")]);
  await page.getByRole("button", { name: en["offers.form.removeImage"], exact: true }).nth(1).click();
  await expect(page.locator('img[src$="server-a.png"]').first()).toBeVisible();
  await expect(page.locator('img[src$="server-b.png"]')).toHaveCount(0);
  await page.getByRole("button", { name: en["offers.form.save"], exact: true }).click();
  await expect.poll(() => form.writes.length).toBe(1);
  expect(form.writes[0].path).toBe("/offers/existing");
  expect(form.writes[0].method).toBe("PUT");
  expect(form.writes[0].body).toContain("server-a");
  expect(form.writes[0].body).not.toContain("server-b");
  expect(form.writes[0].body.indexOf("new-a.png")).toBeLessThan(form.writes[0].body.indexOf("new-b.png"));
  await expect(page.getByTestId("professional-offer-form")).toHaveCount(0);
  await assertReleased(page);
  expect((await audit(page)).revoked.every((url) => url.startsWith("blob:"))).toBe(true);
});

test("rapid selection, removal, reselection, and form switching leave no obsolete URLs", async ({ page }) => {
  await mount(page, "main");
  for (let index = 0; index < 5; index++) {
    await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image(`rapid-${index}.png`));
    await page.getByRole("button", { name: en["offers.form.removeImage"], exact: true }).first().click();
  }
  await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image("retained.png"));
  await page.locator("#unmount").click();
  await assertReleased(page);
});

test("switching between edit and create releases old previews and restores server image references", async ({ page }) => {
  const form = await mount(page, "main", true);
  await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image("edit.png"));
  await form.close(); await assertReleased(page);
  await page.getByTestId("pro-offers-add").click();
  await expect(page.locator('.offer-editor-image-list img')).toHaveCount(0);
  await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image("create.png"));
  await form.close(); await assertReleased(page);
  await form.open();
  await expect(page.locator('.offer-editor-image-list img')).toHaveCount(2);
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
  await expect(page.locator('.offer-editor-image-list img').first()).toHaveAttribute("src", /server-a\.png$/);
  await form.close(); await assertReleased(page);
});

test("validation and save failures retain active previews until the user closes the form", async ({ page }) => {
  const form = await mount(page, "main", true);
  await page.getByTestId("professional-offer-form").locator('input[type="file"]').setInputFiles(image());
  await page.getByTestId("offer-field-oldPrice").fill("0");
  await page.getByRole("button", { name: en["offers.form.save"], exact: true }).click();
  await expect(page.getByTestId("offer-field-oldPrice")).toHaveAttribute("aria-invalid", "true");
  expect((await audit(page)).revoked).toEqual([]);
  expect(form.writes).toEqual([]);
  await page.getByTestId("offer-field-oldPrice").fill("200");
  await page.route("**/api/v1/offers/existing", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"title":"Save failed"}' }));
  await page.getByRole("button", { name: en["offers.form.save"], exact: true }).click();
  await expect(page.getByTestId("professional-offer-form").getByRole("alert")).toBeVisible();
  expect((await audit(page)).revoked).toEqual([]);
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
  await form.close(); await assertReleased(page);
});

test("preview ownership handles full replacement, reset, reorder, repeated selections and batched updates", async ({ page }) => {
  await instrument(page);
  const script = await build({
    stdin: { contents: `import React,{StrictMode,useState,startTransition} from 'react';import {createRoot} from 'react-dom/client';
      import {useImagePreviewUrls} from './src/hooks/useImagePreviewUrls';
      const bytes=Uint8Array.from(atob('${png.toString("base64")}'),c=>c.charCodeAt(0));
      const a=new File([bytes],'a.png',{type:'image/png'}),b=new File([bytes],'b.png',{type:'image/png'});
      function Probe(){const {previewUrls,replacePreviews}=useImagePreviewUrls();return <>
        <button id="select" onClick={()=>replacePreviews([a,b])}>Select</button>
        <button id="reorder" onClick={()=>replacePreviews([b,a])}>Reorder</button>
        <button id="replace" onClick={()=>replacePreviews([b])}>Replace</button>
        <button id="reset" onClick={()=>replacePreviews([])}>Reset</button>
        <button id="batch" onClick={()=>{replacePreviews([a]);replacePreviews([b])}}>Batch</button>
        <button id="transition" onClick={()=>{replacePreviews([a]);startTransition(()=>replacePreviews([b]))}}>Transition</button>
        {previewUrls.map(url=><img key={url} src={url}/>)}</>}
      function Harness(){const [shown,setShown]=useState(true);return <><button id="close" onClick={()=>setShown(false)}>Close</button>{shown&&<Probe/>}</>}
      createRoot(document.getElementById('root')).render(<StrictMode><Harness/></StrictMode>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", jsx: "automatic", tsconfig: path.resolve("tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"' },
  });
  await page.route("**/preview-probe", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("http://localhost:3000/preview-probe");
  await page.addScriptTag({ content: script.outputFiles[0].text });
  expect((await audit(page)).created).toEqual([]);
  await page.locator("#select").click();
  const selected = (await audit(page)).created;
  await page.locator("#select").click();
  expect((await audit(page)).created).toEqual(selected);
  await page.locator("#reorder").click();
  await expect(page.locator("img").first()).toHaveAttribute("src", selected[1]);
  expect((await audit(page)).revoked).toEqual([]);
  await page.locator("#replace").click();
  expect((await audit(page)).revoked).toEqual([selected[0]]);
  await page.locator("#reset").click(); await assertReleased(page);
  await page.locator("#batch").click();
  const batched = await audit(page);
  expect(batched.created).toHaveLength(4);
  expect(batched.revoked).toContain(batched.created[2]);
  await expect(page.locator("img")).toHaveAttribute("src", batched.created[3]);
  await page.locator("#reset").click(); await assertReleased(page);
  await page.locator("#transition").click();
  const transitioned = await audit(page);
  await expect(page.locator("img")).toHaveAttribute("src", transitioned.created.at(-1)!);
  await expect.poll(() => page.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(transitioned.revoked).not.toContain(transitioned.created.at(-1));
  await page.locator("#close").click(); await assertReleased(page);
});
