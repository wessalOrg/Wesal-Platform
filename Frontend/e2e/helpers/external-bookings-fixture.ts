import { expect, test, type Page } from "@playwright/test";

// Browser/API contract tests: every API call is intercepted; no account or live API is used.
export const hallId = "947f9b27-58d4-4ec6-9d51-522cb94cd428";
export const bookingId = "936de2f4-f7eb-46c4-995c-9b201dfb13a6";
export const secondHallId = "65f2676c-d018-4492-852f-084ecdbaf089";
export const legacy = JSON.stringify([{ id: "manual-legacy-test", hallId, customerName: "LEGACY ONLY", date: "2026-11-16", timeFrom: "10:00", timeTo: "12:00" }]);
type Row = { bookingId: string; hallId: string; date: string; source: string; status: string; slotStarts: string[]; revision: number; customerName: string; phone: string; eventType: string; notes: string; [key: string]: unknown };

export async function setupExternalBookings(page: Page, options: { existing?: boolean; expired?: boolean; loseFirstResponse?: boolean; ambiguous5xx?: boolean; twoHalls?: boolean; disjoint?: boolean; rejectRetry?: boolean } = {}) {
  // Calendar "today" belongs to the browser timezone, including either side of UTC midnight.
  const date = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const rows: Row[] = options.existing ? [{ bookingId, hallId, date, source: "ExternalManual", status: "Confirmed", slotStarts: ["14:00:00", "15:00:00"], revision: 1, customerName: "External Customer", phone: "0599123456", eventType: "wedding", notes: "", timeRange: "14:00 - 16:00", guests: null, totalAmount: null, amountReceivedExternally: null, confirmedAt: date + "T10:00:00Z", cancelledAt: null, canEdit: true, canCancel: true, canDelete: false, canConfirmDeposit: false }] : [];
  if (options.disjoint) { rows[0].slotStarts = ["10:00:00", "12:00:00"]; rows[0].timeRange = "10:00 - 13:00"; }
  const keys: string[] = []; const revisions: string[] = []; const submissions: Array<{ path: string; input: unknown }> = []; let lost = false;
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
    if (path === "/owner/halls") return json([hallId, ...(options.twoHalls ? [secondHallId] : [])].map((id) => ({ hallId: id, name: id === hallId ? "Contract Hall" : "Second Hall", status: "Approved", paymentStatus: "Paid", subscriptionCycleEnd: "2099-01-01", systemLocked: options.expired ?? false })));
    if (path.endsWith("/external-bookings") && method === "POST") {
      keys.push(route.request().headers()["idempotency-key"]);
      const input = route.request().postDataJSON();
      submissions.push({ path, input });
      if (!rows.length) rows.push({ ...input, bookingId, hallId, source: "ExternalManual", status: "Confirmed", revision: 1, timeRange: "14:00 - 18:00", confirmedAt: date + "T10:00:00Z", cancelledAt: null, canEdit: true, canCancel: true, canConfirmDeposit: false, canDelete: false });
      if ((options.loseFirstResponse || options.ambiguous5xx) && !lost) { lost = true; if (options.rejectRetry) rows.splice(0); return options.ambiguous5xx ? json({ code: "ServiceUnavailable" }, 503) : route.abort("failed"); }
      if (options.rejectRetry && keys.length === 2) { rows.splice(0); return json({ code: "SlotUnavailable" }, 409); }
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
  return { rows, keys, revisions, date, submissions };
}

