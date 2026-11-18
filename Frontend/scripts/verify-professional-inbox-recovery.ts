/** Run: npx tsx scripts/verify-professional-inbox-recovery.ts */
import assert from "node:assert/strict";
import api from "../src/lib/api";
import { ApiError } from "../src/lib/api-error";
import {
  fetchInboxConversations,
  fetchMyAdminAccountConversation,
} from "../src/services/conversations";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const adminId = "61d33083-e81b-4ee9-8658-f548ce817d8f";
const customerId = "c4a2ad4c-5a37-47ea-9fb0-ed88ca48673c";
const admin = { conversationId: adminId, createdAt: "2026-01-01T10:00:00Z" };
const customer = {
  conversationId: customerId,
  kind: "CustomerProvider",
  otherParticipantName: "Test Customer",
  createdAt: "2026-01-02T10:00:00Z",
};

async function main() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalGet = api.get;
  const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;
  const storage = memoryStorage();
  process.env.NEXT_PUBLIC_DEMO_MODE = "false";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage, sessionStorage: storage },
  });

  let customers: unknown = [customer];
  let adminResponse: unknown = admin;
  api.get = (async (url: string) => {
    if (url === "/professional/conversations") {
      if (customers instanceof Error) throw customers;
      return { data: { items: customers } };
    }
    if (url === "/conversations/admin-account") {
      if (adminResponse instanceof Error) throw adminResponse;
      return { data: adminResponse };
    }
    if (url === "/conversations/admin-account/unread-count") {
      return { data: { unreadCount: 2 } };
    }
    throw new Error(`Unexpected API request: ${url}`);
  }) as typeof api.get;

  try {
    for (const role of ["Photographer", "EventCoordinator"]) {
      storage.setItem("wesal-access-token", "test-session");
      storage.setItem("wesal_auth", JSON.stringify({
        token: "test-session", user: { id: "test-professional", role },
      }));

      customers = new ApiError("Customer inbox unavailable", 500);
      adminResponse = admin;
      const recovered = await fetchInboxConversations();
      assert.equal(recovered.length, 1);
      assert.equal(recovered[0].conversationId, adminId);
      assert.equal(recovered[0].kind, "AdminAccount");
      assert.equal(recovered[0].unreadMessageCount, 2);

      customers = [customer];
      adminResponse = new ApiError("Admin inbox unavailable", 500);
      assert.equal((await fetchInboxConversations())[0].conversationId, customerId);

      customers = new ApiError("Customer inbox unavailable", 500);
      adminResponse = new ApiError("Admin inbox unavailable", 500);
      await assert.rejects(fetchInboxConversations, customers);

      adminResponse = new ApiError("No Admin thread yet", 404);
      await assert.rejects(fetchInboxConversations, customers);
      assert.equal(await fetchMyAdminAccountConversation(), null);

      for (const status of [401, 403]) {
        adminResponse = new ApiError("Access denied", status);
        await assert.rejects(fetchMyAdminAccountConversation, adminResponse);
      }

      customers = [];
      adminResponse = new ApiError("No Admin thread yet", 404);
      assert.deepEqual(await fetchInboxConversations(), []);

      customers = [customer, { ...customer, conversationId: adminId }];
      adminResponse = admin;
      const merged = await fetchInboxConversations();
      assert.deepEqual(merged.map((row) => row.conversationId), [customerId, adminId]);
      console.log(`ok ${role}: partial recovery, total failure, access errors, empty inbox, ordering and deduplication`);
    }
  } finally {
    api.get = originalGet;
    if (originalDemoMode === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
