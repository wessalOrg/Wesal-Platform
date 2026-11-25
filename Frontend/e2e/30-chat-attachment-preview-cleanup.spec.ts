import { expect, test, type Page } from "@playwright/test";
import { image, mount, selectAndFail } from "./helpers/chat-attachment-fixture";

const file = { name: "photo.png", mimeType: "image/png", buffer: image };
async function audit(page: Page) {
  return page.evaluate("JSON.parse(JSON.stringify(urlAudit))") as Promise<{ created: string[]; revoked: string[]; premature: string[] }>;
}
async function released(page: Page) {
  await expect.poll(async () => { const a = await audit(page); return a.created.filter(url => !a.revoked.includes(url)); }).toEqual([]);
  const a = await audit(page);
  expect(new Set(a.revoked).size).toBe(a.revoked.length);
  expect(a.premature).toEqual([]);
  expect(a.revoked.every(url => a.created.includes(url))).toBe(true);
}

test("failed outgoing preview is released after unmount", async ({ page }) => {
  await mount(page, { trackUrls: true }); await selectAndFail(page, "");
  await expect(page.getByTestId("chat-image-thumb").locator("img")).toBeVisible();
  expect((await audit(page)).created.length).toBeGreaterThan(0);
  await page.locator("#mount").click(); await released(page);
});

test("successful send releases local previews and keeps the downloaded image usable", async ({ page }) => {
  await mount(page, { trackUrls: true, failures: 0, composer: true });
  await page.getByTestId("draft-file").setInputFiles(file);
  const draftUrl = await page.getByTestId("draft-preview").getAttribute("src");
  await page.locator("#send-draft").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  await expect(page.getByTestId("draft-preview")).toHaveCount(0);
  await expect.poll(async () => (await audit(page)).revoked.includes(draftUrl!)).toBe(true);
  await expect.poll(async () => { const a = await audit(page); return a.created.filter(url => !a.revoked.includes(url)).length; }).toBe(1);
  await expect.poll(() => page.getByTestId("chat-image-thumb").locator("img").evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(1);
  await page.locator("#mount").click(); await released(page);
});

test("draft selection, replacement, removal and StrictMode own each URL exactly once", async ({ page }) => {
  await mount(page, { trackUrls: true, strict: true, composer: true });
  await page.getByTestId("draft-file").setInputFiles(file);
  await expect(page.getByTestId("draft-preview")).toBeVisible();
  const first = await page.getByTestId("draft-preview").getAttribute("src");
  await page.getByTestId("draft-file").setInputFiles({ ...file, name: "replacement.png" });
  await expect(page.getByTestId("draft-preview")).not.toHaveAttribute("src", first!);
  await expect.poll(async () => (await audit(page)).revoked.includes(first!)).toBe(true);
  await page.locator("#clear-draft").click(); await expect(page.getByTestId("draft-preview")).toHaveCount(0);
  await released(page);
});

test("failed image, caption and original bytes survive repeated retries without new preview URLs", async ({ page }) => {
  const { calls } = await mount(page, { trackUrls: true, failures: 3 }); await selectAndFail(page, "Keep caption");
  const original = await page.getByTestId("chat-image-thumb").locator("img").getAttribute("src");
  for (let n = 2; n <= 3; n++) {
    await page.getByTestId("thread-send-failed").getByRole("button").click();
    await expect.poll(() => calls.length).toBe(n);
    await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "failed");
    expect((await audit(page)).created).toEqual([original]);
    expect((await audit(page)).revoked).toEqual([]);
  }
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(calls.every(call => call.bytes === image.toString("base64") && call.caption === "Keep caption")).toBe(true);
  await page.locator("#mount").click(); await released(page);
});

test("conversation switching frees hidden previews and restores failed previews from the retained File", async ({ page }) => {
  const { calls } = await mount(page, { trackUrls: true }); await selectAndFail(page, "Return to A");
  await page.locator("#thread-B").click(); await released(page);
  await page.locator("#thread-A").click(); await expect(page.getByTestId("thread-send-failed")).toBeVisible();
  await expect.poll(() => page.getByTestId("chat-image-thumb").locator("img").evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(1);
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(calls[1].bytes).toBe(image.toString("base64"));
  await page.locator("#mount").click(); await released(page);
});

for (const transition of ["chatAuth.login('B')", "chatAuth.logout()"])
  test(`account transition releases draft and failed preview: ${transition}`, async ({ page }) => {
    await mount(page, { trackUrls: true, composer: true }); await selectAndFail(page, "Private file");
    await page.getByTestId("draft-file").setInputFiles(file);
    await expect(page.getByTestId("draft-preview")).toBeVisible();
    await page.evaluate(transition);
    await expect(page.getByTestId("thread-message")).toHaveCount(0);
    await expect(page.getByTestId("draft-preview")).toHaveCount(0);
    await released(page);
  });

test("non-image failures retain retry bytes and release preview URLs on closing", async ({ page }) => {
  const { calls } = await mount(page, { trackUrls: true });
  const bytes = Buffer.from("%PDF-1.4\nInvoice\n%%EOF");
  await selectAndFail(page, "Invoice", { name: "invoice.pdf", mimeType: "application/pdf", buffer: bytes });
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(calls[1].bytes).toBe(bytes.toString("base64"));
  await page.locator("#mount").click(); await released(page);
});

test("repeated opening and closing never accumulates URLs or revokes an active lightbox", async ({ page }) => {
  await mount(page, { trackUrls: true, failures: 99, strict: true });
  for (let n = 0; n < 3; n++) {
    await selectAndFail(page, "");
    await page.getByTestId("chat-image-thumb").click();
    await expect(page.getByTestId("chat-image-lightbox")).toBeVisible();
    expect((await audit(page)).revoked).not.toContain(await page.getByTestId("chat-image-thumb").locator("img").getAttribute("src"));
    await page.locator("#mount").evaluate((button: HTMLButtonElement) => button.click());
    await released(page);
    await page.locator("#mount").click();
    await expect(page.getByTestId("thread-state")).toContainText('"status":"empty"');
  }
});

test("remote URLs are borrowed and never revoked", async ({ page }) => {
  await mount(page, { trackUrls: true });
  await page.evaluate(`chat.applyIncoming({id:'remote',senderUserId:'A',senderName:'A',content:'',sentAt:'2030-01-01',delivery:'sent',hasAttachment:true,localPreviewUrl:'https://images.example/remote.png'},'thread-A',true)`);
  await page.locator("#mount").click(); await released(page);
});

test("a sent preview and its lightbox stay valid until the downloaded attachment replaces them", async ({ page }) => {
  const { downloads } = await mount(page, { trackUrls: true, failures: 0, holdDownload: true });
  await page.getByTestId("attachment-file").setInputFiles(file); await page.locator("#send-file").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  await expect.poll(() => downloads.length).toBe(1);
  const src = await page.getByTestId("chat-image-thumb").locator("img").getAttribute("src");
  await page.getByTestId("chat-image-thumb").click();
  await expect(page.getByTestId("chat-image-lightbox").locator("img")).toHaveAttribute("src", src!);
  expect((await audit(page)).revoked).not.toContain(src);
  await downloads[0]();
  await expect(page.getByTestId("chat-image-lightbox").locator("img")).not.toHaveAttribute("src", src!);
  await expect.poll(async () => (await audit(page)).revoked.includes(src!)).toBe(true);
  await page.locator("#mount").evaluate((button: HTMLButtonElement) => button.click()); await released(page);
});

test("a download completing after unmount cannot allocate an orphan URL", async ({ page }) => {
  const { downloads } = await mount(page, { trackUrls: true, failures: 0, holdDownload: true });
  await page.getByTestId("attachment-file").setInputFiles(file); await page.locator("#send-file").click();
  await expect.poll(() => downloads.length).toBe(1);
  await page.locator("#mount").click(); await released(page);
  const count = (await audit(page)).created.length;
  await downloads[0](); await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  expect((await audit(page)).created).toHaveLength(count); await released(page);
});

test("switching conversation during a pending retry releases previews without losing the original upload", async ({ page }) => {
  const { calls, held } = await mount(page, { trackUrls: true, holdRetry: true }); await selectAndFail(page, "Original file");
  await page.getByTestId("thread-send-failed").getByRole("button").click(); await expect.poll(() => held.length).toBe(1);
  await page.locator("#thread-B").click(); await released(page);
  await held[0].reply(500);
  await page.locator("#thread-A").click(); await expect(page.getByTestId("thread-send-failed")).toBeVisible();
  await expect.poll(() => page.getByTestId("chat-image-thumb").locator("img").evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(1);
  await page.getByTestId("thread-send-failed").getByRole("button").click(); await expect.poll(() => held.length).toBe(2);
  await held[1].reply(); await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(calls.every(call => call.bytes === image.toString("base64"))).toBe(true);
  await page.locator("#mount").click(); await released(page);
});

test("a pending send cannot clear a replacement draft preview", async ({ page }) => {
  const { held } = await mount(page, { trackUrls: true, composer: true, failures: 0, holdRetry: true });
  await page.getByTestId("draft-file").setInputFiles(file); await page.locator("#send-draft").click();
  await expect.poll(() => held.length).toBe(1);
  await page.getByTestId("draft-file").setInputFiles({ ...file, name: "new-draft.png" });
  const next = await page.getByTestId("draft-preview").getAttribute("src");
  await held[0].reply(); await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  await expect(page.getByTestId("draft-preview")).toHaveAttribute("src", next!);
  expect((await audit(page)).revoked).not.toContain(next);
  await page.locator("#mount").click(); await released(page);
});
