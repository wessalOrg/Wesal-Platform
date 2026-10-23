import { expect, test, type Page } from "@playwright/test";

// Browser/API contract tests: every API call is intercepted; no account or live API is used.
const hallId = "947f9b27-58d4-4ec6-9d51-522cb94cd428";
const bookingId = "936de2f4-f7eb-46c4-995c-9b201dfb13a6";
const legacy = JSON.stringify([{ id: "manual-legacy-test", hallId, customerName: "LEGACY ONLY", date: "2026-11-16", timeFrom: "10:00", timeTo: "12:00" }]);
type Row = { bookingId: string; hallId: string; date: string; source: string; status: string; slotStarts: string[]; revision: number; customerName: string; phone: string; eventType: string; notes: string; [key: string]: unknown };

async function setup(page: Page, options: { existing?: boolean; expired?: boolean; loseFirstResponse?: boolean } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const rows: Row[] = options.existing ? [{ bookingId, hallId, date, source: "ExternalManual", status: "Confirmed", slotStarts: ["14:00:00", "15:00:00"], revision: 1, customerName: "External Customer", phone: "0599123456", eventType: "wedding", notes: "", timeRange: "14:00 - 16:00", guests: null, totalAmount: null, amountReceivedExternally: null, confirmedAt: date + "T10:00:00Z", cancelledAt: null, canEdit: true, canCancel: true, canDelete: false, canConfirmDeposit: false }] : [];
  const keys: string[] = []; const revisions: string[] = []; let lost = false;
  await page.addInitScript(({ legacy }) => {
    const payload = btoa(JSON.stringify({ sub: "owner", role: "HallOwner", name: "Test Owner", exp: Math.floor(Date.now() / 1000) + 3600 }));
    const token = `test.${payload}.test`;
    localStorage.setItem("wesal-access-token", token);
    localStorage.setItem("wesal_auth", JSON.stringify({ token, user: { id: "owner", name: "Test Owner", role: "HallOwner" } }));
    localStorage.setItem("wesal_owner_manual_bookings_v1", legacy);
  }, { legacy });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/v1/") && url.origin === new URL(test.info().project.use.baseURL as string).origin) return route.continue();
    const path = url.pathname.replace(/^\/api\/v1/, ""); const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } });
    if (method === "OPTIONS") return json({});
    if (path === "/session") return json({ isAuthenticated: true, role: "HallOwner", userName: "Test Owner" });
    if (path === "/owner/halls") return json([{ hallId, name: "Contract Hall", status: "Approved", paymentStatus: "Paid", subscriptionCycleEnd: "2099-01-01", systemLocked: options.expired ?? false }]);
    if (path.endsWith("/external-bookings") && method === "POST") {
      keys.push(route.request().headers()["idempotency-key"]);
      const input = route.request().postDataJSON();
      if (!rows.length) rows.push({ ...input, bookingId, hallId, source: "ExternalManual", status: "Confirmed", revision: 1, timeRange: "14:00 - 18:00", confirmedAt: date + "T10:00:00Z", cancelledAt: null, canEdit: true, canCancel: true, canConfirmDeposit: false, canDelete: false });
      if (options.loseFirstResponse && !lost) { lost = true; return route.abort("failed"); }
      return json(rows[0], 201);
    }
    if (path.endsWith("/external-bookings") && method === "GET") return json({ items: rows, page: 1, pageSize: 100 });
    if (path.includes("/external-bookings/")) {
      if (method === "PUT") { revisions.push(route.request().headers()["if-match"]); Object.assign(rows[0], route.request().postDataJSON(), { revision: rows[0].revision + 1 }); }
      if (path.endsWith("/cancel")) { revisions.push(route.request().headers()["if-match"]); rows[0].status = "Cancelled"; rows[0].revision++; rows[0].canEdit = rows[0].canCancel = false; }
      return json(rows[0]);
    }
    if (path.endsWith("/bookings-calendar")) {
      if (options.expired) return json({ code: "HallSystemLocked", title: "Subscription expired" }, 422);
      const fromDate = url.searchParams.get("fromDate")!; const toDate = url.searchParams.get("toDate")!;
      const days = [];
      for (let day = new Date(fromDate + "T00:00:00Z"); day.toISOString().slice(0, 10) <= toDate; day.setUTCDate(day.getUTCDate() + 1)) {
        const iso = day.toISOString().slice(0, 10); const bookedHours = rows.filter((r) => r.status === "Confirmed" && r.date === iso).flatMap((r) => r.slotStarts);
        days.push({ date: iso, hasBookedHours: bookedHours.length > 0, bookedHours });
      }
      return json({ hallId, fromDate, toDate, days });
    }
    if (path.endsWith("/bookings")) {
      if (options.expired) return json({ code: "HallSystemLocked", title: "Subscription expired" }, 422);
      return json(rows.filter((r) => r.status === "Confirmed").map((r) => ({ ...r, bookingRequestId: r.bookingId, requestedDate: r.date, requesterName: r.customerName, requesterPhone: r.phone, externalEventType: r.eventType })));
    }
    return json({});
  });
  await page.goto(`/owner/calendar?hall=${hallId}`);
  await expect(page.getByTestId("owner-bookings-calendar-page")).toBeVisible();
  return { rows, keys, revisions, date };
}

test("external confirmed calendar cards use server IDs and preserve legacy storage", async ({ page }) => {
  const state = await setup(page, { existing: true });
  const day = page.getByTestId("owner-calendar-booked");
  await expect(day.getByTestId("owner-calendar-booking-card")).toHaveCount(1);
  await expect(day.getByTestId("owner-calendar-booking-card")).toHaveAttribute("data-booking-id", bookingId);
  await expect(day).toContainText("External Customer");
  await expect(page.getByText("LEGACY ONLY")).toHaveCount(0);
  await expect(page.getByTestId(`hall-cal-day-${state.date}`).getByTestId("owner-cal-booked-dot")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("wesal_owner_manual_bookings_v1"))).toBe(legacy);
});

test("lost create response retries the same key and shows success only after acknowledgement", async ({ page }) => {
  const state = await setup(page, { loseFirstResponse: true });
  await page.getByTestId("owner-calendar-add-booking").click();
  const modal = page.getByTestId("owner-add-booking-modal");
  await modal.getByTestId("owner-add-booking-customer").fill("External New");
  await modal.getByTestId("owner-add-booking-phone").fill("0599123456");
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(modal.getByRole("alert")).toBeVisible();
  await expect(modal).toBeVisible();
  await modal.getByTestId("owner-add-booking-save").click();
  await expect(modal).toHaveCount(0);
  expect(state.rows).toHaveLength(1); expect(state.keys).toHaveLength(2); expect(state.keys[0]).toBe(state.keys[1]);
  expect(await page.evaluate(() => localStorage.getItem("wesal_owner_manual_bookings_v1"))).toBe(legacy);
});

test("expired subscription still permits external details editing and cancellation", async ({ page }) => {
  const state = await setup(page, { existing: true, expired: true });
  const day = page.getByTestId("owner-calendar-booked");
  await expect(day.getByTestId("external-booking-actions")).toBeVisible();
  await day.getByTestId("external-booking-actions").getByRole("button").first().click();
  const modal = page.getByTestId("owner-add-booking-modal"); await expect(modal).toBeVisible();
  await modal.getByTestId("owner-add-booking-notes").fill("Updated outside platform");
  await modal.getByTestId("owner-add-booking-save").click(); await expect(modal).toHaveCount(0);
  expect(state.rows[0].notes).toBe("Updated outside platform"); expect(state.revisions[0]).toBe('"1"');
  await day.getByTestId("external-booking-actions").getByRole("button").nth(1).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await dialog.getByRole("button").first().click(); await expect(dialog).toHaveCount(0);
  expect(state.rows[0].status).toBe("Cancelled"); expect(state.revisions[1]).toBe('"2"');
  await expect(page.getByTestId(`hall-cal-day-${state.date}`).getByTestId("owner-cal-booked-dot")).toHaveCount(0);
});
