/**
 * Edit 10 — chat UI stays up for empty/null payloads and attachment captions.
 * Run: npx tsx scripts/verify-messaging-stability.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyAdminMessageCategory } from "../src/lib/admin-message-category";
import {
  isChatImageUrl,
  isPaymentReceiptNotice,
  paymentReceiptNoticeCaption,
  safeMessageText,
} from "../src/lib/chat-image-message";
import { mapThreadMessageDto } from "../src/lib/conversation-mapper";
import { upsertThreadMessage } from "../src/lib/thread-messages";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function testNullContentDoesNotThrow() {
  assert.equal(safeMessageText(null), "");
  assert.equal(safeMessageText(undefined), "");
  assert.equal(isChatImageUrl(null), false);
  assert.equal(isPaymentReceiptNotice(undefined), false);
  assert.equal(paymentReceiptNoticeCaption(null), "");
  assert.equal(classifyAdminMessageCategory(undefined as unknown as string), "conversation");
  const merged = upsertThreadMessage([], {
    id: "m1",
    senderUserId: "u1",
    senderName: undefined as unknown as string,
    content: undefined as unknown as string,
    sentAt: "2026-01-01T00:00:00Z",
    delivery: "sent",
    hasAttachment: true,
  });
  assert.equal(merged[0]?.content, "");
  assert.equal(merged[0]?.senderName, "");
  assert.deepEqual(upsertThreadMessage([], undefined as unknown as (typeof merged)[0]), []);
  console.log("ok  null chat payloads do not throw");
}

function testAttachmentOnlyMessageMaps() {
  const mapped = mapThreadMessageDto({
    id: "8f14e45f-ea9c-4b1c-9d2a-6b7c8d9e0f11",
    content: null,
    hasAttachment: true,
    senderName: "Owner",
    sentAt: "2026-01-01T00:00:00Z",
  });
  assert.ok(mapped);
  assert.equal(mapped?.content, "");
  assert.equal(mapped?.hasAttachment, true);
  console.log("ok  attachment-only Profile/API message maps");
}

function testLiveAttachmentEndpoints() {
  const service = read("src/services/conversations.ts");
  assert.match(service, /\/messages\/attachment/);
  assert.match(service, /formData\.append\("file"/);
  assert.doesNotMatch(service, /\/payment-receipts/);
  const attachHook = read("src/hooks/useMessageAttachment.ts");
  assert.match(attachHook, /\/conversations\/\$\{encodeURIComponent\(conversationId\)\}\/messages/);
  console.log("ok  image send/read uses conversation attachment APIs");
}

function testCrashGuardsInUi() {
  const item = read("src/components/messages/ThreadMessageItem.tsx");
  const inbox = read("src/components/messages/MessagesInbox.tsx");
  const panel = read("src/components/messages/MessagesInboxPanel.tsx");
  const admin = read("src/components/admin/messages/AdminMessagesPage.tsx");
  assert.match(item, /safeMessageText/);
  assert.match(inbox, /MessagesErrorBoundary/);
  assert.match(panel, /MessagesErrorBoundary/);
  assert.match(admin, /MessagesErrorBoundary/);
  console.log("ok  thread + admin chat have crash boundaries");
}

testNullContentDoesNotThrow();
testAttachmentOnlyMessageMaps();
testLiveAttachmentEndpoints();
testCrashGuardsInUi();
console.log("messaging stability checks passed");
