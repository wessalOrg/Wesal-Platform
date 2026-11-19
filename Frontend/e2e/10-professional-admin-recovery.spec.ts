import { expect, test, type Page } from "@playwright/test";

const adminId = "61d33083-e81b-4ee9-8658-f548ce817d8f";

async function setup(page: Page, adminUnavailable = false) {
  let created = 0;
  await page.addInitScript(() => {
    const claims = btoa(JSON.stringify({
      sub: "test-photographer", role: "Photographer", exp: Date.now() / 1000 + 3600,
    }));
    const token = `test.${claims}.test`;
    sessionStorage.setItem("wesal-access-token", token);
    sessionStorage.setItem("wesal_auth", JSON.stringify({
      token, user: { id: "test-photographer", name: "Test Photographer", role: "Photographer" },
    }));
  });
  // Every API response is local to this browser context; no real account is used.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const json = (data: unknown, status = 200) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(data),
      headers: { "access-control-allow-origin": "*" },
    });
    if (url.pathname.startsWith("/hubs/")) return json({}, 404);
    if (!url.pathname.startsWith("/api/v1/")) {
      if (["localhost", "127.0.0.1"].includes(url.hostname)) return route.continue();
      return route.abort();
    }
    const path = url.pathname.slice("/api/v1".length);
    if (route.request().method() === "OPTIONS") return json({});
    if (path === "/session") return json({ isAuthenticated: true, role: "Photographer" });
    if (path === "/profile") return json({
      id: "test-photographer", fullName: "Test Photographer", isSetupComplete: true,
      approvalStatus: "Approved", concurrencyStamp: "test",
    });
    if (path === "/language") return json({ language: "ar" });
    if (path === "/notifications") return json([]);
    if (path.endsWith("/unread-count")) return json({ unreadCount: 0 });
    if (path === "/professional/conversations") return json({ title: "Customer inbox unavailable" }, 500);
    if (path === "/conversations/admin-account") {
      return adminUnavailable
        ? json({ title: "Admin lookup unavailable" }, 500)
        : json({ conversationId: adminId, createdAt: "2026-01-01T10:00:00Z" });
    }
    if (path === "/conversations/contact-admin-account") {
      created += 1;
      return json({ conversationId: adminId }, 201);
    }
    if (path === `/conversations/${adminId}/messages`) return json({
      conversationId: adminId, hallId: "", hallName: "", messages: [{
        id: "test-message", senderUserId: "test-admin", senderName: "Wesal Admin",
        content: "Admin recovery test message", sentAt: "2026-01-01T10:00:00Z",
      }],
    });
    return json({});
  });
  return { createdCount: () => created };
}

test("Admin conversation opens when the customer inbox fails", async ({ page }) => {
  await setup(page);
  await page.goto("/profile/messages?contact=admin");
  await expect(page.getByTestId("message-thread-body")).toContainText("Admin recovery test message");
  await expect(page.getByTestId("professional-chat-inbox").getByTestId("inbox-list-error")).toHaveCount(0);
});

test("Contact Admin opens independently even when both inbox reads fail", async ({ page }) => {
  const state = await setup(page, true);
  await page.goto("/profile/messages?contact=admin");
  await expect(page.getByTestId("message-thread-body")).toContainText("Admin recovery test message");
  expect(state.createdCount()).toBe(1);
});

test("A customer deep link does not add a second administration row", async ({ page }) => {
  await setup(page);
  const customerId = "82d33083-e81b-4ee9-8658-f548ce817d8f";
  await page.route("**/api/v1/professional/conversations?*", (route) => route.fulfill({
    contentType: "application/json", body: JSON.stringify([]),
  }));
  await page.route(`**/api/v1/conversations/${customerId}/messages`, (route) => route.fulfill({
    contentType: "application/json", body: JSON.stringify({
      conversationId: customerId, messages: [{
        id: "customer-message", senderUserId: "customer", senderName: "Customer",
        content: "Customer deep link message", sentAt: "2026-01-01T10:00:00Z",
      }],
    }),
  }));
  await page.goto(`/profile/messages?conversation_id=${customerId}`);
  await expect(page.getByTestId("message-thread-body")).toContainText("Customer deep link message");
  const inbox = page.getByTestId("professional-chat-inbox");
  await inbox.getByRole("tab", { name: /الإدارة/ }).click();
  await expect(inbox.getByTestId("inbox-conversation")).toHaveCount(1);
  await expect(inbox.locator(`[data-conversation-id="${adminId}"]`)).toHaveCount(1);
  await expect(inbox.locator(`[data-conversation-id="${customerId}"]`)).toHaveCount(0);
});

test("A legacy admin row is replaced by the canonical admin row without losing customers", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/professional/conversations?*", (route) => route.fulfill({
    contentType: "application/json", body: JSON.stringify([
      { conversationId: "legacy-admin", kind: "HallBooking", hallId: "",
        otherParticipantId: "admin", otherParticipantName: "Wesal Admin" },
      { conversationId: "customer-admin-name", kind: "CustomerProvider", hallId: "",
        otherParticipantId: "customer", otherParticipantName: "Admin" },
    ]),
  }));
  await page.goto("/profile/messages?contact=admin");
  await expect(page.getByTestId("message-thread-body")).toContainText("Admin recovery test message");
  const inbox = page.getByTestId("professional-chat-inbox");
  await expect(inbox.getByTestId("inbox-conversation")).toHaveCount(1);
  await expect(inbox.locator(`[data-conversation-id="${adminId}"]`)).toHaveCount(1);
  await page.getByRole("tab", { name: /العملاء/ }).click();
  await expect(inbox.locator('[data-conversation-id="customer-admin-name"]')).toHaveCount(1);
});
