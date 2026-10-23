import assert from "node:assert/strict";
import fs from "node:fs";
import { mapHallBookingNotification } from "../src/lib/hall-notifications";
import { mapOwnerHallBookingRequestDto } from "../src/lib/owner-hall-booking-requests-mapper";
import { parseOwnerBookingRequestStatus, canAcceptBookingRequest } from "../src/lib/owner-booking-status";
import { groupOwnerNotifications, cardAcceptanceState } from "../src/lib/owner-acceptance-ui";
import { bookingsForDate } from "../src/lib/owner-calendar-bookings";
import { splitClockRangeLabel, formatClockRange } from "../src/lib/hourly-slots";
import { externalToNotification } from "../src/services/owner-external-bookings";
import type { ExternalBooking } from "../src/types/external-booking";

let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`ok - ${name}`); }
const dto = { bookingRequestId: "6f2d54bb-efcf-4ac4-8f70-e395057c7608", hallId: "test-hall", source: "ExternalManual", status: "Confirmed",
  requesterName: "عميل خارجي", requesterPhone: "0599123456", requestedDate: "2026-11-16", externalEventType: "wedding",
  slotStarts: ["14:00:00", "15:00:00"], timeRange: "14:00 - 16:00", revision: 1, canPublish: true, canDelete: true };
const external = mapHallBookingNotification(dto, "test-hall", 0)!;
check("external source and Confirmed state are explicit", () => { assert.equal(external.source, "ExternalManual"); assert.equal(external.status, "Confirmed"); });
check("external bookings cannot acquire online payment/delete capabilities", () => { assert.equal(external.canPublish, false); assert.equal(external.canDelete, false); });
check("numeric Confirmed status is supported", () => assert.equal(parseOwnerBookingRequestStatus(4), "Confirmed"));
check("unknown statuses never become Pending or acceptable", () => { const status = parseOwnerBookingRequestStatus("FutureStatus"); assert.equal(status, "Unknown"); assert.equal(canAcceptBookingRequest(status), false); });
check("confirmed externals are grouped as handled, never deposit pending", () => { const groups = groupOwnerNotifications([external]); assert.equal(groups.handled.length, 1); assert.equal(groups.depositPending.length, 0); assert.equal(groups.pending.length, 0); });
check("confirmed externals use finalized card styling", () => assert.equal(cardAcceptanceState({ status: external.status, accepting: false }), "finalized"));
check("separate owner request mapper retains confirmation, cancellation and event", () => {
  const row = mapOwnerHallBookingRequestDto(dto, "test-hall")!;
  assert.equal(row.status, "Confirmed"); assert.equal(row.eventTypeLabel, "wedding");
  assert.equal(mapOwnerHallBookingRequestDto({ ...dto, status: "3" }, "test-hall")!.status, "Cancelled");
  assert.equal(mapOwnerHallBookingRequestDto({ ...dto, status: "FutureStatus" }, "test-hall"), null);
});
check("calendar renders an external booking once", () => { const rows = bookingsForDate("2026-11-16", [external], undefined, (key) => key, "ar"); assert.equal(rows.length, 1); assert.equal(rows[0].source, "ExternalManual"); assert.equal(rows[0].statusKind, "confirmed"); });
check("online accepted requests keep the deposit workflow", () => { const row = mapHallBookingNotification({ ...dto, source: "Online", status: "Accepted" }, "test-hall", 0)!; assert.equal(row.status, "AcceptedPendingDeposit"); });
check("RTL time range retains two correctly ordered clock chunks", () => { const chunks = splitClockRangeLabel(formatClockRange("14:00", "16:00", "ar")); assert.equal(chunks.length, 2); assert.match(chunks[0], /2:00/); assert.match(chunks[1], /4:00/); });
check("external list adapter preserves persistent ID without customer account", () => { const row = externalToNotification({ bookingId: dto.bookingRequestId, hallId: "test-hall", source: "ExternalManual", status: "Confirmed", date: "2026-11-16", slotStarts: dto.slotStarts, customerName: "Customer", phone: "0599123456", revision: 1, eventType: "wedding" } as ExternalBooking); assert.equal(row.id, dto.bookingRequestId); assert.equal(row.requesterUserId, ""); });
check("live occupancy and notification hooks do not consume legacy storage", () => { for (const file of ["src/hooks/useHallNotifications.ts", "src/components/owner-management/halls/OwnerHallBookingsCalendar.tsx", "src/components/owner-management/halls/OwnerAddBookingModal.tsx"]) { const text = fs.readFileSync(file, "utf8"); assert.doesNotMatch(text, /owner-manual-bookings-store|mergeApiNotificationsWithManual|addOwnerManualBooking/); } });
console.log(`${checks} external booking checks passed`);
