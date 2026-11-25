import { expect, test } from "@playwright/test";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";
import { image, mount, selectAndFail } from "./helpers/chat-attachment-fixture";

for (const caption of ["", "Original caption"]) test(`retry resends the original image ${caption ? "with caption" : "without caption"}`, async ({ page }) => {
  const { calls, errors } = await mount(page); await selectAndFail(page, caption);
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect.poll(() => calls.filter((call) => call.kind === "file").length, { timeout: 5000 }).toBe(2);
  expect(calls[1]).toMatchObject({ kind: "file", name: "photo.png", mime: "image/png", bytes: image.toString("base64"), caption,
    clientRequestId: calls[0].clientRequestId, token: "Bearer chat-A" });
  await expect(page.getByTestId("thread-message")).toHaveCount(1);
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(errors).toEqual([]);
});

test("a failed non-image attachment retries the same bytes, MIME type and filename", async ({ page }) => {
  const { calls, errors } = await mount(page);
  const pdf = Buffer.from("%PDF-1.4\nOriginal invoice\n%%EOF");
  await selectAndFail(page, "Invoice", { name: "invoice.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(calls[1]).toMatchObject({ kind: "file", name: "invoice.pdf", mime: "application/pdf", bytes: pdf.toString("base64"), caption: "Invoice" });
  expect(errors).toEqual([]);
});

test("repeated retry failures retain the file, caption and idempotency key", async ({ page }) => {
  const { calls } = await mount(page, { failures: 3 }); await selectAndFail(page, "Keep this caption");
  for (let count = 2; count <= 4; count += 1) {
    await page.getByTestId("thread-send-failed").getByRole("button").click();
    await expect.poll(() => calls.length).toBe(count);
    await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", count < 4 ? "failed" : "sent");
  }
  expect(new Set(calls.map((call) => call.clientRequestId)).size).toBe(1);
  expect(calls.every((call) => call.kind === "file" && call.bytes === image.toString("base64") && call.caption === "Keep this caption")).toBe(true);
  await expect(page.getByTestId("thread-message")).toHaveCount(1);
});

test("changing the composer selection does not change the failed message's file or caption", async ({ page }) => {
  const { calls } = await mount(page); await selectAndFail(page, "Original caption");
  await page.getByTestId("attachment-file").setInputFiles({ name: "different.png", mimeType: "image/png", buffer: Buffer.from("different content") });
  await page.getByTestId("attachment-caption").fill("A new draft");
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(calls[1]).toMatchObject({ name: "photo.png", caption: "Original caption", bytes: image.toString("base64") });
});

test("double retry and an old retry callback after success do not duplicate the upload", async ({ page }) => {
  const { calls, held } = await mount(page, { holdRetry: true }); await selectAndFail(page, "Only once");
  await page.evaluate("window.failedId=chat.thread.messages[0].clientRequestId;window.previousRetry=chat.retrySend;chat.retrySend(failedId);chat.retrySend(failedId)");
  await expect.poll(() => held.length).toBe(1); expect(calls).toHaveLength(2);
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "pending");
  await held[0].reply(); await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  await page.evaluate("previousRetry(failedId)"); expect(calls).toHaveLength(2);
});

test("two failed attachments with an empty caption keep independent targets and original files", async ({ page }) => {
  const { calls } = await mount(page, { failures: 2 }); await selectAndFail(page, "");
  const second = Buffer.concat([image, Buffer.from("second image")]);
  await page.getByTestId("attachment-file").setInputFiles({ name: "second.png", mimeType: "image/png", buffer: second });
  await page.locator("#send-file").click();
  await expect(page.getByTestId("thread-message")).toHaveCount(2);
  await expect(page.getByTestId("thread-message").last()).toHaveAttribute("data-delivery", "failed");
  await page.evaluate(`chat.retrySend(${JSON.stringify(calls[0].clientRequestId)})`);
  await expect.poll(() => calls.length).toBe(3);
  expect(calls[2]).toMatchObject({ name: "photo.png", bytes: image.toString("base64"), clientRequestId: calls[0].clientRequestId });
  await expect(page.getByTestId("thread-message")).toHaveCount(2);
  expect(await page.evaluate("chat.thread.messages.filter(m=>m.delivery==='failed').length")).toBe(1);
});

test("switching conversations blocks stale retry actions but preserves retry for the original conversation", async ({ page }) => {
  const { calls, state } = await mount(page); await selectAndFail(page, "Private A file");
  await page.evaluate("window.failedId=chat.thread.messages[0].clientRequestId;window.previousRetry=chat.retrySend");
  await page.locator("#thread-B").click(); await expect(state).toContainText('"status":"empty"');
  await page.evaluate("previousRetry(failedId);chat.retrySend(failedId)");
  expect(calls).toHaveLength(1); await expect(state).not.toContainText("Private A file");
  await page.locator("#thread-A").click(); await expect(page.getByTestId("thread-send-failed")).toBeVisible();
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(calls[1].path).toBe("/conversations/thread-A/messages/attachment");
});

test("a pending retry can finish in its parked conversation without changing the visible thread", async ({ page }) => {
  const { calls, held, state } = await mount(page, { holdRetry: true }); await selectAndFail(page, "A parked upload");
  await page.getByTestId("thread-send-failed").getByRole("button").click(); await expect.poll(() => held.length).toBe(1);
  await page.locator("#thread-B").click(); await expect(state).toContainText('"status":"empty"');
  await held[0].reply(); await expect(state).toContainText('"status":"empty"'); await expect(state).not.toContainText("A parked upload");
  await page.locator("#thread-A").click(); await expect(page.getByTestId("thread-message")).toHaveCount(1);
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  await page.locator("#refresh-thread").click(); await expect(page.getByTestId("thread-message")).toHaveCount(1);
  expect(calls).toHaveLength(2);
});

for (const transition of ["logout", "switch", "same ID login"] as const) test(`${transition} during retry invalidates its result and retry callback`, async ({ page }) => {
  const { calls, held, state, errors } = await mount(page, { holdRetry: true }); await selectAndFail(page, "Private upload A");
  await page.evaluate("window.failedId=chat.thread.messages[0].clientRequestId;window.previousRetry=chat.retrySend");
  await page.getByTestId("thread-send-failed").getByRole("button").click(); await expect.poll(() => held.length).toBe(1);
  await page.evaluate(`chatAuth.logout();${transition === "logout" ? "" : `chatAuth.login('${transition === "switch" ? "B" : "A"}')`}`);
  await expect(state).toContainText(transition === "logout" ? '"status":"idle"' : '"status":"empty"');
  await held[0].reply(); await page.evaluate("previousRetry(failedId);chat.retrySend(failedId)");
  await expect(state).not.toContainText("Private upload A"); expect(calls).toHaveLength(2); expect(errors).toEqual([]);
});

test("an account switch in the same turn cannot dispatch a queued retry using B credentials", async ({ page }) => {
  const { calls, state } = await mount(page); await selectAndFail(page, "A only");
  await page.evaluate("chat.retrySend(chat.thread.messages[0].clientRequestId);chatAuth.login('B')");
  await expect(state).toContainText('"ownerKey":"B"'); await expect(state).toContainText('"status":"empty"');
  expect(calls).toHaveLength(1); expect(calls.every((call) => call.token === "Bearer chat-A")).toBe(true);
});

test("unmount aborts a pending retry and a remount cannot reuse its old handler", async ({ page }) => {
  const { calls, held, state } = await mount(page, { holdRetry: true }); await selectAndFail(page, "Closing upload");
  await page.evaluate("window.failedId=chat.thread.messages[0].clientRequestId;window.previousRetry=chat.retrySend");
  await page.getByTestId("thread-send-failed").getByRole("button").click(); await expect.poll(() => held.length).toBe(1);
  await page.locator("#mount").click(); await held[0].reply(500); await page.locator("#mount").click();
  await expect(state).toContainText('"status":"empty"'); await page.evaluate("previousRetry(failedId)"); expect(calls).toHaveLength(2);
});

for (const lang of ["ar", "en"] as const) test(`${lang}: a missing original file explains recovery without sending caption-only text`, async ({ page }) => {
  const { calls } = await mount(page, { lang });
  await page.evaluate(`chat.applyIncoming({id:'local:lost',clientRequestId:'lost',senderUserId:'A',senderName:'A',content:'Retained caption',
    sentAt:'2030-01-01T00:00:00Z',delivery:'failed',hasAttachment:true,attachmentFileName:'lost.png'},'thread-A',true)`);
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-send-failed").getByRole("alert")).toHaveText((lang === "ar" ? ar : en)["messages.attachmentRetryUnavailable"]);
  expect(calls).toHaveLength(0); await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "failed");
});

test("text-only retry still uses the text endpoint and the same request ID", async ({ page }) => {
  const { calls } = await mount(page); await page.getByTestId("attachment-caption").fill("Text retry"); await page.locator("#send-text").click();
  await expect(page.getByTestId("thread-send-failed")).toBeVisible(); await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(calls.map((call) => call.kind)).toEqual(["text", "text"]); expect(calls[1].clientRequestId).toBe(calls[0].clientRequestId);
});

test("an ordinary successful attachment send and its server refresh stay reconciled", async ({ page }) => {
  const { calls } = await mount(page, { failures: 0 });
  await page.getByTestId("attachment-file").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: image });
  await page.locator("#send-file").click(); await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  await page.locator("#refresh-thread").click(); await expect(page.getByTestId("thread-message")).toHaveCount(1);
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent"); expect(calls).toHaveLength(1);
});

test("a realtime attachment echo before the retry acknowledgement reconciles to one sent message", async ({ page }) => {
  const { calls, held } = await mount(page, { holdRetry: true }); await selectAndFail(page, "");
  await page.getByTestId("thread-send-failed").getByRole("button").click(); await expect.poll(() => held.length).toBe(1);
  const serverId = "saved-" + calls[0].clientRequestId;
  await page.evaluate(`chat.applyIncoming({id:${JSON.stringify(serverId)},senderUserId:'A',senderName:'A',content:'',sentAt:'2030-01-01T10:00:00Z',
    delivery:'sent',hasAttachment:true,attachmentFileName:'photo.png',attachmentUrl:'/attachment.png'},'thread-A')`);
  await held[0].reply(); await expect(page.getByTestId("thread-message")).toHaveCount(1);
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  expect(await page.evaluate("chat.thread.messages[0].id")).toBe(serverId);
});

test("Arabic multiline captions survive retry through the existing multipart API", async ({ page }) => {
  const caption = "صورة الحجز\nتفاصيل إضافية";
  const { calls } = await mount(page, { lang: "ar" }); await selectAndFail(page, caption);
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
  // Browsers may serialize multiline FormData fields with CRLF on the wire.
  expect(calls[1].caption.replace(/\r\n/g, "\n")).toBe(calls[0].caption.replace(/\r\n/g, "\n"));
  expect(calls[1].caption.replace(/\r\n/g, "\n")).toBe(caption);
});

test("returning to A before its pending retry completes reconciles the active A view", async ({ page }) => {
  const { held } = await mount(page, { holdRetry: true }); await selectAndFail(page, "Return before acknowledgement");
  await page.getByTestId("thread-send-failed").getByRole("button").click(); await expect.poll(() => held.length).toBe(1);
  await page.locator("#thread-B").click(); await expect(page.getByTestId("thread-state")).toContainText('"status":"empty"');
  await page.locator("#thread-A").click(); await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "pending");
  await held[0].reply(); await expect(page.getByTestId("thread-message")).toHaveCount(1);
  await expect(page.getByTestId("thread-message")).toHaveAttribute("data-delivery", "sent");
});

test("a restored failed attachment without its request ID explains why it cannot be retried", async ({ page }) => {
  const { calls } = await mount(page);
  await page.evaluate(`chat.applyIncoming({id:'local:legacy',senderUserId:'A',senderName:'A',content:'Caption',
    sentAt:'2030-01-01T00:00:00Z',delivery:'failed',hasAttachment:true},'thread-A',true)`);
  await page.getByTestId("thread-send-failed").getByRole("button").click();
  await expect(page.getByTestId("thread-send-failed").getByRole("alert")).toHaveText(en["messages.attachmentRetryUnavailable"]);
  expect(calls).toHaveLength(0);
});
